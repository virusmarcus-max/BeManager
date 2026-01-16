import type { Employee, Shift, WeeklySchedule, ShiftType, TimeOffRequest, StoreSettings, PermanentRequest } from '../types';
import { getWeekDates } from './dateUtils';



// Helper for randomization
function shuffleArray<T>(array: T[]): T[] {
    const randomValues = new Uint32Array(array.length);
    if (typeof crypto !== 'undefined') {
        crypto.getRandomValues(randomValues);
    } else {
        for (let i = 0; i < array.length; i++) randomValues[i] = Math.floor(Math.random() * 1000000);
    }

    for (let i = array.length - 1; i > 0; i--) {
        // Use the proper modulo bias-free? MVP sufficient
        const j = randomValues[i] % (i + 1);
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export const generateWeeklySchedule = (
    establishmentId: string,
    employees: Employee[],
    weekStartDate: string,
    holidays: { date: string; type: 'full' | 'afternoon' | 'closed_afternoon' }[] = [],
    timeOffRequests: TimeOffRequest[] = [],
    settings?: StoreSettings,
    permanentRequests: PermanentRequest[] = []
): WeeklySchedule => {
    console.log('[Scheduler] Generating Schedule for:', weekStartDate);
    console.log('[Scheduler] Holidays Input:', JSON.stringify(holidays));
    console.log('[Scheduler] Employees Count:', employees.length);
    const shifts: Shift[] = [];

    // 1. Prepare Dates (Mon-Sun)
    const weekDates: string[] = [];
    const startDate = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
    }

    // 2. Initialize Coverage Map to track load
    // date -> { morning: count, afternoon: count }
    const coverage: Record<string, { morning: number, afternoon: number }> = {};
    weekDates.forEach(d => coverage[d] = { morning: 0, afternoon: 0 });

    // Helper to get load
    const getLoad = (date: string, period: 'morning' | 'afternoon') => coverage[date]?.[period] || 0;
    const getTotalLoad = (date: string) => (coverage[date]?.morning || 0) + (coverage[date]?.afternoon || 0);

    // 4. Sort Employees primarily by Weekly Hours
    // Randomize initially to avoid bias in "First Come First Served" for equal hours
    // Explicit Random Tie-Breaker Map
    // Explicit Random Tie-Breaker Map - Regenerate every time to ensure randomness
    const empTieBreaker = new Map<string, number>();
    const empRandomValues = new Uint32Array(employees.length);
    if (typeof crypto !== 'undefined') {
        crypto.getRandomValues(empRandomValues);
    } else {
        // Fallback for non-crypto environments
        for (let i = 0; i < employees.length; i++) empRandomValues[i] = Math.floor(Math.random() * 1000000);
    }
    employees.forEach((e, i) => empTieBreaker.set(e.id, empRandomValues[i]));
    console.log('[Scheduler] Employee Tie-Breakers generated');

    const sortedEmployees = [...employees]
        .filter(emp => emp.active)
        .sort((a, b) => {
            // 1. Full Time (>= 40h) First
            const fullTimeA = a.weeklyHours >= 40;
            const fullTimeB = b.weeklyHours >= 40;
            if (fullTimeA && !fullTimeB) return -1;
            if (!fullTimeA && fullTimeB) return 1;

            // 2. Descending Hours
            if (a.weeklyHours !== b.weeklyHours) {
                return b.weeklyHours - a.weeklyHours;
            }

            // 3. Explicit Random Tie-Break
            return (empTieBreaker.get(b.id) || 0) - (empTieBreaker.get(a.id) || 0);
        });

    sortedEmployees.forEach(emp => {
        // Determine weekly hours for this specific week
        let effectiveHours = emp.weeklyHours;

        // Check for Temporary Hours Adjustment covering this week
        if (emp.tempHours && emp.tempHours.length > 0) {
            const activeTemp = emp.tempHours.find(t => {
                return weekStartDate >= t.start && weekStartDate <= t.end;
            });
            if (activeTemp) {
                effectiveHours = activeTemp.hours;
            }
        }

        const normalizeDate = (d: any): string => {
            if (!d) return '';
            if (typeof d === 'string') return d.split('T')[0].trim();
            // Handle Firestore Timestamp or Date object if slipped in
            if (typeof d.toDate === 'function') return d.toDate().toISOString().split('T')[0];
            if (d instanceof Date) return d.toISOString().split('T')[0];
            return String(d);
        };

        // Calculate target hours based on holidays AND vacations
        let numDaysToReduce = 0;
        weekDates.forEach(d => {
            const h = holidays.find(h => {
                const hDate = typeof h === 'string' ? h : h.date;
                return normalizeDate(hDate) === normalizeDate(d);
            });
            const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');

            // Debug Holiday Check
            if (isFullHoliday) {
                console.log(`[Scheduler] Holiday DETECTED for ${emp.name} on ${d} (Holiday: ${JSON.stringify(h)})`);
            } else {
                if (holidays.length > 0) {
                    const potential = holidays.find(h => (typeof h === 'string' ? h : h.date).includes(d.substring(5))); // Same month/day
                    if (potential) {
                        console.log(`[Scheduler] Potential Mismatch for ${d}? Found similar holiday: ${JSON.stringify(potential)}`);
                    }
                }
            }

            const isPartialHoliday = h && typeof h !== 'string' && (h.type === 'afternoon' || h.type === 'closed_afternoon');

            const isAbsence = timeOffRequests.some(r =>
                r.employeeId === emp.id &&
                (r.type === 'vacation' || r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                (r.dates.includes(d) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
            );

            if (isFullHoliday || isAbsence) {
                numDaysToReduce += 1;
            } else if (isPartialHoliday && effectiveHours === 40) {
                numDaysToReduce += 0.5;
            }
        });

        // Calculate target hours with holiday/vacation deduction based on table
        let targetHours = effectiveHours;

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
                else if (numDaysToReduce >= 5) {
                    targetHours = 0;
                }
                else if (numDaysToReduce > 3) {
                    targetHours = Math.max(0, effectiveHours - Math.round((effectiveHours / 5) * numDaysToReduce));
                }
            } else {
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
        const hasEarlyMorningPerm = userPermRequests.some(r => r.type === 'early_morning_shift');

        const maxAfternoonsReq = userPermRequests.find(r => r.type === 'max_afternoons_per_week');
        const maxAfternoons = maxAfternoonsReq ? (maxAfternoonsReq.value || 3) : 99;

        const hasNoSplit = userPermRequests.some(r => r.type === 'no_split');

        // Adjust slots for Early Morning Shift
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
            const dayOfWeek = dateObj.getDay();

            const holidayObj = holidays.find(h => {
                const hDate = typeof h === 'string' ? h : h.date;
                return normalizeDate(hDate) === normalizeDate(date);
            });
            const isFullHoliday = holidayObj && (typeof holidayObj === 'string' || holidayObj.type === 'full');

            if (emp.name === 'Juan') {
                console.log(`[Scheduler Debug] ${emp.name} - ${date}: Holiday? ${!!holidayObj} type=${typeof holidayObj === 'string' ? holidayObj : holidayObj?.type} Full=${isFullHoliday}`);
            }

            const timeOffReq = timeOffRequests.find(r =>
                r.employeeId === emp.id &&
                (r.dates.includes(date) || (r.startDate && r.endDate && date >= r.startDate && date <= r.endDate))
            );

            // Check permanent days off
            let permDayOff = userPermRequests.find(r => r.type === 'specific_days_off' && r.days?.includes(dayOfWeek));
            const isPreAssignedOff = false;

            if (!permDayOff) {
                const rotReq = userPermRequests.find(r => r.type === 'rotating_days_off' && r.cycleWeeks && r.referenceDate);
                if (rotReq && rotReq.cycleWeeks && rotReq.referenceDate) {
                    const cycleStart = new Date(rotReq.referenceDate);
                    const currentWeek = new Date(weekStartDate);
                    const diffTime = currentWeek.getTime() - cycleStart.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    const diffWeeks = Math.floor(diffDays / 7);

                    if (diffWeeks >= 0) {
                        const cycleIndex = diffWeeks % rotReq.cycleWeeks.length;
                        // Support both legacy array-of-arrays and new object-array structure (for Firestore compatibility)
                        const weekItem = rotReq.cycleWeeks[cycleIndex];
                        let daysOffThisWeek: number[] = [];

                        if (Array.isArray(weekItem)) {
                            daysOffThisWeek = weekItem; // Legacy number[]
                        } else if (weekItem && Array.isArray((weekItem as any).days)) {
                            daysOffThisWeek = (weekItem as any).days; // New { days: number[] }
                        }

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
            else if (isFullHoliday) {
                dayStatus[date] = 'holiday';
                if (emp.name === 'Juan') console.log(`[Scheduler Debug] ${emp.name} - ${date}: Set as HOLIDAY`);
            }
            else if (timeOffReq?.type === 'day_off') dayStatus[date] = 'off';
            else if ((timeOffReq?.type === 'morning_off' || timeOffReq?.type === 'afternoon_off') && effectiveHours >= 40) {
                dayStatus[date] = 'off';
            }
            else if (permDayOff) dayStatus[date] = 'off';
            else if (isPreAssignedOff) dayStatus[date] = 'off';
            else if (isSunday && !isOpenSunday) dayStatus[date] = 'off';
            else {
                availableDays.push(date);
                if (emp.name === 'Juan') console.log(`[Scheduler Debug] ${emp.name} - ${date}: Added to Available`);
            }
        });

        // --- MANDATORY REST DAY RULE ---
        const monToSatDates = weekDates.slice(0, 6);

        const alreadyHasMonSatOff = monToSatDates.some(date => {
            if (dayStatus[date] && dayStatus[date] !== 'morning' && dayStatus[date] !== 'afternoon' && dayStatus[date] !== 'split') return true;

            const dObj = new Date(date + 'T12:00:00');
            const dOfWeek = dObj.getDay();
            const mRest = userPermRequests.find(r => r.type === 'morning_only');
            const aRest = userPermRequests.find(r => r.type === 'afternoon_only');

            const isMBlocked = mRest && mRest.days && mRest.days.length > 0 && !mRest.days.includes(dOfWeek);
            const isABlocked = aRest && aRest.days && aRest.days.length > 0 && !aRest.days.includes(dOfWeek);

            if (isMBlocked || isABlocked) return true;

            return false;
        });

        if (!alreadyHasMonSatOff) {
            const monSatAvailable = availableDays.filter(date => {
                const dayIndex = new Date(date + 'T12:00:00').getDay();
                return dayIndex >= 1 && dayIndex <= 6;
            });

            if (monSatAvailable.length > 0) {
                const isLeader = ['Gerente', 'Subgerente', 'Responsable'].includes(emp.category);

                const tieBreaker = new Map<string, number>();
                const randomValues = new Uint32Array(monSatAvailable.length);
                if (typeof crypto !== 'undefined') {
                    crypto.getRandomValues(randomValues);
                } else {
                    for (let i = 0; i < randomValues.length; i++) randomValues[i] = Math.floor(Math.random() * 1000000);
                }
                monSatAvailable.forEach((d, i) => tieBreaker.set(d, randomValues[i]));

                monSatAvailable.sort((a, b) => {
                    let penaltyA = 0;
                    let penaltyB = 0;

                    if (isLeader) {
                        const countLeadersOff = (date: string) => {
                            return shifts.filter(s => {
                                const sEmp = employees.find(e => e.id === s.employeeId);
                                const isSLeader = sEmp && ['Gerente', 'Subgerente', 'Responsable'].includes(sEmp.category);
                                return isSLeader && s.date === date && (s.type === 'off' || s.type === 'holiday' || s.type === 'vacation');
                            }).length;
                        };

                        const leadersOffA = countLeadersOff(a);
                        const leadersOffB = countLeadersOff(b);

                        penaltyA += leadersOffA * 1000;
                        penaltyB += leadersOffB * 1000;
                    }

                    const scoreA = getTotalLoad(a) - penaltyA;
                    const scoreB = getTotalLoad(b) - penaltyB;

                    if (scoreA !== scoreB) {
                        return scoreB - scoreA;
                    }

                    const randA = tieBreaker.get(a) || 0;
                    const randB = tieBreaker.get(b) || 0;
                    return randB - randA;
                });
                const dayToForceOff = monSatAvailable[0];
                console.log(`[Scheduler] Selected Off for ${emp.name}: ${dayToForceOff}`);
                dayStatus[dayToForceOff] = 'off';

                const availableIdx = availableDays.indexOf(dayToForceOff);
                if (availableIdx > -1) {
                    availableDays.splice(availableIdx, 1);
                }
            }
        }

        const assignedShifts: Record<string, ShiftType> = {};

        const hasForceFullDays = userPermRequests.some(r => r.type === 'force_full_days');

        const isHighHours = effectiveHours >= 40 || hasForceFullDays;

        if (isHighHours) {
            // Filter days that might have partial blocks (morning_off etc) - treat as unavailable for split logic for simplicity or handle gracefully
            // For MVP, we filter for fully available days
            const fullyAvailableDays = availableDays.filter(d => {
                const req = timeOffRequests.find(r =>
                    r.employeeId === emp.id &&
                    (r.dates.includes(d) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
                );

                // Explicitly check for Full Holiday to be absolutely sure
                const hObj = holidays.find(h => {
                    const hDate = typeof h === 'string' ? h : h.date;
                    return normalizeDate(hDate) === normalizeDate(d);
                });
                const isFullHoliday = hObj && (typeof hObj === 'string' || hObj.type === 'full');
                if (isFullHoliday) return false;

                return !req || (req.type !== 'morning_off' && req.type !== 'afternoon_off');
            });

            // RANDOMIZATION: Shuffle first, then sort stability.
            // To guarantee non-determinism, we generate a random score for each day for this specific employee iteration.
            const noiseMap = new Map<string, number>();
            const noiseValues = new Uint32Array(fullyAvailableDays.length);
            if (typeof crypto !== 'undefined') crypto.getRandomValues(noiseValues);
            else for (let i = 0; i < noiseValues.length; i++) noiseValues[i] = Math.floor(Math.random() * 1000000);

            fullyAvailableDays.forEach((d, i) => noiseMap.set(d, noiseValues[i]));

            fullyAvailableDays.sort((a, b) => {
                // Total Load Balance STRICT
                let loadA = getTotalLoad(a);
                let loadB = getTotalLoad(b);

                // PENALTY FOR SATURDAY (Only Sevilla 1)
                // User wants fewer hours on Saturday for this store.
                // We artificially increase the "load" of Saturday so it looks fuller, causing the scheduler to pick other days first.
                if (establishmentId === '1') {
                    const isSatA = new Date(a).getDay() === 6;
                    const isSatB = new Date(b).getDay() === 6;
                    if (isSatA) loadA += 2; // Artificial +2 shifts penalty
                    if (isSatB) loadB += 2;
                }

                if (loadA !== loadB) {
                    return loadA - loadB; // Ascending: Pick emptiest day
                }

                // If loads are equal, use random noise
                return (noiseMap.get(a) || 0) - (noiseMap.get(b) || 0);
            });

            // DEBUG: Log the order for the first employee to verify randomness
            console.log(`[Scheduler] Random Order for ${emp.name} (First 3):`, fullyAvailableDays.slice(0, 3));

            // Assign Split shifts
            for (const day of fullyAvailableDays) {
                const dayObj = new Date(day);
                const dayOfWeek = dayObj.getDay();

                // Check specific restrictions for this day
                const morningRestriction = userPermRequests.find(r => r.type === 'morning_only');
                const afternoonRestriction = userPermRequests.find(r => r.type === 'afternoon_only');

                const isMorningOnlyDay = morningRestriction && (!morningRestriction.days || morningRestriction.days.length === 0 || morningRestriction.days.includes(dayOfWeek));
                const isAfternoonOnlyDay = afternoonRestriction && (!afternoonRestriction.days || afternoonRestriction.days.length === 0 || afternoonRestriction.days.includes(dayOfWeek));

                // Strict Day Violation Check
                const isMDayViolation = morningRestriction && morningRestriction.days && morningRestriction.days.length > 0 && !morningRestriction.days.includes(dayOfWeek);
                const isADayViolation = afternoonRestriction && afternoonRestriction.days && afternoonRestriction.days.length > 0 && !afternoonRestriction.days.includes(dayOfWeek);

                if (isMDayViolation || isADayViolation) continue;

                // Get holiday info for this day again
                const hObj = holidays.find(h => {
                    const hDate = typeof h === 'string' ? h : h.date;
                    return normalizeDate(hDate) === normalizeDate(day);
                });
                const isAfternoonClosed = hObj && typeof hObj !== 'string' && (hObj.type === 'afternoon' || hObj.type === 'closed_afternoon');

                // Check Afternoon Limit
                if (afternoonsAssignedCount >= maxAfternoons) continue;

                // Restrict split if global preference exists (e.g. Morning Only profile -> No Split)
                // OR if explicitly requested 'no_split'
                if (((globalMorningOnly || globalAfternoonOnly) && !hasForceFullDays) || hasNoSplit) continue;

                // Cannot do split if forced Morning Only or Afternoon Only on this specific day
                // OR if afternoon is closed due to holiday
                if (isMorningOnlyDay || isAfternoonOnlyDay || isAfternoonClosed) continue;

                if (slotsRemaining >= 2) {
                    assignedShifts[day] = 'split';
                    coverage[day].morning++;
                    coverage[day].afternoon++;
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

            // Pick slots based on load
            // ... logic continues below

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
                // Holiday check
                const hObj = holidays.find(h => {
                    const hDate = typeof h === 'string' ? h : h.date;
                    return normalizeDate(hDate) === normalizeDate(date);
                });
                const isAfternoonClosed = hObj && typeof hObj !== 'string' && (hObj.type === 'afternoon' || hObj.type === 'closed_afternoon');

                // --- STRICT RULE: Afternoon only if Morning coverage > Afternoon coverage explicitly ---
                // We check the CURRENT state of coverage for the day.
                // Only allow adding an afternoon slot if adding it won't inhibit balance.
                // User Rule: "Never more afternoon hours than morning".
                // So we can trigger afternoon ONLY IF current Afternoon < current Morning.


                // Strict Day Violation Check
                const isMDayViolation = morningRestriction && morningRestriction.days && morningRestriction.days.length > 0 && !morningRestriction.days.includes(dayOfWeek);
                const isADayViolation = afternoonRestriction && afternoonRestriction.days && afternoonRestriction.days.length > 0 && !afternoonRestriction.days.includes(dayOfWeek);

                const canMorning = (!req || req.type !== 'morning_off') && !isAfternoonOnlyDay && !isMDayViolation && !isADayViolation;

                // Can Afternoon checking:
                // 1. Not off, Not Morning Only, Not Closed, Not Day Violation
                const canAfternoon = (!req || req.type !== 'afternoon_off')
                    && !isMorningOnlyDay
                    && !isAfternoonClosed
                    && !isMDayViolation
                    && !isADayViolation;
                // REMOVED STRICT BALANCE CHECK: && (currentAfternoonLoad < currentMorningLoad);

                if (canMorning) {
                    possibleSlots.push({
                        date,
                        period: 'morning',
                        load: getLoad(date, 'morning') // Base load
                    });
                }
                if (canAfternoon) {
                    possibleSlots.push({
                        date,
                        period: 'afternoon',
                        load: getLoad(date, 'afternoon') // Base load
                    });
                }
            });

            // Strategy Priority:
            // 1. Fill Priority Slots (Key Roles, etc)
            // 2. SOFT BIAS: Prefer Morning over Afternoon slightly.
            // 3. SATURDAY PENALTY: Fill Saturday last (effectively "removing" hours from Saturday to complete schedule elsewhere first).

            possibleSlots.forEach(slot => {
                let penalty = 0;

                // --- PRIORITY 1: REFINED BALANCE (Minimal Negative Gap) ---
                // Goal: Morning >= Afternoon (Diff 0 or +). Avoid Afternoon > Morning.
                // Diff = Morning - Afternoon
                const currentM = getLoad(slot.date, 'morning');
                const currentA = getLoad(slot.date, 'afternoon');
                const diff = currentM - currentA;

                if (slot.period === 'morning') {
                    if (diff < 0) penalty -= 50;      // Morning deficit -> FILL URGENTLY
                    else if (diff === 0) penalty -= 0; // Neutral (keep balance)
                    else penalty += 2;                // Morning surplus -> Slight soft block
                } else { // afternoon
                    if (diff < 0) penalty += 10;      // Afternoon surplus -> SOFT BLOCK (was 50, strictly prevented afternoon heavy days)
                    else if (diff === 0) penalty += 0; // Neutral
                    else penalty -= 2;                // Afternoon deficit -> Encourage slightly
                }

                // --- PRIORITY 2: SATURDAY/SUNDAY ---
                // Saturday: PENALIZE (+0.2) - Minimal bias to just break ties
                // Sunday: Reduce penalty to 1.0 to treat it more like a normal day if open.
                const slotDate = new Date(slot.date);
                if (slotDate.getDay() === 6) { // Saturday
                    penalty += 0.2;
                } else if (slotDate.getDay() === 0) { // Sunday (if open)
                    penalty += 1.0;
                }

                // --- PRIORITY 3: RESTRICTIONS ---
                const dayOfWeek = slotDate.getDay();
                const morningRestriction = userPermRequests.find(r => r.type === 'morning_only');
                const afternoonRestriction = userPermRequests.find(r => r.type === 'afternoon_only');

                const isMorningOnlyDay = morningRestriction && (!morningRestriction.days || morningRestriction.days.length === 0 || morningRestriction.days.includes(dayOfWeek));
                const isAfternoonOnlyDay = afternoonRestriction && (!afternoonRestriction.days || afternoonRestriction.days.length === 0 || afternoonRestriction.days.includes(dayOfWeek));

                if ((slot.period === 'morning' && isAfternoonOnlyDay) || (slot.period === 'afternoon' && isMorningOnlyDay)) {
                    penalty += 9999; // Effectively block but keep in list just in case (though filtered out by canMorning/canAfternoon usually)
                }

                // --- PRIORITY 3.5: PARTIAL HOLIDAY OPTIMIZATION ---
                // If the day is a partial holiday (closed afternoon), we MUST prioritize using the morning slot
                // because it's a constrained resource (use it or lose it).
                // --- PRIORITY 3.5: PARTIAL HOLIDAY OPTIMIZATION ---
                // If the day is a partial holiday (closed afternoon), we MUST prioritize using the morning slot
                // because it's a constrained resource (use it or lose it).
                const hObj = holidays.find(h => {
                    const hDate = typeof h === 'string' ? h : h.date;
                    return normalizeDate(hDate) === normalizeDate(slot.date);
                });
                const isAfternoonClosed = hObj && typeof hObj !== 'string' && (hObj.type === 'afternoon' || hObj.type === 'closed_afternoon');

                if (isAfternoonClosed && slot.period === 'morning') {
                    penalty -= 100; // Huge bonus to ensure this slot is picked if available
                }

                // --- PRIORITY 4: SPREAD SHIFTS (Low Hours) ---
                // If not High Hours (Full Time), avoid Split Shifts to maximize days covered.
                if (!isHighHours && assignedShifts[slot.date]) {
                    penalty += 2000;
                }

                slot.load += penalty;
            });

            // Sort by Load Ascending (Lowest load = Best Slot)
            // RANDOMIZATION: Shuffle first, then sort strict load.
            shuffleArray(possibleSlots).sort((a, b) => a.load - b.load);

            for (const slot of possibleSlots) {
                if (slotsRemaining <= 0) break;

                // STRICT Anti-Split for Low Hours (Dynamic)
                // If we already have a shift on this day, SKIP.
                // This forces spreading the shifts to other days.
                if (!isHighHours && assignedShifts[slot.date]) continue;

                // STRICT FIXED RESTRICTIONS (Absolute Priority)
                // Need to recalculate restrictions as we are outside the date loop
                const slotDateObj = new Date(slot.date);
                const slotDayOfWeek = slotDateObj.getDay();

                const mRest = userPermRequests.find(r => r.type === 'morning_only');
                const aRest = userPermRequests.find(r => r.type === 'afternoon_only');

                // STRICT DAY CHECK: If days are defined, work is ONLY allowed on those days.
                // If Morning Only is set for [Mon, Tue], working on Wed is FORBIDDEN.
                if (mRest && mRest.days && mRest.days.length > 0 && !mRest.days.includes(slotDayOfWeek)) continue;
                if (aRest && aRest.days && aRest.days.length > 0 && !aRest.days.includes(slotDayOfWeek)) continue;

                // STRICT PERIOD CHECK: If day is allowed, Period must match.
                // If Mon is in Morning Only, Afternoon is FORBIDDEN.
                // Note: We already know day is allowed or global here.
                const isMOnly = mRest && (!mRest.days || mRest.days.length === 0 || mRest.days.includes(slotDayOfWeek));
                const isAOnly = aRest && (!aRest.days || aRest.days.length === 0 || aRest.days.includes(slotDayOfWeek));

                if ((slot.period === 'morning' && isAOnly) || (slot.period === 'afternoon' && isMOnly)) {
                    continue;
                }

                // STRICT LIMIT CHECK (Max Afternoons) - This remains valid logic
                if (slot.period === 'afternoon' && afternoonsAssignedCount >= maxAfternoons) continue;

                // Re-calculate local restrictions for upgrade check
                const currentType = assignedShifts[slot.date];

                if (!currentType) {
                    assignedShifts[slot.date] = slot.period;
                    coverage[slot.date][slot.period]++;
                    slotsRemaining--;
                    if (slot.period === 'afternoon') afternoonsAssignedCount++;
                } else if (currentType !== 'split' && currentType !== slot.period) {
                    // We have one side, adding the other -> Split
                } else if (currentType !== 'split' && currentType !== slot.period) {
                    // We have one side, adding the other -> Split
                    const slotHoliday = holidays.find(h => {
                        const hDate = typeof h === 'string' ? h : h.date;
                        return normalizeDate(hDate) === normalizeDate(slot.date);
                    });
                    const isSlotAfternoonClosed = slotHoliday && typeof slotHoliday !== 'string' && (slotHoliday.type === 'afternoon' || slotHoliday.type === 'closed_afternoon');

                    if (!globalMorningOnly && !globalAfternoonOnly && !isSlotAfternoonClosed) {
                        if (afternoonsAssignedCount < maxAfternoons) {
                            // Upgrade to Split
                            // No strict balance check here anymore. 
                            assignedShifts[slot.date] = 'split';
                            coverage[slot.date][slot.period]++;
                            slotsRemaining--;
                            afternoonsAssignedCount++;
                        }
                    }
                }
            }

            // --- FALLBACK: FORCE FILL IF NEEDED ---
            // If we still have hours to assign (Ruben case), we must assign them SOMEWHERE.
            // We iterate ALL week dates to find any valid slot.
            if (slotsRemaining > 0) {
                for (const day of weekDates) {
                    if (slotsRemaining <= 0) break;

                    // Respect Days Off and Holidays
                    // We only skip if explicitly marked 'off' or 'holiday'.
                    // Note: dayStatus might be undefined for regular work days
                    if (dayStatus[day]) continue;

                    const dayObj = new Date(day);
                    const dayOfWeek = dayObj.getDay();

                    // Restrictions
                    const morningRestriction = userPermRequests.find(r => r.type === 'morning_only');
                    const afternoonRestriction = userPermRequests.find(r => r.type === 'afternoon_only');

                    // STRICT DAY CHECK in Fallback: Block forbidden days
                    if (morningRestriction && morningRestriction.days && morningRestriction.days.length > 0 && !morningRestriction.days.includes(dayOfWeek)) continue;
                    if (afternoonRestriction && afternoonRestriction.days && afternoonRestriction.days.length > 0 && !afternoonRestriction.days.includes(dayOfWeek)) continue;

                    const isMorningOnlyDay = morningRestriction && (!morningRestriction.days || morningRestriction.days.length === 0 || morningRestriction.days.includes(dayOfWeek));
                    const isAfternoonOnlyDay = afternoonRestriction && (!afternoonRestriction.days || afternoonRestriction.days.length === 0 || afternoonRestriction.days.includes(dayOfWeek));

                    // Holiday Closing
                    // Holiday Closing
                    const hObj = holidays.find(h => {
                        const hDate = typeof h === 'string' ? h : h.date;
                        return normalizeDate(hDate) === normalizeDate(day);
                    });
                    const isAfternoonClosed = hObj && typeof hObj !== 'string' && (hObj.type === 'afternoon' || hObj.type === 'closed_afternoon');
                    const isFullHoliday = hObj && (typeof hObj === 'string' || hObj.type === 'full');
                    if (isFullHoliday) continue;

                    const timeOffReq = timeOffRequests.find(r =>
                        r.employeeId === emp.id &&
                        (r.dates.includes(day) || (r.startDate && r.endDate && day >= r.startDate && day <= r.endDate))
                    );

                    const currentType = assignedShifts[day];

                    // Try assigning Morning
                    const canMorning = (!timeOffReq || timeOffReq.type !== 'morning_off') &&
                        (!currentType || currentType === 'afternoon') &&
                        !isAfternoonOnlyDay &&
                        !globalAfternoonOnly &&
                        assignedShifts[day] !== 'morning' &&
                        assignedShifts[day] !== 'split';

                    if (canMorning) {
                        assignedShifts[day] = currentType === 'afternoon' ? 'split' : 'morning';
                        coverage[day]['morning']++;
                        slotsRemaining--;
                        if (slotsRemaining <= 0) break;
                    }

                    // Try assigning Afternoon
                    const canAfternoon = (!timeOffReq || timeOffReq.type !== 'afternoon_off') &&
                        (!currentType || currentType === 'morning') &&
                        !isMorningOnlyDay &&
                        !globalMorningOnly &&
                        !isAfternoonClosed &&
                        assignedShifts[day] !== 'afternoon' &&
                        assignedShifts[day] !== 'split' &&
                        afternoonsAssignedCount < maxAfternoons; // STRICT MAX CHECK

                    if (canAfternoon) {
                        assignedShifts[day] = currentType === 'morning' ? 'split' : 'afternoon';
                        coverage[day]['afternoon']++;
                        slotsRemaining--;
                        afternoonsAssignedCount++;
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

                if (s.type !== 'off' && s.type !== 'holiday' && s.type !== 'vacation' && s.type !== 'sick_leave' && s.type !== 'maternity_paternity') {
                    if (appliesToDay) {
                        if (s.type === 'afternoon' || s.type === 'split') {
                            const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                            warnings.push(`Restricción Violada: ${emp.name} tiene "Solo Mañanas" el ${dayName} pero tiene turno de ${s.type === 'afternoon' ? 'Tarde' : 'Partido'}.`);
                        }
                    } else {
                        // User expectation: If days are specified (e.g. Mon-Fri), working on Sat is a potential violation/warning
                        const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                        warnings.push(`Restricción Violada (Días): ${emp.name} tiene turno el ${dayName} (Fuera de los días definidos en 'Solo Mañanas').`);
                    }
                }
            });
        }

        if (req.type === 'afternoon_only') {
            empShifts.forEach(s => {
                const dayIndex = getDayIndex(s.date);
                const appliesToDay = !req.days || req.days.length === 0 || req.days.includes(dayIndex);

                if (s.type !== 'off' && s.type !== 'holiday' && s.type !== 'vacation' && s.type !== 'sick_leave' && s.type !== 'maternity_paternity') {
                    if (appliesToDay) {
                        if (s.type === 'morning' || s.type === 'split') {
                            const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                            warnings.push(`Restricción Violada: ${emp.name} tiene "Solo Tardes" el ${dayName} pero tiene turno de ${s.type === 'morning' ? 'Mañana' : 'Partido'}.`);
                        }
                    } else {
                        // User expectation: If days are specified (e.g. Mon-Fri), working on Sat is a potential violation/warning
                        const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                        warnings.push(`Restricción Violada (Días): ${emp.name} tiene turno el ${dayName} (Fuera de los días definidos en 'Solo Tardes').`);
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
                // Support both legacy and new structure
                let daysOffList: number[] = [];
                if (Array.isArray(daysOff)) {
                    daysOffList = daysOff;
                } else if (daysOff && Array.isArray((daysOff as any).days)) {
                    daysOffList = (daysOff as any).days;
                }

                if (daysOffList && daysOffList.length > 0) {
                    daysOffList.forEach((dayIndex: number) => {
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
        const holiday = settings.holidays?.find(h => {
            const hDate = typeof h === 'string' ? h : h.date;
            // Simple fallback normalize if function not in scope here
            const norm = (d: any) => typeof d === 'string' ? d.split('T')[0].trim() : (d?.date ? String(d.date).split('T')[0] : String(d));
            return norm(hDate) === norm(date);
        });

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

export const validateFullSchedule = (
    schedule: WeeklySchedule,
    employees: Employee[],
    settings: StoreSettings,
    timeOffRequests: TimeOffRequest[],
    permanentRequests: PermanentRequest[],
    mode: 'warning' | 'publish' = 'warning'
): { strictWarnings: string[], debtAdjustments: any[] } => {
    let strictWarnings: string[] = [];
    const debtAdjustments: any[] = [];
    const weekDates = getWeekDates(schedule.weekStartDate);

    // 1. Permanent Restrictions
    strictWarnings = [...strictWarnings, ...validatePermanentRestrictions(schedule, permanentRequests, employees, false)];

    // 2. Availability Request Validation
    const weekReqs = timeOffRequests.filter(req => {
        const emp = employees.find(e => e.id === req.employeeId);
        if (!emp || emp.establishmentId !== schedule.establishmentId) return false;
        if (req.dates && req.dates.some(date => weekDates.includes(date))) return true;
        if (req.startDate && req.endDate) return req.startDate <= weekDates[6] && req.endDate >= weekDates[0];
        return false;
    });

    weekReqs.forEach(req => {
        const empShifts = schedule.shifts.filter((s: any) => s.employeeId === req.employeeId);
        if (req.dates && req.dates.length > 0) {
            req.dates.forEach(date => {
                const shift = empShifts.find((s: any) => s.date === date);
                if (shift && shift.type !== 'off' && shift.type !== 'holiday' && shift.type !== 'vacation' && shift.type !== 'sick_leave') {
                    const empName = employees.find(e => e.id === req.employeeId)?.name;
                    if (req.type === 'day_off') {
                        strictWarnings.push(`Petición Violada: ${empName} solicitó DÍA LIBRE el ${new Date(date).getDate()} pero tiene turno.`);
                    } else if (req.type === 'morning_off' && (shift.type === 'morning' || shift.type === 'split')) {
                        strictWarnings.push(`Petición Violada: ${empName} solicitó MAÑANA LIBRE el ${new Date(date).getDate()} pero tiene turno.`);
                    } else if (req.type === 'afternoon_off' && (shift.type === 'afternoon' || shift.type === 'split')) {
                        strictWarnings.push(`Petición Violada: ${empName} solicitó TARDE LIBRE el ${new Date(date).getDate()} pero tiene turno.`);
                    }
                }
            });
        }
    });

    // 3. Register Coverage Validation (Strict for Publish)
    if (mode === 'publish') {
        const registerWarnings = validateRegisterCoverage(schedule, settings);
        strictWarnings = [...strictWarnings, ...registerWarnings];
    }

    // 4. Employee Hours & Debt Calculation
    const storeEmployees = employees.filter(e => e.establishmentId === schedule.establishmentId && e.active);

    storeEmployees.forEach(emp => {
        const employeeShifts = schedule.shifts.filter((s: any) => s.employeeId === emp.id);
        const workedHours = employeeShifts.reduce((acc: number, s: any) => {
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

        let targetHours = emp.weeklyHours;

        if (emp.tempHours && emp.tempHours.length > 0) {
            const activeTemp = emp.tempHours.find((t: any) => {
                return schedule.weekStartDate >= t.start && schedule.weekStartDate <= t.end;
            });
            if (activeTemp) {
                targetHours = activeTemp.hours;
            }
        }

        const currentHolidays = settings.holidays;
        const contractHours = targetHours;
        let numDaysToReduce = 0;



        weekDates.forEach(d => {
            const h = currentHolidays.find((holiday: any) => {
                const hDate = typeof holiday === 'string' ? holiday : holiday.date;
                // Inline normalize to avoid scope issues or extensive Refactor
                const norm = (val: any) => {
                    if (typeof val === 'string') return val.split('T')[0].trim();
                    if (val?.toDate) return val.toDate().toISOString().split('T')[0];
                    if (val instanceof Date) return val.toISOString().split('T')[0];
                    return String(val);
                };
                return norm(hDate) === norm(d);
            });
            const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');
            const isPartialHoliday = h && typeof h !== 'string' && (h.type === 'afternoon' || h.type === 'closed_afternoon');
            const isAbsence = timeOffRequests.some(r =>
                r.employeeId === emp.id &&
                (r.type === 'vacation' || r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                (r.dates.includes(d) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
            );

            if (isFullHoliday || isAbsence) {
                numDaysToReduce++;
            } else if (isPartialHoliday && contractHours === 40) {
                numDaysToReduce += 0.5;
            }
        });

        const rReduction = Math.round(numDaysToReduce * 10) / 10;
        const baseHours = targetHours;

        const reductionTable: Record<number, number[]> = {
            40: [36, 32, 28, 24, 16],
            36: [33, 30, 27, 23, 18],
            32: [30, 27, 24, 21, 16],
            28: [25, 23, 21, 19, 14],
            24: [22, 20, 18, 16, 12],
            20: [18, 17, 15, 13, 10],
            16: [14, 13, 12, 10, 8]
        };

        if (rReduction > 0) {
            const tableRow = reductionTable[baseHours];
            if (tableRow) {
                if (rReduction === 0.5) targetHours = tableRow[0];
                else if (rReduction === 1) targetHours = tableRow[1];
                else if (rReduction === 1.5) targetHours = tableRow[2];
                else if (rReduction === 2) targetHours = tableRow[3];
                else if (rReduction === 3) targetHours = tableRow[4];
                else if (rReduction >= 5) targetHours = 0;
                else if (rReduction > 3) targetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
            } else {
                targetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
            }
        }

        let diff = Math.round((workedHours - targetHours) * 10) / 10;

        const nonOffShifts = employeeShifts.filter((s: any) => s.type !== 'off' && s.type !== 'holiday');
        const isFullAbsence = nonOffShifts.length > 0 && nonOffShifts.every((s: any) => s.type === 'vacation' || s.type === 'sick_leave');
        if (isFullAbsence) diff = 0;

        if (diff !== 0) {
            debtAdjustments.push({
                empId: emp.id,
                name: emp.name,
                amount: diff,
                worked: Math.round(workedHours * 10) / 10,
                contract: targetHours
            });
            const actionText = diff > 0 ? "se añaden a deuda" : "se restan de deuda";
            if (diff > 0) {
                strictWarnings.push(`${emp.name}: Tiene ${diff.toFixed(1)}h extra (${actionText}).`);
            } else {
                strictWarnings.push(`${emp.name}: Le faltan ${Math.abs(diff).toFixed(1)}h (${actionText}).`);
            }
        }
    });

    // 5. Daily Coverage & Open/Close Validation
    weekDates.forEach(date => {
        const shiftsOnDate = schedule.shifts.filter((s: any) => s.date === date);
        const morningHours = shiftsOnDate.filter((s: any) => s.type === 'morning' || s.type === 'split').length * 4;
        const afternoonHours = shiftsOnDate.filter((s: any) => s.type === 'afternoon' || s.type === 'split').length * 4;
        const totalHours = morningHours + afternoonHours;

        const isSunday = new Date(date).getDay() === 0;
        const isOpenSunday = settings.openSundays.includes(date);
        if (isSunday && !isOpenSunday) return;

        const holidayObj = settings.holidays.find((h: any) => (typeof h === 'string' ? h === date : h.date === date));
        const isFullHoliday = holidayObj && (typeof holidayObj === 'string' || holidayObj.type === 'full');
        const isAfternoonHoliday = holidayObj && typeof holidayObj !== 'string' && (holidayObj.type === 'afternoon' || holidayObj.type === 'closed_afternoon');

        if (isFullHoliday) return;

        let threshold = 48;
        if (isAfternoonHoliday) threshold = 24;

        if (totalHours < threshold) {
            strictWarnings.push(`Baja Cobertura: El ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()} solo tiene ${totalHours}h planificadas (Mínimo recomendado: ${threshold}h).`);
        }

        if (mode === 'publish' && !isFullHoliday) {
            const shiftOpening = shiftsOnDate.find((s: any) => s.isOpening);
            const shiftClosing = shiftsOnDate.find((s: any) => s.isClosing);

            if (!shiftOpening) {
                strictWarnings.push(`Falta APERTURA (A) el ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()}`);
            }

            if (!shiftClosing) {
                strictWarnings.push(`Falta CIERRE (C) el ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()}`);
            }
        }
    });

    return { strictWarnings, debtAdjustments };
};
