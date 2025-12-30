import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AnnualPlanModal from '../components/AnnualPlanModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { parseLocalDate, formatLocalDate } from '../services/dateUtils';
import {
    Plus, Search, Trash2, Pencil, CalendarClock, Plane, Calendar as CalendarIcon,
    TrendingUp, Activity, AlertCircle, X, Clock, RotateCcw
} from 'lucide-react';
import { DatePicker } from '../components/DatePicker';
import type { Employee, EmployeeCategory, PermanentRequestType, TimeOffType } from '../types';
import clsx from 'clsx';

const EmployeesPage: React.FC = () => {
    const { user } = useAuth();
    const { employees, addEmployee, updateEmployee, deactivateEmployee, reactivateEmployee, permanentRequests, addPermanentRequest, removePermanentRequest, addTimeOff, removeTimeOff, timeOffRequests } = useStore();
    const { showToast } = useToast();
    const { addTempHours, removeTempHours } = useStore();

    if (!user) return null;

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Perm Request State
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);
    const [permEmpId, setPermEmpId] = useState<string | null>(null);
    const [newPermType, setNewPermType] = useState<PermanentRequestType>('morning_only');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [maxAfternoons, setMaxAfternoons] = useState(3);
    const [isConfirmDeletePermOpen, setIsConfirmDeletePermOpen] = useState(false);
    const [reqToDelete, setReqToDelete] = useState<string | null>(null);
    // Rotating Days State
    const [rotatingCycleWeeks, setRotatingCycleWeeks] = useState(2);
    const [rotatingCycleDays, setRotatingCycleDays] = useState<number[][]>([[], []]); // [[week1days], [week2days]]
    const [rotatingRefDate, setRotatingRefDate] = useState('');

    // Sick Leave State
    const [isSickModalOpen, setIsSickModalOpen] = useState(false);
    const [sickEmpId, setSickEmpId] = useState<string | null>(null);
    const [sickStartDate, setSickStartDate] = useState('');
    const [sickEndDate, setSickEndDate] = useState('');
    const [isSickHistoryOpen, setIsSickHistoryOpen] = useState(false);
    const [deletingSickLeaveId, setDeletingSickLeaveId] = useState<string | null>(null);
    const [isConfirmDeleteSickOpen, setIsConfirmDeleteSickOpen] = useState(false);
    const [sickHistoryYear, setSickHistoryYear] = useState<number>(new Date().getFullYear());
    const [sickType, setSickType] = useState<TimeOffType>('sick_leave');


    // Annual Planning State
    const [isAnnualPlanningOpen, setIsAnnualPlanningOpen] = useState(false);

    // Reactivation / Deactivation State
    const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
    const [employeeToDeactivateId, setEmployeeToDeactivateId] = useState<string | null>(null);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    // Reactivation Modal State
    const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
    const [reactivatingEmpId, setReactivatingEmpId] = useState<string | null>(null);
    const [reactivateMode, setReactivateMode] = useState<'indefinido' | 'temporal' | 'sustitucion'>('indefinido');
    const [reactivateEndDate, setReactivateEndDate] = useState('');
    const [reactivateSubstitutionId, setReactivateSubstitutionId] = useState('');

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyEmpId, setHistoryEmpId] = useState<string | null>(null);
    const [isFullHistoryModalOpen, setIsFullHistoryModalOpen] = useState(false); // New state for full history

    const getFullStoreHistory = () => {
        if (!user) return [];
        const storeEmployees = employees.filter(e => e.establishmentId === user.establishmentId);
        const historyEntries: { empId: string, empName: string, date: string, type: 'hired' | 'terminated' | 'rehired', reason?: string }[] = [];

        storeEmployees.forEach(emp => {
            if (emp.history) {
                emp.history.forEach(h => {
                    historyEntries.push({
                        empId: emp.id,
                        empName: emp.name,
                        date: h.date,
                        type: h.type as 'hired' | 'terminated' | 'rehired',
                        reason: h.reason
                    });
                });
            }
        });

        // Sort by date descending (newest first)
        return historyEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    // Form State
    const [newName, setNewName] = useState('');
    const [newInitial, setNewInitial] = useState('');
    const [newCategory, setNewCategory] = useState<EmployeeCategory>('Empleado');
    const [newHours, setNewHours] = useState(40);
    const [newSeniority, setNewSeniority] = useState('');
    const [newBirthDate, setNewBirthDate] = useState('');
    // Edit State Trackers
    const [editingPermReqId, setEditingPermReqId] = useState<string | null>(null);
    const [editingSickInfoId, setEditingSickInfoId] = useState<string | null>(null);
    // Temp hours edit isn't straightforward as it uses complex ID or composite. 
    // Checking removal: setDeletingTempId({ empId: emp.id, adjId: th.id });
    const [editingTempHoursId, setEditingTempHoursId] = useState<{ empId: string, adjId: string } | null>(null);

    const [newEmail, setNewEmail] = useState('');
    const [contractEndDate, setContractEndDate] = useState('');
    const [isIndefinite, setIsIndefinite] = useState(false);
    // Add Modal Extra State
    const [addPermRequest, setAddPermRequest] = useState(false);
    const [addPermType, setAddPermType] = useState<PermanentRequestType>('morning_only');
    const [addPermDays, setAddPermDays] = useState<number[]>([]);

    // Vacation Modal State
    const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
    const [vacEmpId, setVacEmpId] = useState<string>('');
    const [planningYear, setPlanningYear] = useState<number>(new Date().getFullYear());

    const [vacStartDate, setVacStartDate] = useState('');
    const [vacEndDate, setVacEndDate] = useState('');
    const [vacationRanges, setVacationRanges] = useState<{ start: string, end: string }[]>([]);
    const [deletingVacationId, setDeletingVacationId] = useState<string | null>(null);
    const [isConfirmDeleteVacationOpen, setIsConfirmDeleteVacationOpen] = useState(false);

    // Temp Hours Modal
    const [isTempHoursModalOpen, setIsTempHoursModalOpen] = useState(false);
    const [tempEmpId, setTempEmpId] = useState('');
    const [tempStart, setTempStart] = useState('');
    const [tempEnd, setTempEnd] = useState('');
    const [tempHoursVal, setTempHoursVal] = useState(40);
    const [deletingTempId, setDeletingTempId] = useState<{ empId: string, adjId: string } | null>(null);
    const [isConfirmDeleteTempOpen, setIsConfirmDeleteTempOpen] = useState(false);

    if (!user) return null;

    const filteredEmployees = user
        ? employees
            .filter(e => e.establishmentId === user.establishmentId)
            .filter(e => showInactive ? true : e.active) // Filter active unless showInactive is true
            .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : [];

    const [isNewEmployee, setIsNewEmployee] = useState(true);



    const getSickEmployees = () => {
        if (!user) return [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const sickRequestEmpIds = timeOffRequests
            .filter(r => r.type === 'sick_leave')
            .filter(r => {
                const start = new Date(r.startDate || r.dates[0] || '');
                const end = r.endDate ? new Date(r.endDate) : null;
                // Active sick leave: started in past/today and (no end date OR end date in future/today)
                return start <= now && (!end || end >= now);
            })
            .map(r => r.employeeId);

        return employees
            .filter(e => e.establishmentId === user.establishmentId && e.active)
            .filter(e => sickRequestEmpIds.includes(e.id));
    };

    const handleReactivateClick = (id: string) => {
        setReactivatingEmpId(id);
        setReactivateMode('indefinido');
        setReactivateEndDate('');
        setReactivateSubstitutionId('');
        setIsReactivateModalOpen(true);
    };

    const confirmReactivation = (e: React.FormEvent) => {
        e.preventDefault();
        if (reactivatingEmpId) {
            const options: any = {};
            if (reactivateMode === 'indefinido') {
                options.contractType = 'indefinido';
                options.contractEndDate = undefined;
            } else if (reactivateMode === 'temporal') {
                options.contractType = 'temporal';
                options.contractEndDate = reactivateEndDate;
            } else {
                options.contractType = 'temporal'; // Substitution is usually temporal
                options.substitutingId = reactivateSubstitutionId;
            }
            reactivateEmployee(reactivatingEmpId, options);
            showToast('Empleado reactivado correctamente', 'success');
            setIsReactivateModalOpen(false);
            setReactivatingEmpId(null);
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const newId = addEmployee({
            name: newName,
            category: newCategory,
            weeklyHours: newHours,
            establishmentId: user.establishmentId,
            seniorityDate: isNewEmployee ? new Date().toISOString() : newSeniority,
            birthDate: newBirthDate,
            email: newEmail,
            contractEndDate: isIndefinite ? undefined : contractEndDate,
            initials: newInitial.toUpperCase()
        });

        if (addPermRequest) {
            addPermanentRequest({
                employeeId: newId,
                type: addPermType,
                days: addPermDays.length > 0 ? addPermDays : undefined
            });
        }

        showToast('Empleado añadido correctamente', 'success');
        setIsAddModalOpen(false);
        setNewName('');
        setNewCategory('Empleado');
        setNewHours(40);
        setNewSeniority('');
        setNewBirthDate('');
        setNewBirthDate('');
        setNewEmail('');
        setContractEndDate('');
        setIsIndefinite(false);
        setIsNewEmployee(true); // Reset to default
        setAddPermRequest(false);
        setAddPermType('morning_only');
        setAddPermDays([]);
        setNewInitial('');
    };

    const handleDeactivateClick = (id: string) => {
        setEmployeeToDeactivateId(id);
        setDeactivationReason('');
        setIsDeactivateModalOpen(true);
    };

    const handleConfirmDeactivate = (e: React.FormEvent) => {
        e.preventDefault();
        if (employeeToDeactivateId && deactivationReason) {
            deactivateEmployee(employeeToDeactivateId, deactivationReason);
            showToast('Empleado dado de baja correctamente', 'success');
            setIsDeactivateModalOpen(false);
            setEmployeeToDeactivateId(null);
            setDeactivationReason('');
        }
    };

    const handleReactivate = (id: string) => {
        reactivateEmployee(id);
        showToast('Empleado reactivado correctamente', 'success');
    };

    const handleViewHistory = (id: string) => {
        setHistoryEmpId(id);
        setIsHistoryModalOpen(true);
    };

    const openEdit = (emp: Employee) => {
        setEditingEmployee(emp.id);
        setNewName(emp.name);
        setNewCategory(emp.category);
        setNewHours(emp.weeklyHours);
        setNewSeniority(emp.seniorityDate || '');
        setNewBirthDate(emp.birthDate || '');
        setNewEmail(emp.email || '');
        setContractEndDate(emp.contractEndDate || '');
        setIsIndefinite(!emp.contractEndDate);
        setNewInitial(emp.initials || '');
        setIsEditModalOpen(true);
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingEmployee) {
            updateEmployee(editingEmployee, {
                name: newName,
                category: newCategory,
                weeklyHours: newHours,
                seniorityDate: newSeniority,
                birthDate: newBirthDate,
                email: newEmail,
                contractEndDate: isIndefinite ? undefined : contractEndDate,
                initials: newInitial.toUpperCase()
            });
            showToast('Empleado modificado correctamente', 'success');
            setIsEditModalOpen(false);
            setEditingEmployee(null);

            // Reset for Add
            setNewName('');
            setNewCategory('Empleado');
            setNewHours(40);
            setNewSeniority('');
            setNewBirthDate('');
            setNewEmail('');
            setContractEndDate('');
            setIsIndefinite(false);
            setNewInitial('');
        }
    };

    const openPermModal = (id: string) => {
        setPermEmpId(id);
        setIsPermModalOpen(true);
        setNewPermType('morning_only');
        setSelectedDays([]);
        setMaxAfternoons(3);
    }

    const handleAddPerm = () => {
        if (!permEmpId) return;

        if (newPermType === 'rotating_days_off') {
            if (!rotatingRefDate) {
                showToast('Selecciona una fecha de inicio para el ciclo (Lunes)', 'error');
                return;
            }
        }

        if (editingPermReqId) {
            removePermanentRequest(editingPermReqId);
        }

        addPermanentRequest({
            employeeId: permEmpId,
            type: newPermType,
            days: selectedDays.length > 0 ? selectedDays : undefined,
            value: newPermType === 'max_afternoons_per_week' ? maxAfternoons : undefined,
            cycleWeeks: newPermType === 'rotating_days_off' ? rotatingCycleDays.slice(0, rotatingCycleWeeks) : undefined,
            referenceDate: newPermType === 'rotating_days_off' ? rotatingRefDate : undefined
        });

        showToast(editingPermReqId ? 'Petición editada correctamente' : 'Petición permanente añadida', 'success');

        if (editingPermReqId) {
            setIsPermModalOpen(false);
            setEditingPermReqId(null);
        }

        // Reset
        setNewPermType('morning_only');
        setSelectedDays([]);
        setMaxAfternoons(3);
        setRotatingCycleWeeks(2);
        setRotatingCycleDays([[], []]);
        setRotatingRefDate('');
    };

    const toggleDay = (day: number) => {
        setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    const employeePermRequests = permanentRequests.filter(r => r.employeeId === permEmpId);

    const checkOverlap = (newStart: string, newEnd: string) => {
        const start = parseLocalDate(newStart).getTime();
        const end = parseLocalDate(newEnd).getTime();

        // 1. Check against ranges currently in the "Added Segments" list
        for (const range of vacationRanges) {
            const rStart = parseLocalDate(range.start).getTime();
            const rEnd = parseLocalDate(range.end).getTime();
            // Ranges overlap if (StartA <= EndB) and (EndA >= StartB)
            if (start <= rEnd && end >= rStart) {
                return { type: 'local', range };
            }
        }

        // 2. Check against existing saved requests in the database
        const existingVacations = timeOffRequests.filter(req =>
            req.employeeId === vacEmpId &&
            req.type === 'vacation'
        );

        for (const req of existingVacations) {
            // Check startDate/endDate if available
            if (req.startDate && req.endDate) {
                const rStart = parseLocalDate(req.startDate).getTime();
                const rEnd = parseLocalDate(req.endDate).getTime();
                if (start <= rEnd && end >= rStart) return { type: 'db', req };
            }
            // Fallback/Double check individual dates
            else if (req.dates && req.dates.length > 0) {
                const hasOverlap = req.dates.some(d => {
                    const t = parseLocalDate(d).getTime();
                    return t >= start && t <= end;
                });
                if (hasOverlap) return { type: 'db', req };
            }
        }

        return null;
    };

    const handleAddVacation = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vacEmpId) return;

        const rangesToSave = [...vacationRanges];

        // If there is a pending range in inputs, try to add it
        if (vacStartDate && vacEndDate) {
            const overlap = checkOverlap(vacStartDate, vacEndDate);
            if (overlap) {
                if (overlap.type === 'local') {
                    showToast('El rango que intentas guardar se solapa con otro de la lista.', 'error');
                } else {
                    showToast('El rango que intentas guardar se solapa con vacaciones ya existentes.', 'error');
                }
                return;
            }
            rangesToSave.push({ start: vacStartDate, end: vacEndDate });
        }

        if (rangesToSave.length === 0) {
            showToast('Añade al menos un tramo de fechas', 'error');
            return;
        }

        // Calculate total days
        let newDaysCount = 0;
        rangesToSave.forEach(range => {
            const start = parseLocalDate(range.start);
            const end = parseLocalDate(range.end);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            newDaysCount += diffDays;
        });

        const usedDays = getVacationDaysForYear(vacEmpId, planningYear);
        if (usedDays + newDaysCount > 31) {
            showToast(`Error: El total de vacaciones (${usedDays + newDaysCount} días) supera el límite de 31 días.`, 'error');
            return;
        }

        // Save all ranges
        rangesToSave.forEach(range => {
            const start = parseLocalDate(range.start);
            const end = parseLocalDate(range.end);
            const dates: string[] = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(formatLocalDate(d));
            }
            addTimeOff({
                employeeId: vacEmpId,
                type: 'vacation',
                dates: dates,
                startDate: range.start,
                endDate: range.end
            });
        });

        showToast('Vacaciones registradas correctamente', 'success');
        setIsVacationModalOpen(false);
        setVacEmpId('');
        setVacStartDate('');
        setVacEndDate('');
        setVacationRanges([]);
    };

    const handleAddSickLeave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!sickEmpId || !sickStartDate || !sickEndDate) {
            showToast('Por favor completa todos los campos', 'error');
            return;
        }

        if (new Date(sickEndDate) < new Date(sickStartDate)) {
            showToast('La fecha fin debe ser posterior a la fecha inicio', 'error');
            return;
        }

        // Check for overlaps with existing requests (Vacation or sick leave), excluding the one being edited
        const hasOverlap = timeOffRequests.some(req => {
            if (editingSickInfoId && req.id === editingSickInfoId) return false; // Ignore self
            if (req.employeeId !== sickEmpId) return false;
            // Treat maternity_paternity same as sick_leave for overlap purposes
            if (req.type !== 'sick_leave' && req.type !== 'vacation' && req.type !== 'maternity_paternity') return false;

            const newS = parseLocalDate(sickStartDate).getTime();
            const newE = parseLocalDate(sickEndDate).getTime();

            if (req.startDate && req.endDate) {
                const rS = parseLocalDate(req.startDate).getTime();
                const rE = parseLocalDate(req.endDate).getTime();
                return (newS <= rE && newE >= rS);
            } else if (req.dates && req.dates.length > 0) {
                return req.dates.some(d => {
                    const t = parseLocalDate(d).getTime();
                    return t >= newS && t <= newE;
                });
            }
            return false;
        });

        if (hasOverlap) {
            showToast('El empleado ya tiene una baja o vacaciones registradas en esas fechas', 'error');
            return;
        }

        if (editingSickInfoId) {
            removeTimeOff(editingSickInfoId);
        }

        addTimeOff({
            employeeId: sickEmpId,
            dates: [],
            type: sickType,
            startDate: sickStartDate,
            endDate: sickEndDate
        });

        showToast(editingSickInfoId ? 'Baja actualizada' : 'Baja registrada', 'success');
        setIsSickModalOpen(false);
        setSickStartDate('');
        setSickEndDate('');
        setSickType('sick_leave');
        setEditingSickInfoId(null);
    };



    const addRange = () => {
        if (vacStartDate && vacEndDate) {
            const start = new Date(vacStartDate);
            const end = new Date(vacEndDate);
            if (end < start) {
                showToast('La fecha fin debe ser posterior a la fecha inicio', 'error');
                return;
            }

            const overlap = checkOverlap(vacStartDate, vacEndDate);
            if (overlap) {
                if (overlap.type === 'local') {
                    showToast('Este rango se solapa con otro tramo ya añadido en la lista.', 'error');
                } else {
                    showToast('Este rango se solapa con unas vacaciones ya registradas anteriormente.', 'error');
                }
                return;
            }

            setVacationRanges(prev => [...prev, { start: vacStartDate, end: vacEndDate }]);
            setVacStartDate('');
            setVacEndDate('');
        }
    };

    const removeRange = (index: number) => {
        setVacationRanges(prev => prev.filter((_, i) => i !== index));
    };

    const getVacationDaysForYear = (empId: string, year: number) => {
        return timeOffRequests
            .filter(req => req.employeeId === empId && req.type === 'vacation')
            .flatMap(req => req.dates)
            .filter(dateStr => parseLocalDate(dateStr).getFullYear() === year)
            .length;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Empleados</h1>
                    <p className="text-slate-500">Gestiona tu equipo de {user.establishmentName}</p>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
                    {/* History & Planning Group */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setIsFullHistoryModalOpen(true)} // Open full history modal
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-blue-600"
                            title="Historial Completo Tienda"
                        >
                            <Clock size={16} />
                            <span className="hidden xl:inline">Historial Completo</span>
                        </button>
                        <div className="w-px bg-slate-200 mx-1 my-1"></div>
                        <button
                            onClick={() => setIsAnnualPlanningOpen(true)}
                            className="flex items-center gap-2 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all text-xs font-bold uppercase tracking-wide"
                            title="Ver Planificación Anual"
                        >
                            <CalendarIcon size={16} />
                            <span className="hidden xl:inline">Anual</span>
                        </button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button
                            onClick={() => setIsSickHistoryOpen(true)}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-xs font-bold uppercase tracking-wide",
                                isSickHistoryOpen ? "bg-white text-red-600 shadow-sm" : "text-slate-600 hover:text-red-600"
                            )}
                            title="Historial de Bajas"
                        >
                            <Activity size={16} />
                            <span className="hidden xl:inline">Historial Bajas</span>
                        </button>
                    </div>

                    {/* Schedule Management Group */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => { setPermEmpId(''); setIsPermModalOpen(true); }}
                            className="group flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 px-3 py-2 rounded-xl hover:bg-purple-100 transition-all text-sm font-medium shadow-sm"
                            title="Petición Permanente"
                        >
                            <CalendarClock size={18} className="text-purple-600 group-hover:scale-110 transition-transform" />
                            <span className="hidden lg:inline">P. Permanente</span>
                        </button>
                        <button
                            onClick={() => { setTempEmpId(''); setTempStart(''); setTempEnd(''); setTempHoursVal(40); setIsTempHoursModalOpen(true); }}
                            className="group flex items-center gap-2 bg-orange-50 border border-orange-100 text-orange-700 px-3 py-2 rounded-xl hover:bg-orange-100 transition-all text-sm font-medium shadow-sm"
                            title="Ampliación Horas"
                        >
                            <TrendingUp size={18} className="text-orange-600 group-hover:scale-110 transition-transform" />
                            <span className="hidden lg:inline">Ampliar Horas</span>
                        </button>
                    </div>

                    {/* Time Off Group */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => { setVacEmpId(''); setIsVacationModalOpen(true); }}
                            className="group flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-3 py-2 rounded-xl hover:bg-teal-100 transition-all text-sm font-medium shadow-sm"
                            title="Planificar Vacaciones"
                        >
                            <Plane size={18} className="text-teal-600 group-hover:scale-110 transition-transform" />
                            <span className="hidden lg:inline">Vacaciones</span>
                        </button>
                        <button
                            onClick={() => { setSickEmpId(''); setSickStartDate(''); setSickEndDate(''); setSickType('sick_leave'); setIsSickModalOpen(true); }}
                            className="group flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-3 py-2 rounded-xl hover:bg-red-100 transition-all text-sm font-medium shadow-sm"
                            title="Registrar Baja"
                        >
                            <Activity size={18} className="text-red-600 group-hover:scale-110 transition-transform" />
                            <span className="hidden lg:inline">Registrar Baja</span>
                        </button>
                    </div>

                    {/* Primary Action */}
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm font-bold ml-auto"
                    >
                        <Plus size={20} />
                        Nuevo Empleado
                    </button>
                </div>
            </div>

            {isAnnualPlanningOpen && (
                <AnnualPlanModal
                    isOpen={isAnnualPlanningOpen}
                    onClose={() => setIsAnnualPlanningOpen(false)}
                    establishmentId={user.establishmentId}
                />
            )}


            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <Search size={20} className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar empleados..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 outline-none text-slate-700 placeholder-slate-400"
                    />
                </div>
                <div className="flex items-center gap-2 px-1">
                    <input
                        type="checkbox"
                        id="showInactive"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="showInactive" className="text-xs font-medium text-slate-500 select-none cursor-pointer hover:text-indigo-600 transition-colors">
                        Mostrar Bajas / Inactivos
                    </label>
                </div>

                {/* Active Permanent Requests Banner */}
                {/* Active Restrictions & Quick Actions Grid */}
                {(permanentRequests.length > 0 || employees.some(e => e.establishmentId === user.establishmentId && e.tempHours && e.tempHours.length > 0) || timeOffRequests.some(r => (r.type === 'sick_leave' || r.type === 'maternity_paternity') && employees.some(e => e.id === r.employeeId))) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">

                        {/* Permanent Restrictions Card */}
                        {permanentRequests.some(req => employees.some(e => e.id === req.employeeId && e.establishmentId === user.establishmentId)) && (
                            <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 relative overflow-hidden group hover:border-purple-200 transition-colors">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <CalendarClock size={64} className="text-purple-500" />
                                </div>
                                <h3 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2 relative z-10">
                                    <div className="p-1 bg-purple-100 rounded text-purple-600"><CalendarClock size={14} /></div>
                                    Restricciones Fijas
                                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                                        {permanentRequests.filter(req => employees.some(e => e.id === req.employeeId && e.establishmentId === user.establishmentId)).length}
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 relative z-10">
                                    {permanentRequests
                                        .filter(req => employees.some(e => e.id === req.employeeId && e.establishmentId === user.establishmentId))
                                        .map(req => {
                                            const emp = employees.find(e => e.id === req.employeeId);
                                            if (!emp) return null;
                                            return (
                                                <div key={req.id} className="bg-purple-50/50 border border-purple-100 hover:border-purple-300 rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-default group">
                                                    <span className="font-semibold text-purple-900">{emp.initials || emp.name.substring(0, 2).toUpperCase()}</span>
                                                    <span className="text-purple-500">•</span>
                                                    <span className="text-purple-700">
                                                        {req.type === 'morning_only' ? 'Mañanas' :
                                                            req.type === 'afternoon_only' ? 'Tardes' :
                                                                req.type === 'max_afternoons_per_week' ? `Máx ${req.value || 3} T` :
                                                                    req.type === 'force_full_days' ? 'Días Comp.' :
                                                                        req.type === 'early_morning_shift' ? '9:00h' :
                                                                            req.type === 'rotating_days_off' ? 'Rotativo' :
                                                                                'Días Libres'}
                                                    </span>
                                                    <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPermEmpId(emp.id);
                                                                setNewPermType(req.type);
                                                                setSelectedDays(req.days || []);
                                                                setMaxAfternoons(req.value || 3);
                                                                setEditingPermReqId(req.id);
                                                                setIsPermModalOpen(true);
                                                            }}
                                                            className="p-0.5 hover:bg-purple-200 rounded text-purple-500 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setReqToDelete(req.id);
                                                                setIsConfirmDeletePermOpen(true);
                                                            }}
                                                            className="p-0.5 hover:bg-red-100 rounded text-purple-500 hover:text-red-600 transition-colors"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Temp Hours Card */}
                        {employees.some(e => e.establishmentId === user.establishmentId && e.tempHours && e.tempHours.length > 0) && (
                            <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-4 relative overflow-hidden group hover:border-orange-200 transition-colors">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <TrendingUp size={64} className="text-orange-500" />
                                </div>
                                <h3 className="text-sm font-bold text-orange-900 mb-3 flex items-center gap-2 relative z-10">
                                    <div className="p-1 bg-orange-100 rounded text-orange-600"><TrendingUp size={14} /></div>
                                    Ampliaciones
                                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                                        {employees.filter(e => e.establishmentId === user.establishmentId && e.tempHours && e.tempHours.length > 0).flatMap(e => e.tempHours).length}
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 relative z-10">
                                    {employees
                                        .filter(e => e.establishmentId === user.establishmentId && e.tempHours && e.tempHours.length > 0)
                                        .flatMap(e => (e.tempHours || []).map(th => ({ ...th, emp: e })))
                                        .map(({ emp, ...th }) => (
                                            <div key={th.id} className="bg-orange-50/50 border border-orange-100 hover:border-orange-300 rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-default group">
                                                <span className="font-semibold text-orange-900">{emp.initials || emp.name.substring(0, 2).toUpperCase()}</span>
                                                <span className="text-orange-500">•</span>
                                                <span className="text-orange-700 font-bold">+{th.hours}h</span>
                                                <span className="text-[10px] text-orange-400">
                                                    ({new Date(th.start).getDate()}/{new Date(th.start).getMonth() + 1})
                                                </span>
                                                <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTempEmpId(emp.id);
                                                            setTempStart(th.start);
                                                            setTempEnd(th.end);
                                                            setTempHoursVal(th.hours);
                                                            setEditingTempHoursId({ empId: emp.id, adjId: th.id });
                                                            setIsTempHoursModalOpen(true);
                                                        }}
                                                        className="p-0.5 hover:bg-orange-200 rounded text-orange-500 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingTempId({ empId: emp.id, adjId: th.id });
                                                            setIsConfirmDeleteTempOpen(true);
                                                        }}
                                                        className="p-0.5 hover:bg-red-100 rounded text-orange-500 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Sick Leaves & Maternity Card */}
                        {timeOffRequests.some(r => (r.type === 'sick_leave' || r.type === 'maternity_paternity') && employees.some(e => e.id === r.employeeId)) && (
                            <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4 relative overflow-hidden group hover:border-red-200 transition-colors">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Activity size={64} className="text-red-500" />
                                </div>
                                <h3 className="text-sm font-bold text-red-900 mb-3 flex items-center gap-2 relative z-10">
                                    <div className="p-1 bg-red-100 rounded text-red-600"><Activity size={14} /></div>
                                    Bajas y Maternidad
                                    <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                                        {timeOffRequests.filter(req => (req.type === 'sick_leave' || req.type === 'maternity_paternity') && employees.some(e => e.id === req.employeeId && e.establishmentId === user.establishmentId)).length}
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 relative z-10">
                                    {timeOffRequests
                                        .filter(req => {
                                            if (req.type !== 'sick_leave' && req.type !== 'maternity_paternity') return false;
                                            if (!employees.some(e => e.id === req.employeeId && e.establishmentId === user.establishmentId)) return false;

                                            const todayLine = new Date();
                                            todayLine.setHours(0, 0, 0, 0);
                                            const end = new Date(req.endDate || '');
                                            end.setHours(0, 0, 0, 0);
                                            return end >= todayLine; // Show if not past
                                        })
                                        .map(req => {
                                            const emp = employees.find(e => e.id === req.employeeId);
                                            const isMater = req.type === 'maternity_paternity';
                                            return (
                                                <div key={req.id} className={`border rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-default group ${isMater ? 'bg-pink-50/50 border-pink-100 hover:border-pink-300' : 'bg-red-50/50 border-red-100 hover:border-red-300'}`}>
                                                    <span className={`font-semibold ${isMater ? 'text-pink-900' : 'text-red-900'}`}>{emp?.initials || emp?.name.substring(0, 2).toUpperCase()}</span>
                                                    <span className={`${isMater ? 'text-pink-500' : 'text-red-500'}`}>•</span>
                                                    <span className={`${isMater ? 'text-pink-700' : 'text-red-700'} font-medium`}>
                                                        {isMater ? 'Maternidad' : 'Baja'}
                                                    </span>
                                                    <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (emp) {
                                                                    setSickEmpId(emp.id);
                                                                    setSickStartDate(req.startDate || '');
                                                                    setSickEndDate(req.endDate || '');
                                                                    setSickType(req.type); // Important
                                                                    setEditingSickInfoId(req.id);
                                                                    setIsSickModalOpen(true);
                                                                }
                                                            }}
                                                            className={`p-0.5 rounded transition-colors ${isMater ? 'hover:bg-pink-200 text-pink-500 hover:text-indigo-600' : 'hover:bg-red-200 text-red-500 hover:text-indigo-600'}`}
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredEmployees.map(emp => {
                    const getCatColor = (cat: string) => {
                        switch (cat) {
                            case 'Gerente': return 'violet';
                            case 'Subgerente': return 'indigo';
                            case 'Responsable': return 'blue';
                            case 'Limpieza': return 'emerald';
                            default: return 'slate';
                        }
                    };
                    const color = getCatColor(emp.category);

                    // Calculations
                    const activeTempBounds = emp.tempHours?.filter(th => {
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        return now >= new Date(th.start) && now <= new Date(th.end);
                    }) || [];
                    const activeTempHours = activeTempBounds.reduce((acc, curr) => acc + curr.hours, 0);

                    const currentYear = new Date().getFullYear();
                    const vacationDays = timeOffRequests
                        .filter(r => r.employeeId === emp.id && r.type === 'vacation')
                        .flatMap(r => r.dates)
                        .filter(d => new Date(d).getFullYear() === currentYear)
                        .length;



                    const isSickNow = timeOffRequests.some(r =>
                        r.employeeId === emp.id && r.type === 'sick_leave' &&
                        new Date() >= new Date(r.startDate || '') && new Date() <= new Date(r.endDate || '')
                    );

                    return (
                        <div key={emp.id} className={clsx(
                            "group relative rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col",
                            emp.active
                                ? "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-lg"
                                : "bg-red-200 border-red-300"
                        )}>
                            {!emp.active && (
                                <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
                                    <div className="bg-slate-800/90 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transform -rotate-12 shadow-xl backdrop-blur-sm border border-slate-700">
                                        Dado de Baja
                                    </div>
                                </div>
                            )}

                            <div className="p-5 flex flex-col h-full gap-4 relative z-10">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className={`h-14 w-14 shrink-0 rounded-2xl bg-${color}-100 text-${color}-700 flex items-center justify-center text-xl font-bold border border-${color}-200`}>
                                            {emp.initials || emp.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg leading-tight line-clamp-1" title={emp.name}>{emp.name}</h3>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold bg-${color}-50 text-${color}-700 border border-${color}-100`}>
                                                {emp.category}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Action Buttons - Top Right */}
                                    {/* Action Buttons - Top Right */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-100 z-20">
                                        <button onClick={() => handleViewHistory(emp.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors" title="Ver Historial"><Clock size={15} /></button>
                                        {emp.active && (
                                            <button onClick={() => openEdit(emp)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors" title="Editar"><Pencil size={15} /></button>
                                        )}
                                        {emp.active ? (
                                            <button onClick={() => handleDeactivateClick(emp.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600 transition-colors" title="Dar de Baja"><Trash2 size={15} /></button>
                                        ) : (
                                            <button onClick={() => handleReactivateClick(emp.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-green-600 transition-colors" title="Reactivar"><TrendingUp size={15} /></button>
                                        )}
                                    </div>
                                </div>

                                {/* Main Stats Grid */}
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    {/* Contract Hours */}
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                                        <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                                            <Clock size={14} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Contrato</span>
                                        </div>
                                        <div className="text-xl font-black text-slate-800 flex items-baseline gap-1">
                                            {emp.weeklyHours}h
                                            {activeTempHours > 0 && <span className="text-orange-500 text-xs font-bold">+{activeTempHours}h</span>}
                                        </div>
                                    </div>

                                    {/* Vacations */}
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-center items-center relative overflow-hidden group/vac">

                                        <div className="flex items-center gap-1.5 text-slate-400 mb-0.5 relative z-10 w-full justify-center">
                                            <Plane size={14} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Vacaciones</span>
                                            {emp.active && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setVacEmpId(emp.id);
                                                        setPlanningYear(new Date().getFullYear());
                                                        setIsVacationModalOpen(true);
                                                    }}
                                                    className="ml-1 text-slate-300 hover:text-indigo-500 transition-colors p-0.5 rounded hover:bg-indigo-50"
                                                    title="Ver detalle vacaciones"
                                                >
                                                    <Search size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-xl font-black text-slate-800 relative z-10">
                                            {vacationDays}<span className="text-slate-400 text-sm font-medium">/31</span>
                                        </div>
                                        {/* Progress Bar background */}
                                        <div className="absolute bottom-0 left-0 h-1 bg-teal-500 transition-all duration-500" style={{ width: `${(vacationDays / 31) * 100}%` }}></div>
                                    </div>
                                </div>

                                {/* Info & Status Pills */}
                                <div className="flex flex-wrap gap-2 mt-auto">
                                    {isSickNow && (
                                        <div className="w-full flex items-center justify-between px-3 py-2 bg-red-50 text-red-700 rounded-lg border border-red-100 shadow-sm animate-pulse">
                                            <span className="text-xs font-bold flex items-center gap-2">
                                                <Activity size={14} /> Baja Activa
                                            </span>
                                        </div>
                                    )}
                                    {/* Contract info pill */}
                                    <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-slate-700 rounded-lg border border-slate-100 shadow-sm">
                                        <div className="text-xs font-bold flex items-center gap-1.5">
                                            <Clock size={14} />
                                            <span>{emp.weeklyHours}h/sem</span>
                                            {emp.seniorityDate && (
                                                <>
                                                    <span className="text-slate-300">•</span>
                                                    <span title={`Antigüedad: ${new Date(emp.seniorityDate).toLocaleDateString()}`}>
                                                        Antig: {new Date(emp.seniorityDate).getFullYear()}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {activeTempHours > 0 && (
                                        <div className="w-full flex items-center justify-between px-3 py-2 bg-orange-50 text-orange-800 rounded-lg border border-orange-100 shadow-sm">
                                            <span className="text-xs font-bold flex items-center gap-2">
                                                <TrendingUp size={14} /> Ampliación Temporal
                                            </span>
                                            <span className="text-xs font-bold bg-white px-1.5 py-0.5 rounded border border-orange-200">+{activeTempHours}h</span>
                                        </div>
                                    )}

                                    {/* Action Bar (Quick Actions) */}
                                    <div className="grid grid-cols-4 gap-2 w-full mt-2 pt-3 border-t border-slate-100">
                                        <button
                                            onClick={() => { if (emp.active) { setTempEmpId(emp.id); setTempStart(''); setTempEnd(''); setTempHoursVal(40); setIsTempHoursModalOpen(true); } }}
                                            className={clsx("flex flex-col items-center justify-center p-2 rounded-lg transition-all gap-1 group/btn", emp.active ? "hover:bg-slate-50 text-slate-400 hover:text-orange-600" : "opacity-30 cursor-not-allowed")}
                                            title="Ampliar Horas"
                                            disabled={!emp.active}
                                        >
                                            <TrendingUp size={18} className="group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[9px] font-bold">Ampliar</span>
                                        </button>
                                        <button
                                            onClick={() => { if (emp.active) { setSickEmpId(emp.id); setIsSickModalOpen(true); } }}
                                            className={clsx("flex flex-col items-center justify-center p-2 rounded-lg transition-all gap-1 group/btn", emp.active ? "hover:bg-slate-50 text-slate-400 hover:text-red-600" : "opacity-30 cursor-not-allowed")}
                                            title="Registrar Baja"
                                            disabled={!emp.active}
                                        >
                                            <Activity size={18} className="group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[9px] font-bold">Baja</span>
                                        </button>
                                        <button
                                            onClick={() => { if (emp.active) openPermModal(emp.id); }}
                                            className={clsx("flex flex-col items-center justify-center p-2 rounded-lg transition-all gap-1 group/btn", emp.active ? "hover:bg-slate-50 text-slate-400 hover:text-purple-600" : "opacity-30 cursor-not-allowed")}
                                            title="Restricciones"
                                            disabled={!emp.active}
                                        >
                                            <CalendarClock size={18} className="group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[9px] font-bold">Restric.</span>
                                        </button>
                                        {!emp.active && (
                                            <button
                                                onClick={() => handleReactivate(emp.id)}
                                                className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600 transition-all gap-1 group/btn"
                                                title="Reactivar Empleado"
                                            >
                                                <RotateCcw size={18} className="group-hover/btn:scale-110 transition-transform" />
                                                <span className="text-[9px] font-bold text-emerald-600">Alta</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Nuevo Empleado</h2>
                            <form onSubmit={handleAdd} className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="premium-label-light">Nombre Completo</label>
                                        <input
                                            required
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            className="premium-input-light w-full"
                                            placeholder="Ej: Juan Pérez"
                                        />
                                    </div>
                                    <div className="w-1/4">
                                        <label className="premium-label-light">Iniciales</label>
                                        <input
                                            type="text"
                                            maxLength={4}
                                            value={newInitial}
                                            onChange={e => setNewInitial(e.target.value.toUpperCase())}
                                            className="premium-input-light w-full uppercase text-center"
                                            placeholder="JP"
                                        />
                                    </div>
                                </div>


                                <div>
                                    <label className="premium-label-light">Categoría</label>
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value as EmployeeCategory)}
                                        className="premium-select-light w-full"
                                    >
                                        <option value="Empleado" className="bg-white text-slate-900">Empleado</option>
                                        <option value="Responsable" className="bg-white text-slate-900">Responsable</option>
                                        <option value="Subgerente" className="bg-white text-slate-900">Subgerente</option>
                                        <option value="Gerente" className="bg-white text-slate-900">Gerente</option>
                                        <option value="Limpieza" className="bg-white text-slate-900">Limpieza</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="premium-label-light">Horas Semanales</label>
                                    <select
                                        value={newHours}
                                        onChange={e => setNewHours(Number(e.target.value))}
                                        className="premium-select-light w-full"
                                    >
                                        {Array.from({ length: 15 }, (_, i) => 12 + (i * 2)).map(h => (
                                            <option key={h} value={h} className="bg-white text-slate-900">{h} horas</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="premium-label-light">Email</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        className="premium-input-light w-full"
                                        placeholder="email@ejemplo.com"
                                    />
                                </div>
                                <div>
                                    <DatePicker variant="light"
                                        label="Cumpleaños"
                                        value={newBirthDate}
                                        onChange={setNewBirthDate}
                                    />
                                </div>

                                <div className="pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-3 mb-4">
                                        <input
                                            type="checkbox"
                                            id="isIndefinite"
                                            checked={isIndefinite}
                                            onChange={(e) => setIsIndefinite(e.target.checked)}
                                            className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 bg-white"
                                        />
                                        <label htmlFor="isIndefinite" className="text-sm font-black text-slate-500 uppercase tracking-wider">Contrato Indefinido</label>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100">
                                    <label className="premium-label-light">Antigüedad del Empleado</label>
                                    <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-4 border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setIsNewEmployee(true)}
                                            className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all ${isNewEmployee ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Nuevo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsNewEmployee(false)}
                                            className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all ${!isNewEmployee ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Antiguo
                                        </button>
                                    </div>

                                    {!isNewEmployee && (
                                        <div className="animate-in fade-in slide-in-from-top-1">
                                            <DatePicker variant="light"
                                                label="Fecha de Antigüedad"
                                                value={newSeniority}
                                                onChange={setNewSeniority}
                                                required={!isNewEmployee}
                                            />
                                        </div>
                                    )}
                                </div>
                                {!isIndefinite && (
                                    <div className="animate-in fade-in slide-in-from-top-1">
                                        <DatePicker variant="light"
                                            label="Fecha Fin Contrato"
                                            value={contractEndDate}
                                            onChange={setContractEndDate}
                                        />
                                    </div>
                                )}
                                {/* Permanent Request Option */}
                                <div className="border-t border-gray-100 pt-4 mt-2">
                                    <div className="flex items-center gap-2 mb-3">
                                        <input
                                            type="checkbox"
                                            id="addPerm"
                                            checked={addPermRequest}
                                            onChange={(e) => setAddPermRequest(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="addPerm" className="text-sm font-medium text-slate-700 select-none">
                                            Añadir Petición Permanente Inicial
                                        </label>
                                    </div>

                                    {addPermRequest && (
                                        <div className="space-y-3 pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <select
                                                className="premium-select-light w-full"
                                                value={addPermType}
                                                onChange={e => setAddPermType(e.target.value as PermanentRequestType)}
                                            >
                                                <option value="morning_only" className="bg-white text-slate-900">Solo Mañanas</option>
                                                <option value="afternoon_only" className="bg-white text-slate-900">Solo Tardes</option>
                                                <option value="specific_days_off" className="bg-white text-slate-900">Días Libres Fijos</option>
                                                <option value="max_afternoons_per_week" className="bg-white text-slate-900">Máximo de Tardes Semanales</option>
                                            </select>

                                            {addPermType === 'max_afternoons_per_week' ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-slate-500 font-medium ml-1">Número Máximo de Tardes:</span>
                                                    <div className="flex gap-2">
                                                        {[1, 2, 3].map(num => (
                                                            <button
                                                                type="button"
                                                                key={num}
                                                                onClick={() => { /* Since this is add modal state is complex to route strictly through addPermDays abuse or new state. For simplicity I will just use days[0] to store value or add a new state, but adding new state requires full re-render. I will skip full implementation in Add Employee Modal for this edge case to keep it simple, or force user to use perm modal. Let's add partial support.*/ }}
                                                                className={clsx(
                                                                    "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                                                                    "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed" // Disabled in quick add for simplicity to avoid state explosion
                                                                )}
                                                                title="Usa el botón 'Petición Permanente' en la lista para configurar esto con detalle."
                                                            >
                                                                {num} (Usar Modal Detalle)
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-orange-500">Para "Max Tardes", por favor crea el empleado y luego usa el botón del reloj.</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-slate-500 font-medium ml-1">
                                                        {addPermType === 'specific_days_off' ? 'Selecciona los días libres:' : 'Aplicar solo en estos días (opcional):'}
                                                    </span>
                                                    <div className="flex gap-2 justify-center py-2 flex-wrap">
                                                        {[1, 2, 3, 4, 5, 6, 0].map(day => (
                                                            <button
                                                                key={day}
                                                                type="button"
                                                                onClick={() => setAddPermDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                                                className={clsx(
                                                                    "w-8 h-8 rounded-full text-xs font-medium transition-colors",
                                                                    addPermDays.includes(day)
                                                                        ? 'bg-purple-600 text-white'
                                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                )}
                                                            >
                                                                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day].charAt(0)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddModalOpen(false);
                                            setNewName('');
                                        }}
                                        className="flex-1 px-4 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                    >
                                        Crear Empleado
                                    </button>
                                </div>
                            </form>
                        </div >
                    </div >
                )
            }

            {/* Edit Modal */}
            {
                isEditModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Editar Empleado</h2>
                            <form onSubmit={handleEdit} className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="premium-label-light">Nombre Completo</label>
                                        <input
                                            required
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            className="premium-input-light w-full"
                                        />
                                    </div>
                                    <div className="w-1/4">
                                        <label className="premium-label-light">Iniciales</label>
                                        <input
                                            type="text"
                                            maxLength={4}
                                            value={newInitial}
                                            onChange={e => setNewInitial(e.target.value.toUpperCase())}
                                            className="premium-input-light w-full uppercase"
                                            placeholder="ABCD"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="premium-label-light">Categoría</label>
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value as EmployeeCategory)}
                                        className="premium-select-light w-full"
                                    >
                                        <option value="Empleado" className="bg-white text-slate-900">Empleado</option>
                                        <option value="Responsable" className="bg-white text-slate-900">Responsable</option>
                                        <option value="Subgerente" className="bg-white text-slate-900">Subgerente</option>
                                        <option value="Gerente" className="bg-white text-slate-900">Gerente</option>
                                        <option value="Limpieza" className="bg-white text-slate-900">Limpieza</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="premium-label-light">Horas Semanales</label>
                                    <select
                                        value={newHours}
                                        onChange={e => setNewHours(Number(e.target.value))}
                                        className="premium-select-light w-full"
                                    >
                                        {Array.from({ length: 15 }, (_, i) => 12 + (i * 2)).map(h => (
                                            <option key={h} value={h} className="bg-white text-slate-900">{h} horas</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="premium-label-light">Email</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        className="premium-input-light w-full"
                                    />
                                </div>
                                <div>
                                    <DatePicker variant="light"
                                        label="Cumpleaños"
                                        value={newBirthDate}
                                        onChange={setNewBirthDate}
                                    />
                                </div>



                                <div className="pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            id="editIsIndefinite"
                                            checked={isIndefinite}
                                            onChange={(e) => setIsIndefinite(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="editIsIndefinite" className="text-sm font-medium text-slate-700">Contrato Indefinido</label>
                                    </div>
                                    {!isIndefinite && (
                                        <div className="animate-in fade-in slide-in-from-top-1">
                                            <DatePicker variant="light"
                                                label="Fecha Fin Contrato"
                                                value={contractEndDate}
                                                onChange={setContractEndDate}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditModalOpen(false);
                                            setNewName('');
                                        }}
                                        className="flex-1 px-4 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                    >
                                        Guardar Cambios
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Permanent Requests Modal */}
            {/* Permanent Requests Modal */}
            {
                isPermModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Peticiones</h2>
                                <button onClick={() => setIsPermModalOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-2 rounded-xl border border-slate-200">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                                {!permEmpId ? (
                                    <div className="mb-8">
                                        <label className="premium-label-light">Selecciona Empleado</label>
                                        <select
                                            className="premium-select-light w-full"
                                            onChange={(e) => setPermEmpId(e.target.value)}
                                            value={permEmpId || ''}
                                        >
                                            <option value="" className="bg-white text-slate-900">-- Seleccionar --</option>
                                            {filteredEmployees.map(e => (
                                                <option key={e.id} value={e.id} className="bg-white text-slate-900">{e.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="mb-6 flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Empleado Seleccionado</p>
                                            <p className="text-xl font-black text-slate-900 tracking-tight">{filteredEmployees.find(e => e.id === permEmpId)?.name}</p>
                                        </div>
                                        <button onClick={() => setPermEmpId(null)} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all">Cambiar</button>
                                    </div>
                                )}

                                {permEmpId && (
                                    <>
                                        <div className="mb-8 space-y-3">
                                            {employeePermRequests.length > 0 ? (
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Restricciones Activas</p>
                                            ) : null}
                                            {employeePermRequests.length > 0 ? employeePermRequests.map(req => (
                                                <div key={req.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                                                    <div className="text-sm">
                                                        <div className="font-black text-slate-900 uppercase text-xs tracking-tight">
                                                            {req.type === 'morning_only' ? 'Solo Mañanas' :
                                                                req.type === 'afternoon_only' ? 'Solo Tardes' :
                                                                    req.type === 'max_afternoons_per_week' ? `Máximo ${req.value} Tardes/Semana` :
                                                                        req.type === 'force_full_days' ? 'Descanso en Días Completos' :
                                                                            req.type === 'rotating_days_off' ? 'Ciclo de Libranzas' :
                                                                                req.type === 'early_morning_shift' ? 'Entrada 9:00' :
                                                                                    'Días Libres Fijos'}
                                                        </div>
                                                        {(req.days && req.days.length > 0) && (
                                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                                                {req.days.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ')}
                                                            </div>
                                                        )}
                                                        {req.type === 'rotating_days_off' && (
                                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                                                Ciclo de {req.cycleWeeks} semanas
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReqToDelete(req.id);
                                                            setIsConfirmDeletePermOpen(true);
                                                        }}
                                                        className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )) : (
                                                <div className="py-8 text-center flex flex-col items-center gap-3 bg-slate-50 rounded-[2rem] border border-slate-100">
                                                    <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                                                        <AlertCircle size={24} className="text-slate-300" />
                                                    </div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin restricciones activas</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t border-slate-100 pt-8">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Añadir Restricción</p>
                                            <div className="space-y-6">
                                                <select
                                                    className="premium-select-light w-full"
                                                    value={newPermType}
                                                    onChange={e => setNewPermType(e.target.value as PermanentRequestType)}
                                                >
                                                    <option value="morning_only" className="bg-white text-slate-900">Solo Mañanas</option>
                                                    <option value="afternoon_only" className="bg-white text-slate-900">Solo Tardes</option>
                                                    <option value="specific_days_off" className="bg-white text-slate-900">Días Libres Fijos</option>
                                                    <option value="rotating_days_off" className="bg-white text-slate-900">Turnos Rotativos (Libranzas Alternas)</option>
                                                    <option value="max_afternoons_per_week" className="bg-white text-slate-900">Máximo de Tardes Semanales</option>
                                                    <option value="force_full_days" className="bg-white text-slate-900">Descanso en Días Completos</option>
                                                    <option value="early_morning_shift" className="bg-white text-slate-900">Entrada 9:00 (Bloque 9-14h)</option>
                                                </select>

                                                <div className="flex flex-col gap-1">
                                                    {newPermType === 'rotating_days_off' ? (
                                                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                                                            <div className="flex gap-4">
                                                                <div className="flex-1">
                                                                    <label className="premium-label-light">Duración Ciclo</label>
                                                                    <select
                                                                        value={rotatingCycleWeeks}
                                                                        onChange={(e) => {
                                                                            const n = Number(e.target.value);
                                                                            setRotatingCycleWeeks(n);
                                                                            const newArr = new Array(n).fill([]).map((_, i) => rotatingCycleDays[i] || []);
                                                                            setRotatingCycleDays(newArr);
                                                                        }}
                                                                        className="premium-select-light w-full text-xs"
                                                                    >
                                                                        <option value={2} className="bg-white text-slate-900">2 Semanas</option>
                                                                        <option value={3} className="bg-white text-slate-900">3 Semanas</option>
                                                                        <option value={4} className="bg-white text-slate-900">4 Semanas</option>
                                                                    </select>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="premium-label-light">Inicio (S-1)</label>
                                                                    <DatePicker variant="light"
                                                                        value={rotatingRefDate}
                                                                        onChange={setRotatingRefDate}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {Array.from({ length: rotatingCycleWeeks }).map((_, weekIndex) => (
                                                                    <div key={weekIndex} className="bg-white p-4 rounded-xl border border-slate-200/50">
                                                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Semana {weekIndex + 1}</p>
                                                                        <div className="flex gap-1.5 justify-between">
                                                                            {[1, 2, 3, 4, 5, 6, 0].map(day => (
                                                                                <button
                                                                                    key={day}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const currentDays = rotatingCycleDays[weekIndex] || [];
                                                                                        const newDays = currentDays.includes(day)
                                                                                            ? currentDays.filter(d => d !== day)
                                                                                            : [...currentDays, day];
                                                                                        const newCycleDays = [...rotatingCycleDays];
                                                                                        newCycleDays[weekIndex] = newDays;
                                                                                        setRotatingCycleDays(newCycleDays);
                                                                                    }}
                                                                                    className={clsx(
                                                                                        "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all",
                                                                                        (rotatingCycleDays[weekIndex] || []).includes(day)
                                                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                                                                            : 'bg-slate-100 text-slate-400 hover:text-slate-600 border border-slate-200'
                                                                                    )}
                                                                                >
                                                                                    {['D', 'L', 'M', 'X', 'J', 'V', 'S'][day === 0 ? 0 : day]}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : newPermType === 'max_afternoons_per_week' ? (
                                                        <div className="space-y-4">
                                                            <label className="premium-label-light">Máximo de Tardes:</label>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                {[1, 2, 3].map(num => (
                                                                    <button
                                                                        key={num}
                                                                        type="button"
                                                                        onClick={() => setMaxAfternoons(num)}
                                                                        className={clsx(
                                                                            "py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                                                            maxAfternoons === num
                                                                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 border border-purple-500'
                                                                                : 'bg-slate-100 text-slate-400 border border-slate-200 hover:border-purple-500/50'
                                                                        )}
                                                                    >
                                                                        {num}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex gap-3">
                                                                <AlertCircle size={16} className="text-purple-600 shrink-0" />
                                                                <p className="text-[10px] text-purple-600 font-medium leading-relaxed uppercase">La jornada partida cuenta como 1 tarde.</p>
                                                            </div>
                                                        </div>
                                                    ) : newPermType === 'force_full_days' ? (
                                                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex gap-3">
                                                            <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
                                                            <p className="text-[10px] text-indigo-600 uppercase tracking-widest font-black leading-relaxed">Preferirá jornadas partidas para maximizar días libres completos.</p>
                                                        </div>
                                                    ) : newPermType === 'early_morning_shift' ? (
                                                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                                                            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                                                            <p className="text-[10px] text-amber-600 uppercase tracking-widest font-black leading-relaxed">Trabajará 4 días/semana entrando a las 9:00 (Bloque 5h).</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            <label className="premium-label-light">
                                                                {newPermType === 'specific_days_off' ? 'Selecciona los días libres:' : 'Aplicar solo en estos días (opcional):'}
                                                            </label>
                                                            <div className="flex gap-1.5 justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                                {[1, 2, 3, 4, 5, 6, 0].map(day => (
                                                                    <button
                                                                        key={day}
                                                                        type="button"
                                                                        onClick={() => toggleDay(day)}
                                                                        className={clsx(
                                                                            "w-9 h-9 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                                                            selectedDays.includes(day)
                                                                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                                                                                : 'bg-white text-slate-400 border border-slate-200 hover:border-purple-500/30'
                                                                        )}
                                                                    >
                                                                        {['D', 'L', 'M', 'X', 'J', 'V', 'S'][day === 0 ? 0 : day]}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="pt-8">
                                                <button
                                                    type="button"
                                                    onClick={handleAddPerm}
                                                    className="w-full py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                                >
                                                    Añadir Petición
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Vacation Planning Modal */}
            {
                isVacationModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                                    <Plane className="text-teal-600" /> Vacaciones
                                </h2>
                                <button onClick={() => setIsVacationModalOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleAddVacation} className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-2">
                                <div>
                                    <label className="premium-label-light">Selecciona Empleado</label>
                                    <select
                                        className="premium-select-light w-full"
                                        onChange={(e) => {
                                            setVacEmpId(e.target.value);
                                            setVacationRanges([]);
                                        }}
                                        value={vacEmpId}
                                        required
                                    >
                                        <option value="" className="bg-white text-slate-900">-- Seleccionar --</option>
                                        {filteredEmployees.map(e => (
                                            <option key={e.id} value={e.id} className="bg-white text-slate-900">{e.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {!vacEmpId ? (
                                    <div className="bg-slate-50 border border-slate-100 border-dashed rounded-[2.5rem] p-12 text-center flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                                            <Plane size={32} className="text-slate-200" />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecciona un empleado para empezar</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                                            {[new Date().getFullYear(), new Date().getFullYear() + 1].map(year => (
                                                <button
                                                    key={year}
                                                    type="button"
                                                    onClick={() => setPlanningYear(year)}
                                                    className={clsx(
                                                        "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                        planningYear === year
                                                            ? "bg-white text-teal-600 shadow-sm"
                                                            : "text-slate-400 hover:text-slate-600"
                                                    )}
                                                >
                                                    {year}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 rounded-3xl p-6">
                                            {(() => {
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                let enjoyed = 0;
                                                let planned = 0;

                                                timeOffRequests
                                                    .filter(req => req.employeeId === vacEmpId && req.type === 'vacation')
                                                    .forEach(req => {
                                                        req.dates.forEach(dStr => {
                                                            const d = new Date(dStr);
                                                            if (d.getFullYear() === planningYear) {
                                                                d.setHours(0, 0, 0, 0);
                                                                if (d < today) enjoyed++;
                                                                else planned++;
                                                            }
                                                        });
                                                    });

                                                vacationRanges.forEach(r => {
                                                    const s = new Date(r.start);
                                                    const e = new Date(r.end);
                                                    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                                                        if (d.getFullYear() === planningYear) {
                                                            const current = new Date(d);
                                                            current.setHours(0, 0, 0, 0);
                                                            if (current < today) enjoyed++;
                                                            else planned++;
                                                        }
                                                    }
                                                });

                                                const totalUsed = enjoyed + planned;
                                                const remaining = 31 - totalUsed;

                                                return (
                                                    <div className="flex justify-between items-center gap-6">
                                                        <div>
                                                            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{remaining}</p>
                                                            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Días disponibles</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-1">de 31 días en {planningYear}</p>
                                                        </div>
                                                        <div className="flex gap-6 text-right">
                                                            <div>
                                                                <div className="text-xl font-black text-slate-900 mb-1">{enjoyed}</div>
                                                                <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Gozados</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xl font-black text-indigo-600 mb-1">{planned}</div>
                                                                <div className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">Plan</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Historial {planningYear}</p>
                                            <div className="bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                                                {(() => {
                                                    const empRequests = timeOffRequests
                                                        .filter(req => req.employeeId === vacEmpId && req.type === 'vacation')
                                                        .filter(req => req.dates.some(d => new Date(d).getFullYear() === planningYear))
                                                        .sort((a, b) => new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime());

                                                    if (empRequests.length === 0) {
                                                        return (
                                                            <div className="p-8 text-center flex flex-col items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                                                                    <AlertCircle size={18} className="text-slate-200" />
                                                                </div>
                                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin vacaciones registradas</p>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="divide-y divide-slate-100">
                                                            {empRequests.map(req => {
                                                                const daysInYear = req.dates.filter(d => new Date(d).getFullYear() === planningYear).length;
                                                                if (daysInYear === 0) return null;

                                                                const startStr = req.startDate || (req.dates && req.dates[0]) || '';
                                                                const endStr = req.endDate || (req.dates && req.dates[req.dates.length - 1]) || '';
                                                                const isPassed = endStr ? new Date(endStr) < new Date() : false;

                                                                return (
                                                                    <div key={req.id} className="p-4 flex items-center justify-between hover:bg-white transition-colors group">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={clsx("w-2 h-2 rounded-full", isPassed ? "bg-slate-200" : "bg-teal-500 shadow-sm shadow-teal-500/20")}></div>
                                                                            <div>
                                                                                <div className={clsx("text-xs font-black uppercase tracking-tight", isPassed ? "text-slate-400" : "text-slate-900")}>
                                                                                    {startStr ? new Date(startStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '?'}
                                                                                    {' → '}
                                                                                    {endStr ? new Date(endStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '?'}
                                                                                </div>
                                                                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{daysInYear} días</div>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeletingVacationId(req.id);
                                                                                setIsConfirmDeleteVacationOpen(true);
                                                                            }}
                                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Staged Ranges */}
                                        {vacationRanges.length > 0 && (
                                            <div className="space-y-4">
                                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Nuevos Periodos</p>
                                                <div className="bg-indigo-50 rounded-[2rem] border border-indigo-100 overflow-hidden divide-y divide-indigo-100">
                                                    {vacationRanges.map((range, idx) => (
                                                        <div key={idx} className="p-4 flex justify-between items-center">
                                                            <div>
                                                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                                                    {new Date(range.start).toLocaleDateString()} → {new Date(range.end).toLocaleDateString()}
                                                                </p>
                                                                <p className="text-[10px] text-indigo-600 font-bold uppercase">
                                                                    {Math.ceil((new Date(range.end).getTime() - new Date(range.start).getTime()) / (1000 * 60 * 60 * 24)) + 1} días
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeRange(idx)}
                                                                className="p-2 text-indigo-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Añadir Periodo</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <DatePicker variant="light"
                                                    label="Desde"
                                                    value={vacStartDate}
                                                    onChange={setVacStartDate}
                                                />
                                                <DatePicker variant="light"
                                                    label="Hasta"
                                                    value={vacEndDate}
                                                    onChange={setVacEndDate}
                                                    min={vacStartDate}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={addRange}
                                                disabled={!vacStartDate || !vacEndDate}
                                                className="w-full py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center gap-3 transition-all active:scale-95"
                                            >
                                                <Plus size={16} /> Añadir a la Lista
                                            </button>
                                        </div>

                                        <div className="pt-4 sticky bottom-0 bg-white py-4 border-t border-slate-100 mt-auto">
                                            <button
                                                type="submit"
                                                disabled={vacationRanges.length === 0}
                                                className="w-full py-4 bg-teal-600 text-white font-black text-xs uppercase tracking-widest hover:bg-teal-700 rounded-2xl shadow-lg shadow-teal-600/20 active:scale-95 transition-all disabled:opacity-30"
                                            >
                                                Guardar Planificación
                                            </button>
                                        </div>
                                    </>
                                )}
                            </form>
                        </div>
                    </div>
                )
            }
            {
                isTempHoursModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                                    <TrendingUp className="text-orange-500" /> Ampliación
                                </h2>
                                <button onClick={() => setIsTempHoursModalOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                if (!tempEmpId || !tempStart || !tempEnd) {
                                    showToast('Completa todos los campos', 'error');
                                    return;
                                }

                                if (editingTempHoursId) {
                                    removeTempHours(editingTempHoursId.empId, editingTempHoursId.adjId);
                                }

                                addTempHours(tempEmpId, {
                                    hours: tempHoursVal,
                                    start: tempStart,
                                    end: tempEnd
                                });
                                showToast(editingTempHoursId ? 'Ampliación editada' : 'Horas ampliadas correctamente', 'success');
                                setIsTempHoursModalOpen(false);
                                setEditingTempHoursId(null);
                            }} className="space-y-6">
                                <div>
                                    <label className="premium-label-light">Empleado</label>
                                    <select
                                        className="premium-select-light w-full"
                                        onChange={(e) => {
                                            setTempEmpId(e.target.value);
                                            const selectedEmp = employees.find(emp => emp.id === e.target.value);
                                            if (selectedEmp) {
                                                setTempHoursVal(Math.min(40, selectedEmp.weeklyHours + 4));
                                            }
                                        }}
                                        value={tempEmpId}
                                        required
                                    >
                                        <option value="" className="bg-white text-slate-900">-- Seleccionar --</option>
                                        {filteredEmployees
                                            .filter(e => e.weeklyHours < 40)
                                            .map(e => (
                                                <option key={e.id} value={e.id} className="bg-white text-slate-900">{e.name} ({e.weeklyHours}h)</option>
                                            ))}
                                    </select>
                                </div>

                                {tempEmpId && (
                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Estado Actual</p>
                                        <p className="text-sm font-bold text-slate-900 mb-0.5">{employees.find(e => e.id === tempEmpId)?.name}</p>
                                        <p className="text-xs text-slate-500 font-bold">Base: {employees.find(e => e.id === tempEmpId)?.weeklyHours}h / semana</p>
                                    </div>
                                )}

                                <div>
                                    <label className="premium-label-light">Nuevas Horas Semanales (Total)</label>
                                    <select
                                        value={tempHoursVal}
                                        onChange={e => setTempHoursVal(Number(e.target.value))}
                                        className="premium-select-light w-full"
                                    >
                                        {(() => {
                                            const emp = employees.find(e => e.id === tempEmpId);
                                            const standardHours = [16, 20, 24, 28, 30, 32, 36, 40];
                                            const currentBase = emp ? emp.weeklyHours : 0;
                                            return standardHours
                                                .filter(h => h > currentBase)
                                                .map(h => (
                                                    <option key={h} value={h} className="bg-white text-slate-900">{h} Horas</option>
                                                ));
                                        })()}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest pl-1">Máximo: 40 horas semanales</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <DatePicker variant="light"
                                        label="Desde"
                                        value={tempStart}
                                        onChange={setTempStart}
                                        required
                                    />
                                    <DatePicker variant="light"
                                        label="Hasta"
                                        value={tempEnd}
                                        onChange={setTempEnd}
                                        required
                                        min={tempStart}
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setIsTempHoursModalOpen(false)} className="flex-1 px-4 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
                                    <button type="submit" className="flex-1 px-4 py-3.5 bg-orange-600 text-white font-black text-xs uppercase tracking-widest hover:bg-orange-700 rounded-2xl shadow-lg shadow-orange-600/20 active:scale-95 transition-all">
                                        Guardar
                                    </button>
                                </div>

                                {tempEmpId && (
                                    <div className="pt-6 border-t border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Ampliaciones Activas</p>
                                        <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                            {(() => {
                                                const emp = employees.find(e => e.id === tempEmpId);
                                                if (!emp || !emp.tempHours || emp.tempHours.length === 0) {
                                                    return <p className="text-xs text-slate-400 italic py-4 text-center">No hay ampliaciones registradas.</p>;
                                                }
                                                return emp.tempHours.map(h => (
                                                    <div key={h.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 group/item hover:border-orange-200 transition-all">
                                                        <div className="text-xs">
                                                            <span className="font-black text-slate-900 block mb-0.5">{h.hours}h Semanales</span>
                                                            <span className="text-slate-400 font-bold uppercase tracking-tighter">{new Date(h.start).toLocaleDateString()} - {new Date(h.end).toLocaleDateString()}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setDeletingTempId({ empId: tempEmpId, adjId: h.id });
                                                                setIsConfirmDeleteTempOpen(true);
                                                            }}
                                                            className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Legacy Delete Modals Removed - Replaced with ConfirmDialogs below */}
            {/* ... */}


            {
                isSickModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                            <div className="flex items-center justify-between p-8 border-b border-slate-100">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Registro de Baja</h3>
                                    <p className="text-sm text-slate-400 font-medium">
                                        {sickEmpId && employees.find(e => e.id === sickEmpId)?.name}
                                    </p>
                                </div>
                                <button onClick={() => setIsSickModalOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleAddSickLeave} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                <div>
                                    <label className="premium-label-light">Empleado</label>
                                    <select
                                        className="premium-select-light w-full"
                                        value={sickEmpId || ''}
                                        onChange={e => setSickEmpId(e.target.value)}
                                        required
                                    >
                                        <option value="" className="bg-white text-slate-900">-- Seleccionar Empleado --</option>
                                        {employees.filter(e => e.establishmentId === user.establishmentId).map(e => (
                                            <option key={e.id} value={e.id} className="bg-white text-slate-900">{e.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="premium-label-light">Tipo de Baja</label>
                                    <select
                                        className="premium-select-light w-full"
                                        value={sickType}
                                        onChange={e => setSickType(e.target.value as TimeOffType)}
                                    >
                                        <option value="sick_leave" className="bg-white text-slate-900">Baja Común / IT</option>
                                        <option value="maternity_paternity" className="bg-white text-slate-900">Maternidad / Paternidad</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <DatePicker variant="light"
                                        label="Fecha Inicio"
                                        value={sickStartDate}
                                        onChange={setSickStartDate}
                                        required
                                    />
                                    <DatePicker variant="light"
                                        label="Fecha Fin (Estimada)"
                                        value={sickEndDate}
                                        onChange={setSickEndDate}
                                        required
                                    />
                                </div>
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                        El empleado no será asignado a ningún turno durante este periodo. Se marcará como inactivo temporalmente en el generador de IA.
                                    </p>
                                </div>
                                <div className="pt-4 flex justify-end gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsSickModalOpen(false)}
                                        className="flex-1 px-4 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3.5 bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 rounded-2xl shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                                    >
                                        Registrar
                                    </button>
                                </div>

                                {/* Sick Leave History */}
                                {sickEmpId && (
                                    <div className="pt-8 border-t border-slate-100">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Historial de Bajas</h4>
                                        <div className="space-y-3">
                                            {timeOffRequests
                                                .filter(req => req.employeeId === sickEmpId && (req.type === 'sick_leave' || req.type === 'maternity_paternity'))
                                                .sort((a, b) => new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime())
                                                .map(req => (
                                                    <div key={req.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 group/item hover:border-red-200 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 border border-red-100">
                                                                <Activity size={18} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-slate-900">
                                                                    {new Date(req.startDate || '').toLocaleDateString()} - {new Date(req.endDate || '').toLocaleDateString()}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                                    {(() => {
                                                                        const start = new Date(req.startDate || '');
                                                                        const end = new Date(req.endDate || '');
                                                                        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                                                        return `${diffDays} días registrados`;
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setDeletingSickLeaveId(req.id);
                                                                setIsConfirmDeleteSickOpen(true);
                                                            }}
                                                            className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            {timeOffRequests.filter(req => req.employeeId === sickEmpId && (req.type === 'sick_leave' || req.type === 'maternity_paternity')).length === 0 && (
                                                <p className="text-center text-xs text-slate-600 py-6 italic">No hay bajas registradas previamente.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                )
            }



            <ConfirmDialog
                isOpen={isConfirmDeletePermOpen}
                title="Confirmación de Gerente Requerida"
                message="¿Estás seguro de eliminar esta restricción permanentemente? Esta acción requiere autorización del gerente."
                confirmText="Eliminar Permanentemente"
                cancelText="Cancelar"
                onConfirm={() => {
                    if (reqToDelete) {
                        removePermanentRequest(reqToDelete);
                        setReqToDelete(null);
                        showToast('Restricción eliminada permanentemente', 'success');
                    }
                    setIsConfirmDeletePermOpen(false);
                }}
                onCancel={() => {
                    setIsConfirmDeletePermOpen(false);
                    setReqToDelete(null);
                }}
                isDestructive={true}
            />

            <ConfirmDialog
                isOpen={isConfirmDeleteVacationOpen}
                title="Eliminar Vacaciones"
                message="¿Estás seguro de que quieres eliminar este periodo de vacaciones?"
                confirmText="Eliminar"
                cancelText="Cancelar"
                onConfirm={() => {
                    if (deletingVacationId) {
                        removeTimeOff(deletingVacationId);
                        showToast('Vacaciones eliminadas', 'info');
                        setDeletingVacationId(null);
                    }
                    setIsConfirmDeleteVacationOpen(false);
                }}
                onCancel={() => {
                    setIsConfirmDeleteVacationOpen(false);
                    setDeletingVacationId(null);
                }}
                isDestructive={true}
            />

            {/* Sick Leave History Modal (Global) */}
            {
                isSickHistoryOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold text-slate-900">Historial Bajas</h3>
                                        <div className="relative">
                                            <select
                                                value={sickHistoryYear}
                                                onChange={(e) => setSickHistoryYear(parseInt(e.target.value))}
                                                className="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-900 text-lg font-bold py-1 pl-3 pr-8 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none transition-colors"
                                            >
                                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">Registro completo de bajas durante el año seleccionado</p>
                                </div>
                                <button onClick={() => setIsSickHistoryOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                <div className="space-y-3">
                                    {timeOffRequests
                                        .filter(req => {
                                            if (req.type !== 'sick_leave' && req.type !== 'maternity_paternity') return false;
                                            if (!employees.some(e => e.id === req.employeeId && e.establishmentId === user?.establishmentId)) return false;

                                            // Filter by selected year
                                            const year = sickHistoryYear;
                                            const startYear = new Date(req.startDate || '').getFullYear();
                                            const endYear = new Date(req.endDate || '').getFullYear();

                                            // Include if it starts in the year, ends in the year, or spans across the year
                                            return (startYear <= year && endYear >= year);
                                        })
                                        .sort((a, b) => new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime()) // Newest first
                                        .map(req => {
                                            const emp = employees.find(e => e.id === req.employeeId);
                                            if (!emp) return null;
                                            const isMaternity = req.type === 'maternity_paternity';
                                            return (
                                                <div key={req.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-slate-300 transition-all group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold shrink-0 border ${isMaternity ? 'bg-pink-100 text-pink-600 border-pink-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                                                            {emp.initials || emp.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-slate-900 group-hover:text-red-700 transition-colors">{emp.name}</h4>
                                                                {isMaternity && <span className="text-[10px] font-bold bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded border border-pink-200 uppercase tracking-tight">Maternidad/Paternidad</span>}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                                <span className="font-medium bg-white px-2 py-0.5 rounded border border-slate-200">{new Date(req.startDate || '').toLocaleDateString()}</span>
                                                                <span className="text-slate-300">→</span>
                                                                <span className="font-medium bg-white px-2 py-0.5 rounded border border-slate-200">{new Date(req.endDate || '').toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 shadow-sm">
                                                            {(() => {
                                                                const start = new Date(req.startDate || '').getTime();
                                                                const end = new Date(req.endDate || '').getTime();
                                                                const diffTime = Math.abs(end - start);
                                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                                                return `${diffDays} días`;
                                                            })()}
                                                        </span>
                                                        {(() => {
                                                            const today = new Date();
                                                            today.setHours(0, 0, 0, 0);
                                                            const start = new Date(req.startDate || '');
                                                            const end = new Date(req.endDate || '');
                                                            start.setHours(0, 0, 0, 0);
                                                            end.setHours(0, 0, 0, 0);
                                                            if (today >= start && today <= end) {
                                                                return <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 uppercase tracking-wide">ACTIVA</span>
                                                            }
                                                            return <span className="text-[10px] font-bold text-slate-400">Finalizada</span>
                                                        })()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    {timeOffRequests.filter(req => {
                                        if (req.type !== 'sick_leave') return false;
                                        if (!employees.some(e => e.id === req.employeeId && e.establishmentId === user?.establishmentId)) return false;
                                        const year = sickHistoryYear;
                                        const startYear = new Date(req.startDate || '').getFullYear();
                                        const endYear = new Date(req.endDate || '').getFullYear();
                                        return (startYear <= year && endYear >= year);
                                    }).length === 0 && (
                                            <div className="text-center py-12 text-slate-400">
                                                <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Activity size={32} className="opacity-20" />
                                                </div>
                                                <p className="font-medium">No hay bajas registradas en {sickHistoryYear}</p>
                                            </div>
                                        )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            <ConfirmDialog
                isOpen={isConfirmDeletePermOpen}
                title="Confirmación de Gerente Requerida"
                message="¿Estás seguro de eliminar esta restricción permanentemente? Esta acción requiere autorización del gerente."
                confirmText="Eliminar Permanentemente"
                cancelText="Cancelar"
                onConfirm={() => {
                    if (reqToDelete) {
                        removePermanentRequest(reqToDelete);
                        setReqToDelete(null);
                        showToast('Restricción eliminada permanentemente', 'success');
                    }
                    setIsConfirmDeletePermOpen(false);
                }}
                onCancel={() => {
                    setIsConfirmDeletePermOpen(false);
                    setReqToDelete(null);
                }}
                isDestructive={true}
            />

            <ConfirmDialog
                isOpen={isConfirmDeleteVacationOpen}
                title="Eliminar Vacaciones"
                message="¿Estás seguro de que quieres eliminar este periodo de vacaciones?"
                confirmText="Eliminar"
                cancelText="Cancelar"
                onConfirm={() => {
                    if (deletingVacationId) {
                        removeTimeOff(deletingVacationId);
                        showToast('Vacaciones eliminadas', 'info');
                        setDeletingVacationId(null);
                    }
                    setIsConfirmDeleteVacationOpen(false);
                }}
                onCancel={() => {
                    setIsConfirmDeleteVacationOpen(false);
                    setDeletingVacationId(null);
                }}
                isDestructive={true}
            />

            <ConfirmDialog
                isOpen={isConfirmDeleteTempOpen}
                title="Eliminar Ampliación de Horas"
                message="¿Estás seguro de eliminar esta ampliación de horas permanentemente? Esta acción requiere autorización del gerente."
                confirmText="Eliminar"
                cancelText="Cancelar"
                onConfirm={() => {
                    if (deletingTempId) {
                        removeTempHours(deletingTempId.empId, deletingTempId.adjId);
                        showToast('Ampliación eliminada correctamente', 'info');
                        setDeletingTempId(null);
                    }
                    setIsConfirmDeleteTempOpen(false);
                }}
                onCancel={() => {
                    setIsConfirmDeleteTempOpen(false);
                    setDeletingTempId(null);
                }}
                isDestructive={true}
            />

            <ConfirmDialog
                isOpen={isConfirmDeleteSickOpen}
                title="Eliminar Baja Médica"
                message="¿Estás seguro de eliminar esta baja médica del historial? Esta acción requiere autorización del gerente."
                confirmText="Eliminar"
                cancelText="Cancelar"
                onConfirm={() => {
                    if (deletingSickLeaveId) {
                        removeTimeOff(deletingSickLeaveId);
                        showToast('Baja eliminada correctamente', 'info');
                        setDeletingSickLeaveId(null);
                    }
                    setIsConfirmDeleteSickOpen(false);
                }}
                onCancel={() => {
                    setIsConfirmDeleteSickOpen(false);
                    setDeletingSickLeaveId(null);
                }}
                isDestructive={true}
            />



            {/* Deactivation Modal */}
            {
                isDeactivateModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Dar de Baja</h2>
                            <p className="text-slate-500 text-sm mb-8 font-medium">Indica el motivo de la baja para el historial del empleado.</p>
                            <form onSubmit={handleConfirmDeactivate} className="space-y-6">
                                <div>
                                    <label className="premium-label-light">Motivo de la Baja</label>
                                    <textarea
                                        required
                                        value={deactivationReason}
                                        onChange={e => setDeactivationReason(e.target.value)}
                                        className="premium-input-light w-full h-32 resize-none pt-4"
                                        placeholder="Ej: Fin de contrato, Renuncia voluntaria..."
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsDeactivateModalOpen(false)}
                                        className="flex-1 px-4 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3.5 bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 rounded-2xl shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                                    >
                                        Confirmar Baja
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Reactivation Modal */}
            {
                isReactivateModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Reactivar Empleado</h2>
                            <p className="text-sm text-slate-500 mb-8 font-medium">Configura las condiciones del nuevo contrato.</p>
                            <form onSubmit={confirmReactivation} className="space-y-6">
                                <div>
                                    <label className="premium-label-light">Tipo de Contrato</label>
                                    <div className="grid grid-cols-3 gap-3 p-1.5 bg-slate-100 border border-slate-200 rounded-2xl">
                                        <button
                                            type="button"
                                            onClick={() => setReactivateMode('indefinido')}
                                            className={clsx(
                                                "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                reactivateMode === 'indefinido' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            Indefinido
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReactivateMode('temporal')}
                                            className={clsx(
                                                "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                reactivateMode === 'temporal' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            Temporal
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReactivateMode('sustitucion')}
                                            className={clsx(
                                                "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                reactivateMode === 'sustitucion' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            Sustitución
                                        </button>
                                    </div>
                                </div>

                                {reactivateMode === 'temporal' && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <DatePicker variant="light"
                                            label="Fecha Fin (Estimada)"
                                            value={reactivateEndDate}
                                            onChange={setReactivateEndDate}
                                            required
                                        />
                                    </div>
                                )}

                                {reactivateMode === 'sustitucion' && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <label className="premium-label-light">Sustituir a (Baja Médica)</label>
                                        <select
                                            required
                                            value={reactivateSubstitutionId}
                                            onChange={(e) => setReactivateSubstitutionId(e.target.value)}
                                            className="premium-select-light w-full"
                                        >
                                            <option value="" className="bg-white text-slate-900">Seleccionar empleado...</option>
                                            {getSickEmployees().map(emp => (
                                                <option key={emp.id} value={emp.id} className="bg-white text-slate-900">{emp.name}</option>
                                            ))}
                                        </select>
                                        {getSickEmployees().length === 0 && (
                                            <p className="text-[10px] font-bold text-amber-600 mt-2 uppercase tracking-widest px-1">No hay empleados con baja médica activa.</p>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsReactivateModalOpen(false)}
                                        className="flex-1 px-4 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                    >
                                        Reactivar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* History Modal */}
            {
                isHistoryModalOpen && historyEmpId && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Historial de Empleado</h2>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-6 pr-2">
                                {(() => {
                                    const emp = employees.find(e => e.id === historyEmpId);
                                    if (!emp || !emp.history || emp.history.length === 0) {
                                        return <div className="text-slate-400 text-center py-12 flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                                                <AlertCircle size={24} className="text-slate-300" />
                                            </div>
                                            <p className="font-bold text-xs uppercase tracking-widest">Sin registros</p>
                                        </div>;
                                    }
                                    return [...emp.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry, idx) => (
                                        <div key={idx} className="relative pl-8 pb-8 border-l-2 border-slate-100 last:border-0 last:pb-0">
                                            <div className={clsx(
                                                "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-md",
                                                entry.type === 'hired' ? "bg-emerald-500" :
                                                    entry.type === 'terminated' ? "bg-red-500" : "bg-indigo-500"
                                            )}></div>
                                            <div className="bg-slate-50 border border-slate-100/50 rounded-2xl p-4 hover:border-indigo-500/30 transition-all">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                    {new Date(entry.date).toLocaleDateString()} • {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <p className="font-black text-slate-900 text-sm uppercase tracking-tight mb-2">
                                                    {entry.type === 'hired' ? 'Alta de Contrato' :
                                                        entry.type === 'terminated' ? 'Baja Laboral' : 'Reincorporación'}
                                                </p>
                                                {entry.reason && (
                                                    <div className="text-[11px] text-slate-600 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                                                        {entry.reason}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Full Store History Modal */}
            {
                isFullHistoryModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-5xl p-8 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Movimientos de Personal</h2>
                                    <p className="text-slate-500 text-sm font-medium">Registro histórico detallado de todas las altas y bajas en la tienda.</p>
                                </div>
                                <button onClick={() => setIsFullHistoryModalOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                                    <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar flex-1 bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden shadow-inner">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white/80 backdrop-blur-md sticky top-0 z-20">
                                        <tr>
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Fecha y Hora</th>
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Empleado</th>
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 text-center">Movimiento</th>
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Observaciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {getFullStoreHistory().length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-20 text-center">
                                                    <div className="flex flex-col items-center gap-4 text-slate-300">
                                                        <Activity size={40} className="opacity-20" />
                                                        <p className="font-bold text-sm uppercase tracking-widest">No hay registros históricos disponibles</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            getFullStoreHistory().map((entry, idx) => (
                                                <tr key={idx} className="group hover:bg-white transition-colors">
                                                    <td className="p-5 whitespace-nowrap">
                                                        <div className="text-xs font-bold text-slate-900">
                                                            {new Date(entry.date).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                                {entry.empName.charAt(0)}
                                                            </div>
                                                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{entry.empName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        <span className={clsx(
                                                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                            entry.type === 'hired' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                                entry.type === 'terminated' ? "bg-red-50 text-red-600 border border-red-100" :
                                                                    "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                                        )}>
                                                            {entry.type === 'hired' ? 'Alta' :
                                                                entry.type === 'terminated' ? 'Baja' : 'Reincorporación'}
                                                        </span>
                                                    </td>
                                                    <td className="p-5">
                                                        <p className="text-xs text-slate-600 font-medium line-clamp-2 max-w-xs">{entry.reason || '-'}</p>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default EmployeesPage;
