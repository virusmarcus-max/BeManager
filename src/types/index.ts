export * from './ilt';
export type UserRole = 'manager';

export interface User {
    id: string;
    name: string;
    role: 'admin' | 'manager';
    establishmentId: string;
    establishmentName: string;
}

export type EmployeeCategory = 'Limpieza' | 'Empleado' | 'Responsable' | 'Subgerente' | 'Gerente';

export interface Employee {
    id: string;
    name: string;
    establishmentId: string;
    weeklyHours: number;
    active: boolean;
    category: EmployeeCategory;
    seniorityDate?: string; // ISO Date YYYY-MM-DD
    birthDate?: string;    // ISO Date YYYY-MM-DD
    email?: string;
    hoursDebt: number; // Positive = Employee worked extra, Negative = Employee owes hours
    contractEndDate?: string | null; // ISO Date YYYY-MM-DD
    contractStartDate?: string; // ISO Date YYYY-MM-DD - The actual start date of the current contract
    contractType?: 'indefinido' | 'temporal' | 'sustitucion';
    initials?: string;
    tempHours?: TemporaryHoursAdjustment[];
    history?: EmployeeHistoryEntry[];
    substitutingId?: string; // ID of the employee being substituted
}

export interface EmployeeHistoryEntry {
    date: string; // ISO Timestamp
    type: 'hired' | 'terminated' | 'rehired';
    reason?: string;
    contractEndDate?: string;
    contractStartDate?: string;
}

export interface TemporaryHoursAdjustment {
    id: string;
    start: string; // ISO Date YYYY-MM-DD
    end: string; // ISO Date YYYY-MM-DD
    hours: number;
}

export interface HoursDebtLog {
    id: string;
    employeeId: string;
    amount: number;
    reason: string; // "Schedule week of 2025-01-01" or "Manual adjustment"
    date: string; // ISO Timestamp
    scheduleId?: string;
}

export interface StoreSettings {
    establishmentId: string;
    storeName: string;
    password?: string; // Optional for backward compatibility, but required for login logic
    managerName: string;
    contactEmail: string;
    phone?: string;
    address?: string;
    city?: string;
    zipCode?: string;
    holidays: { date: string; type: 'full' | 'afternoon' | 'closed_afternoon' }[]; // ISO Date strings YYYY-MM-DD
    openSundays: string[]; // ISO Date strings YYYY-MM-DD
    openingHours: {
        morningStart: string; // "10:00"
        morningEnd: string;   // "14:00"
        afternoonStart: string; // "16:30"
        afternoonEnd: string;   // "20:30"
    };
    roleSchedules?: Record<WorkRole, RoleScheduleConfig>;
    individualMeetingStartTime?: string;
}

export type WorkRole = 'sales_register' | 'purchase_register' | 'shuttle' | 'cleaning';

export interface RoleScheduleConfig {
    startTime?: string; // Optional, defaults to store settings
    endTime?: string;   // Optional, defaults to store settings
    type: 'morning' | 'afternoon' | 'split';
    morningEndTime?: string; // Optional for split
    afternoonStartTime?: string; // Optional for split
}

export type ShiftType = 'morning' | 'afternoon' | 'split' | 'off' | 'holiday' | 'vacation' | 'sick_leave' | 'maternity_paternity';

export interface Shift {
    id: string;
    employeeId: string;
    date: string; // ISO Date YYYY-MM-DD
    type: ShiftType;
    startTime?: string; // "10:00"
    endTime?: string; // "14:00" (or 20:30 for split end)

    // For split shifts manual override
    morningEndTime?: string;   // "14:00"
    afternoonStartTime?: string; // "16:30"
    role?: WorkRole;
    isIndividualMeeting?: boolean;
    isOpening?: boolean;
    isClosing?: boolean;
}

export interface WeeklySchedule {
    id: string;
    establishmentId: string;
    weekStartDate: string; // Monday of the week
    shifts: Shift[];
    status: 'draft' | 'published';
    approvalStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
    supervisorNotes?: string;
    submittedAt?: string;
    modificationStatus?: 'none' | 'requested' | 'approved' | 'rejected';
    modificationReason?: string;
    originalShiftsSnapshot?: Shift[];
}

export interface BreakLog {
    id: string;
    employeeId: string;
    startTime: string; // ISO Timestamp
    endTime?: string; // ISO Timestamp
    date: string;
}

