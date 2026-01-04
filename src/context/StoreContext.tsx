import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Employee, WeeklySchedule, BreakLog, StoreSettings, TimeOffRequest, EmployeeLog, Shift, PermanentRequest, HoursDebtLog, TemporaryHoursAdjustment, Notification, Task, TaskStatus, IncentiveReport, ILTReport } from '../types';
import { generateWeeklySchedule } from '../services/scheduler';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';



const DEFAULT_SETTINGS: Omit<StoreSettings, 'establishmentId'> = {
    storeName: '',
    managerName: '',
    contactEmail: '',
    holidays: [
        { date: '2025-01-01', type: 'full' },
        { date: '2025-01-06', type: 'full' },
        { date: '2025-05-01', type: 'full' },
        { date: '2025-08-15', type: 'full' },
        { date: '2025-10-12', type: 'full' },
        { date: '2025-11-01', type: 'full' },
        { date: '2025-12-06', type: 'full' },
        { date: '2025-12-08', type: 'full' },
        { date: '2025-12-25', type: 'full' }
    ],
    openSundays: [],
    phone: '',
    address: '',
    city: '',
    zipCode: '',
    openingHours: {
        morningStart: '10:00',
        morningEnd: '14:00',
        afternoonStart: '16:30',
        afternoonEnd: '20:30'
    },
    roleSchedules: {
        'sales_register': { startTime: '', endTime: '', type: 'morning' },
        'purchase_register': { startTime: '', endTime: '', type: 'afternoon' },
        'shuttle': { startTime: '', endTime: '', type: 'morning' },
        'cleaning': { startTime: '', endTime: '', type: 'morning' }
    }
};

