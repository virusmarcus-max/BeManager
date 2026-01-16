import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Employee, WeeklySchedule, BreakLog, StoreSettings, TimeOffRequest, EmployeeLog, Shift, PermanentRequest, HoursDebtLog, TemporaryHoursAdjustment, Notification, Task, TaskStatus, IncentiveReport, ILTReport } from '../types';
import { generateWeeklySchedule } from '../services/scheduler';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';
import { db } from '../firebase';
import { calculateWeeklyHours } from '../utils/hoursUtils';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, getDocs, getDoc, increment, deleteField, where } from 'firebase/firestore';

// Polyfill for environments where crypto.randomUUID is not available (e.g. non-HTTPS)
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fallback if it fails
        }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

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
    addEmployee: (employee: Omit<Employee, 'id' | 'active' | 'hoursDebt'>) => Promise<string>;
    deactivateEmployee: (id: string, reason: string, contractEndDate?: string) => void;
    deleteEmployee: (id: string) => Promise<void>;
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
    updateSettings: (newSettings: StoreSettings) => Promise<void>;
    addTimeOff: (request: Omit<TimeOffRequest, 'id' | 'status'>) => Promise<void>;
    removeTimeOff: (id: string) => void;
    updateTimeOff: (id: string, updates: Partial<TimeOffRequest>) => void;
    addPermanentRequest: (req: Omit<PermanentRequest, 'id'>) => void;
    removePermanentRequest: (id: string) => void;
    updatePermanentRequest: (id: string, updates: Partial<PermanentRequest>) => void;
    updateHoursDebt: (employeeId: string, amount: number, reason: string, scheduleId?: string) => void;
    addTempHours: (employeeId: string, adjustment: Omit<TemporaryHoursAdjustment, 'id'>) => void;
    removeTempHours: (employeeId: string, adjustmentId: string) => void;
    updateScheduleStatus: (scheduleId: string, status: 'draft' | 'pending' | 'approved' | 'rejected', notes?: string) => Promise<void>;
    requestScheduleModification: (scheduleId: string, reason: string) => Promise<void>;
    respondToModificationRequest: (scheduleId: string, status: 'approved' | 'rejected', notes?: string) => Promise<void>;
    resetData: () => void;
    isLoaded: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

import { useAuth } from './AuthContext';