export type TimeOffType = 'morning_off' | 'afternoon_off' | 'day_off' | 'vacation' | 'sick_leave' | 'early_morning_shift' | 'maternity_paternity';

export interface TimeOffRequest {
    id: string;
    employeeId: string;
    dates: string[]; // List of YYYY-MM-DD
    type: TimeOffType;
    status: 'pending' | 'approved' | 'rejected';
    startDate?: string; // For long-term ranges
    endDate?: string;   // For long-term ranges
}

export interface EmployeeLog {
    id: string;
    employeeId: string;
    type: 'hire' | 'termination' | 'modification';
    details: string;
    date: string; // ISO Date YYYY-MM-DD
    establishmentId: string;
}

export type PermanentRequestType = 'morning_only' | 'afternoon_only' | 'specific_days_off' | 'max_afternoons_per_week' | 'force_full_days' | 'early_morning_shift' | 'rotating_days_off' | 'fixed_rotating_shift' | 'no_split' | 'custom_days_off';

export interface PermanentRequest {
    id: string;
    employeeId: string;
    type: PermanentRequestType;
    days?: number[]; // 0=Sunday, 1=Monday... (Used for specific_days_off)
    exceptions?: string[]; // List of week start dates (YYYY-MM-DD) when this request is ignored
    value?: number; // Aux value (e.g., number of afternoons)
    // For Rotating Days
    cycleWeeks?: { days: number[] }[]; // Array of cycles. Index 0 = Week 1, Index 1 = Week 2. Each inner array is list of days off (0-6)
    referenceDate?: string; // ISO Date YYYY-MM-DD (Week Start Date) to anchor the cycle (Week 1 starts here)
}

export interface Notification {
    id: string;
    establishmentId: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    createdAt: string;
    linkTo?: string; // Optional link (e.g., to schedule)
}

export type TaskType = 'specific_date' | 'cyclical';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface TaskStatusDetail {
    storeId: string;
    status: TaskStatus;
    lastUpdated: string;
    completedBy?: string; // ID of the manager
    completedByInitials?: string; // Initials of the employee who finished it
}

export interface Task {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    createdBy: string; // supervisor id
    priority: TaskPriority;

    // Assignment
    targetStores: 'all' | string[]; // 'all' or list of store IDs

    // Timing
    type: TaskType;
    date?: string; // YYYY-MM-DD for specific
    startDate?: string; // for range
    endDate?: string; // for range

    // Cyclical Configuration
    isCyclical?: boolean;
    cycleUnit?: 'weeks' | 'months';
    cycleFrequency?: number; // e.g., every 2 weeks
    cyclicalDayOfWeek?: number; // 1=Monday...
    cyclicalDayOfMonth?: number; // 1-31

    durationDays?: number; // 1-30
    lastActivatedDate?: string;

    // Status (Per Store)
    status: Record<string, TaskStatusDetail>;

    // Administrative
    isArchived?: boolean;
}

export interface IncentiveAdjustment {
    id: string;
    description: string;
    amount: number;
}

export interface IncentiveItem {
    employeeId: string;
    employeeName: string;
    baseAmount: number;
    pluses: IncentiveAdjustment[];
    deductions: IncentiveAdjustment[];

    // Microprestamos (Inputs from Manager)
    micros_aptacion_qty?: number;
    micros_mecanizacion_qty?: number;
    hours_payment_qty?: number; // Hours transferred from hours bank

    // Responsibility Check (Just a flag or calculated? Assuming role check at runtime, but storing the bonus amount here helps)
    responsibility_bonus_amount?: number;

    // Sick Days Count (For Reference)
    sickDays?: number;

    total: number; // Calculated property
}

export interface IncentiveReport {
    id: string;
    establishmentId: string;
    month: string; // YYYY-MM
    status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'changes_requested' | 'modification_requested';
    items: IncentiveItem[];
    submittedAt?: string;
    approvedAt?: string;
    supervisorNotes?: string;
    managerNotes?: string;
    updatedAt: string;

    // Configuration Values (Set by Supervisor)
    value_per_captacion?: number;
    value_per_mecanizacion?: number;
    value_responsibility_bonus?: number;
    value_per_extra_hour?: number;

    // Responsibility Bonus Configuration
    apply_bonus_responsible?: boolean;
    apply_bonus_manager?: boolean;
    apply_bonus_submanager?: boolean;
}
