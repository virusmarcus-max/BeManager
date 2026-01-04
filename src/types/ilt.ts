
export interface ILTReportItem {
    id: string; // Unique ID for the row (can be employeeId)
    employeeId: string;
    employeeName: string;
    hireDate?: string;
    contractEndDate?: string;
    contractHours?: number; // Weekly contracted hours

    // IT (Sick Leave)
    itDays: number;
    itRanges: { start: string; end: string }[];

    // Maternity/Paternity
    matPatDays: number;
    matPatRanges: { start: string; end: string }[];

    // Vacation
    vacationDays: number;
    vacationRanges: { start: string; end: string }[];
}

export interface ILTReport {
    id: string; // generated ID
    establishmentId: string;
    month: string; // YYYY-MM
    generatedAt: string;
    items: ILTReportItem[];
}
