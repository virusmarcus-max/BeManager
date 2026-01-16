
const holidays = [
    { date: '2026-01-20', type: 'full' }
];

const weekDates = [
    '2026-01-19', // Mon
    '2026-01-20', // Tue (HOLIDAY)
    '2026-01-21', // Wed
    '2026-01-22', // Thu
    '2026-01-23', // Fri
    '2026-01-24', // Sat
    '2026-01-25'  // Sun
];

const weekStartDate = '2026-01-19';

const employees = [
    { id: '1', name: 'Juan', weeklyHours: 40, active: true },
    { id: '2', name: 'Gonzalez', weeklyHours: 40, active: true }
];

function normalizeDate(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.split('T')[0].trim();
    if (d instanceof Date) return d.toISOString().split('T')[0];
    return String(d);
}

// SIMULATE SCHEDULER LOGIC

employees.forEach(emp => {
    console.log(`\nProcessing ${emp.name}...`);
    let effectiveHours = emp.weeklyHours;

    // REDUCTION LOGIC
    let numDaysToReduce = 0;
    weekDates.forEach(d => {
        const h = holidays.find(h => {
            const hDate = typeof h === 'string' ? h : h.date;
            return normalizeDate(hDate) === normalizeDate(d);
        });
        const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');

        if (isFullHoliday) {
            console.log(`  Found Holiday on ${d}`);
            numDaysToReduce += 1;
        }
    });

    console.log(`  Days to reduce: ${numDaysToReduce}`);

    let targetHours = effectiveHours;
    if (numDaysToReduce === 1 && effectiveHours === 40) targetHours = 32;
    console.log(`  Target Hours: ${targetHours}`);

    // AVAILABILITY LOGIC
    const availableDays = [];
    const dayStatus = {};

    weekDates.forEach(date => {
        const hObj = holidays.find(h => {
            const hDate = typeof h === 'string' ? h : h.date;
            return normalizeDate(hDate) === normalizeDate(date);
        });
        const isFullHoliday = hObj && (typeof hObj === 'string' || hObj.type === 'full');
        const isSunday = new Date(date).getDay() === 0;

        if (isFullHoliday) dayStatus[date] = 'holiday';
        else if (isSunday) dayStatus[date] = 'off';
        else availableDays.push(date);
    });

    console.log(`  Available Days: ${JSON.stringify(availableDays)}`);
    console.log(`  Day Status: ${JSON.stringify(dayStatus)}`);

    // RANDOMNESS SIMULATION
    // Weighted Sort Logic
    // Simulate coverage penalty
    const getWeightedLoad = (d) => {
        const date = new Date(d);
        if (date.getDay() === 6) return 1; // Sat Penalty
        return 0;
    };

    // Shuffle
    const shuffled = [...availableDays];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Sort
    const sortedDays = shuffled.sort((a, b) => {
        const diff = getWeightedLoad(a) - getWeightedLoad(b);
        return diff;
    });

    console.log(`  Preferred Days Order: ${JSON.stringify(sortedDays)}`);

    // FILLING LOGIC (Simplified)
    let slotsNeeded = Math.round(targetHours / 4);
    console.log(`  Slots Needed: ${slotsNeeded}`);

    const assigned = [];
    let slotsUsed = 0;

    // Mock "Split Shift" Strategy (Try to assign 2 slots per day)
    for (const day of sortedDays) {
        if (slotsUsed + 2 <= slotsNeeded) {
            assigned.push(day);
            slotsUsed += 2;
        }
    }

    console.log(`  Assigned Days: ${JSON.stringify(assigned)}`);
});