// ... (imports remain)

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth(); // Import user from AuthContext
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

    // Initial Migration Logic (Only if user is logged in to allow writes if needed, or if we want to migrate irrespective?
    // The previous code didn't check user, but we can't write to DB without user if rules block it.
    // Migration reads from LocalStorage, so it's fine. But writing to DB needs auth.
    // We'll move this inside the auth check or just leave it but it might fail if not logged in.
    // Safest is to do nothing until logged in.
    useEffect(() => {
        if (!user) return; // Wait for login

        const checkAndMigrate = async () => {
            // ... existing migration logic ...
            const empSnap = await getDocs(collection(db, 'employees'));
            if (!empSnap.empty) {
                // Already has data in cloud
                return;
            }

            const storedData = localStorage.getItem('saas_schedule_clean_v2');
            if (storedData) {
                try {
                    console.log("Migrating LocalStorage to Firestore...");
                    const parsed = JSON.parse(storedData);
                    const batch = writeBatch(db);

                    const collectionsToMigrate: Record<string, any[]> = {
                        employees: parsed.employees || [],
                        schedules: parsed.schedules || [],
                        breakLogs: parsed.breakLogs || [],
                        employeeLogs: parsed.employeeLogs || [],
                        settings: parsed.settings || [],
                        timeOffRequests: parsed.timeOffRequests || [],
                        permanentRequests: parsed.permanentRequests || [],
                        hoursDebtLogs: parsed.hoursDebtLogs || [],
                        notifications: parsed.notifications || [],
                        tasks: parsed.tasks || [],
                        incentiveReports: parsed.incentiveReports || [],
                        iltReports: parsed.iltReports || []
                    };

                    Object.entries(collectionsToMigrate).forEach(([colName, items]) => {
                        items.forEach(item => {
                            if (item.id || item.establishmentId) {
                                // Settings use establishmentId as ID logic
                                const docId = item.id || (colName === 'settings' ? item.establishmentId : generateUUID());
                                const ref = doc(db, colName, docId);
                                batch.set(ref, item);
                            }
                        });
                    });

                    await batch.commit();
                    console.log("Migration Complete!");
                } catch (error) {
                    console.error("Migration failed:", error);
                }
            }
        };

        checkAndMigrate();
    }, [user]);

    // Firestore Listeners
    useEffect(() => {
        if (!user) {
            setEmployees([]);
            setSchedules([]);
            // ... reset others if needed, though they will just be stale until next login
            setIsLoaded(false);
            return;
        }

        const unsubs: (() => void)[] = [];
        let loadedCount = 0;
        const totalCollections = 12;

        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount >= totalCollections) {
                setIsLoaded(true);
            }
        };

        const subscribe = (colName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
            const q = query(collection(db, colName));
            return onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                setter(data);
                // We only count the FIRST load for isLoaded
                if (loadedCount < totalCollections) checkLoaded();
            }, (error) => {
                console.error(`Error listening to ${colName}:`, error);
                // Even on error we should probably 'proceed' or handle it, but for now allow loading to finish
                if (loadedCount < totalCollections) checkLoaded();
            });
        };

        unsubs.push(subscribe('employees', setEmployees));
        unsubs.push(subscribe('schedules', setSchedules));
        unsubs.push(subscribe('breakLogs', setBreakLogs));
        unsubs.push(subscribe('employeeLogs', setEmployeeLogs));
        unsubs.push(subscribe('settings', setSettings));
        unsubs.push(subscribe('timeOffRequests', setTimeOffRequests));
        unsubs.push(subscribe('permanentRequests', setPermanentRequests));
        unsubs.push(subscribe('hoursDebtLogs', setHoursDebtLogs));
        unsubs.push(subscribe('notifications', setNotifications));
        unsubs.push(subscribe('tasks', setTasks));
        unsubs.push(subscribe('incentiveReports', setIncentiveReports));
        unsubs.push(subscribe('iltReports', setILTReports));

        // Just in case some fail or are empty, ensure we don't hang forever?
        // Firestore onSnapshot fires immediately with empty set if empty.

        return () => unsubs.forEach(u => u());
    }, [user]);

    // Check Cyclical Tasks daily (Logic moved to backend trigger ideally, but keeping frontend check for now)
    useEffect(() => {
        if (!isLoaded || tasks.length === 0) return;

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
        const dayOfMonth = today.getDate(); // 1-31

        const addDays = (d: Date, days: number) => {
            const res = new Date(d);
            res.setDate(res.getDate() + days);
            return res.toISOString().split('T')[0];
        };

        tasks.forEach(async (task) => {
            if (!task.isCyclical || task.isArchived) return;
            if (task.lastActivatedDate === todayStr) return;

            let shouldRun = false;

            if (task.cycleUnit === 'weeks') {
                // Weekly Frequency logic
                if (task.cyclicalDayOfWeek === dayOfWeek) {
                    if (!task.lastActivatedDate) {
                        shouldRun = true;
                    } else {
                        const lastRun = new Date(task.lastActivatedDate);
                        const diffTime = Math.abs(today.getTime() - lastRun.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const frequencyDays = (task.cycleFrequency || 1) * 7;
                        if (diffDays >= frequencyDays - 1) shouldRun = true;
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
                const duration = task.durationDays || 1;
                const newDueDate = addDays(today, duration);
                // Update Firestore
                await updateDoc(doc(db, 'tasks', task.id), {
                    status: {},
                    lastActivatedDate: todayStr,
                    date: newDueDate
                });
            }
        });
    }, [isLoaded, tasks]); // Dependency on tasks ensures we check when tasks load


    const tracker = async (type: 'hire' | 'termination' | 'modification', details: string, employeeId: string, establishmentId: string) => {
        const id = generateUUID();
        const newLog: EmployeeLog = {
            id,
            employeeId,
            type,
            details,
            date: new Date().toISOString(),
            establishmentId
        };
        try {
            await setDoc(doc(db, 'employeeLogs', id), newLog);
        } catch (e) {
            console.error("Error logging:", e);
        }
    };

    const addEmployee = async (employeeData: Omit<Employee, 'id' | 'active' | 'hoursDebt'>): Promise<string> => {
        const id = generateUUID();
        const newEmployee: Employee = {
            ...employeeData,
            id,
            active: true,
            hoursDebt: 0,
            contractStartDate: employeeData.seniorityDate,
            history: [{
                date: new Date().toISOString(),
                type: 'hired',
                reason: 'Alta inicial',
                contractStartDate: employeeData.seniorityDate
            }]
        };

        // Sanitize: Remove undefined values for Firestore
        const sanitizedEmployee = JSON.parse(JSON.stringify(newEmployee));

        try {
            await setDoc(doc(db, 'employees', id), sanitizedEmployee);
            // Only track if successful
            tracker('hire', `Alta de empleado: ${newEmployee.name} (${newEmployee.category})`, newEmployee.id, newEmployee.establishmentId);
            return id;
        } catch (error) {
            console.error("Error adding employee:", error);
            throw error;
        }
    };

    const updateEmployee = async (id: string, updates: Partial<Employee>) => {


        console.log(`[StoreContext] Updating employee ID: ${id}`, updates);
        const emp = employees.find(e => e.id === id);

        try {
            if (emp) {
                // Handle deletion of fields (specifically contractEndDate if null)
                const firestoreUpdates: any = { ...updates };
                if (firestoreUpdates.contractEndDate === null) {
                    console.log('Deleting contractEndDate field');
                    firestoreUpdates.contractEndDate = deleteField();
                }

                // Sanitize undefined values
                Object.keys(firestoreUpdates).forEach(key => {
                    if (firestoreUpdates[key] === undefined) {
                        delete firestoreUpdates[key];
                    }
                });

                await updateDoc(doc(db, 'employees', id), firestoreUpdates);
                console.log(`[StoreContext] Successfully updated employee ${id} in Firestore`);
                tracker('modification', `Modificación ficha: ${Object.keys(updates).join(', ')}`, id, emp.establishmentId);
            } else {
                console.error(`[StoreContext] Employee with ID ${id} not found in local state!`);
                throw new Error(`Empleado con ID ${id} no encontrado.`);
            }
        } catch (error) {
            console.error("Error updating employee:", error);
            throw error;
        }
    };

    const deactivateEmployee = async (id: string, reason: string, contractEndDate?: string) => {
        const emp = employees.find(e => e.id === id);
        if (emp) {
            tracker('termination', `Baja de empleado: ${emp.name}. Motivo: ${reason}`, id, emp.establishmentId);

            const batch = writeBatch(db);

            // 1. Mark as Inactive in History & Reset Debt
            if ((emp.hoursDebt || 0) !== 0) {
                const logId = generateUUID();
                const logEntry: HoursDebtLog = {
                    id: logId,
                    employeeId: id,
                    amount: -(emp.hoursDebt || 0),
                    reason: `Liquidación horas por baja (${reason})`,
                    date: new Date().toISOString()
                };
                batch.set(doc(db, 'hoursDebtLogs', logId), logEntry);
            }

            const updatedEmployee = {
                active: false,
                hoursDebt: 0,
                contractEndDate: contractEndDate,
                history: [...(emp.history || []), {
                    date: new Date().toISOString(),
                    type: 'terminated',
                    reason,
                    contractEndDate
                }]
            };
            batch.update(doc(db, 'employees', id), updatedEmployee);

            // 2. Remove all Permanent Requests
            permanentRequests.filter(req => req.employeeId === id).forEach(req => {
                batch.delete(doc(db, 'permanentRequests', req.id));
            });

            // 3. Remove FUTURE vacations
            // 4. End Active Sick Leave TODAY
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            timeOffRequests.forEach(req => {
                if (req.employeeId !== id) return;

                if (req.type === 'vacation') {
                    const start = new Date(req.startDate || req.dates[0]);
                    if (start > today) {
                        batch.delete(doc(db, 'timeOffRequests', req.id));
                    }
                } else if (req.type === 'sick_leave') {
                    const start = new Date(req.startDate || '');
                    const end = new Date(req.endDate || '');

                    if (start > today) {
                        batch.delete(doc(db, 'timeOffRequests', req.id));
                    } else if (end >= today || !req.endDate) {
                        const updatedEndDate = today.toISOString().split('T')[0];
                        batch.update(doc(db, 'timeOffRequests', req.id), { endDate: updatedEndDate });
                    }
                }
            });

            await batch.commit();
        }
    };

    const deleteEmployee = async (id: string) => {
        const emp = employees.find(e => e.id === id);
        if (!emp) return;

        console.log(`Permanently deleting employee ${id} (${emp.name})`);

        try {
            const batch = writeBatch(db);

            // 1. Delete the Employee Document
            batch.delete(doc(db, 'employees', id));

            // 2. Delete Settings config if it was a store (unlikely but safe)
            // batch.delete(doc(db, 'settings', id)); // Logic collision with establishmentId, skipping to be safe

            // 3. Delete Time Off Requests
            timeOffRequests.filter(req => req.employeeId === id).forEach(req => {
                batch.delete(doc(db, 'timeOffRequests', req.id));
            });

            // 4. Delete Permanent Requests
            permanentRequests.filter(req => req.employeeId === id).forEach(req => {
                batch.delete(doc(db, 'permanentRequests', req.id));
            });

            // 5. Delete Logs (Best effort, might be many)
            // Note: In a real large app, dragging all logs might be heavy. For this scale, it's fine.
            employeeLogs.filter(log => log.employeeId === id).forEach(log => {
                batch.delete(doc(db, 'employeeLogs', log.id));
            });

            hoursDebtLogs.filter(log => log.employeeId === id).forEach(log => {
                batch.delete(doc(db, 'hoursDebtLogs', log.id));
            });

            breakLogs.filter(log => log.employeeId === id).forEach(log => {
                batch.delete(doc(db, 'breakLogs', log.id));
            });

            // 6. Delete temp hours
            // They are inside the employee doc, so already gone.

            await batch.commit();
            tracker('termination', `Eliminación DEFINITIVA de empleado: ${emp.name}`, id, emp.establishmentId);

        } catch (error) {
            console.error("Error deleting employee:", error);
            throw error;
        }
    };

    const reactivateEmployee = async (id: string, options?: { contractType?: 'indefinido' | 'temporal', contractEndDate?: string, substitutingId?: string }) => {
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

            const updatedData = {
                active: true,
                contractType: options?.contractType || emp.contractType || 'indefinido',
                contractEndDate: options?.contractEndDate || null,
                substitutingId: options?.substitutingId || null,
                history: [...(emp.history || []), {
                    date: new Date().toISOString(),
                    type: 'rehired',
                    reason: reason
                }]
            };

            // @ts-ignore
            await updateDoc(doc(db, 'employees', id), updatedData);
        }
    };

    const startBreak = (employeeId: string) => {
        const id = generateUUID();
        const newLog: BreakLog = {
            id,
            employeeId,
            startTime: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
        };
        setDoc(doc(db, 'breakLogs', id), newLog);
    };

    const endBreak = (logId: string) => {
        const log = breakLogs.find(l => l.id === logId);
        if (log) {
            updateDoc(doc(db, 'breakLogs', logId), { endTime: new Date().toISOString() });
        }
    };

    const getSettings = (establishmentId: string): StoreSettings => {
        const existing = settings.find(s => s.establishmentId === establishmentId);
        if (existing) return existing;

        const newSettings: StoreSettings = {
            ...DEFAULT_SETTINGS,
            establishmentId,
            storeName: DEFAULT_STORE_NAMES[establishmentId] || `Tienda ${establishmentId}`,
            password: establishmentId === '1' ? 'barbapapa' : establishmentId === '2' ? 'desgraciao' : establishmentId === 'super' ? 'sirmarcus' : 'admin',
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

    const updateSettings = async (newSettings: StoreSettings) => {
        try {
            // Use establishmentId as document ID
            // Sanitize to remove undefined values which Firestore doesn't support
            const sanitizedSettings = JSON.parse(JSON.stringify(newSettings));
            await setDoc(doc(db, 'settings', newSettings.establishmentId), sanitizedSettings);
        } catch (error) {
            console.error("Error updating settings:", error);
            throw error;
        }
    };

    const updateHoursDebt = async (employeeId: string, amount: number, reason: string, scheduleId?: string) => {
        // Update Employee
        try {
            // We need to read current hoursDebt first for atomic update? 
            // Or just use increment(). Firestore has increment!
            // But we don't have atomic increment import. Let's read & update or just optimistic.
            // Actually, we can use `runTransaction` or just getDoc.
            // For simplicity in this migration, let's just getDoc.
            const empRef = doc(db, 'employees', employeeId);
            // Removed unused empSnap
            // Wait, ID is the doc ID? In addEmployee I made docID = employee.id.
            // So I can just getDoc(doc(db, 'employees', employeeId)).

            // Atomic update using increment
            await updateDoc(empRef, { hoursDebt: increment(amount) });

            const logId = generateUUID();
            const newLog: HoursDebtLog = {
                id: logId,
                employeeId,
                amount,
                reason,
                date: new Date().toISOString(),
                scheduleId: scheduleId // Undefined is fine here, sanitizer removes it
            };

            // Sanitize just in case
            const sanitizedLog = JSON.parse(JSON.stringify(newLog));
            await setDoc(doc(db, 'hoursDebtLogs', logId), sanitizedLog);
        } catch (e) {
            console.error("Error updating hours debt:", e);
            throw e; // Re-throw to alert caller
        }
    };



    const addTempHours = async (employeeId: string, adjustment: Omit<TemporaryHoursAdjustment, 'id'>) => {
        const empRef = doc(db, 'employees', employeeId);
        const empDoc = await getDoc(empRef);
        if (empDoc.exists()) {
            const current = empDoc.data().tempHours || [];
            const newAdj = { ...adjustment, id: generateUUID() };
            await updateDoc(empRef, { tempHours: [...current, newAdj] });
        }
    };

    const removeTempHours = async (employeeId: string, adjustmentId: string) => {
        const empRef = doc(db, 'employees', employeeId);
        const empDoc = await getDoc(empRef);
        if (empDoc.exists()) {
            const current = empDoc.data().tempHours || [];
            await updateDoc(empRef, {
                tempHours: current.filter((h: any) => h.id !== adjustmentId)
            });
        }
    };

    // Task Management
    const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
        const id = generateUUID();
        const newTask: Task = {
            ...taskData,
            id,
            createdAt: new Date().toISOString(),
            status: {} // Initialize empty status map
        };
        // Sanitize to remove undefined values
        const sanitizedTask = JSON.parse(JSON.stringify(newTask));
        setDoc(doc(db, 'tasks', id), sanitizedTask);
    };

    const updateTask = (id: string, updates: Partial<Task>) => {
        // Sanitize to remove undefined values
        const sanitizedUpdates = JSON.parse(JSON.stringify(updates));
        updateDoc(doc(db, 'tasks', id), sanitizedUpdates);
    };

    const triggerCyclicalTask = async (taskId: string) => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const taskDoc = tasks.find(t => t.id === taskId);

        if (taskDoc) {
            const duration = taskDoc.durationDays || 1;
            const res = new Date(today);
            res.setDate(res.getDate() + duration);
            const newDueDate = res.toISOString().split('T')[0];

            await updateDoc(doc(db, 'tasks', taskId), {
                status: {},
                lastActivatedDate: todayStr,
                date: newDueDate
            });
        }
    };

    const deleteTask = (id: string) => {
        deleteDoc(doc(db, 'tasks', id));
    };

    const updateTaskStatus = (taskId: string, storeId: string, status: TaskStatus, userId?: string, initials?: string) => {
        const updateData = {
            [`status.${storeId}`]: {
                storeId,
                status,
                lastUpdated: new Date().toISOString(),
                completedBy: userId,
                completedByInitials: initials
            }
        };
        // Sanitize to remove undefined values
        const sanitizedUpdateData = JSON.parse(JSON.stringify(updateData));
        updateDoc(doc(db, 'tasks', taskId), sanitizedUpdateData);
    };

    const updateIncentiveReport = (report: IncentiveReport) => {
        // Use report ID as doc ID
        setDoc(doc(db, 'incentiveReports', report.id), report);
    };

    const addILTReport = (report: ILTReport) => {
        setDoc(doc(db, 'iltReports', report.id), report);
    };

    const createSchedule = (establishmentId: string, weekStartDate: string, force: boolean = false) => {
        // Find existing schedule directly from the current state
        const existingSchedule = schedules.find(s => s.establishmentId === establishmentId && s.weekStartDate === weekStartDate);

        if (existingSchedule) {
            if (!force) {
                throw new Error('Ya existe un horario para esa semana.');
            }
        }

        const establishmentEmployees = employees.filter(e => e.establishmentId === establishmentId);
        if (establishmentEmployees.length === 0) {
            throw new Error('No hay empleados para generar un horario.');
        }

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

        // If we are forcing (regenerating), reuse the existing ID to overwrite the document
        // This ensures the UI updates correctly and we don't acculumate duplicate weeks
        if (existingSchedule && force) {
            newSchedule.id = existingSchedule.id;
        }

        // Save to Firestore
        // Sanitize to remove undefined values
        const sanitizedSchedule = JSON.parse(JSON.stringify(newSchedule));
        setDoc(doc(db, 'schedules', newSchedule.id), sanitizedSchedule);
        return newSchedule;
    };

    const updateShift = (scheduleId: string, shiftId: string, updates: Partial<Shift>) => {
        const schedule = schedules.find(s => s.id === scheduleId);
        if (schedule) {
            const updatedShifts = schedule.shifts.map(shift => {
                if (shift.id !== shiftId) return shift;
                return { ...shift, ...updates };
            });
            // Sanitize to remove undefined values
            const sanitizedShifts = JSON.parse(JSON.stringify(updatedShifts));
            updateDoc(doc(db, 'schedules', scheduleId), { shifts: sanitizedShifts });
        }
    };

    const publishSchedule = (scheduleId: string) => {
        updateDoc(doc(db, 'schedules', scheduleId), {
            status: 'published',
            approvalStatus: 'pending',
            submittedAt: new Date().toISOString(),
            modificationStatus: 'none',
            modificationReason: null // Firestore handles null well usually, or ignore undefined
        });
    };

    const updateScheduleStatus = async (scheduleId: string, status: 'draft' | 'pending' | 'approved' | 'rejected', notes?: string) => {
        try {
            const schedule = schedules.find(s => s.id === scheduleId);
            if (!schedule) throw new Error('Schedule not found');

            const updates: any = {
                approvalStatus: status,
                supervisorNotes: notes !== undefined ? notes : (schedule.supervisorNotes || null),
                status: status === 'approved' ? 'published' : schedule.status,
            };
            if (status === 'approved') {
                updates.originalShiftsSnapshot = null; // Clear snapshot

                // --- CALCULATE AND APPLY HOURS DEBT ---
                // 1. Get current store settings/employees to calculate correctly
                // (We use current state. If employee was modified since schedule creation, it applies current contract.
                //Ideally we should use snapshot of employee state, but for simplicty we use current.)
                const storeSettings = getSettings(schedule.establishmentId);
                const storeEmployees = employees.filter(e => e.establishmentId === schedule.establishmentId);

                const debtAdjustments = calculateWeeklyHours(schedule, storeEmployees, storeSettings, timeOffRequests);

                // Apply adjustments
                debtAdjustments.forEach(adj => {
                    updateHoursDebt(adj.empId, adj.amount, `Cierre Horario Semana ${schedule.weekStartDate}`, schedule.id);
                });
            }

            // Sanitize
            const sanitizedUpdates = JSON.parse(JSON.stringify(updates));
            await updateDoc(doc(db, 'schedules', scheduleId), sanitizedUpdates);

            // Notification Logic
            if (status === 'approved' || status === 'rejected') {
                const message = status === 'approved'
                    ? `Tu horario de la semana ${schedule.weekStartDate} ha sido APROBADO.`
                    : `Tu horario de la semana ${schedule.weekStartDate} ha sido RECHAZADO. Revisa las notas.`;

                const id = generateUUID();
                const newNotif: Notification = {
                    id,
                    establishmentId: schedule.establishmentId,
                    message,
                    type: status === 'approved' ? 'success' : 'error',
                    read: false,
                    createdAt: new Date().toISOString(),
                    linkTo: '/horarios'
                };
                await setDoc(doc(db, 'notifications', id), newNotif);
            }
        } catch (error) {
            console.error('Error updating schedule status:', error);
            throw error;
        }
    };

    const requestScheduleModification = async (scheduleId: string, reason: string) => {
        try {
            await updateDoc(doc(db, 'schedules', scheduleId), {
                modificationStatus: 'requested',
                modificationReason: reason
            });
        } catch (error) {
            console.error('Error requesting modification:', error);
            throw error;
        }
    };

    const respondToModificationRequest = async (scheduleId: string, status: 'approved' | 'rejected', notes?: string) => {
        try {
            const schedule = schedules.find(s => s.id === scheduleId);
            if (!schedule) throw new Error('Schedule not found');

            const updates: any = {
                modificationStatus: status,
                supervisorNotes: notes || schedule.supervisorNotes,
            };
            if (status === 'approved') {
                updates.originalShiftsSnapshot = JSON.parse(JSON.stringify(schedule.shifts));
                updates.approvalStatus = 'draft'; // Unlock for editing
                updates.status = 'draft'; // Revert from 'published' so it leaves Supervisor history

                // --- REVERT HOURS DEBT ---
                // 1. Find logs associated with this schedule
                // Note: We need to query hoursDebtLogs where scheduleId == scheduleId.
                // Since we don't have the collection in state, we query Firestore.
                const logsQuery = query(collection(db, 'hoursDebtLogs'), where('scheduleId', '==', scheduleId));
                const logsSnapshot = await getDocs(logsQuery);

                logsSnapshot.forEach(async (logDoc) => {
                    const logData = logDoc.data();
                    // Revert the amount (multiply by -1)
                    const revertAmount = -logData.amount;
                    await updateHoursDebt(logData.employeeId, revertAmount, `Reversión: Desbloqueo Horario ${schedule.weekStartDate}`, scheduleId);
                });
            }

            const sanitizedUpdates = JSON.parse(JSON.stringify(updates));
            await updateDoc(doc(db, 'schedules', scheduleId), sanitizedUpdates);

            // Notification Logic
            const message = status === 'approved'
                ? `Solicitud de modificación APROBADA para la semana ${schedule.weekStartDate}. Ya puedes editar.`
                : `Solicitud de modificación DENEGADA para la semana ${schedule.weekStartDate}.`;

            const id = generateUUID();
            const newNotif: Notification = {
                id,
                establishmentId: schedule.establishmentId,
                message,
                type: status === 'approved' ? 'success' : 'error',
                read: false,
                createdAt: new Date().toISOString(),
                linkTo: '/horarios'
            };
            await setDoc(doc(db, 'notifications', id), newNotif);

        } catch (error) {
            console.error('Error responding to modification request:', error);
            throw error;
        }
    };

    const markNotificationAsRead = (id: string) => {
        updateDoc(doc(db, 'notifications', id), { read: true });
    };

    const removeNotification = (id: string) => {
        deleteDoc(doc(db, 'notifications', id));
    };

    const addTimeOff = async (req: Omit<TimeOffRequest, 'id' | 'status'>) => {
        const batch = writeBatch(db);
        const requestId = generateUUID();
        const newReq = { ...req, id: requestId, status: 'approved' as const };

        // Sanitize request
        const sanitizedReq = JSON.parse(JSON.stringify(newReq));
        batch.set(doc(db, 'timeOffRequests', requestId), sanitizedReq);

        // Update Schedules & Notify supervisor if it's a sick leave
        if (req.type === 'sick_leave') {
            const emp = employees.find(e => e.id === req.employeeId);
            if (emp) {
                const dates = req.dates || [];

                // Find schedules that contain any of these dates
                const affectedSchedules = schedules.filter(s =>
                    s.establishmentId === emp.establishmentId &&
                    dates.some(d => {
                        // Simple check: is date within [weekStart, weekStart + 6 days]
                        const dateStr = d;
                        const weekStartStr = s.weekStartDate;
                        if (dateStr < weekStartStr) return false;

                        const wStart = new Date(weekStartStr);
                        wStart.setDate(wStart.getDate() + 6);
                        const weekEndStr = wStart.toISOString().split('T')[0];

                        return dateStr >= weekStartStr && dateStr <= weekEndStr;
                    })
                );

                // Update shifts in affected schedules
                affectedSchedules.forEach(schedule => {
                    let hasChanges = false;
                    const updatedShifts = schedule.shifts.map(shift => {
                        if (shift.employeeId === req.employeeId && dates.includes(shift.date)) {
                            // Only update if not already correct (avoid unnecessary writes if logic runs multiple times)
                            // and ensure we preserve the ID and other unrelated props, just change type
                            if (shift.type !== 'sick_leave') {
                                hasChanges = true;
                                return { ...shift, type: 'sick_leave' };
                            }
                        }
                        return shift;
                    });

                    if (hasChanges) {
                        const sanitizedShifts = JSON.parse(JSON.stringify(updatedShifts));
                        batch.update(doc(db, 'schedules', schedule.id), { shifts: sanitizedShifts });
                    }
                });

                // Notification Logic for Published Schedules
                const affectedPublishedSchedules = affectedSchedules.filter(s => s.approvalStatus === 'approved');
                if (affectedPublishedSchedules.length > 0) {
                    const storeName = getSettings(emp.establishmentId).storeName || `Tienda ${emp.establishmentId}`;
                    const notifId = generateUUID();
                    const newNotif: Notification = {
                        id: notifId,
                        establishmentId: 'admin',
                        message: `Baja Médica: ${emp.name} en ${storeName} (Horario Publicado)`,
                        type: 'warning',
                        read: false,
                        createdAt: new Date().toISOString(),
                        linkTo: '/supervision'
                    };
                    batch.set(doc(db, 'notifications', notifId), newNotif);
                }
            }
        }

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error adding time off and syncing schedules:", error);
            throw error;
        }
    };

    const removeTimeOff = (id: string) => {
        deleteDoc(doc(db, 'timeOffRequests', id));
    };

    const updateTimeOff = (id: string, updates: Partial<TimeOffRequest>) => {
        updateDoc(doc(db, 'timeOffRequests', id), updates);
    };

    const addPermanentRequest = async (req: Omit<PermanentRequest, 'id'>) => {
        const id = generateUUID();
        const newReq = { ...req, id };

        console.log('[StoreContext] Attempting to add Permanent Request:', newReq);

        try {
            // Sanitize
            const sanitizedReq = JSON.parse(JSON.stringify(newReq));
            console.log('[StoreContext] Sanitized Request Payload:', sanitizedReq);

            await setDoc(doc(db, 'permanentRequests', id), sanitizedReq);
            console.log('[StoreContext] Permanent Request saved successfully to Firestore with ID:', id);
        } catch (error) {
            console.error("[StoreContext] Error adding permanent request:", error);
            // Re-throw to ensure caller knows it failed
            throw error;
        }
    };

    const removePermanentRequest = (id: string) => {
        deleteDoc(doc(db, 'permanentRequests', id));
    };

    const updatePermanentRequest = (id: string, updates: Partial<PermanentRequest>) => {
        updateDoc(doc(db, 'permanentRequests', id), updates);
    };

    const resetData = async () => {
        // Dangerous! Only for admin/debug.
        // Needs to delete all collections. 
        // For now, let's just log and maybe clear local storage for safety?
        // But local storage is not used anymore.
        // To clear firestore, we'd need to list and delete.
        console.warn("resetData implementation in Firestore is dangerous and temporarily disabled.");

        // Optional: clear local cache only or something.
    };

    return (
        <StoreContext.Provider value={{
            employees, schedules, breakLogs, employeeLogs, settings, timeOffRequests, permanentRequests,
            addEmployee, deactivateEmployee, deleteEmployee, reactivateEmployee, updateEmployee, tracker,
            startBreak, endBreak,
            createSchedule, updateShift, publishSchedule, updateScheduleStatus,
            getSettings, updateSettings,
            addTimeOff, removeTimeOff, updateTimeOff,
            addPermanentRequest, removePermanentRequest, updatePermanentRequest,

            hoursDebtLogs, updateHoursDebt, addTempHours, removeTempHours, resetData, requestScheduleModification, respondToModificationRequest, getManagerNames,
            notifications, markNotificationAsRead, removeNotification,
            tasks, addTask, updateTask, deleteTask, triggerCyclicalTask, updateTaskStatus,
            incentiveReports, updateIncentiveReport,
            iltReports, addILTReport,
            isLoaded
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
