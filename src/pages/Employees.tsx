
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AddEmployeeModal from '../components/employees/AddEmployeeModal';
import EditEmployeeModal from '../components/employees/EditEmployeeModal';
import PermanentRequestsModal from '../components/employees/PermanentRequestsModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { parseLocalDate, formatLocalDate } from '../services/dateUtils';
import {
    Plus, Trash2, Pencil, CalendarClock, Plane,
    TrendingUp, Activity, AlertCircle, Clock, RotateCcw,
    Users, ShieldAlert, X, FileText
} from 'lucide-react';
import { DatePicker } from '../components/DatePicker';
import type { Employee, TimeOffType } from '../types';
import clsx from 'clsx';
import VacationModal from '../components/employees/VacationModal';
import TempHoursModal from '../components/employees/TempHoursModal';
import ILTReportModal from '../components/employees/ILTReportModal';
import { CustomSelect } from '../components/CustomSelect';

const EmployeesPage: React.FC = () => {
    const { user } = useAuth();
    const { employees, addEmployee, updateEmployee, deactivateEmployee, deleteEmployee, reactivateEmployee, permanentRequests, addPermanentRequest, removePermanentRequest, addTimeOff, removeTimeOff, timeOffRequests, schedules } = useStore();
    const { showToast } = useToast();
    const { removeTempHours } = useStore();

    if (!user) return null;

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    // Perm Request State
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);
    const [permEmpId, setPermEmpId] = useState<string | null>(null);
    const [isConfirmDeletePermOpen, setIsConfirmDeletePermOpen] = useState(false);
    const [reqToDelete, setReqToDelete] = useState<string | null>(null);

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




    // Reactivation / Deactivation State
    const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
    const [employeeToDeactivateId, setEmployeeToDeactivateId] = useState<string | null>(null);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [deactivationDate, setDeactivationDate] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    // Hard Delete State
    const [isConfirmHardDeleteOpen, setIsConfirmHardDeleteOpen] = useState(false);
    const [employeeToDeleteId, setEmployeeToDeleteId] = useState<string | null>(null);
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
    const [isILTModalOpen, setIsILTModalOpen] = useState(false);

    const getFullStoreHistory = () => {
        if (!user) return [];
        const storeEmployees = employees.filter(e => e.establishmentId === user.establishmentId);
        const historyEntries: { empId: string, empName: string, date: string, type: 'hired' | 'terminated' | 'rehired', reason?: string, contractEndDate?: string, contractStartDate?: string }[] = [];

        storeEmployees.forEach(emp => {
            if (emp.history) {
                emp.history.forEach(h => {
                    historyEntries.push({
                        empId: emp.id,
                        empName: emp.name,
                        date: h.date,
                        type: h.type as 'hired' | 'terminated' | 'rehired',
                        reason: h.reason,
                        contractEndDate: h.contractEndDate,
                        contractStartDate: h.contractStartDate
                    });
                });
            }
        });

        // Sort by date descending (newest first)
        return historyEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    // Form State
    // Edit State Trackers
    const [editingSickInfoId, setEditingSickInfoId] = useState<string | null>(null);
    const [editingTempHoursId, setEditingTempHoursId] = useState<{ empId: string, adjId: string } | null>(null);

    // Add Modal Extra State


    // Vacation Modal State
    const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
    const [vacEmpId, setVacEmpId] = useState<string>('');

    // Actually, I am deleting the block below.


    const [isTempHoursModalOpen, setIsTempHoursModalOpen] = useState(false);
    const [tempEmpId, setTempEmpId] = useState('');

    // Deletion State for Panel
    const [deletingTempId, setDeletingTempId] = useState<{ empId: string, adjId: string } | null>(null);
    const [isConfirmDeleteTempOpen, setIsConfirmDeleteTempOpen] = useState(false);

    if (!user) return null;

    const allStoreEmployees = employees.filter(e => e.establishmentId === user.establishmentId);

    const filteredEmployees = allStoreEmployees
        .filter(e => showInactive ? !e.active : e.active);

    // Stats Calculations
    const totalTeam = allStoreEmployees.filter(e => e.active).length;
    const inactiveTeam = allStoreEmployees.filter(e => !e.active).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const onVacationCount = timeOffRequests.filter(r => {
        if (r.type !== 'vacation') return false;
        if (!allStoreEmployees.some(e => e.id === r.employeeId)) return false;
        const start = new Date(r.startDate || r.dates[0] || '');
        const end = r.endDate ? new Date(r.endDate) : (r.dates[r.dates.length - 1] ? new Date(r.dates[r.dates.length - 1]) : null);
        return start <= today && (!end || end >= today);
    }).length;

    const onSickLeaveCount = timeOffRequests.filter(r => {
        if (r.type !== 'sick_leave' && r.type !== 'maternity_paternity') return false;
        if (!allStoreEmployees.some(e => e.id === r.employeeId)) return false;
        const start = new Date(r.startDate || r.dates[0] || '');
        const end = r.endDate ? new Date(r.endDate) : null;
        return start <= today && (!end || end >= today);
    }).length;





    const getAvatarGradient = (name: string) => {
        const gradients = [
            'from-indigo-500 to-purple-600',
            'from-blue-500 to-indigo-600',
            'from-emerald-500 to-teal-600',
            'from-orange-500 to-red-600',
            'from-pink-500 to-rose-600',
            'from-cyan-500 to-blue-600'
        ];
        const index = name.length % gradients.length;
        return gradients[index];
    };

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

    const handleAdd = async (employeeData: any) => {
        try {
            await addEmployee({
                ...employeeData,
                establishmentId: user.establishmentId,
            });

            showToast('Empleado añadido correctamente', 'success');
            setIsAddModalOpen(false);
        } catch (error: any) {
            console.error(error);
            showToast(`Error: ${error.message || 'Verifica tu conexión'}`, 'error');
        }
    };

    const handleDeactivateClick = (id: string) => {
        setEmployeeToDeactivateId(id);
        setDeactivationReason('');
        setDeactivationDate('');
        setIsDeactivateModalOpen(true);
    };

    const handleConfirmDeactivate = (e: React.FormEvent) => {
        e.preventDefault();

        if (!deactivationDate) {
            showToast('Por favor indica la fecha de fin de contrato', 'error');
            return;
        }

        if (employeeToDeactivateId && deactivationReason) {
            deactivateEmployee(employeeToDeactivateId, deactivationReason, deactivationDate);
            showToast('Empleado dado de baja correctamente', 'success');
            setIsDeactivateModalOpen(false);
            setEmployeeToDeactivateId(null);
            setDeactivationReason('');
            setDeactivationDate('');
        }
    };



    const handleViewHistory = (id: string) => {
        setHistoryEmpId(id);
        setIsHistoryModalOpen(true);
    };

    const openEdit = (emp: Employee) => {
        setEditingEmployee(emp);
        setIsEditModalOpen(true);
    };

    const handleEdit = async (id: string, data: any) => {
        try {
            await updateEmployee(id, data);
            showToast('Empleado modificado correctamente', 'success');
            setIsEditModalOpen(false);
            setEditingEmployee(null);
        } catch (error) {
            console.error(error);
            showToast('Error al modificar empleado', 'error');
        }
    };

    const openPermModal = (id: string) => {
        setPermEmpId(id);
        setIsPermModalOpen(true);
    }



    const isDateBlockedForSickLeave = (date: Date) => {
        if (!sickEmpId) return false;

        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        const checkTime = checkDate.getTime();

        return timeOffRequests.some(req => {
            if (editingSickInfoId && req.id === editingSickInfoId) return false;

            // Only check constraints for the same employee
            if (req.employeeId !== sickEmpId) return false;

            // Check against Sick Leaves and Maternity/Paternity (ignore vacations)
            if (req.type !== 'sick_leave' && req.type !== 'maternity_paternity') return false;

            if (req.startDate && req.endDate) {
                const start = parseLocalDate(req.startDate);
                start.setHours(0, 0, 0, 0);
                const end = parseLocalDate(req.endDate);
                end.setHours(0, 0, 0, 0);
                return checkTime >= start.getTime() && checkTime <= end.getTime();
            } else if (req.dates && req.dates.length > 0) {
                return req.dates.some(d => {
                    const tDate = parseLocalDate(d);
                    tDate.setHours(0, 0, 0, 0);
                    return tDate.getTime() === checkTime;
                });
            }
            return false;
        });
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








    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-8">
            <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">

                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Equipo</h1>
                        <p className="text-slate-500 font-medium">Gestión estratégica de personal en {user.establishmentName}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Secondary Tools Menu */}
                        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                            <button
                                onClick={() => setIsFullHistoryModalOpen(true)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center gap-2"
                                title="Historial"
                            >
                                <Clock size={16} /> <span className="hidden sm:inline">Historial</span>
                            </button>

                            <button
                                onClick={() => setIsSickHistoryOpen(true)}
                                className={clsx(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border-l border-slate-100",
                                    isSickHistoryOpen ? "bg-red-50 text-red-600" : "text-slate-600 hover:bg-slate-50 hover:text-red-600"
                                )}
                            >
                                <Activity size={16} /> <span className="hidden sm:inline">Bajas</span>
                            </button>

                            <div className="w-px h-6 bg-slate-200 mx-2"></div>

                            <button
                                onClick={() => setIsILTModalOpen(true)}
                                className={clsx(
                                    "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                                    (new Date().getDate() >= 20 && new Date().getDate() <= 30)
                                        ? "bg-indigo-50 text-indigo-600 animate-pulse hover:animate-none hover:bg-indigo-100"
                                        : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                                )}
                                title="Informe ILT"
                            >
                                <FileText size={18} /> <span className="hidden sm:inline">Informe ILT</span>
                            </button>
                        </div>


                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                        >
                            <Plus size={20} /> <span className="hidden sm:inline">Nuevo Empleado</span>
                        </button>
                    </div>
                </div>



                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Equipo', value: totalTeam, icon: Users, color: 'indigo' },
                        { label: 'En Vacaciones', value: onVacationCount, icon: Plane, color: 'emerald' },
                        { label: 'Bajas Activas', value: onSickLeaveCount, icon: Activity, color: 'red' },
                        { label: 'Inactivos', value: inactiveTeam, icon: ShieldAlert, color: 'amber' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                                <p className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                            </div>
                            <div className={`w-14 h-14 rounded-2xl bg-${stat.color}-50 flex items-center justify-center text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                                <stat.icon size={28} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters & Actions Bar */}
                {/* Filters & Actions Bar */}
                {/* Filters & Actions Bar */}
                <div className="bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-sm mb-6">
                    <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
                        {/* Left Side Spacer (to help center properly if needed, or just justify-between) */}
                        <div className="hidden xl:block flex-1"></div>

                        {/* Quick Actions Buttons - Centered */}
                        <div className="flex flex-wrap items-center justify-center gap-3 w-full xl:w-auto">
                            <button onClick={() => setIsTempHoursModalOpen(true)} className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-orange-50 text-orange-600 font-black text-xs uppercase tracking-wider hover:bg-orange-500 hover:text-white transition-all hover:shadow-lg hover:shadow-orange-200">
                                <TrendingUp size={18} className="group-hover:scale-110 transition-transform" />
                                <span>Ampliaciones</span>
                            </button>

                            <button onClick={() => setIsPermModalOpen(true)} className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-purple-50 text-purple-600 font-black text-xs uppercase tracking-wider hover:bg-purple-500 hover:text-white transition-all hover:shadow-lg hover:shadow-purple-200">
                                <CalendarClock size={18} className="group-hover:scale-110 transition-transform" />
                                <span>Peticiones</span>
                            </button>

                            <button onClick={() => setIsVacationModalOpen(true)} className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-xs uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all hover:shadow-lg hover:shadow-emerald-200">
                                <Plane size={18} className="group-hover:scale-110 transition-transform" />
                                <span>Vacaciones</span>
                            </button>

                            <button onClick={() => setIsSickModalOpen(true)} className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-50 text-red-600 font-black text-xs uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all hover:shadow-lg hover:shadow-red-200">
                                <Activity size={18} className="group-hover:scale-110 transition-transform" />
                                <span>Registrar Baja</span>
                            </button>



                            <div className="w-px h-8 bg-slate-200 mx-2 hidden xl:block"></div>

                            {/* Inactive Toggle Button */}
                            <button
                                onClick={() => setShowInactive(!showInactive)}
                                className={clsx(
                                    "group flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all hover:shadow-lg",
                                    showInactive
                                        ? "bg-slate-800 text-white shadow-slate-200"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                )}
                            >
                                <Users size={18} className={clsx("transition-transform", showInactive ? "" : "group-hover:scale-110")} />
                                <span>{showInactive ? 'Ocultar Inactivos' : 'Ver Inactivos'}</span>
                            </button>
                        </div>

                        {/* Right Side Info */}
                        <div className="flex items-center justify-end flex-1 w-full xl:w-auto text-center xl:text-right mt-4 xl:mt-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                {filteredEmployees.length} {showInactive ? 'Inactivos' : 'Activos'}
                            </p>
                        </div>
                    </div>
                </div>


            </div>

            {/* ACTIVE OVERVIEW PANELS */}
            {/* ACTIVE OVERVIEW PANELS */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                {/* Active Permanent Requests Panel */}
                <div className="bg-white rounded-3xl p-5 border border-purple-100 shadow-sm flex flex-col h-full">
                    <h3 className="text-xs font-black text-purple-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <CalendarClock size={16} className="text-purple-500" /> Peticiones Activas
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-48">
                        {(() => {
                            const activePerms = permanentRequests.filter(r => {
                                const emp = employees.find(e => e.id === r.employeeId);
                                return emp && emp.active && emp.establishmentId === user.establishmentId;
                            });

                            if (activePerms.length === 0) return <div className="h-full flex items-center justify-center"><p className="text-xs text-slate-400 italic">No hay peticiones activas</p></div>;

                            return activePerms.map(req => {
                                const emp = employees.find(e => e.id === req.employeeId);
                                return (
                                    <div key={req.id} className="group flex items-center justify-between p-2.5 bg-purple-50/50 hover:bg-purple-50 rounded-2xl border border-purple-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-sm", getAvatarGradient(emp?.name || ''))}>
                                                {emp?.initials || emp?.name[0]}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-800 line-clamp-1">{emp?.name}</p>
                                                <p className="text-[10px] text-purple-600 font-medium leading-tight">
                                                    {req.type === 'morning_only' ? 'Solo Mañanas' :
                                                        req.type === 'afternoon_only' ? 'Solo Tardes' :
                                                            req.type === 'specific_days_off' ? 'Días Fijos' :
                                                                req.type === 'rotating_days_off' ? 'Días Rotativos (Ciclos)' :
                                                                    req.type === 'fixed_rotating_shift' ? 'Turno Rotativo Fijo' :
                                                                        req.type === 'max_afternoons_per_week' ? `Máx. Tardes: ${req.value || 0}` :
                                                                            req.type === 'no_split' ? 'No Turno Partido' :
                                                                                req.type === 'force_full_days' ? 'Solo Jornadas Completas' :
                                                                                    req.type === 'custom_days_off' ? 'Libranza Personalizada' :
                                                                                        'Otras Restricciones'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setPermEmpId(req.employeeId); setIsPermModalOpen(true); }} className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"><Pencil size={12} /></button>
                                            <button onClick={() => { /* setReqToDelete(req.id); setIsConfirmDeletePermOpen(true); */ removePermanentRequest(req.id); showToast('Petición eliminada', 'success'); }} className="p-1.5 text-purple-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Active Sick Leaves Panel */}
                <div className="bg-white rounded-3xl p-5 border border-red-100 shadow-sm flex flex-col h-full">
                    <h3 className="text-xs font-black text-red-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity size={16} className="text-red-500" /> Bajas Activas
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-48">
                        {(() => {
                            const activeSick = timeOffRequests.filter(r => {
                                const emp = employees.find(e => e.id === r.employeeId);
                                return (r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                                    (!r.endDate || new Date(r.endDate) >= new Date()) &&
                                    emp && emp.establishmentId === user.establishmentId;
                            });

                            if (activeSick.length === 0) return <div className="h-full flex items-center justify-center"><p className="text-xs text-slate-400 italic">No hay bajas activas</p></div>;

                            return activeSick.map(req => {
                                const emp = employees.find(e => e.id === req.employeeId);
                                return (
                                    <div key={req.id} className="group flex items-center justify-between p-2.5 bg-red-50/50 hover:bg-red-50 rounded-2xl border border-red-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-sm", getAvatarGradient(emp?.name || ''))}>
                                                {emp?.initials || emp?.name[0]}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-800 line-clamp-1">{emp?.name}</p>
                                                <p className="text-[10px] text-red-600 font-medium leading-tight">
                                                    Hasta {req.endDate ? formatLocalDate(parseLocalDate(req.endDate)) : 'Indefinido'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingSickInfoId(req.id); setIsSickModalOpen(true); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"><Pencil size={12} /></button>
                                            <button onClick={() => {
                                                setDeletingSickLeaveId(req.id);
                                                setIsConfirmDeleteSickOpen(true);
                                            }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Active Temp Hours (Ampliaciones) Panel */}
                <div className="bg-white rounded-3xl p-5 border border-orange-100 shadow-sm flex flex-col h-full">
                    <h3 className="text-xs font-black text-orange-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-orange-500" /> Ampliaciones Activas
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-48">
                        {(() => {
                            const now = new Date();
                            const activeTemp = employees
                                .filter(e => e.establishmentId === user.establishmentId && e.active)
                                .flatMap(e => (e.tempHours || []).map(th => ({ ...th, emp: e })))
                                .filter(item => {
                                    const start = new Date(item.start);
                                    const end = new Date(item.end);
                                    return now >= start && now <= end;
                                });

                            if (activeTemp.length === 0) return <div className="h-full flex items-center justify-center"><p className="text-xs text-slate-400 italic">No hay ampliaciones activas</p></div>;

                            return activeTemp.map(item => (
                                <div key={item.id} className="group flex items-center justify-between p-2.5 bg-orange-50/50 hover:bg-orange-50 rounded-2xl border border-orange-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-sm", getAvatarGradient(item.emp.name))}>
                                            {item.emp.initials || item.emp.name[0]}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 line-clamp-1">{item.emp.name}</p>
                                            <p className="text-[10px] text-orange-600 font-medium leading-tight">
                                                +{item.hours}h ({formatLocalDate(parseLocalDate(item.end || now.toISOString()))})
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingTempHoursId({ empId: item.emp.id, adjId: item.id }); setIsTempHoursModalOpen(true); }} className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"><Pencil size={12} /></button>
                                        <button onClick={() => {
                                            setDeletingTempId({ empId: item.emp.id, adjId: item.id });
                                            setIsConfirmDeleteTempOpen(true);
                                        }} className="p-1.5 text-orange-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>



                {/* Active Vacations Panel (This Week) */}
                <div className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-sm flex flex-col h-full">
                    <h3 className="text-xs font-black text-emerald-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Plane size={16} className="text-emerald-500" /> En Vacaciones (Esta Semana)
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-48">
                        {(() => {
                            const todayFn = new Date();
                            const firstDay = new Date(todayFn.setDate(todayFn.getDate() - todayFn.getDay() + 1)); // Monday
                            const lastDay = new Date(todayFn.setDate(todayFn.getDate() + 6)); // Sunday
                            const firstDayStr = firstDay.toISOString().split('T')[0];
                            const lastDayStr = lastDay.toISOString().split('T')[0];

                            const activeVacs = timeOffRequests.filter(r => {
                                if (r.type !== 'vacation') return false;
                                const emp = employees.find(e => e.id === r.employeeId);
                                if (!emp || emp.establishmentId !== user.establishmentId) return false;

                                // Check overlap with current week
                                return r.dates.some(d => d >= firstDayStr && d <= lastDayStr);
                            });

                            if (activeVacs.length === 0) return <div className="h-full flex items-center justify-center"><p className="text-xs text-slate-400 italic">Nadie de vacaciones esta semana</p></div>;

                            return activeVacs.map(req => {
                                const emp = employees.find(e => e.id === req.employeeId);
                                // Find which dates fall in this week
                                const weekDates = req.dates.filter(d => d >= firstDayStr && d <= lastDayStr).sort();
                                const rangeStr = weekDates.length > 1
                                    ? `${formatLocalDate(parseLocalDate(weekDates[0]))} - ${formatLocalDate(parseLocalDate(weekDates[weekDates.length - 1]))}`
                                    : formatLocalDate(parseLocalDate(weekDates[0]));

                                return (
                                    <div key={req.id} className="group flex items-center justify-between p-2.5 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl border border-emerald-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-sm", getAvatarGradient(emp?.name || ''))}>
                                                {emp?.initials || emp?.name[0]}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-800 line-clamp-1">{emp?.name}</p>
                                                <p className="text-[10px] text-emerald-600 font-medium leading-tight">
                                                    {rangeStr}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => {
                                                if (confirm('¿Cancelar este periodo de vacaciones?')) removeTimeOff(req.id);
                                            }} className="p-1.5 text-emerald-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>

            {/* Grid Header Info */}


            {/* Employees Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {filteredEmployees.map(emp => {
                    const currentYear = new Date().getFullYear();
                    const vacationDays = timeOffRequests
                        .filter(r => r.employeeId === emp.id && r.type === 'vacation')
                        .flatMap(r => r.dates)
                        .filter(d => new Date(d).getFullYear() === currentYear)
                        .length;

                    // Calculate Active Temp Hours
                    const now = new Date();
                    const activeTempHours = (emp.tempHours || [])
                        .filter(th => {
                            const start = new Date(th.start);
                            const end = new Date(th.end);
                            return now >= start && now <= end;
                        })
                        .reduce((acc, curr) => acc + curr.hours, 0);

                    // Status Logic
                    const todayStr = new Date().toISOString().split('T')[0];


                    let status: 'working' | 'off' | 'vacation' | 'sick' | 'free' = 'free';

                    // Check Time Off (Highest Priority)
                    const activeSick = timeOffRequests.find(r =>
                        r.employeeId === emp.id &&
                        (r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                        (!r.endDate || new Date(r.endDate) >= now) &&
                        (r.startDate ? new Date(r.startDate) <= now : true)
                    );

                    if (activeSick) status = 'sick';
                    else {
                        const activeVacation = timeOffRequests.find(r =>
                            r.employeeId === emp.id &&
                            r.type === 'vacation' &&
                            r.dates.includes(todayStr)
                        );
                        if (activeVacation) status = 'vacation';
                        else {
                            // Check Schedule
                            // Note: We need schedules from store. Assuming we have 'schedules' from context.
                            // But EmployeesPage doesn't import 'schedules'. Let's adding it.
                            // For now, defaulting to 'free' if no schedule data, or I need to import schedules context. 
                        }
                    }



                    // Schedule Logic for Status
                    if (status === 'free') {
                        // Find current week schedule
                        const currentWeekStart = (() => {
                            const d = new Date();
                            const day = d.getDay();
                            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                            const monday = new Date(d.setDate(diff));
                            return monday.toISOString().split('T')[0];
                        })();

                        const currentSchedule = schedules.find(s => s.weekStartDate === currentWeekStart && s.establishmentId === user.establishmentId);
                        if (currentSchedule) {
                            const todayShift = currentSchedule.shifts.find(s => s.employeeId === emp.id && s.date === todayStr);

                            if (todayShift) {
                                if (todayShift.type === 'off' || todayShift.type === 'holiday') {
                                    status = 'off';
                                } else {
                                    // Check if currently within hours
                                    const currentHour = now.getHours() + now.getMinutes() / 60;
                                    const parseTime = (t?: string) => t ? parseInt(t.split(':')[0]) + parseInt(t.split(':')[1]) / 60 : 0;

                                    let isWorkingNow = false;
                                    if (todayShift.type === 'split') {
                                        const ms = parseTime(todayShift.startTime) || 10;
                                        const me = parseTime(todayShift.morningEndTime) || 14;
                                        const as = parseTime(todayShift.afternoonStartTime) || 17;
                                        const ae = parseTime(todayShift.endTime) || 21;
                                        if ((currentHour >= ms && currentHour < me) || (currentHour >= as && currentHour < ae)) isWorkingNow = true;
                                    } else {
                                        const s = parseTime(todayShift.startTime) || 10;
                                        const e = parseTime(todayShift.endTime) || 14;
                                        if (currentHour >= s && currentHour < e) isWorkingNow = true;
                                    }

                                    status = isWorkingNow ? 'working' : 'free';
                                }
                            }
                        }
                    }

                    return (
                        <div key={emp.id} className={clsx(
                            "group bg-white rounded-[2.5rem] border border-slate-200 transition-all duration-500 overflow-hidden flex flex-col hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-100",
                            !emp.active && "grayscale opacity-80"
                        )}>
                            <div className="p-6 space-y-6">
                                {/* Card Top */}
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className="relative">
                                            <div className={clsx(
                                                "w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black bg-gradient-to-br shadow-xl shadow-slate-200 transition-transform group-hover:scale-105",
                                                getAvatarGradient(emp.name)
                                            )}>
                                                {emp.initials || emp.name.charAt(0)}
                                            </div>
                                            {/* Status Indicator Badge */}
                                            <div className={clsx(
                                                "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm",
                                                status === 'working' ? "bg-emerald-500" :
                                                    status === 'sick' ? "bg-red-500" :
                                                        status === 'vacation' ? "bg-cyan-500" :
                                                            status === 'off' ? "bg-slate-400" : "bg-indigo-400"
                                            )} title={
                                                status === 'working' ? "Trabajando Ahora" :
                                                    status === 'sick' ? "De Baja" :
                                                        status === 'vacation' ? "De Vacaciones" :
                                                            status === 'off' ? "Día Libre / Fuera de Turno" : "Disponible"
                                            }>
                                                {status === 'working' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg leading-tight line-clamp-1">{emp.name}</h3>

                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-slate-100">
                                                    {emp.category}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                                        <button onClick={() => handleViewHistory(emp.id)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><Clock size={16} /></button>
                                        <button onClick={() => openEdit(emp)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><Pencil size={16} /></button>
                                    </div>
                                </div>

                                {/* Contract info */}
                                <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-xl shadow-sm"><Clock size={16} className="text-slate-400" /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jornada</p>
                                            <p className="text-sm font-black text-slate-800">
                                                {emp.weeklyHours}h {activeTempHours > 0 && <span className="text-orange-500">+{activeTempHours}h</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{emp.contractEndDate ? 'Fin Contrato' : 'Tipo'}</p>
                                        <p className="text-sm font-black text-slate-800">
                                            {emp.contractEndDate ? new Date(emp.contractEndDate).toLocaleDateString() : 'Indefinido'}
                                        </p>
                                    </div>
                                </div>

                                {/* Vacation Progress */}
                                <div className="space-y-2 px-1">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vacaciones Usadas</span>
                                        <span className="text-xs font-black text-slate-800">{vacationDays} / 31</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={clsx(
                                                "h-full rounded-full transition-all duration-1000",
                                                vacationDays > 25 ? "bg-red-400" : vacationDays > 15 ? "bg-amber-400" : "bg-emerald-400"
                                            )}
                                            style={{ width: `${Math.min(100, (vacationDays / 31) * 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Quick Status Icons */}
                            </div>
                            {/* Quick Actions Bar */}
                            <div className="grid grid-cols-3 gap-2 w-full pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => { if (emp.active) { setTempEmpId(emp.id); setIsTempHoursModalOpen(true); } }}
                                    className={clsx(
                                        "flex flex-col items-center justify-center p-2 rounded-2xl transition-all gap-1 group/btn",
                                        emp.active ? "hover:bg-orange-50 text-slate-400 hover:text-orange-600" : "opacity-30 cursor-not-allowed"
                                    )}
                                    title="Ampliar Horas"
                                    disabled={!emp.active}
                                >
                                    <TrendingUp size={18} className="group-hover/btn:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-tight">Ampliar</span>
                                </button>
                                <button
                                    onClick={() => { if (emp.active) { setSickEmpId(emp.id); setIsSickModalOpen(true); } }}
                                    className={clsx(
                                        "flex flex-col items-center justify-center p-2 rounded-2xl transition-all gap-1 group/btn",
                                        emp.active ? "hover:bg-red-50 text-slate-400 hover:text-red-600" : "opacity-30 cursor-not-allowed"
                                    )}
                                    title="Registrar Baja"
                                    disabled={!emp.active}
                                >
                                    <Activity size={18} className="group-hover/btn:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-tight">Baja</span>
                                </button>
                                <button
                                    onClick={() => { if (emp.active) openPermModal(emp.id); }}
                                    className={clsx(
                                        "flex flex-col items-center justify-center p-2 rounded-2xl transition-all gap-1 group/btn",
                                        emp.active ? "hover:bg-purple-50 text-slate-400 hover:text-purple-600" : "opacity-30 cursor-not-allowed"
                                    )}
                                    title="Restricciones"
                                    disabled={!emp.active}
                                >
                                    <CalendarClock size={18} className="group-hover/btn:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-tight">Restric.</span>
                                </button>
                            </div>
                            {/* Footer Actions */}
                            <div className="mt-auto border-t border-slate-50 bg-slate-50/30 p-4 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setVacEmpId(emp.id); setIsVacationModalOpen(true); }}
                                    className="col-span-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-slate-600 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plane size={14} /> Vacaciones
                                </button>
                                {!emp.active && (
                                    <>
                                        <button
                                            onClick={() => handleReactivateClick(emp.id)}
                                            className="col-span-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                                            title="Reactivar Empleado"
                                        >
                                            <RotateCcw size={14} /> Reactivar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEmployeeToDeleteId(emp.id);
                                                setIsConfirmHardDeleteOpen(true);
                                            }}
                                            className="col-span-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2"
                                            title="Eliminar Definitivamente"
                                        >
                                            <Trash2 size={14} /> Eliminar
                                        </button>
                                    </>
                                )}
                                {emp.active && (
                                    <button
                                        onClick={() => handleDeactivateClick(emp.id)}
                                        className="col-span-2 py-2 rounded-xl text-[9px] font-bold uppercase text-slate-400 hover:text-red-400 transition-colors"
                                    >
                                        Baja Definitiva
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}


            </div>
            {/* Add Modal */}
            <AddEmployeeModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAdd}
                sickEmployees={getSickEmployees()}
            />

            {/* Edit Modal */}
            <EditEmployeeModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingEmployee(null);
                }}
                employee={editingEmployee}
                onEdit={handleEdit}
            />


            <PermanentRequestsModal
                isOpen={isPermModalOpen}
                onClose={() => setIsPermModalOpen(false)}
                employees={allStoreEmployees}
                requests={permanentRequests}
                onAdd={async (req) => {
                    await addPermanentRequest(req);
                    showToast('Petición añadida correctamente', 'success');
                }}
                onRemove={(id) => {
                    removePermanentRequest(id);
                    showToast('Petición eliminada', 'success');
                }}
                initialEmployeeId={permEmpId}
            />
            {/* Vacation Planning Modal */}
            <VacationModal
                isOpen={isVacationModalOpen}
                onClose={() => setIsVacationModalOpen(false)}
                selectedEmployeeId={vacEmpId}
                onEmployeeSelect={setVacEmpId}
            />



            <TempHoursModal
                isOpen={isTempHoursModalOpen}
                onClose={() => {
                    setIsTempHoursModalOpen(false);
                    setEditingTempHoursId(null);
                    setTempEmpId('');
                }}
                preSelectedEmployeeId={tempEmpId}
                editData={editingTempHoursId}
            />

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
                                    <CustomSelect
                                        options={employees.filter(e => e.establishmentId === user.establishmentId).map(e => ({ value: e.id, label: e.name }))}
                                        value={sickEmpId || ''}
                                        onChange={(val) => setSickEmpId(val as string)}
                                        placeholder="-- Seleccionar Empleado --"
                                        icon={Users}
                                    />
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
                                        isDateDisabled={isDateBlockedForSickLeave}
                                    />
                                    <DatePicker variant="light"
                                        label="Fecha Fin (Estimada)"
                                        value={sickEndDate}
                                        onChange={setSickEndDate}
                                        required
                                        isDateDisabled={isDateBlockedForSickLeave}
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
            <ConfirmDialog
                isOpen={isConfirmHardDeleteOpen}
                title="¿Eliminar Empleado Definitivamente?"
                message="Esta acción borrará permanentemente al empleado y todo su historial, solicitudes y registros. NO se puede deshacer. ¿Estás seguro?"
                confirmText="Sí, Eliminar Todo"
                cancelText="Cancelar"
                isDestructive={true}
                onConfirm={async () => {
                    if (employeeToDeleteId) {
                        try {
                            await deleteEmployee(employeeToDeleteId);
                            showToast('Empleado eliminado definitivamente', 'success');
                        } catch (error) {
                            showToast('Error al eliminar empleado', 'error');
                        }
                        setIsConfirmHardDeleteOpen(false);
                        setEmployeeToDeleteId(null);
                    }
                }}
                onCancel={() => {
                    setIsConfirmHardDeleteOpen(false);
                    setEmployeeToDeleteId(null);
                }}
            />

            {
                isDeactivateModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Dar de Baja</h2>
                            <p className="text-slate-500 text-sm mb-8 font-medium">Indica el motivo de la baja para el historial del empleado.</p>
                            <form onSubmit={handleConfirmDeactivate} className="space-y-6">
                                <div>
                                    <label className="premium-label-light">Fecha de Fin de Contrato</label>
                                    <DatePicker
                                        required
                                        value={deactivationDate}
                                        onChange={setDeactivationDate}
                                        variant="light"
                                    />
                                    <p className="text-xs text-slate-400 mt-1 pl-1">Esta fecha figurará como el fin oficial del contrato.</p>
                                </div>
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
                                                    <div className="text-[11px] text-slate-600 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-100 mb-2">
                                                        {entry.reason}
                                                    </div>
                                                )}
                                                {entry.contractEndDate && (
                                                    <div className="flex items-center gap-2 mt-2 bg-slate-100/50 p-2 rounded-lg border border-slate-100">
                                                        <CalendarClock size={14} className="text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                            Fin Contrato: <span className="text-slate-700">{new Date(entry.contractEndDate).toLocaleDateString()}</span>
                                                        </span>
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
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 border-r border-slate-100">Contrato</th>
                                            <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Observaciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {getFullStoreHistory().length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-20 text-center">
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
                                                    <td className="p-5 border-r border-slate-50">
                                                        <div className="flex flex-col gap-1 items-center">
                                                            {entry.contractStartDate && (
                                                                <div className="text-[10px] text-slate-500 font-medium">
                                                                    <span className="font-bold text-slate-400 uppercase tracking-wider mr-1">Inicio:</span>
                                                                    <span className="text-slate-700 font-bold">{new Date(entry.contractStartDate).toLocaleDateString()}</span>
                                                                </div>
                                                            )}
                                                            {entry.contractEndDate ? (
                                                                <div className="text-[10px] text-slate-500 font-medium">
                                                                    <span className="font-bold text-slate-400 uppercase tracking-wider mr-1">Fin:</span>
                                                                    <span className="text-slate-700 font-bold">{new Date(entry.contractEndDate).toLocaleDateString()}</span>
                                                                </div>
                                                            ) : (
                                                                !entry.contractStartDate && <div className="text-center text-slate-300 text-[10px] font-bold">-</div>
                                                            )}
                                                        </div>
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
            {/* Other Modals as needed */}
            <ILTReportModal
                isOpen={isILTModalOpen}
                onClose={() => setIsILTModalOpen(false)}
            />
        </div>
    );
};

export default EmployeesPage;
