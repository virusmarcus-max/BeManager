import type { Employee, WeeklySchedule, TimeOffRequest, StoreSettings } from '../types';

export interface WeeklyHourCalculation {
    empId: string;
    name: string;
    worked: number;
    contract: number;
    amount: number; // The difference/debt adjustment
}

export const calculateWeeklyHours = (
    schedule: WeeklySchedule,
    employees: Employee[],
    settings: StoreSettings,
    timeOffRequests: TimeOffRequest[]
): WeeklyHourCalculation[] => {
    const calculations: WeeklyHourCalculation[] = [];
    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(schedule.weekStartDate);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    // Filter employees relevant to this schedule (establishment check should be done by caller, but we filter by existing shifts or active status if needed)
    // Actually, we should probably iterate over the employees passed in.
    employees.forEach(emp => {
        // Calculate Worked Hours
        const employeeShifts = schedule.shifts.filter(s => s.employeeId === emp.id);
        const workedHours = employeeShifts.reduce((acc, s) => {
            if (s.type === 'morning' || s.type === 'afternoon') {
                if (s.startTime && s.endTime) {
                    const start = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                    const end = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                    return acc + (end - start);
                }
                return acc + 4;
            }
            if (s.type === 'split') {
                if (s.startTime && s.endTime && s.morningEndTime && s.afternoonStartTime) {
                    const mStart = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                    const mEnd = parseInt(s.morningEndTime.split(':')[0]) + parseInt(s.morningEndTime.split(':')[1]) / 60;
                    const aStart = parseInt(s.afternoonStartTime.split(':')[0]) + parseInt(s.afternoonStartTime.split(':')[1]) / 60;
                    const aEnd = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                    return acc + (mEnd - mStart) + (aEnd - aStart);
                }
                return acc + 8;
            }
            return acc;
        }, 0);

        // Calculate Target Hours
        let targetHours = emp.weeklyHours;

        // Check for Temporary Hours (Ampliaciones)
        if (emp.tempHours && emp.tempHours.length > 0) {
            const activeTemp = emp.tempHours.find(t => schedule.weekStartDate >= t.start && schedule.weekStartDate <= t.end);
            if (activeTemp) {
                targetHours = activeTemp.hours;
            }
        }

        // Calculate Reduction based on Holidays and Absences
        const currentHolidays = settings.holidays || [];
        const contractHours = targetHours; // Snapshot of contract hours before reduction

        let numDaysToReduce = 0;
        weekDates.forEach(d => {
            const h = currentHolidays.find((holiday: any) => (typeof holiday === 'string' ? holiday : holiday.date) === d);
            const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');
            const isPartialHoliday = h && typeof h !== 'string' && (h.type === 'afternoon' || h.type === 'closed_afternoon');

            const isAbsence = timeOffRequests.some(r =>
                r.employeeId === emp.id &&
                (r.type === 'vacation' || r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                (
                    (r.dates && r.dates.includes(d)) ||
                    (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate)
                )
            );

            if (isFullHoliday || isAbsence) {
                numDaysToReduce++;
            } else if (isPartialHoliday && contractHours === 40) {
                // EXCEPTION: 40h employees get 0.5 reduction for partial holidays
                numDaysToReduce += 0.5;
            }
        });

        const rReduction = Math.round(numDaysToReduce * 10) / 10;
        const baseHours = targetHours;

        // Reduction Table
        const reductionTable: Record<number, number[]> = {
            40: [36, 32, 28, 24, 16],
            36: [33, 30, 27, 23, 18],
            32: [30, 27, 24, 21, 16],
            28: [25, 23, 21, 19, 14],
            24: [22, 20, 18, 16, 12],
            20: [18, 17, 15, 13, 10],
            16: [14, 13, 12, 10, 8]
        };

        // Apply Reduction
        let effectiveTargetHours = targetHours;
        if (rReduction > 0) {
            const tableRow = reductionTable[baseHours];
            if (tableRow) {
                if (rReduction === 0.5) effectiveTargetHours = tableRow[0];
                else if (rReduction === 1) effectiveTargetHours = tableRow[1];
                else if (rReduction === 1.5) effectiveTargetHours = tableRow[2];
                else if (rReduction === 2) effectiveTargetHours = tableRow[3];
                else if (rReduction === 3) effectiveTargetHours = tableRow[4];
                else if (rReduction >= 5) {
                    effectiveTargetHours = 0;
                }
                else if (rReduction > 3) {
                    effectiveTargetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                }
            } else {
                effectiveTargetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
            }
        }

        // Round to 1 decimal
        let diff = Math.round((workedHours - effectiveTargetHours) * 10) / 10;

        // Check for Full Absence (Full week vacation/sick/holidays) - if so, diff should be 0? 
        // Existing logic says: if isFullAbsence, diff = 0.
        // Full absence means NO shifts other than off/holiday/vacation/sick.
        const nonOffShifts = employeeShifts.filter(s => s.type !== 'off' && s.type !== 'holiday');
        const isFullAbsence = nonOffShifts.length > 0 && nonOffShifts.every(s => s.type === 'vacation' || s.type === 'sick_leave');

        // Also if they have NO shifts at all? No, that's debt/absenteeism usually.
        // But if explicitly sick/vacation for all "working" slots...
        if (isFullAbsence) {
            diff = 0;
        }

        if (diff !== 0) {
            calculations.push({
                empId: emp.id,
                name: emp.name,
                worked: Math.round(workedHours * 10) / 10,
                contract: effectiveTargetHours, // Show the reduced target
                amount: diff
            });
        }
    });

    return calculations;
};
