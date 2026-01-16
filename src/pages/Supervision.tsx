import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import {
    CheckCircle, XCircle, AlertCircle, Clock, Store,
    Calendar, ShieldAlert,
    FileText, ChevronRight
} from 'lucide-react';
import type { WeeklySchedule } from '../types';
import clsx from 'clsx';
import { validateFullSchedule } from '../services/scheduler';
import { FilterSelect } from '../components/FilterSelect';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';

const SupervisionPage: React.FC = () => {
    const { schedules, employees, updateScheduleStatus, settings, permanentRequests, respondToModificationRequest, timeOffRequests } = useStore();

    // UI State
    const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

    // Filters for History
    const [filterStore, setFilterStore] = useState('');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState('');

    // Reset month when year changes
    useEffect(() => {
        setFilterMonth('');
    }, [filterYear]);

    // Reject Modal State
    const [rejectNotes, setRejectNotes] = useState('');
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectType, setRejectType] = useState<'schedule' | 'modification'>('schedule');

    // Validation State
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [validationResults, setValidationResults] = useState<{
        strictWarnings: string[];
        coverageWarnings: string[];
        debtAdjustments: { empId: string, name: string, amount: number, worked: number, contract: number }[];
    }>({ strictWarnings: [], coverageWarnings: [], debtAdjustments: [] });

    // Data Derivation
    const pendingSchedules = schedules.filter(s => s.approvalStatus === 'pending');
    const modificationRequests = schedules.filter(s => s.modificationStatus === 'requested');
    const approvedSchedules = schedules.filter(s => s.approvalStatus === 'approved' || s.status === 'published'); // Published implies approved usually in this context

    // Filter Options
    const storeOptions = useMemo(() => {
        const uniqueStores = Array.from(new Set(schedules.map(r => r.establishmentId)));
        return uniqueStores.map(id => ({
            value: id,
            label: settings.find(s => s.establishmentId === id)?.storeName || DEFAULT_STORE_NAMES[id] || `Tienda ${id}`
        }));
    }, [schedules, settings]);

    const yearOptions = useMemo(() => {
        const years = new Set<string>();
        schedules.forEach(r => {
            const y = new Date(r.weekStartDate).getFullYear().toString();
            years.add(y);
        });
        // Ensure current year is always an option
        years.add(new Date().getFullYear().toString());

        return Array.from(years).sort().reverse().map(y => ({
            value: y,
            label: y
        }));
    }, [schedules]);

    const monthOptions = useMemo(() => {
        const months = new Set<string>();
        schedules.forEach(r => {
            const d = new Date(r.weekStartDate);
            // Filter by selected year if active
            if (filterYear && d.getFullYear().toString() !== filterYear) return;

            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.add(key);
        });
        return Array.from(months).sort().reverse().map(m => {
            const [y, mo] = m.split('-');
            const date = new Date(parseInt(y), parseInt(mo) - 1, 1);
            return {
                value: m,
                label: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                    .replace(/^\w/, c => c.toUpperCase())
            };
        });
    }, [schedules, filterYear]);

    // Filtered History
    const filteredHistory = approvedSchedules.filter(s => {
        if (filterStore && s.establishmentId !== filterStore) return false;

        const d = new Date(s.weekStartDate);
        if (filterYear && d.getFullYear().toString() !== filterYear) return false;

        if (filterMonth) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (key !== filterMonth) return false;
        }
        return true;
    });

    const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);

    // Helper functions
    const getStoreName = (id: string) => {
        const store = settings.find(s => s.establishmentId === id);
        if (store && store.storeName) return store.storeName;
        return DEFAULT_STORE_NAMES[id] || `Tienda ${id}`;
    };

    const handleRejectClick = (type: 'schedule' | 'modification') => {
        if (!selectedScheduleId) return;
        setRejectType(type);
        setRejectNotes('');
        setIsRejectModalOpen(true);
    };

    const confirmReject = () => {
        if (selectedScheduleId) {
            if (rejectType === 'schedule') {
                updateScheduleStatus(selectedScheduleId, 'rejected', rejectNotes);
            } else {
                respondToModificationRequest(selectedScheduleId, 'rejected', rejectNotes);
            }
            setIsRejectModalOpen(false);
            setSelectedScheduleId(null);
        }
    };

    const { showToast } = useToast();

    const handleApprove = async () => {
        // DEBUG: Force alert to see if click works
        // alert("Botón clickado. Iniciando aprobación...");

        if (!selectedSchedule) {
            // alert("Error: No hay horario seleccionado");
            return;
        }
        try {
            console.log("Approving schedule:", selectedSchedule.id);
            await updateScheduleStatus(selectedSchedule.id, 'approved');
            // alert("Proceso de aprobación finalizado (éxito)"); // Debug
            showToast('Horario aprobado y publicado correctamente', 'success');
        } catch (error) {
            console.error(error);
            showToast('Error al aprobar el horario', 'error');
        }
    };

    const handleUnlockApprove = async () => {
        if (!selectedSchedule) return;
        try {
            await respondToModificationRequest(selectedSchedule.id, 'approved');
            showToast('Desbloqueo aprobado correctamente', 'success');
        } catch (error) {
            console.error(error);
            showToast('Error al aprobar desbloqueo', 'error');
        }
    };

    // Calculate hours logic (reused)
    const getShiftHours = (shift: any, storeSettings: any) => {
        if (!shift || ['off', 'vacation', 'sick_leave', 'holiday'].includes(shift.type)) return { morning: 0, afternoon: 0, total: 0 };
        const parseTime = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h + m / 60;
        };
        if (shift.type === 'split') {
            const mStart = parseTime(shift.startTime || storeSettings.openingHours.morningStart);
            const mEnd = parseTime(shift.morningEndTime || storeSettings.openingHours.morningEnd);
            const aStart = parseTime(shift.afternoonStartTime || storeSettings.openingHours.afternoonStart);
            const aEnd = parseTime(shift.endTime || storeSettings.openingHours.afternoonEnd);
            return { morning: mEnd - mStart, afternoon: aEnd - aStart, total: (mEnd - mStart) + (aEnd - aStart) };
        } else if (shift.type === 'morning') {
            const start = parseTime(shift.startTime || storeSettings.openingHours.morningStart);
            const end = parseTime(shift.endTime || storeSettings.openingHours.morningEnd);
            return { morning: end - start, afternoon: 0, total: end - start };
        } else {
            const start = parseTime(shift.startTime || storeSettings.openingHours.afternoonStart);
            const end = parseTime(shift.endTime || storeSettings.openingHours.afternoonEnd);
            return { morning: 0, afternoon: end - start, total: end - start };
        }
    };

    // Derived State for Stats
    const stats = useMemo(() => {
        if (!selectedSchedule) return null;
        const storeEmployees = employees.filter(e => e.establishmentId === selectedSchedule.establishmentId && e.active);
        const currentStoreSettings = settings.find(s => s.establishmentId === selectedSchedule.establishmentId);

        const daily = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(selectedSchedule.weekStartDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            return storeEmployees.reduce((acc, emp) => {
                const shift = selectedSchedule.shifts.find(s => s.employeeId === emp.id && s.date === dateStr);
                const h = getShiftHours(shift, currentStoreSettings);
                return {
                    morning: acc.morning + h.morning,
                    afternoon: acc.afternoon + h.afternoon,
                    total: acc.total + h.total,
                    date: d
                };
            }, { morning: 0, afternoon: 0, total: 0, date: d });
        });

        const weeklyTotal = daily.reduce((acc, d) => acc + d.total, 0);
        const totalContracted = storeEmployees.reduce((acc, emp) => acc + emp.weeklyHours, 0);
        const coveragePercent = totalContracted > 0 ? (weeklyTotal / totalContracted) * 100 : 0;

        return { daily, weeklyTotal, totalContracted, coveragePercent };
    }, [selectedSchedule, employees, settings]);



    const handleValidate = (schedule: WeeklySchedule) => {
        const storeSettings = settings.find(s => s.establishmentId === schedule.establishmentId);
        if (!storeSettings) return;

        const results = validateFullSchedule(
            schedule,
            employees, // Pass full list, function filters by store
            storeSettings,
            timeOffRequests,
            permanentRequests,
            'publish' // Supervisor always validates as if publishing/final check
        );

        setValidationResults({
            strictWarnings: results.strictWarnings,
            coverageWarnings: [], // Already included in strictWarnings by validateFullSchedule if customized
            debtAdjustments: results.debtAdjustments
        });
        setIsValidationModalOpen(true);
    };

    return (
        <div className="px-4 py-8 pb-24 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full relative z-10">

                {/* Header - Command Center Style */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-8 print:hidden">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 opacity-70">Hola, Supervisor 👋</p>
                        <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                            <ShieldAlert size={18} /> Schedule Command Center
                        </h2>
                        <h1 className="text-6xl font-black text-white tracking-tight leading-tight whitespace-nowrap">
                            Gestión de <span className="text-slate-500 italic font-medium">Horarios</span>
                        </h1>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Sidebar Left */}
                    <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-8 print:hidden">
                        {/* SECTION: PENDIENTES */}
                        <div className="bg-slate-900/40 border border-slate-800/50 rounded-[3rem] p-6 backdrop-blur-sm">
                            <h2 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileText size={16} /> Pendientes de Validar
                            </h2>

                            <div className="space-y-3">
                                {/* Modifications */}
                                {modificationRequests.map(req => (
                                    <button
                                        key={req.id}
                                        onClick={() => setSelectedScheduleId(req.id)}
                                        className={clsx(
                                            "w-full text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden group",
                                            selectedScheduleId === req.id
                                                ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20"
                                                : "bg-slate-900/60 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <span className={clsx(
                                                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                                                selectedScheduleId === req.id ? "bg-white/20 text-white" : "bg-blue-500/10 text-blue-400"
                                            )}>
                                                {getStoreName(req.establishmentId)}
                                            </span>
                                            <Clock size={14} className={selectedScheduleId === req.id ? "text-white/60" : "text-slate-500"} />
                                        </div>
                                        <div className="relative z-10">
                                            <h3 className={clsx("font-bold text-lg leading-tight mb-1", selectedScheduleId === req.id ? "text-white" : "text-slate-200")}>
                                                Solicitud Modificación
                                            </h3>
                                            <p className={clsx("text-xs font-medium truncate", selectedScheduleId === req.id ? "text-blue-100" : "text-slate-500")}>
                                                {new Date(req.weekStartDate).toLocaleDateString('es-ES')}
                                            </p>
                                        </div>
                                    </button>
                                ))}

                                {/* Pending Schedules */}
                                {pendingSchedules.map(sched => (
                                    <button
                                        key={sched.id}
                                        onClick={() => setSelectedScheduleId(sched.id)}
                                        className={clsx(
                                            "w-full text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden group",
                                            selectedScheduleId === sched.id
                                                ? "bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20"
                                                : "bg-slate-900/60 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <span className={clsx(
                                                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                                                selectedScheduleId === sched.id ? "bg-white/20 text-white" : "bg-indigo-500/10 text-indigo-400"
                                            )}>
                                                {getStoreName(sched.establishmentId)}
                                            </span>
                                            <span className={clsx("text-xs font-bold", selectedScheduleId === sched.id ? "text-white" : "text-slate-500")}>
                                                {sched.shifts.length} Turnos
                                            </span>
                                        </div>
                                        <div className="relative z-10">
                                            <h3 className={clsx("font-bold text-lg leading-tight mb-1", selectedScheduleId === sched.id ? "text-white" : "text-slate-200")}>
                                                Semana {new Date(sched.weekStartDate).getDate()}
                                            </h3>
                                            <p className={clsx("text-xs font-medium truncate", selectedScheduleId === sched.id ? "text-indigo-100" : "text-slate-500")}>
                                                {new Date(sched.weekStartDate).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </button>
                                ))}

                                {pendingSchedules.length === 0 && modificationRequests.length === 0 && (
                                    <div className="text-center py-6">
                                        <CheckCircle size={32} className="mx-auto text-slate-700 mb-2" />
                                        <p className="text-sm text-slate-500">No hay tareas pendientes</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SECTION: HISTORY */}
                        <div className="bg-slate-900/40 border border-slate-800/50 rounded-3xl p-5">
                            <h2 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <CheckCircle size={16} /> Historial Aprobados
                            </h2>

                            <div className="space-y-3 mb-4">
                                <FilterSelect
                                    options={storeOptions}
                                    value={filterStore}
                                    onChange={setFilterStore}
                                    placeholder="Filtrar por Tienda"
                                    icon={Store}
                                    theme="dark"
                                />
                                <FilterSelect
                                    options={yearOptions}
                                    value={filterYear}
                                    onChange={setFilterYear}
                                    placeholder="Filtrar por Año"
                                    icon={Calendar}
                                    theme="dark"
                                />
                                <FilterSelect
                                    options={monthOptions}
                                    value={filterMonth}
                                    onChange={setFilterMonth}
                                    placeholder="Filtrar por Mes"
                                    icon={Calendar}
                                    theme="dark"
                                />
                            </div>

                            <div className="space-y-2">
                                {filteredHistory.map(sched => (
                                    <button
                                        key={sched.id}
                                        onClick={() => setSelectedScheduleId(sched.id)}
                                        className={clsx(
                                            "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
                                            selectedScheduleId === sched.id
                                                ? "bg-slate-800 border-slate-600 ring-1 ring-slate-500"
                                                : "bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-800"
                                        )}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-slate-300 text-sm group-hover:text-white transition-colors truncate">
                                                {getStoreName(sched.establishmentId)}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-medium truncate">
                                                Semana {new Date(sched.weekStartDate).toLocaleDateString('es-ES')}
                                            </p>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 shrink-0" />
                                    </button>
                                ))}
                                {filteredHistory.length === 0 && (
                                    <p className="text-xs text-slate-600 text-center py-4">No hay historial disponible</p>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 w-full bg-slate-900/40 border border-slate-800/50 rounded-[3rem] overflow-hidden backdrop-blur-sm h-[85vh] flex flex-col">
                        {selectedSchedule ? (
                            <div className="flex-1 h-full overflow-y-auto custom-scrollbar px-4 py-8 lg:p-10">

                                {/* Detail Header */}
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-8 relative">
                                    {/* Background Glow */}
                                    <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -ml-20 -mt-20 pointer-events-none"></div>

                                    <div className="relative z-10">
                                        <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                                            <ShieldAlert size={18} /> Schedule Command Center
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-4 mb-3">
                                            <h1 className="text-6xl font-black text-white tracking-tight leading-tight">
                                                {getStoreName(selectedSchedule.establishmentId)} <span className="text-slate-500 italic font-medium">Horarios</span>
                                            </h1>
                                            <span className={clsx(
                                                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-lg shadow-amber-500/5",
                                                selectedSchedule.approvalStatus === 'pending' || selectedSchedule.modificationStatus === 'requested'
                                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                            )}>
                                                {selectedSchedule.modificationStatus === 'requested' ? 'Solicitud Modificación' :
                                                    selectedSchedule.approvalStatus === 'pending' ? 'Pendiente' : 'Aprobado'}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 text-lg font-medium">
                                            Semana del <span className="text-slate-200 font-bold">{new Date(selectedSchedule.weekStartDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-4 relative z-10">
                                        {selectedSchedule.modificationStatus === 'requested' ? (
                                            <>
                                                <button
                                                    onClick={() => handleRejectClick('modification')}
                                                    className="px-6 py-3 rounded-xl bg-slate-900 border border-red-900/50 text-red-500 font-bold hover:bg-red-950/50 transition-colors flex items-center gap-2"
                                                >
                                                    <XCircle size={18} /> Cancelar Solicitud
                                                </button>
                                                <button
                                                    onClick={handleUnlockApprove}
                                                    className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
                                                >
                                                    <CheckCircle size={18} /> Aprobar Desbloqueo
                                                </button>
                                            </>
                                        ) : selectedSchedule.approvalStatus === 'pending' ? (
                                            <>
                                                <button
                                                    onClick={() => handleRejectClick('schedule')}
                                                    className="px-6 py-3 rounded-xl bg-slate-900 border border-red-900/50 text-red-500 font-bold hover:bg-red-950/50 transition-colors flex items-center gap-2"
                                                >
                                                    <XCircle size={18} /> Rechazar
                                                </button>
                                                <button
                                                    onClick={() => handleValidate(selectedSchedule)}
                                                    className="px-6 py-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold hover:bg-indigo-500/20 transition-colors flex items-center gap-2"
                                                >
                                                    <ShieldAlert size={18} /> Validar
                                                </button>
                                                <button
                                                    onClick={handleApprove}
                                                    className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                                                >
                                                    <CheckCircle size={18} /> Aprobar Horario
                                                </button>
                                            </>
                                        ) : (
                                            <div className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-bold flex items-center gap-2 cursor-default">
                                                <CheckCircle size={18} /> Horario Aprobado
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Schedule Grid Preview (Inline) */}
                                <div className="bg-slate-900/40 border border-slate-800/50 rounded-[2.5rem] p-4 lg:p-8 overflow-hidden">
                                    {/* Coverage Banner */}
                                    {stats && (
                                        <div className="mb-8 p-6 bg-slate-900 border border-slate-700 rounded-3xl shadow-lg relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                                            <div className="flex flex-col lg:flex-row gap-8 items-stretch relative z-10">
                                                {/* Main Stats */}
                                                <div className="flex-shrink-0 flex flex-col justify-center min-w-[200px] border-r border-slate-800 pr-8">
                                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Cobertura Semanal</p>
                                                    <div className="flex items-baseline gap-2 mb-2">
                                                        <span className={clsx(
                                                            "text-4xl font-black",
                                                            stats.coveragePercent > 105 ? "text-rose-400" :
                                                                stats.coveragePercent < 95 ? "text-amber-400" :
                                                                    "text-emerald-400"
                                                        )}>
                                                            {stats.coveragePercent.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 space-y-1">
                                                        <div className="flex justify-between">
                                                            <span>Prog:</span>
                                                            <span className="text-slate-300 font-bold">{stats.weeklyTotal.toFixed(1)}h</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Contr:</span>
                                                            <span className="text-slate-300 font-bold">{stats.totalContracted.toFixed(1)}h</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Daily Breakdown */}
                                                <div className="flex-1 grid grid-cols-7 gap-2">
                                                    {stats.daily.map((day, i) => (
                                                        <div key={i} className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-950/50 border border-slate-800/50 hover:bg-slate-950 hover:border-slate-700 transition-all">
                                                            <div className="text-center pb-2 border-b border-slate-800/50">
                                                                <span className="block text-[10px] font-black uppercase text-slate-500 mb-0.5">{day.date.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                                                                <span className="text-sm font-bold text-white">{day.date.getDate()}</span>
                                                            </div>
                                                            <div className="space-y-1.5 pt-1">
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="text-blue-400 font-medium">Mañ</span>
                                                                    <span className="text-slate-300 font-bold">{day.morning > 0 ? day.morning.toFixed(1) : '-'}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="text-orange-400 font-medium">Tar</span>
                                                                    <span className="text-slate-300 font-bold">{day.afternoon > 0 ? day.afternoon.toFixed(1) : '-'}</span>
                                                                </div>
                                                                <div className="pt-1.5 border-t border-slate-800/50 flex justify-between items-center">
                                                                    <span className="text-[10px] font-black text-slate-500">TOT</span>
                                                                    <span className="text-xs font-black text-white">{day.total.toFixed(1)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Modification Diff View */}
                                    {(() => {
                                        if (selectedSchedule.modificationStatus !== 'requested' || !selectedSchedule.originalShiftsSnapshot) return null;

                                        const diffs = employees.filter(e => e.establishmentId === selectedSchedule.establishmentId).flatMap(emp => {
                                            return Array.from({ length: 7 }).map((_, i) => {
                                                const d = new Date(selectedSchedule.weekStartDate);
                                                d.setDate(d.getDate() + i);
                                                const dateStr = d.toISOString().split('T')[0];

                                                const oldShift = selectedSchedule.originalShiftsSnapshot?.find(s => s.employeeId === emp.id && s.date === dateStr);
                                                const newShift = selectedSchedule.shifts.find(s => s.employeeId === emp.id && s.date === dateStr);

                                                const oldType = oldShift?.type || 'none';
                                                const newType = newShift?.type || 'none';
                                                let hasChange = false;
                                                let changeDesc = '';

                                                if (oldType !== newType) {
                                                    hasChange = true;
                                                    changeDesc = `Cambio de ${oldType} a ${newType}`;
                                                } else if (oldType !== 'none') {
                                                    if (oldType === 'split') {
                                                        if (oldShift?.startTime !== newShift?.startTime || oldShift?.endTime !== newShift?.endTime) {
                                                            hasChange = true;
                                                            changeDesc = 'Ajuste de horario (Turno Partido)';
                                                        }
                                                    } else {
                                                        if (oldShift?.startTime !== newShift?.startTime || oldShift?.endTime !== newShift?.endTime) {
                                                            hasChange = true;
                                                            changeDesc = `Ajuste de horario`;
                                                        }
                                                    }
                                                }

                                                if (hasChange) {
                                                    return { emp, date: d, oldShift, newShift, changeDesc };
                                                }
                                                return null;
                                            }).filter(Boolean);
                                        });

                                        if (diffs.length === 0) return null;

                                        return (
                                            <div className="mb-8 bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
                                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                                    <ShieldAlert className="text-amber-500" />
                                                    Cambios Solicitados ({diffs.length})
                                                </h3>
                                                <div className="grid gap-3">
                                                    {diffs.map((diff: any, idx) => (
                                                        <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-bold text-indigo-400">{diff.emp.name}</span>
                                                                    <span className="text-slate-300 capitalize">{diff.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</span>
                                                                </div>
                                                                <p className="text-sm text-slate-400">{diff.changeDesc}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="overflow-x-auto lg:overflow-x-visible custom-scrollbar pb-4">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="sticky left-0 z-20 bg-slate-900 p-3 text-left text-[10px] font-black uppercase text-slate-500 border-b border-r border-slate-800 min-w-[120px]">Empleado</th>
                                                    {Array.from({ length: 7 }).map((_, i) => {
                                                        const d = new Date(selectedSchedule.weekStartDate);
                                                        d.setDate(d.getDate() + i);
                                                        return (
                                                            <th key={i} className="p-2 lg:p-3 bg-slate-900/50 text-center border-b border-slate-800 min-w-[70px]">
                                                                <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                                                                <span className="text-base font-bold text-slate-200">{d.getDate()}</span>
                                                            </th>
                                                        );
                                                    })}
                                                    <th className="p-2 lg:p-3 bg-indigo-950/30 text-center border-b border-slate-800 min-w-[70px]">
                                                        <span className="block text-[9px] font-black uppercase text-indigo-400 mb-0.5">Balance</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employees.filter(e => e.establishmentId === selectedSchedule.establishmentId && e.active).map(emp => {
                                                    const empShifts = selectedSchedule.shifts.filter(s => s.employeeId === emp.id);
                                                    const storeSettings = settings.find(s => s.establishmentId === selectedSchedule.establishmentId);

                                                    let weeklyWorked = 0;

                                                    // Cells
                                                    const cells = Array.from({ length: 7 }).map((_, i) => {
                                                        const d = new Date(selectedSchedule.weekStartDate);
                                                        d.setDate(d.getDate() + i);
                                                        const dateStr = d.toISOString().split('T')[0];
                                                        const shift = empShifts.find(s => s.date === dateStr);
                                                        const hours = getShiftHours(shift, storeSettings);
                                                        weeklyWorked += hours.total;

                                                        return (
                                                            <td key={i} className="p-2 border-b border-slate-800 text-center">
                                                                {shift ? (
                                                                    <div className={`
                                                                p-2 rounded-xl text-[10px] font-bold h-full flex flex-col justify-center items-center gap-1 border
                                                                ${shift.type === 'morning' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                                                                ${shift.type === 'afternoon' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                                                                ${shift.type === 'split' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                                                                ${shift.type === 'off' ? 'bg-slate-800/50 text-slate-500 border-slate-700' : ''}
                                                                ${shift.type === 'vacation' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                                                                ${shift.type === 'sick_leave' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                                                                ${shift.type === 'holiday' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : ''}
                                                            `}>
                                                                        {shift.type === 'split' ? (
                                                                            <>
                                                                                <span className="font-mono text-[9px] whitespace-nowrap">{shift.startTime}-{shift.morningEndTime}</span>
                                                                                <span className="font-mono text-[9px] whitespace-nowrap">{shift.afternoonStartTime}-{shift.endTime}</span>
                                                                            </>
                                                                        ) : shift.type === 'off' ? (
                                                                            <span className="uppercase opacity-50 italic">Descanso</span>
                                                                        ) : (shift.type === 'vacation' || shift.type === 'sick_leave' || shift.type === 'holiday') ? (
                                                                            <span className="uppercase tracking-widest">{shift.type.substring(0, 3)}</span>
                                                                        ) : (
                                                                            <span className="font-mono text-[11px] font-black">{shift.startTime}-{shift.endTime}</span>
                                                                        )}
                                                                    </div>
                                                                ) : <span className="text-slate-700">-</span>}
                                                            </td>
                                                        );
                                                    });

                                                    let target = emp.weeklyHours;
                                                    const absences = empShifts.filter(s => ['vacation', 'sick_leave', 'holiday'].includes(s.type)).length;
                                                    if (absences > 0) target = Math.max(0, emp.weeklyHours - Math.round((emp.weeklyHours / 5) * absences));
                                                    const balance = weeklyWorked - target;

                                                    return (
                                                        <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                                                            <td className="sticky left-0 z-10 bg-slate-900/90 backdrop-blur-md p-4 border-b border-r border-slate-800">
                                                                <p className="font-bold text-slate-200">{emp.name}</p>
                                                                <span className="text-[9px] text-slate-500 uppercase font-bold">{emp.category || 'Empleado'}</span>
                                                            </td>
                                                            {cells}
                                                            <td className="p-3 border-b border-slate-800 bg-indigo-950/10 text-center">
                                                                <div className={clsx(
                                                                    "px-2 py-1 rounded text-xs font-black",
                                                                    balance > 0 ? "text-emerald-400 bg-emerald-500/10" : balance < 0 ? "text-rose-400 bg-rose-500/10" : "text-slate-400"
                                                                )}>
                                                                    {balance > 0 ? '+' : ''}{balance.toFixed(1)}h
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8">
                                <div className="relative mb-10">
                                    <div className="absolute inset-0 bg-indigo-500/10 blur-[60px] rounded-full scale-150"></div>
                                    <div className="relative bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl">
                                        <Store size={80} className="text-slate-800" strokeWidth={1} />
                                    </div>
                                </div>
                                <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Panel de <span className="text-slate-500 italic font-medium">Supervisión</span></h2>
                                <p className="text-slate-500 text-lg font-medium text-center max-w-md leading-relaxed">
                                    Selecciona una tienda del menú lateral para gestionar sus <span className="text-indigo-400 font-bold">horarios y validaciones</span>.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals are kept the same/similar, simplified for brevity in this rewrite step */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-2">Motivo del Rechazo</h3>
                        <textarea
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-red-500 outline-none resize-none h-32"
                            placeholder="Explica por qué se rechaza..."
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                        ></textarea>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-slate-400">Cancelar</button>
                            <button onClick={confirmReject} disabled={!rejectNotes.trim()} className="px-4 py-2 bg-red-600 rounded-lg text-white font-bold">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {isValidationModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl p-8">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <ShieldAlert className="text-indigo-500" /> Resultado de Validación
                        </h3>

                        {validationResults.strictWarnings.length === 0 ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center mb-6">
                                <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
                                <p className="text-emerald-400 font-bold text-lg">Todo Correcto</p>
                                <p className="text-emerald-500/60 text-sm">El horario cumple con todas las reglas definidas.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {validationResults.strictWarnings.map((w, i) => (
                                    <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-red-200">
                                        <AlertCircle className="shrink-0 text-red-500" size={20} />
                                        <span className="text-sm font-medium">{w}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {validationResults.debtAdjustments.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ajustes de Horas (Deuda/Extras)</h4>
                                <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                                            <tr>
                                                <th className="px-4 py-3">Empleado</th>
                                                <th className="px-4 py-3 text-center">Objetivo</th>
                                                <th className="px-4 py-3 text-center">Real</th>
                                                <th className="px-4 py-3 text-right">Dif</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800 text-slate-300">
                                            {validationResults.debtAdjustments.map((adj, i) => (
                                                <tr key={i} className="hover:bg-slate-900/50">
                                                    <td className="px-4 py-3 font-medium">{adj.name}</td>
                                                    <td className="px-4 py-3 text-center text-slate-500">{adj.contract}h</td>
                                                    <td className="px-4 py-3 text-center text-slate-400">{adj.worked}h</td>
                                                    <td className={clsx("px-4 py-3 text-right font-bold", adj.amount > 0 ? "text-emerald-400" : "text-rose-400")}>
                                                        {adj.amount > 0 ? '+' : ''}{adj.amount}h
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button onClick={() => setIsValidationModalOpen(false)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

        </div >
    );
};

export default SupervisionPage;