const INITIAL_EMPLOYEES: Employee[] = [
    // Sevilla 1
    { id: '1-1', name: 'Alejandro Rodriguez Freita', establishmentId: '1', weeklyHours: 40, active: true, category: 'Empleado', initials: 'AR1', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-2', name: 'Gonzalo Arenas Del Cuerpo', establishmentId: '1', weeklyHours: 40, active: true, category: 'Empleado', initials: 'GAC', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-3', name: 'Antonio Perez Rodriguez', establishmentId: '1', weeklyHours: 32, active: true, category: 'Empleado', initials: 'APR', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-4', name: 'Juan Manuel Neri Garcia', establishmentId: '1', weeklyHours: 40, active: true, category: 'Empleado', initials: 'JMN', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-5', name: 'Eva Maria Marco Anacleto', establishmentId: '1', weeklyHours: 20, active: true, category: 'Empleado', initials: 'EM', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-6', name: 'Tamara Alvarez mejias', establishmentId: '1', weeklyHours: 32, active: true, category: 'Empleado', initials: 'TAM', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-7', name: 'FRANCISCA SEDEÑO', establishmentId: '1', weeklyHours: 24, active: true, category: 'Empleado', initials: 'HLJ', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-8', name: 'Jesica Romero Amador', establishmentId: '1', weeklyHours: 28, active: true, category: 'Empleado', initials: 'JRA', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-9', name: 'Manuel Ramos Benedito', establishmentId: '1', weeklyHours: 32, active: true, category: 'Empleado', initials: 'MB', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-10', name: 'Miguel Quiroga Martinez', establishmentId: '1', weeklyHours: 40, active: true, category: 'Empleado', initials: 'MQ', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-11', name: 'Orlando Isaa Moreno de la Cruz', establishmentId: '1', weeklyHours: 32, active: true, category: 'Empleado', initials: 'OMD', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-12', name: 'Cristina Molina', establishmentId: '1', weeklyHours: 24, active: true, category: 'Empleado', initials: 'CASS', hoursDebt: 0, contractType: 'indefinido' },
    { id: '1-13', name: 'Teresa Gaitica Lopez', establishmentId: '1', weeklyHours: 20, active: true, category: 'Empleado', initials: 'TERE', hoursDebt: 0, contractType: 'indefinido' },

    // Sevilla 2
    { id: '2-1', name: 'FRANCISCO MESA MOLINA', establishmentId: '2', weeklyHours: 40, active: true, category: 'Empleado', initials: 'FM', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-2', name: 'ANGEL RAFA MORENO LANCHA', establishmentId: '2', weeklyHours: 24, active: true, category: 'Empleado', initials: 'RML', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-3', name: 'MANU SOLIER', establishmentId: '2', weeklyHours: 40, active: true, category: 'Empleado', initials: 'MS', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-4', name: 'ALICIA peñuela', establishmentId: '2', weeklyHours: 32, active: true, category: 'Empleado', initials: 'APM', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-5', name: 'JOSE CARLOS BARRIENTOS', establishmentId: '2', weeklyHours: 40, active: true, category: 'Empleado', initials: 'JCB', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-6', name: 'JUAN MANU HIDALGO RAMIREZ', establishmentId: '2', weeklyHours: 40, active: true, category: 'Empleado', initials: 'JMH', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-7', name: 'Gonzalo Gonzalez Sosa', establishmentId: '2', weeklyHours: 40, active: true, category: 'Empleado', initials: 'GG', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-8', name: 'EVA MARIA JIMENEZ PERALTA', establishmentId: '2', weeklyHours: 20, active: true, category: 'Empleado', initials: 'EJP', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-9', name: 'TOÑI CASTRO MESA', establishmentId: '2', weeklyHours: 40, active: true, category: 'Empleado', initials: 'TC', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-10', name: 'MARIA BELEN MATEOS PEREZ', establishmentId: '2', weeklyHours: 26, active: true, category: 'Empleado', initials: 'BMP', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-11', name: 'RUBEN NOGUERO LOBO', establishmentId: '2', weeklyHours: 32, active: true, category: 'Responsable', initials: 'RNL', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-12', name: 'ALBERTO CONDE OLMO', establishmentId: '2', weeklyHours: 40, active: true, category: 'Empleado', initials: 'AOC', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-13', name: 'ANGEL Luna Perejon', establishmentId: '2', weeklyHours: 24, active: true, category: 'Empleado', initials: 'ALP', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-14', name: 'ALEJANDRO GUERRA', establishmentId: '2', weeklyHours: 32, active: true, category: 'Empleado', initials: 'AGR', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-15', name: 'PAOLA SANDOVAL', establishmentId: '2', weeklyHours: 24, active: true, category: 'Empleado', initials: 'PES', hoursDebt: 0, contractType: 'indefinido' },
    { id: '2-16', name: 'Monica Gomez', establishmentId: '2', weeklyHours: 40, active: true, category: 'Empleado', initials: 'mg', hoursDebt: 0, contractType: 'indefinido' },
];

interface StoreContextType {
    employees: Employee[];
    schedules: WeeklySchedule[];
    breakLogs: BreakLog[];
    employeeLogs: EmployeeLog[];
    settings: StoreSettings[];
    timeOffRequests: TimeOffRequest[];
    permanentRequests: PermanentRequest[];
    hoursDebtLogs: HoursDebtLog[];
    notifications: Notification[];
    // Tasks
    tasks: Task[];
    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    triggerCyclicalTask: (taskId: string) => void;
    updateTaskStatus: (taskId: string, storeId: string, status: TaskStatus, userId?: string, initials?: string) => void;

    markNotificationAsRead: (id: string) => void;
    removeNotification: (id: string) => void;
    addEmployee: (employee: Omit<Employee, 'id' | 'active' | 'hoursDebt'>) => string;
    deactivateEmployee: (id: string, reason: string, contractEndDate?: string) => void;
    reactivateEmployee: (id: string, options?: { contractType?: 'indefinido' | 'temporal', contractEndDate?: string, substitutingId?: string }) => void;
    updateEmployee: (id: string, updates: Partial<Employee>) => void;
    // Incentives
    incentiveReports: IncentiveReport[];
    updateIncentiveReport: (report: IncentiveReport) => void;
    // ILT Reports
    iltReports: ILTReport[];
    addILTReport: (report: ILTReport) => void;
    tracker: (type: 'hire' | 'termination' | 'modification', details: string, employeeId: string, establishmentId: string) => void;
    startBreak: (employeeId: string) => void;
    endBreak: (logId: string) => void;
    createSchedule: (establishmentId: string, weekStartDate: string, force?: boolean) => WeeklySchedule;
    updateShift: (scheduleId: string, shiftId: string, updates: Partial<Shift>) => void;
    publishSchedule: (scheduleId: string) => void;
    getSettings: (establishmentId: string) => StoreSettings;
    getManagerNames: (establishmentId: string) => string;
    updateSettings: (newSettings: StoreSettings) => void;
    addTimeOff: (request: Omit<TimeOffRequest, 'id' | 'status'>) => void;
    removeTimeOff: (id: string) => void;
    updateTimeOff: (id: string, updates: Partial<TimeOffRequest>) => void;
    addPermanentRequest: (req: Omit<PermanentRequest, 'id'>) => void;
    removePermanentRequest: (id: string) => void;
    updatePermanentRequest: (id: string, updates: Partial<PermanentRequest>) => void;
    updateHoursDebt: (employeeId: string, amount: number, reason: string, scheduleId?: string) => void;
    addTempHours: (employeeId: string, adjustment: Omit<TemporaryHoursAdjustment, 'id'>) => void;
    removeTempHours: (employeeId: string, adjustmentId: string) => void;
    updateScheduleStatus: (scheduleId: string, status: 'draft' | 'pending' | 'approved' | 'rejected', notes?: string) => void;
    requestScheduleModification: (scheduleId: string, reason: string) => void;
    respondToModificationRequest: (scheduleId: string, status: 'approved' | 'rejected', notes?: string) => void;
    resetData: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);



export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
    const [breakLogs, setBreakLogs] = useState<BreakLog[]>([]);
    const [employeeLogs, setEmployeeLogs] = useState<EmployeeLog[]>([]);
    const [settings, setSettings] = useState<StoreSettings[]>([]);
    const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
    const [permanentRequests, setPermanentRequests] = useState<PermanentRequest[]>([]);
    const [hoursDebtLogs, setHoursDebtLogs] = useState<HoursDebtLog[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [incentiveReports, setIncentiveReports] = useState<IncentiveReport[]>([]);
    const [iltReports, setILTReports] = useState<ILTReport[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from LocalStorage
    useEffect(() => {
        const storedData = localStorage.getItem('saas_schedule_clean_v2');
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                if (parsed.employees && parsed.employees.length > 0) {
                    setEmployees((parsed.employees || []).map((e: any) => ({
                        ...e,
                        hoursDebt: e.hoursDebt || 0
                    })));
                    setSchedules(parsed.schedules || []);
                    setBreakLogs(parsed.breakLogs || []);
                    setEmployeeLogs(parsed.employeeLogs || []);
                    setSettings((parsed.settings || []).map((s: any) => ({
                        ...s,
                        holidays: (s.holidays || []).map((h: any) => (typeof h === 'string' ? { date: h, type: 'full' } : h))
                    })));
                    setTimeOffRequests(parsed.timeOffRequests || []);
                    setPermanentRequests(parsed.permanentRequests || []);
                    setHoursDebtLogs(parsed.hoursDebtLogs || []);
                    setNotifications(parsed.notifications || []);
                    setIncentiveReports(parsed.incentiveReports || []);
                    setILTReports(parsed.iltReports || []);
                    // Filter tasks: Keep cyclical tasks, remove specific tasks older than 60 days
                    const limitDate = new Date();
                    limitDate.setDate(limitDate.getDate() - 60);
                    const limitStr = limitDate.toISOString().split('T')[0];

                    setTasks((parsed.tasks || []).filter((t: any) => {
                        if (t.isCyclical) return true; // Always keep cyclical definitions

                        if (t.type === 'specific_date' && t.date) {
                            return t.date >= limitStr;
                        }

                        // Fallback for tasks without specific rules, use creation date
                        if (t.createdAt) {
                            try {
                                return t.createdAt.split('T')[0] >= limitStr;
                            } catch (e) { return true; }
                        }
                        return true;
                    }));
                } else {
                    console.warn("Storage found but empty/corrupted. Re-seeding...");
                    throw new Error("Empty employees list");
                }
            } catch (error) {
                console.error('Error parsing stored data or corrupted, resetting:', error);
                // Fallback to seeding
                setEmployees(INITIAL_EMPLOYEES);
                setSchedules([]);
                setTimeOffRequests([]);
                setNotifications([]);
                setTasks([]);
                setPermanentRequests([
                    {
                        id: 'seed-req-eva-morning',
                        employeeId: '1-5',
                        type: 'morning_only',
                        days: [1, 2, 3, 4, 5],
                        exceptions: []
                    },
                    {
                        id: 'seed-req-eva-weekend',
                        employeeId: '1-5',
                        type: 'specific_days_off',
                        days: [0, 6],
                        exceptions: []
                    }
                ]);
            }
        } else {
            console.log("Seeding initial employees...", INITIAL_EMPLOYEES.length);
            setEmployees(INITIAL_EMPLOYEES);
            setSchedules([]);
            setTimeOffRequests([]);
            setNotifications([]);
            setIncentiveReports([]);
            setILTReports([]);
            setTasks([]);
            setPermanentRequests([
                {
                    id: 'seed-req-eva-morning',
                    employeeId: '1-5', // Eva Maria Marco Anacleto
                    type: 'morning_only',
                    days: [1, 2, 3, 4, 5], // Lunes a Viernes
                    exceptions: []
                },
                {
                    id: 'seed-req-eva-weekend',
                    employeeId: '1-5',
                    type: 'specific_days_off',
                    days: [0, 6], // Domingo y Sábado
                    exceptions: []
                }
            ]);
        }
        setIsLoaded(true);
    }, []);

    // Hotfix removed: Was potentially reverting manual changes to employee category.

    // Save to LocalStorage
    useEffect(() => {
        if (!isLoaded) return;
        try {
            const data = { employees, schedules, breakLogs, employeeLogs, settings, timeOffRequests, permanentRequests, hoursDebtLogs, notifications, tasks, incentiveReports, iltReports };
            localStorage.setItem('saas_schedule_clean_v2', JSON.stringify(data));
        } catch (error) {
            console.error("CRITICAL: Failed to save to localStorage. Quota might be exceeded.", error);
            // Optionally notify user via toast if accessible, or just log for now
        }
    }, [employees, schedules, breakLogs, employeeLogs, settings, timeOffRequests, permanentRequests, hoursDebtLogs, notifications, tasks, incentiveReports]);

    // Check Cyclical Tasks daily/on-mount
    useEffect(() => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
        const dayOfMonth = today.getDate(); // 1-31

        // Helper to format date + days
        const addDays = (d: Date, days: number) => {
            const res = new Date(d);
            res.setDate(res.getDate() + days);
            return res.toISOString().split('T')[0];
        };

        setTasks(prevTasks => {
            let hasChanges = false;
            const updatedTasks = prevTasks.map(task => {
                if (!task.isCyclical || task.isArchived) return task;
                if (task.lastActivatedDate === todayStr) return task; // Already ran today

                let shouldRun = false;

                if (task.cycleUnit === 'weeks') {
                    // Weekly Frequency
                    if (task.cyclicalDayOfWeek === dayOfWeek) {
                        if (!task.lastActivatedDate) {
                            shouldRun = true;
                        } else {
                            const lastRun = new Date(task.lastActivatedDate);
                            const diffTime = Math.abs(today.getTime() - lastRun.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            const frequencyDays = (task.cycleFrequency || 1) * 7;

                            // Allow a buffer (e.g. if it ran 14 days ago, and today matches dayOfWeek, run it)
                            if (diffDays >= frequencyDays - 1) {
                                shouldRun = true;
                            }
                        }
                    }

                } else if (task.cycleUnit === 'months') {
                    // Monthly Frequency
                    if (task.cyclicalDayOfMonth === dayOfMonth) {
                        if (!task.lastActivatedDate) {
                            shouldRun = true;
                        } else {
                            const lastRun = new Date(task.lastActivatedDate);
                            // Simple month diff check
                            const monthsSince = (today.getFullYear() - lastRun.getFullYear()) * 12 + (today.getMonth() - lastRun.getMonth());

                            if (monthsSince >= (task.cycleFrequency || 1)) {
                                shouldRun = true;
                            }
                        }
                    }
                }

                if (shouldRun) {
                    hasChanges = true;
                    const duration = task.durationDays || 1;
                    const newDueDate = addDays(today, duration);

                    return {
                        ...task,
                        status: {},
                        lastActivatedDate: todayStr,
                        date: newDueDate
                    };
                }
                return task;
            });

            return hasChanges ? updatedTasks : prevTasks;
        });
    }, []);


    const tracker = (type: 'hire' | 'termination' | 'modification', details: string, employeeId: string, establishmentId: string) => {
        const newLog: EmployeeLog = {
            id: crypto.randomUUID(),
            employeeId,
            type,
            details,
            date: new Date().toISOString(),
            establishmentId
        };
        setEmployeeLogs(prev => [newLog, ...prev]);
    };

    const addEmployee = (employeeData: Omit<Employee, 'id' | 'active' | 'hoursDebt'>) => {
        const newEmployee: Employee = {
            ...employeeData,
            id: crypto.randomUUID(),
            active: true,
            hoursDebt: 0,
            contractStartDate: employeeData.seniorityDate, // Explicitly save this as the contract start date
            history: [{
                date: new Date().toISOString(),
                type: 'hired',
                reason: 'Alta inicial',
                contractStartDate: employeeData.seniorityDate
            }]
        };
        setEmployees(prev => [...prev, newEmployee]);
        tracker('hire', `Alta de empleado: ${newEmployee.name} (${newEmployee.category})`, newEmployee.id, newEmployee.establishmentId);
        return newEmployee.id;
    };

    const updateEmployee = (id: string, updates: Partial<Employee>) => {
        console.log(`Updating employee ${id}:`, updates);
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
        const emp = employees.find(e => e.id === id);
        if (emp) {
            tracker('modification', `Modificación ficha: ${Object.keys(updates).join(', ')}`, id, emp.establishmentId);
        }
    };

    const deactivateEmployee = (id: string, reason: string, contractEndDate?: string) => {
        const emp = employees.find(e => e.id === id);
        if (emp) {
            tracker('termination', `Baja de empleado: ${emp.name}. Motivo: ${reason}`, id, emp.establishmentId);

            // 1. Mark as Inactive in History
            setEmployees(prev => prev.map(e => e.id === id ? {
                ...e,
                active: false,
                contractEndDate: contractEndDate, // Save the actual end date if provided
                history: [...(e.history || []), {
                    date: new Date().toISOString(),
                    type: 'terminated',
                    reason,
                    contractEndDate
                }]
            } : e));

            // 2. Remove all Permanent Requests
            setPermanentRequests(prev => prev.filter(req => req.employeeId !== id));

            // 3. Remove FUTURE vacations (vacations starting AFTER today)
            // 4. End Active Sick Leave TODAY
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            setTimeOffRequests(prev => {
                const updatedRequests: TimeOffRequest[] = [];
                prev.forEach(req => {
                    if (req.employeeId !== id) {
                        updatedRequests.push(req);
                        return;
                    }

                    // Handle Employee's Requests
                    if (req.type === 'vacation') {
                        // If it starts in the future, skip it (remove)
                        const start = new Date(req.startDate || req.dates[0]);
                        if (start > today) return;

                        // If it's already started but spans future, we could trim it, 
                        // but user asked "vacaciones que tuviese planificadas despues de su baja".
                        // Assuming purely future ones for now or just letting past stay.
                        // If it overlaps, maybe we should clamp end date? 
                        // Let's just remove FUTURE ones as requested.
                        updatedRequests.push(req);
                    } else if (req.type === 'sick_leave') {
                        // If active sick leave, end it today
                        const start = new Date(req.startDate || '');
                        const end = new Date(req.endDate || '');

                        // If future strict, remove
                        if (start > today) return;

                        // If active (start <= today <= end), update endDate to today (ISO string)
                        // Actually, endDate is string YYYY-MM-DD usually.
                        if (end >= today || !req.endDate) {
                            updatedRequests.push({
                                ...req,
                                endDate: today.toISOString().split('T')[0]
                            });
                        } else {
                            // Past sick leave, keep it
                            updatedRequests.push(req);
                        }
                    } else {
                        // Other types (day_off etc), remove future? Keep simple
                        updatedRequests.push(req);
                    }
                });
                return updatedRequests;
            });
        }
    };

    const reactivateEmployee = (id: string, options?: { contractType?: 'indefinido' | 'temporal', contractEndDate?: string, substitutingId?: string }) => {
        const emp = employees.find(e => e.id === id);
        if (emp) {
            let reason = 'Reincorporación';
            if (options?.substitutingId) {
                const subsEmp = employees.find(se => se.id === options.substitutingId);
                if (subsEmp) {
                    reason += ` (Sustitución de ${subsEmp.name})`;
                }
            } else if (options?.contractType === 'temporal' && options?.contractEndDate) {
                reason += ` (Temporal hasta ${options.contractEndDate})`;
            }

            tracker('hire', `Reactivación de empleado: ${emp.name}`, id, emp.establishmentId);
            setEmployees(prev => prev.map(e => e.id === id ? {
                ...e,
                active: true,
                contractType: options?.contractType || e.contractType || 'indefinido',
                contractEndDate: options?.contractEndDate, // Clear or set
                substitutingId: options?.substitutingId, // Set substitution
                history: [...(e.history || []), {
                    date: new Date().toISOString(),
                    type: 'rehired',
                    reason: reason
                }]
            } : e));
        }
    };

    const startBreak = (employeeId: string) => {
        const newLog: BreakLog = {
            id: crypto.randomUUID(),
            employeeId,
            startTime: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
        };
        setBreakLogs(prev => [...prev, newLog]);
    };

    const endBreak = (logId: string) => {
        setBreakLogs(prev => prev.map(log => {
            if (log.id === logId) {
                return { ...log, endTime: new Date().toISOString() };
            }
            return log;
        }));
    };

    const getSettings = (establishmentId: string): StoreSettings => {
        const existing = settings.find(s => s.establishmentId === establishmentId);
        if (existing) return existing;

        const newSettings: StoreSettings = {
            ...DEFAULT_SETTINGS,
            establishmentId,
            storeName: DEFAULT_STORE_NAMES[establishmentId] || `Tienda ${establishmentId}`,
            managerName: '',
            contactEmail: ''
        };
        return newSettings;
    };

    const getManagerNames = (establishmentId: string): string => {
        const managers = employees.filter(e => e.establishmentId === establishmentId && e.active && e.category === 'Gerente');
        if (managers.length === 0) return '';

        // Format: "Name1", "Name1 y Name2", "Name1, Name2 y Name3"
        const names = managers.map(m => m.name.split(' ')[0]); // Use first names
        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]} y ${names[1]}`;
        return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
    };

    const updateSettings = (newSettings: StoreSettings) => {
        setSettings(prev => {
            const index = prev.findIndex(s => s.establishmentId === newSettings.establishmentId);
            if (index >= 0) {
                const copy = [...prev];
                copy[index] = newSettings;
                return copy;
            }
            return [...prev, newSettings];
        });
    };

    const createSchedule = (establishmentId: string, weekStartDate: string, force: boolean = false) => {
        const existingIndex = schedules.findIndex(s => s.establishmentId === establishmentId && s.weekStartDate === weekStartDate);

        if (existingIndex >= 0) {
            if (!force) {
                throw new Error('Ya existe un horario para esa semana.');
            }
            // If forcing, we don't throw, we just proceed. The setSchedules below will filter out the old one.
        }

        const establishmentEmployees = employees.filter(e => e.establishmentId === establishmentId);
        if (establishmentEmployees.length === 0) {
            throw new Error('No hay empleados para generar un horario.');
        }

        // Fetch fresh settings
        const storeSettings = getSettings(establishmentId);
        const storeTimeOff = timeOffRequests.filter(r => establishmentEmployees.some(e => e.id === r.employeeId));

        const newSchedule = generateWeeklySchedule(
            establishmentId,
            establishmentEmployees,
            weekStartDate,
            storeSettings.holidays,
            storeTimeOff,
            storeSettings,
            permanentRequests
                .filter(pr => establishmentEmployees.some(e => e.id === pr.employeeId))
                .filter(pr => !pr.exceptions?.includes(weekStartDate))
        );

        setSchedules(prev => {
            if (force) {
                // Remove existing if forcing
                return [...prev.filter(s => !(s.establishmentId === establishmentId && s.weekStartDate === weekStartDate)), newSchedule];
            }
            return [...prev, newSchedule];
        });

        return newSchedule;
    };

    const updateShift = (scheduleId: string, shiftId: string, updates: Partial<Shift>) => {
        setSchedules(prev => prev.map(sch => {
            if (sch.id !== scheduleId) return sch;

            const updatedShifts = sch.shifts.map(shift => {
                if (shift.id !== shiftId) return shift;
                return { ...shift, ...updates };
            });

            return { ...sch, shifts: updatedShifts };
        }));
    };

    const publishSchedule = (scheduleId: string) => {
        // Now requesting approval instead of direct publish
        setSchedules(prev => prev.map(s => s.id === scheduleId ? {
            ...s,
            status: 'published',
            approvalStatus: 'pending',
            submittedAt: new Date().toISOString(),
            modificationStatus: 'none',
            modificationReason: undefined
        } : s));
    };

    const updateScheduleStatus = (scheduleId: string, status: 'draft' | 'pending' | 'approved' | 'rejected', notes?: string) => {
        setSchedules(prev => prev.map(s => {
            if (s.id !== scheduleId) return s;
            return {
                ...s,
                approvalStatus: status,
                supervisorNotes: notes !== undefined ? notes : s.supervisorNotes,
                status: status === 'approved' ? 'published' : s.status,
                // Clear snapshot if approved (cycle complete), otherwise keep it
                originalShiftsSnapshot: status === 'approved' ? undefined : s.originalShiftsSnapshot
            };
        }));

        // Notification Logic
        if (status === 'approved' || status === 'rejected') {
            const sched = schedules.find(s => s.id === scheduleId);
            if (sched) {
                const message = status === 'approved'
                    ? `Tu horario de la semana ${sched.weekStartDate} ha sido APROBADO.`
                    : `Tu horario de la semana ${sched.weekStartDate} ha sido RECHAZADO. Revisa las notas.`;

                const newNotif: Notification = {
                    id: crypto.randomUUID(),
                    establishmentId: sched.establishmentId,
                    message,
                    type: status === 'approved' ? 'success' : 'error',
                    read: false,
                    createdAt: new Date().toISOString(),
                    linkTo: '/horarios'
                };
                setNotifications(prev => [newNotif, ...prev]);
            }
        }
    };

    const requestScheduleModification = (scheduleId: string, reason: string) => {
        setSchedules(prev => prev.map(s => s.id === scheduleId ? {
            ...s,
            modificationStatus: 'requested',
            modificationReason: reason
        } : s));
    };

    const respondToModificationRequest = (scheduleId: string, status: 'approved' | 'rejected', notes?: string) => {
        setSchedules(prev => prev.map(s => s.id === scheduleId ? {
            ...s,
            modificationStatus: status,
            supervisorNotes: notes || s.supervisorNotes,
            originalShiftsSnapshot: status === 'approved' ? JSON.parse(JSON.stringify(s.shifts)) : s.originalShiftsSnapshot
        } : s));

        // Notification Logic
        const sched = schedules.find(s => s.id === scheduleId);
        if (sched) {
            const message = status === 'approved'
                ? `Solicitud de modificación APROBADA para la semana ${sched.weekStartDate}. Ya puedes editar.`
                : `Solicitud de modificación DENEGADA para la semana ${sched.weekStartDate}.`;

            const newNotif: Notification = {
                id: crypto.randomUUID(),
                establishmentId: sched.establishmentId,
                message,
                type: status === 'approved' ? 'success' : 'error',
                read: false,
                createdAt: new Date().toISOString(),
                linkTo: '/horarios'
            };
            setNotifications(prev => [newNotif, ...prev]);
        }
    };

    const markNotificationAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const addTimeOff = (req: Omit<TimeOffRequest, 'id' | 'status'>) => {
        const requestId = crypto.randomUUID();
        setTimeOffRequests(prev => [...prev, { ...req, id: requestId, status: 'approved' }]);

        // Notify supervisor if it's a sick leave in a published week
        if (req.type === 'sick_leave') {
            const emp = employees.find(e => e.id === req.employeeId);
            if (!emp) return;

            const dates = req.dates || [];
            // Check if any date belongs to a published schedule
            const affectedPublishedSchedules = schedules.filter(s =>
                s.establishmentId === emp.establishmentId &&
                s.approvalStatus === 'approved' &&
                dates.some(d => {
                    const date = new Date(d);
                    const weekStart = new Date(s.weekStartDate);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    return date >= weekStart && date <= weekEnd;
                })
            );

            if (affectedPublishedSchedules.length > 0) {
                const storeName = getSettings(emp.establishmentId).storeName || `Tienda ${emp.establishmentId}`;
                const newNotif: Notification = {
                    id: crypto.randomUUID(),
                    establishmentId: 'admin',
                    message: `Baja Médica: ${emp.name} en ${storeName} (Horario Publicado)`,
                    type: 'warning',
                    read: false,
                    createdAt: new Date().toISOString(),
                    linkTo: '/supervision'
                };
                setNotifications(prev => [newNotif, ...prev]);
            }
        }
    };

    const removeTimeOff = (id: string) => {
        setTimeOffRequests(prev => prev.filter(r => r.id !== id));
    };

    const updateTimeOff = (id: string, updates: Partial<TimeOffRequest>) => {
        setTimeOffRequests(prev => prev.map(req => req.id === id ? { ...req, ...updates } : req));
    };

    const addPermanentRequest = (req: Omit<PermanentRequest, 'id'>) => {
        setPermanentRequests(prev => [...prev, { ...req, id: crypto.randomUUID() }]);
    };

    const removePermanentRequest = (id: string) => {
        setPermanentRequests(prev => prev.filter(p => p.id !== id));
    };

    const updatePermanentRequest = (id: string, updates: Partial<PermanentRequest>) => {
        setPermanentRequests(prev => prev.map(req => req.id === id ? { ...req, ...updates } : req));
    };

    const updateHoursDebt = (employeeId: string, amount: number, reason: string, scheduleId?: string) => {
        setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, hoursDebt: (e.hoursDebt || 0) + amount } : e));

        const newLog: HoursDebtLog = {
            id: crypto.randomUUID(),
            employeeId,
            amount,
            reason,
            date: new Date().toISOString(),
            scheduleId
        };
        setHoursDebtLogs(prev => [newLog, ...prev]);
    };

    const addTempHours = (employeeId: string, adjustment: Omit<TemporaryHoursAdjustment, 'id'>) => {
        setEmployees(prev => prev.map(e => {
            if (e.id !== employeeId) return e;
            const newAdj = { ...adjustment, id: crypto.randomUUID() };
            return {
                ...e,
                tempHours: [...(e.tempHours || []), newAdj]
            };
        }));
    };

    const removeTempHours = (employeeId: string, adjustmentId: string) => {
        setEmployees(prev => prev.map(e => {
            if (e.id !== employeeId) return e;
            return {
                ...e,
                tempHours: (e.tempHours || []).filter(h => h.id !== adjustmentId)
            };
        }));
    };

    // Task Management
    const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
        const newTask: Task = {
            ...taskData,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            status: {} // Initialize empty status map
        };
        setTasks(prev => [newTask, ...prev]);
    };

    const updateTask = (id: string, updates: Partial<Task>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const triggerCyclicalTask = (taskId: string) => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        setTasks(prev => prev.map(task => {
            if (task.id !== taskId) return task;

            const duration = task.durationDays || 1;
            const res = new Date(today);
            res.setDate(res.getDate() + duration);
            const newDueDate = res.toISOString().split('T')[0];

            return {
                ...task,
                status: {},
                lastActivatedDate: todayStr,
                date: newDueDate
            };
        }));
    };

    const deleteTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const updateTaskStatus = (taskId: string, storeId: string, status: TaskStatus, userId?: string, initials?: string) => {
        setTasks(prev => prev.map(t => {
            if (t.id !== taskId) return t;
            return {
                ...t,
                status: {
                    ...t.status,
                    [storeId]: {
                        storeId,
                        status,
                        lastUpdated: new Date().toISOString(),
                        completedBy: userId,
                        completedByInitials: initials
                    }
                }
            };
        }));
    };

    const updateIncentiveReport = (report: IncentiveReport) => {
        setIncentiveReports(prev => {
            const exists = prev.find(r => r.id === report.id);
            if (exists) {
                return prev.map(r => r.id === report.id ? report : r);
            }
            return [...prev, report];
        });
    };

    const addILTReport = (report: ILTReport) => {
        setILTReports(prev => {
            // Replace if exists for same month/shop? Or just append? User said history.
            // Usually, we overwrite if same ID, or append if new.
            const exists = prev.findIndex(r => r.id === report.id);
            if (exists >= 0) {
                const copy = [...prev];
                copy[exists] = report;
                return copy;
            }
            return [...prev, report];
        });
    };

    const resetData = () => {
        setSchedules([]);
        setHoursDebtLogs([]);
        setEmployees(prev => {
            const updatedEmployees = prev.map(e => ({ ...e, hoursDebt: 0 }));

            // FORCE SAVE TO LOCALSTORAGE HERE TO PREVENT RACE CONDITION WITH RELOAD
            const dataToSave = {
                employees: updatedEmployees,
                schedules: [],
                breakLogs,
                employeeLogs,
                settings,
                timeOffRequests,
                permanentRequests,
                hoursDebtLogs: [],
                notifications: [],
                tasks: []
            };
            localStorage.setItem('saas_schedule_clean_v2', JSON.stringify(dataToSave));

            return updatedEmployees;
        });
    };

    return (
        <StoreContext.Provider value={{
            employees, schedules, breakLogs, employeeLogs, settings, timeOffRequests, permanentRequests,
            addEmployee, deactivateEmployee, reactivateEmployee, updateEmployee, tracker,
            startBreak, endBreak,
            createSchedule, updateShift, publishSchedule, updateScheduleStatus,
            getSettings, updateSettings,
            addTimeOff, removeTimeOff, updateTimeOff,
            addPermanentRequest, removePermanentRequest, updatePermanentRequest,

            hoursDebtLogs, updateHoursDebt, addTempHours, removeTempHours, resetData, requestScheduleModification, respondToModificationRequest, getManagerNames,
            notifications, markNotificationAsRead, removeNotification,
            tasks, addTask, updateTask, deleteTask, triggerCyclicalTask, updateTaskStatus,
            incentiveReports, updateIncentiveReport,
            iltReports, addILTReport
        }}>

            {children}
        </StoreContext.Provider>
    );
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (context === undefined) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};
