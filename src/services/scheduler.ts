import type { Employee, Shift, WeeklySchedule, ShiftType, TimeOffRequest, StoreSettings, PermanentRequest } from '../types';
import { getWeekDates } from './dateUtils';



export const generateWeeklySchedule = (
    establishmentId: string,
    employees: Employee[],
    weekStartDate: string,
    holidays: { date: string; type: 'full' | 'afternoon' | 'closed_afternoon' }[] = [],
    timeOffRequests: TimeOffRequest[] = [],
    settings?: StoreSettings,
    permanentRequests: PermanentRequest[] = []
): WeeklySchedule => {
    const shifts: Shift[] = [];

    // Helper to identify Key Roles
    const isKeyRole = (category: string) => ['Gerente', 'Subgerente', 'Responsable'].includes(category);

    // 1. Prepare Dates (Mon-Sun)
    const weekDates: string[] = [];
    const startDate = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
    }

    // 2. Initialize Coverage Map to track load
    // date -> { morning: count, afternoon: count, keyStaff: count }
    const coverage: Record<string, { morning: number, afternoon: number, keyStaff: number }> = {};
    weekDates.forEach(d => coverage[d] = { morning: 0, afternoon: 0, keyStaff: 0 });

    // Helper to get load
    const getLoad = (date: string, period: 'morning' | 'afternoon') => coverage[date]?.[period] || 0;
    const getTotalLoad = (date: string) => (coverage[date]?.morning || 0) + (coverage[date]?.afternoon || 0);

    // Sort employees: 
    // 1. Key Roles FIRST (Gerente > Subgerente > Responsable) to ensure they anchor the coverage
    // 2. Then High hours
    const rolePriority = { 'Gerente': 4, 'Subgerente': 3, 'Responsable': 2, 'Empleado': 1, 'Limpieza': 0 };

    const sortedEmployees = [...employees]
        .filter(emp => emp.active)
        .sort((a, b) => {
            const pA = rolePriority[a.category as keyof typeof rolePriority] || 0;
            const pB = rolePriority[b.category as keyof typeof rolePriority] || 0;
            if (pA !== pB) return pB - pA; // Higher priority first
            return b.weeklyHours - a.weeklyHours; // Then hours
        });

    sortedEmployees.forEach(emp => {
        // Determine weekly hours for this specific week
        let effectiveHours = emp.weeklyHours;

        // Check for Temporary Hours Adjustment covering this week
        // We look for any overlap or if the week start is inside the range
        // For simplicity, if the weekStartDate is inside a temp range, we use that.
        // Or if the majority of the week is inside.
        // Let's check if the weekStartDate is within a tempHours range.
        if (emp.tempHours && emp.tempHours.length > 0) {
            const activeTemp = emp.tempHours.find(t => {
                return weekStartDate >= t.start && weekStartDate <= t.end;
            });
            if (activeTemp) {
                effectiveHours = activeTemp.hours;
            }
        }

        // Calculate target hours based on holidays AND vacations
        let numDaysToReduce = 0;
        weekDates.forEach(d => {
            const h = holidays.find(h => (typeof h === 'string' ? h : h.date) === d);
            const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');
            const isPartialHoliday = h && typeof h !== 'string' && (h.type === 'afternoon' || h.type === 'closed_afternoon');

            const isAbsence = timeOffRequests.some(r =>
                r.employeeId === emp.id &&
                (r.type === 'vacation' || r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                (r.dates.includes(d) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
            );

            if (isFullHoliday || isAbsence) {
                numDaysToReduce += 1;
            } else if (isPartialHoliday && effectiveHours === 40) {
                // EXCEPTION: 40h employees get 0.5 reduction for partial holidays
                numDaysToReduce += 0.5;
            }
        });

        // Calculate target hours with holiday/vacation deduction based on table
        let targetHours = effectiveHours;

        // Key: Contracted Hours
        // Columns correspond to days to reduce: [0.5, 1, 1.5, 2, 3]
        const reductionTable: Record<number, number[]> = {
            40: [36, 32, 28, 24, 16],
            36: [33, 30, 27, 23, 18],
            32: [30, 27, 24, 21, 16],
            28: [25, 23, 21, 19, 14],
            24: [22, 20, 18, 16, 12],
            20: [18, 17, 15, 13, 10],
            16: [14, 13, 12, 10, 8]
        };

        if (numDaysToReduce > 0) {
            const tableRow = reductionTable[effectiveHours];
            if (tableRow) {
                if (numDaysToReduce === 0.5) targetHours = tableRow[0];
                else if (numDaysToReduce === 1) targetHours = tableRow[1];
                else if (numDaysToReduce === 1.5) targetHours = tableRow[2];
                else if (numDaysToReduce === 2) targetHours = tableRow[3];
                else if (numDaysToReduce === 3) targetHours = tableRow[4];
                // Fallback / combinations not in exact table columns
                else if (numDaysToReduce >= 5) {
                    targetHours = 0;
                }
                else if (numDaysToReduce > 3) {
                    targetHours = Math.max(0, effectiveHours - Math.round((effectiveHours / 5) * numDaysToReduce));
                }
            } else {
                // Fallback for non-standard hours
                targetHours = Math.max(0, effectiveHours - Math.round((effectiveHours / 5) * numDaysToReduce));
            }
        }

        // Permanent Constraints
        const userPermRequests = permanentRequests.filter(r =>
            r.employeeId === emp.id &&
            (!r.exceptions || !r.exceptions.includes(weekStartDate))
        );
        const globalMorningOnly = userPermRequests.some(r => r.type === 'morning_only');
        const globalAfternoonOnly = userPermRequests.some(r => r.type === 'afternoon_only');
        const hasEarlyMorningPerm = userPermRequests.some(r => r.type === 'early_morning_shift'); // Check for early morning

        const maxAfternoonsReq = userPermRequests.find(r => r.type === 'max_afternoons_per_week');
        const maxAfternoons = maxAfternoonsReq ? (maxAfternoonsReq.value || 3) : 99; // Default high if no limit

        // Adjust slots for Early Morning Shift (consumes 1 extra hour for 4 days = 4 hours = 1 slot)
        let slotsNeeded = Math.round(targetHours / 4);
        if (hasEarlyMorningPerm && targetHours >= 20) {
            slotsNeeded -= 1;
        }
        let slotsRemaining = slotsNeeded;

        let afternoonsAssignedCount = 0;

        // Pre-calculate available days
        const availableDays: string[] = [];
        const dayStatus: Record<string, ShiftType> = {};

        weekDates.forEach(date => {
            const dateObj = new Date(date);
            const isSunday = dateObj.getDay() === 0;
            const isOpenSunday = settings?.openSundays?.includes(date);
            const dayOfWeek = dateObj.getDay(); // 0 Sun, 1 Mon...
            // Handle new object structure or legacy string
            const holidayObj = holidays.find(h => (typeof h === 'string' ? h : h.date) === date);
            const isFullHoliday = holidayObj && (typeof holidayObj === 'string' || holidayObj.type === 'full');

            const timeOffReq = timeOffRequests.find(r =>
                r.employeeId === emp.id &&
                (r.dates.includes(date) || (r.startDate && r.endDate && date >= r.startDate && date <= r.endDate))
            );

            // Check permanent days off
            let permDayOff = userPermRequests.find(r => r.type === 'specific_days_off' && r.days?.includes(dayOfWeek));

            if (!permDayOff) {
                const rotReq = userPermRequests.find(r => r.type === 'rotating_days_off' && r.cycleWeeks && r.referenceDate);
                if (rotReq && rotReq.cycleWeeks && rotReq.referenceDate) {
                    const cycleStart = new Date(rotReq.referenceDate);
                    const currentWeek = new Date(weekStartDate);
                    // Calculate difference in weeks. Careful with timezone but usually safe if both YYYY-MM-DD
                    const diffTime = currentWeek.getTime() - cycleStart.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    const diffWeeks = Math.floor(diffDays / 7);

                    if (diffWeeks >= 0) {
                        const cycleIndex = diffWeeks % rotReq.cycleWeeks.length;
                        const daysOffThisWeek = rotReq.cycleWeeks[cycleIndex];
                        if (daysOffThisWeek && daysOffThisWeek.includes(dayOfWeek)) {
                            permDayOff = rotReq;
                        }
                    }
                }
            }

            if (!permDayOff) {
                const fixedRotReq = userPermRequests.find(r => r.type === 'fixed_rotating_shift' && r.referenceDate && r.value !== undefined);
                if (fixedRotReq && fixedRotReq.referenceDate) {
                    const cycleStart = new Date(fixedRotReq.referenceDate);
                    const currentWeek = new Date(weekStartDate);
                    const diffTime = currentWeek.getTime() - cycleStart.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    const diffWeeks = Math.floor(diffDays / 7);

                    if (diffWeeks >= 0) {
                        // Rotation index: Mon(1) to Sat(6). 6 days cycle.
                        const startDay = fixedRotReq.value || 1;
                        const currentOffDay = 1 + ((startDay - 1 + diffWeeks) % 6);
                        if (dayOfWeek === currentOffDay) {
                            permDayOff = fixedRotReq;
                        }
                    }
                }
            }

            if (timeOffReq?.type === 'sick_leave') dayStatus[date] = 'sick_leave';
            else if (timeOffReq?.type === 'maternity_paternity') dayStatus[date] = 'maternity_paternity';
            else if (timeOffReq?.type === 'vacation') dayStatus[date] = 'vacation';
            else if (isFullHoliday) dayStatus[date] = 'holiday';
            else if (timeOffReq?.type === 'day_off') dayStatus[date] = 'off';
            else if (permDayOff) dayStatus[date] = 'off'; // Permanent Day Off
            else if (isSunday && !isOpenSunday) dayStatus[date] = 'off';
            // Note: Afternoon holiday doesn't set dayStatus because we still work in the morning
            else availableDays.push(date);
        });

        const assignedShifts: Record<string, ShiftType> = {};

        // Strategy Selection
        const hasForceFullDays = userPermRequests.some(r => r.type === 'force_full_days');

        // Use High Hours Strategy (Split shifts priority) if hours >= 40 OR explicitly requested (e.g. 32h users wanting full days off)
        const isHighHours = emp.weeklyHours >= 40 || hasForceFullDays;

        if (isHighHours) {
            // STRATEGY: Full Days (Split) to leave other days empty
            // We need `slotsRemaining / 2` days.
            // We should pick days that are currently LEAST loaded to balance the week.

            // Filter days that might have partial blocks (morning_off etc) - treat as unavailable for split logic for simplicity or handle gracefully
            // For MVP, we filter for fully available days
            const fullyAvailableDays = availableDays.filter(d => {
                const req = timeOffRequests.find(r =>
                    r.employeeId === emp.id &&
                    (r.dates.includes(d) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
                );
                return !req || (req.type !== 'morning_off' && req.type !== 'afternoon_off');
            });

            // Sort days by current Total Load (Ascending) -> Balance the week
            // AND Priority for Key Staff: Fill Empty Coverage days first
            const isKeyEmp = isKeyRole(emp.category);

            fullyAvailableDays.sort((a, b) => {
                // 1. Key Coverage Priority
                if (isKeyEmp) {
                    const covA = coverage[a].keyStaff === 0 ? -1 : 0;
                    const covB = coverage[b].keyStaff === 0 ? -1 : 0;
                    if (covA !== covB) return covA - covB; // -1 comes first
                }

                // 2. Total Load Balance
                return getTotalLoad(a) - getTotalLoad(b);
            });

            // Assign Split shifts
            for (const day of fullyAvailableDays) {
                const dayObj = new Date(day);
                const dayOfWeek = dayObj.getDay();

                // Check specific restrictions for this day
                const morningRestriction = userPermRequests.find(r => r.type === 'morning_only');
                const afternoonRestriction = userPermRequests.find(r => r.type === 'afternoon_only');

                const isMorningOnlyDay = morningRestriction && (!morningRestriction.days || morningRestriction.days.length === 0 || morningRestriction.days.includes(dayOfWeek));
                const isAfternoonOnlyDay = afternoonRestriction && (!afternoonRestriction.days || afternoonRestriction.days.length === 0 || afternoonRestriction.days.includes(dayOfWeek));

                // Get holiday info for this day again
                const hObj = holidays.find(h => typeof h === 'string' ? h === day : h.date === day);
                const isAfternoonClosed = hObj && typeof hObj !== 'string' && (hObj.type === 'afternoon' || hObj.type === 'closed_afternoon');

                // Check Afternoon Limit
                if (afternoonsAssignedCount >= maxAfternoons) continue;

                // Restrict split if global preference exists (e.g. Morning Only profile -> No Split)
                if ((globalMorningOnly || globalAfternoonOnly) && !hasForceFullDays) continue;

                // SATURDAY ROTATION LOGIC (Heuristic)
                // Attempt to give Saturday off if it's "their turn"
                // Seed based on week start date integer representation + employee index
                if (dayOfWeek === 6) { // Saturday
                    const weekTime = new Date(weekStartDate).getTime();
                    const weekNum = Math.floor(weekTime / (7 * 24 * 60 * 60 * 1000));
                    const empIndex = employees.findIndex(e => e.id === emp.id);
                    const isTurnForOff = (weekNum + empIndex) % 4 === 0;

                    // If Key Staff and Coverage is 0, IGNORE rotation (Must Work)
                    const mustCover = isKeyEmp && coverage[day].keyStaff === 0;

                    if (isTurnForOff && !mustCover) {
                        // Deprioritize Saturday for this user -> skip split assignment on Saturday if possible
                        // But only if we have enough OTHER days to fill slots
                        const otherDaysCount = fullyAvailableDays.length - 1;
                        if (otherDaysCount >= Math.ceil(slotsRemaining / 2)) {
                            continue;
                        }
                    }
                }

                // Cannot do split if forced Morning Only or Afternoon Only on this specific day
                // OR if afternoon is closed due to holiday
                if (isMorningOnlyDay || isAfternoonOnlyDay || isAfternoonClosed) continue;

                if (slotsRemaining >= 2) {
                    assignedShifts[day] = 'split';
                    coverage[day].morning++;
                    coverage[day].afternoon++;
                    if (isKeyEmp) coverage[day].keyStaff++;
                    slotsRemaining -= 2;
                    afternoonsAssignedCount++;
                }
            }

            // If any slots remaining (odd number? shouldn't happen with 32/40 but maybe 36?), fill individually later
        }

        // Fill remaining slots (for Low hours OR leftovers from High hours OR constraints preventing split)
        if (slotsRemaining > 0) {
            // Create a list of all possible slots: (Date, Period)
            // That are available for this user
            const possibleSlots: { date: string, period: 'morning' | 'afternoon', load: number }[] = [];

            // Re-calculate isKeyEmp in this scope
            const isKeyEmp = isKeyRole(emp.category);

            availableDays.forEach(date => {
                // Check if day already taken by Split above
                if (assignedShifts[date]) return;

                const req = timeOffRequests.find(r =>
                    r.employeeId === emp.id &&
                    (r.dates.includes(date) || (r.startDate && r.endDate && date >= r.startDate && date <= r.endDate))
                );
                const dayObj = new Date(date);
                const dayOfWeek = dayObj.getDay();

                // Check specific restrictions for this day
                const morningRestriction = userPermRequests.find(r => r.type === 'morning_only');
                const afternoonRestriction = userPermRequests.find(r => r.type === 'afternoon_only');

                const isMorningOnlyDay = morningRestriction && (!morningRestriction.days || morningRestriction.days.length === 0 || morningRestriction.days.includes(dayOfWeek));
                const isAfternoonOnlyDay = afternoonRestriction && (!afternoonRestriction.days || afternoonRestriction.days.length === 0 || afternoonRestriction.days.includes(dayOfWeek));

                // Holiday check
                const hObj = holidays.find(h => typeof h === 'string' ? h === date : h.date === date);
                const isAfternoonClosed = hObj && typeof hObj !== 'string' && (hObj.type === 'afternoon' || hObj.type === 'closed_afternoon');

                const canMorning = (!req || req.type !== 'morning_off') && !isAfternoonOnlyDay;

                // Can Afternoon if not off, not morning only, not closed, AND limit not reached
                // Note: We check limit here, BUT for prioritization we assume we can add it. 
                // We will check 'afternoonsAssignedCount' strictly during assignment loop.
                const canAfternoon = (!req || req.type !== 'afternoon_off') && !isMorningOnlyDay && !isAfternoonClosed;

                // Priority Modification
                let slotPenalty = 0;

                // RESTRICTION PRIORITY
                if (isMorningOnlyDay || isAfternoonOnlyDay) {
                    slotPenalty -= 50;
                }

                // KEY STAFF COVERAGE PRIORITY
                if (isKeyEmp && coverage[date].keyStaff === 0) {
                    slotPenalty -= 2000;
                }

                // Base penalty for Saturday/Sunday REMOVED
                if (dayOfWeek === 6 || dayOfWeek === 0) slotPenalty += 0;

                if (dayOfWeek === 6) {
                    const weekTime = new Date(weekStartDate).getTime();
                    const weekNum = Math.floor(weekTime / (7 * 24 * 60 * 60 * 1000));
                    const empIndex = employees.findIndex(e => e.id === emp.id);
                    const isTurnForOff = (weekNum + empIndex) % 4 === 0;

                    // If Must Cover (Coverage 0), ignore rotation
                    const mustCover = isKeyEmp && coverage[date].keyStaff === 0;

                    if (isTurnForOff && !mustCover) {
                        // Reduced from 1000 to 5 to allow balancing if load is very uneven
                        slotPenalty += 5;
                    }
                }

                if (canMorning) {
                    possibleSlots.push({
                        date,
                        period: 'morning',
                        // Weight: Current Load + Bias
                        load: getLoad(date, 'morning') + slotPenalty
                    });
                }
                if (canAfternoon) {
                    possibleSlots.push({
                        date,
                        period: 'afternoon',
                        load: getLoad(date, 'afternoon') + 0.5 + slotPenalty // Preference to Morning
                    });
                }
            });

            // Sort by Load Ascending
            possibleSlots.sort((a, b) => a.load - b.load);

            // Pick the best slots
            for (const slot of possibleSlots) {
                if (slotsRemaining <= 0) break;

                // STRICT LIMIT CHECK
                if (slot.period === 'afternoon' && afternoonsAssignedCount >= maxAfternoons) continue;

                // Re-calculate local restrictions for upgrade check
                const currentType = assignedShifts[slot.date];

                if (!currentType) {
                    assignedShifts[slot.date] = slot.period;
                    coverage[slot.date][slot.period]++;
                    if (isKeyEmp) coverage[slot.date].keyStaff++;
                    slotsRemaining--;
                    if (slot.period === 'afternoon') afternoonsAssignedCount++;
                } else if (currentType !== 'split' && currentType !== slot.period) {
                    // We have one side, adding the other -> Split
                    // Only allowed if NOT morningOnly/afternoonOnly GLOBAL (prevent accidental splits for mono-turn profiles)
                    // AND afternoon limit not reached
                    // AND afternoon is NOT CLOSED
                    const slotHoliday = holidays.find(h => typeof h === 'string' ? h === slot.date : h.date === slot.date);
                    const isSlotAfternoonClosed = slotHoliday && typeof slotHoliday !== 'string' && (slotHoliday.type === 'afternoon' || slotHoliday.type === 'closed_afternoon');

                    if (!globalMorningOnly && !globalAfternoonOnly && !isSlotAfternoonClosed) {
                        if (afternoonsAssignedCount < maxAfternoons) {
                            assignedShifts[slot.date] = 'split'; // Upgrade
                            coverage[slot.date][slot.period]++;
                            slotsRemaining--;
                            afternoonsAssignedCount++;
                        }
                    }
                }
            }
        }

        // Determine which dates should get the permanent early morning shift (spread out)
        const earlyMorningDates = new Set<string>();
        if (hasEarlyMorningPerm) {
            const workingMorningDates = weekDates.filter(d =>
                (assignedShifts[d] === 'morning' || assignedShifts[d] === 'split') &&
                !dayStatus[d] // Ensure not off/holiday implicitly
            );

            const targetCount = 4;
            if (workingMorningDates.length <= targetCount) {
                workingMorningDates.forEach(d => earlyMorningDates.add(d));
            } else {
                // Distribute spread out
                // Heuristic: Pick indices based on even spacing
                // e.g. 5 days (0..4), pick 4 -> 0, 1, 3, 4
                // e.g. 6 days (0..5), pick 4 -> 0, 2, 3, 5
                for (let i = 0; i < targetCount; i++) {
                    const index = Math.round(i * (workingMorningDates.length - 1) / (targetCount - 1));
                    earlyMorningDates.add(workingMorningDates[index]);
                }
            }
        }

        // Finalize Shifts object
        weekDates.forEach(date => {
            let type = assignedShifts[date] || dayStatus[date];

            // Handle requests if we ignored them and assigned nothing
            const timeOffReq = timeOffRequests.find(r =>
                r.employeeId === emp.id &&
                (r.dates.includes(date) || (r.startDate && r.endDate && date >= r.startDate && date <= r.endDate))
            );
            if (!assignedShifts[date]) {
                if (timeOffReq?.type === 'morning_off' || timeOffReq?.type === 'afternoon_off') {
                    // If we didn't assign work, and they asked for partial off, they are effectively OFF that day or just that part?
                    // They are OFF the whole day if we assigned no shifts.
                    type = 'off';
                } else if (!type) {
                    type = 'off';
                }
            }

            // Assign Times
            let startTime: string | undefined;
            let endTime: string | undefined;
            let morningEndTime: string | undefined;
            let afternoonStartTime: string | undefined;

            if (settings && type !== 'off' && type !== 'holiday' && type !== 'vacation' && type !== 'sick_leave' && type !== 'maternity_paternity') {
                // Check for one-off request first
                const earlyMorningOneOff = timeOffRequests.find(r =>
                    r.employeeId === emp.id &&
                    r.type === 'early_morning_shift' &&
                    (r.dates.includes(date) || (r.startDate && r.endDate && date >= r.startDate && date <= r.endDate))
                );

                // Check for permanent request (limit to 4 days per week)
                let shouldApplyEarlyMorning = !!earlyMorningOneOff;
                if (!shouldApplyEarlyMorning && earlyMorningDates.has(date)) {
                    shouldApplyEarlyMorning = true;
                }

                if (type === 'morning') {
                    if (shouldApplyEarlyMorning) {
                        startTime = '09:00';
                        endTime = '14:00';
                    } else {
                        startTime = settings.openingHours.morningStart;
                        endTime = settings.openingHours.morningEnd;
                    }
                } else if (type === 'afternoon') {
                    startTime = settings.openingHours.afternoonStart;
                    endTime = settings.openingHours.afternoonEnd;
                } else if (type === 'split') {
                    if (shouldApplyEarlyMorning) {
                        startTime = '09:00';
                        morningEndTime = '14:00';
                    } else {
                        startTime = settings.openingHours.morningStart;
                        morningEndTime = settings.openingHours.morningEnd;
                    }
                    endTime = settings.openingHours.afternoonEnd;
                    afternoonStartTime = settings.openingHours.afternoonStart;
                }
            }

            shifts.push({
                id: crypto.randomUUID(),
                employeeId: emp.id,
                date: date,
                type: type as ShiftType,
                startTime,
                endTime,
                morningEndTime,
                afternoonStartTime
            });
        });
    });

    return {
        id: crypto.randomUUID(),
        establishmentId,
        weekStartDate,
        shifts,
        status: 'draft'
    };
};

export const validatePermanentRestrictions = (
    schedule: WeeklySchedule,
    permanentRequests: PermanentRequest[],
    employees: Employee[],
    ignoreExceptions: boolean = false
): string[] => {
    const warnings: string[] = [];

    permanentRequests.forEach(req => {
        const emp = employees.find(e => e.id === req.employeeId);
        if (!emp) return;

        const empShifts = schedule.shifts.filter(s => s.employeeId === req.employeeId);

        // Filter exceptions
        if (!ignoreExceptions && req.exceptions?.includes(schedule.weekStartDate)) {
            // console.log(`Skipping restriction for ${emp.name} (${req.type}) due to exception for week ${schedule.weekStartDate}`);
            return;
        }



        // Helper for safe day index (0-6)
        const getDayIndex = (dateStr: string) => {
            const d = new Date(dateStr + 'T12:00:00');
            return d.getDay();
        };

        if (req.type === 'specific_days_off' && req.days) {
            req.days.forEach(dayIndex => {
                const shift = empShifts.find(s => getDayIndex(s.date) === dayIndex);
                if (shift && shift.type !== 'off' && shift.type !== 'holiday' && shift.type !== 'vacation' && shift.type !== 'sick_leave' && shift.type !== 'maternity_paternity') {
                    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                    warnings.push(`Restricción Violada: ${emp.name} tiene "Día Libre Fijo" el ${dayName} pero tiene turno asignado (${shift.type === 'morning' ? 'Mañana' : shift.type === 'afternoon' ? 'Tarde' : 'Partido'}).`);
                }
            });
        }

        if (req.type === 'morning_only') {
            empShifts.forEach(s => {
                const dayIndex = getDayIndex(s.date);
                const appliesToDay = !req.days || req.days.length === 0 || req.days.includes(dayIndex);

                if (appliesToDay) {
                    if (s.type === 'afternoon' || s.type === 'split') {
                        const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                        warnings.push(`Restricción Violada: ${emp.name} tiene "Solo Mañanas" pero tiene turno de ${s.type === 'afternoon' ? 'Tarde' : 'Partido'} el ${dayName}.`);
                    }
                }
            });
        }

        if (req.type === 'afternoon_only') {
            empShifts.forEach(s => {
                const dayIndex = getDayIndex(s.date);
                const appliesToDay = !req.days || req.days.length === 0 || req.days.includes(dayIndex);

                if (appliesToDay) {
                    if (s.type === 'morning' || s.type === 'split') {
                        const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                        warnings.push(`Restricción Violada: ${emp.name} tiene "Solo Tardes" pero tiene turno de ${s.type === 'morning' ? 'Mañana' : 'Partido'} el ${dayName}.`);
                    }
                }
            });
        }


        if (req.type === 'max_afternoons_per_week') {
            let afternoonCount = 0;
            empShifts.forEach(s => {
                if (s.type === 'afternoon' || s.type === 'split') afternoonCount++;
            });
            const max = req.value !== undefined ? req.value : 3;
            if (afternoonCount > max) {
                warnings.push(`Restricción Violada: ${emp.name} excede el máximo de tardes permitidas (${max}). Tiene ${afternoonCount}.`);
            }
        }

        if (req.type === 'rotating_days_off' && req.cycleWeeks && req.referenceDate) {
            const cycleStart = new Date(req.referenceDate);
            const currentWeek = new Date(schedule.weekStartDate);
            const diffTime = currentWeek.getTime() - cycleStart.getTime();
            const diffWeeks = Math.floor(Math.round(diffTime / (1000 * 60 * 60 * 24)) / 7);

            if (diffWeeks >= 0) {
                const cycleIndex = diffWeeks % req.cycleWeeks.length;
                const daysOff = req.cycleWeeks[cycleIndex];

                if (daysOff && daysOff.length > 0) {
                    daysOff.forEach(dayIndex => {
                        const shift = empShifts.find(s => getDayIndex(s.date) === dayIndex);
                        if (shift && shift.type !== 'off' && shift.type !== 'holiday' && shift.type !== 'vacation' && shift.type !== 'sick_leave' && shift.type !== 'maternity_paternity') {
                            const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                            warnings.push(`Restricción Violada (Rotativo): ${emp.name} debe librar el ${dayName} esta semana (Semana ${cycleIndex + 1} del ciclo) pero tiene turno.`);
                        }
                    });
                }
            }
        }

        if (req.type === 'fixed_rotating_shift' && req.referenceDate && req.value !== undefined) {
            const cycleStart = new Date(req.referenceDate);
            const currentWeek = new Date(schedule.weekStartDate);
            const diffTime = currentWeek.getTime() - cycleStart.getTime();
            const diffWeeks = Math.floor(Math.round(diffTime / (1000 * 60 * 60 * 24)) / 7);

            if (diffWeeks >= 0) {
                const startDay = req.value || 1;
                const currentOffDayIndex = (startDay - 1 + diffWeeks) % 6;
                const currentOffDay = 1 + currentOffDayIndex;

                const shift = empShifts.find(s => getDayIndex(s.date) === currentOffDay);
                if (shift && shift.type !== 'off' && shift.type !== 'holiday' && shift.type !== 'vacation' && shift.type !== 'sick_leave' && shift.type !== 'maternity_paternity') {
                    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][currentOffDay];
                    warnings.push(`Restricción Violada (Turno Rotativo Fijo): ${emp.name} debe librar el ${dayName} esta semana pero tiene turno.`);
                }
            }
        }
    });

    return warnings;
};

export const validateRegisterCoverage = (schedule: WeeklySchedule, settings: StoreSettings): string[] => {
    const warnings: string[] = [];
    const weekDates = getWeekDates(schedule.weekStartDate);

    weekDates.forEach(date => {
        const dateObj = new Date(date);
        const isSunday = dateObj.getDay() === 0;
        const isOpenSunday = settings.openSundays?.includes(date);
        const holiday = settings.holidays?.find(h => h.date === date);

        // Skip if store is closed
        if (isSunday && !isOpenSunday) return;
        if (holiday?.type === 'full') return;

        const dayShifts = schedule.shifts.filter(s =>
            s.date === date &&
            s.type !== 'off' &&
            s.type !== 'holiday' &&
            s.type !== 'vacation' &&
            s.type !== 'sick_leave' &&
            s.type !== 'maternity_paternity'
        );

        const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        // Morning checks
        const morningSales = dayShifts.some(s => s.role === 'sales_register' && (s.type === 'morning' || s.type === 'split'));
        const morningPurchase = dayShifts.some(s => s.role === 'purchase_register' && (s.type === 'morning' || s.type === 'split'));

        if (!morningSales) warnings.push(`Falta Caja de Ventas (MAÑANA) el ${dayName}`);
        if (!morningPurchase) warnings.push(`Falta Caja de Compras (MAÑANA) el ${dayName}`);

        // Afternoon checks (skip if afternoon closure)
        if (holiday?.type !== 'afternoon' && holiday?.type !== 'closed_afternoon') {
            const afternoonSales = dayShifts.some(s => s.role === 'sales_register' && (s.type === 'afternoon' || s.type === 'split'));
            const afternoonPurchase = dayShifts.some(s => s.role === 'purchase_register' && (s.type === 'afternoon' || s.type === 'split'));

            if (!afternoonSales) warnings.push(`Falta Caja de Ventas (TARDE) el ${dayName}`);
            if (!afternoonPurchase) warnings.push(`Falta Caja de Compras (TARDE) el ${dayName}`);
        }
    });

    return warnings;
};
