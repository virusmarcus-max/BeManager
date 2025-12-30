
/**
 * Utility to handle date parsing and formatting without timezone shifting issues.
 * Always works in the "local" perspective of the provided YYYY-MM-DD strings.
 */

export const parseLocalDate = (dateStr: string): Date => {
    // Use YYYY, MM, DD to avoid UTC shifting
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const formatLocalDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const getDayOfWeek = (dateStr: string): number => {
    // 0 is Sunday, 1 is Monday...
    return parseLocalDate(dateStr).getDay();
};

export const isSameDay = (date1: string, date2: string): boolean => {
    return date1 === date2;
};

export const getWeekDates = (weekStartStr: string): string[] => {
    const dates = [];
    const start = parseLocalDate(weekStartStr);
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(formatLocalDate(d));
    }
    return dates;
};
