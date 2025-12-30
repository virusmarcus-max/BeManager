import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
    Calendar,
    Clock,
    Moon,
    Palmtree,
    Stethoscope,
    CheckCircle,
    Activity,
    Store,
} from 'lucide-react';
import clsx from 'clsx';
import { formatLocalDate } from '../services/dateUtils';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';
import type { Shift, Employee } from '../types';

// Helper to get Monday of current week
const getMonday = (d: Date) => {
    const monday = new Date(d);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

const isTimeInRange = (now: Date, startStr?: string, endStr?: string) => {
    if (!startStr || !endStr) return false;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
};

interface WorkingEmployee extends Employee {
    storeName: string;
    shift: Shift;
}

interface RestingEmployee extends Employee {
    storeName: string;
    reason: string;
}

interface AbsentEmployee extends Employee {
    storeName: string;
}

const SupervisorLive: React.FC = () => {
    const { schedules, employees, settings } = useStore();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

    // Update clock every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // 1. Determine Current Context
    const today = new Date();
    const todayStr = formatLocalDate(today);
    const currentWeekStart = formatLocalDate(getMonday(today));

    // 2. Filter Data
    // Get schedules for the current week for ALL stores
    const activeSchedules = schedules.filter(s => s.weekStartDate === currentWeekStart);

    // Get unique active stores from these schedules (or settings)
    const activeStoreIds = Array.from(new Set(activeSchedules.map(s => s.establishmentId)));

    // Helper to get initials
    const getInitials = (emp: Employee) => {
        if (emp.initials) return emp.initials;
        return emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    // Helper to get store name
    const getStoreName = (id: string) => {
        const store = settings.find(s => s.establishmentId === id);
        if (store && store.storeName) return store.storeName;

        return DEFAULT_STORE_NAMES[id] || `Tienda ${id}`;
    };

    // 3. Process "Working Today"
    const workingToday: WorkingEmployee[] = [];
    const restingToday: RestingEmployee[] = [];
    const sickToday: AbsentEmployee[] = [];
    const onVacationWeek: AbsentEmployee[] = [];
    const onSickLeaveWeek: AbsentEmployee[] = [];

    // Map of all active employees to check status (only those hired/rehired and not terminated relative to today)
    const allActiveEmployees = employees.filter(e => {
        // First filter by store if selected
        if (selectedStoreId !== 'all' && e.establishmentId !== selectedStoreId) return false;

        if (!e.active) return false;

        const todayStr = formatLocalDate(new Date());
        if (!e.history || e.history.length === 0) return e.active;

        const sortedHistory = [...e.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const entriesBefore = sortedHistory.filter(h => h.date <= todayStr);
        let activeNow = false;

        if (entriesBefore.length > 0) {
            const lastEntry = entriesBefore[entriesBefore.length - 1];
            activeNow = (lastEntry.type === 'hired' || lastEntry.type === 'rehired');
        } else {
            const firstEvent = sortedHistory[0];
            activeNow = firstEvent?.type === 'terminated';
        }

        return activeNow;
    });

    allActiveEmployees.forEach(emp => {
        const storeName = getStoreName(emp.establishmentId);

        // Find schedule for this employee's store
        const schedule = activeSchedules.find(s => s.establishmentId === emp.establishmentId);

        if (!schedule) {
            // No schedule published/created for this store this week
            return;
        }

        // Check for today's shift
        const todayShift = schedule.shifts.find(s => s.employeeId === emp.id && s.date === todayStr);

        // Check for vacations/sick leave in the whole week
        const weekShifts = schedule.shifts.filter(s => s.employeeId === emp.id);
        const hasVacation = weekShifts.some(s => s.type === 'vacation');
        const hasSickLeave = weekShifts.some(s => s.type === 'sick_leave');

        if (hasVacation && !onVacationWeek.some(x => x.id === emp.id)) {
            onVacationWeek.push({ ...emp, storeName });
        }
        if (hasSickLeave && !onSickLeaveWeek.some(x => x.id === emp.id)) {
            onSickLeaveWeek.push({ ...emp, storeName });
        }

        if (todayShift && todayShift.type !== 'off' && todayShift.type !== 'vacation' && todayShift.type !== 'sick_leave' && todayShift.type !== 'maternity_paternity') {
            workingToday.push({
                ...emp,
                storeName,
                shift: todayShift
            });
        } else if (todayShift?.type === 'sick_leave') {
            sickToday.push({
                ...emp,
                storeName
            });
        } else {
            let reason = 'Descanso';
            if (todayShift?.type === 'vacation') reason = 'Vacaciones';
            else if (todayShift?.type === 'maternity_paternity') reason = 'Maternidad/Paternidad';
            // Sick leave is handled in sickToday

            restingToday.push({
                ...emp,
                storeName,
                reason
            });
        }
    });

    // Group Working Today by Store
    const workingByStore = workingToday.reduce((acc, curr) => {
        if (!acc[curr.storeName]) acc[curr.storeName] = [];
        acc[curr.storeName].push(curr);
        return acc;
    }, {} as Record<string, WorkingEmployee[]>);


    return (
        <div className="p-8 pb-24 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full relative z-10">

                {/* Header - Command Center Style */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-8 print:hidden">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 opacity-70">Hola, Supervisor 👋</p>
                        <div className="flex items-center gap-3 mb-3">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                Live Command Center
                            </h2>
                        </div>
                        <h1 className="text-6xl font-black text-white tracking-tight leading-tight">
                            Monitorización <span className="text-slate-500 italic font-medium">En Vivo</span>
                        </h1>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="bg-slate-900/40 border border-slate-800/50 rounded-[2rem] px-8 py-4 flex items-center gap-8 backdrop-blur-xl shadow-2xl">
                            <div className="flex items-center gap-3">
                                <Calendar className="text-indigo-500" size={24} />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider">Hoy</span>
                                    <span className="font-bold text-white capitalize leading-none text-lg">
                                        {today.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                            <div className="h-10 w-px bg-slate-700/50"></div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Clock className="text-emerald-500" size={24} />
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                </div>
                                <span className="font-mono text-3xl font-black text-white tracking-widest tabular-nums leading-none mt-[-4px]">
                                    {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Store Selection Pills */}
                <div className="flex flex-wrap items-center gap-3 mb-10 print:hidden">
                    <button
                        onClick={() => setSelectedStoreId('all')}
                        className={clsx(
                            "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                            selectedStoreId === 'all'
                                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                                : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Store size={14} />
                            Global / Todas
                        </div>
                    </button>
                    {activeStoreIds.map(id => (
                        <button
                            key={id}
                            onClick={() => setSelectedStoreId(id)}
                            className={clsx(
                                "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                                selectedStoreId === id
                                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                                    : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
                            )}
                        >
                            {getStoreName(id)}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Working Now (Main Focus) */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Active Stores Section */}
                        {Object.entries(workingByStore).map(([storeName, staff]) => (
                            <div key={storeName} className="bg-slate-900/40 border border-slate-800/50 rounded-[3rem] p-8 relative overflow-hidden backdrop-blur-sm">
                                {/* Store Header */}
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
                                            <StoreIcon />
                                        </div>
                                        <h2 className="text-2xl font-bold text-white">{storeName}</h2>
                                    </div>
                                    <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        {staff.length} Trabajando
                                    </span>
                                </div>

                                {/* Staff Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {staff.map((emp) => {
                                        const shift = emp.shift;
                                        const isSplit = shift.type === 'split';
                                        const storeSettings = settings.find(s => s.establishmentId === emp.establishmentId);
                                        const openingHours = storeSettings?.openingHours;

                                        // Determine if currently working
                                        let isWorkingNow = false;
                                        if (isSplit) {
                                            const mStart = shift.startTime || openingHours?.morningStart || '10:00';
                                            const mEnd = shift.morningEndTime || openingHours?.morningEnd || '14:00';
                                            const aStart = shift.afternoonStartTime || openingHours?.afternoonStart || '16:30';
                                            const aEnd = shift.endTime || openingHours?.afternoonEnd || '20:30';
                                            isWorkingNow = isTimeInRange(currentTime, mStart, mEnd) || isTimeInRange(currentTime, aStart, aEnd);
                                        } else {
                                            const start = shift.startTime || (shift.type === 'morning' ? openingHours?.morningStart : openingHours?.afternoonStart) || '00:00';
                                            const end = shift.endTime || (shift.type === 'morning' ? openingHours?.morningEnd : openingHours?.afternoonEnd) || '00:00';
                                            isWorkingNow = isTimeInRange(currentTime, start, end);
                                        }

                                        return (
                                            <div key={emp.id} className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 hover:border-indigo-500/30 transition-all group relative hover:bg-slate-900/80">
                                                <div className="relative">
                                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                                        {getInitials(emp)}
                                                    </div>
                                                    <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-[4px] border-slate-950 shadow-lg ${isWorkingNow ? 'bg-emerald-500 shadow-emerald-500/50 animate-pulse' : 'bg-red-500 shadow-red-500/50'}`} title={isWorkingNow ? "Trabajando ahora" : "Fuera de turno ahora"}></div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-200 truncate text-base">{emp.name}</p>
                                                    <p className="text-xs text-slate-500 truncate font-medium">{emp.category}</p>
                                                </div>
                                                <div className="text-right">
                                                    {isSplit ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-[10px] font-mono font-bold bg-slate-800 text-indigo-300 px-2 py-1 rounded-lg border border-slate-700">
                                                                {shift.startTime || openingHours?.morningStart || '10:00'} - {shift.morningEndTime || openingHours?.morningEnd || '14:00'}
                                                            </span>
                                                            <span className="text-[10px] font-mono font-bold bg-slate-800 text-indigo-300 px-2 py-1 rounded-lg border border-slate-700">
                                                                {shift.afternoonStartTime || openingHours?.afternoonStart || '16:30'} - {shift.endTime || openingHours?.afternoonEnd || '20:30'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 block">
                                                            {shift.startTime || (shift.type === 'morning' ? openingHours?.morningStart : openingHours?.afternoonStart) || '00:00'} - {shift.endTime || (shift.type === 'morning' ? openingHours?.morningEnd : openingHours?.afternoonEnd) || '00:00'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {workingToday.length === 0 && (
                            <div className="bg-slate-900/40 border border-slate-800/50 rounded-[3rem] p-12 text-center flex flex-col items-center justify-center text-slate-500 backdrop-blur-sm">
                                <Moon size={64} className="mb-6 text-slate-700" />
                                <p className="text-xl font-bold text-slate-400">Sin Actividad</p>
                                <p className="text-sm mt-2">No hay empleados trabajando activamente en este momento.</p>
                            </div>
                        )}

                    </div>

                    {/* Right Column: Absences & Weekly Info */}
                    <div className="space-y-6">

                        {/* Active Sick Leaves Today Card (Reordered & Always Visible) */}
                        <div className="bg-gradient-to-br from-red-900/20 to-rose-900/20 border border-red-500/20 rounded-[3rem] p-8 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                                <div className="p-2 bg-red-500/20 rounded-xl text-red-500">
                                    <Activity size={20} />
                                </div>
                                Bajas Hoy
                            </h3>
                            {sickToday.length === 0 ? (
                                <p className="text-sm text-slate-500 flex items-center gap-2 font-medium">
                                    <CheckCircle size={16} className="text-emerald-500" /> Sin bajas registradas hoy.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {sickToday.map(emp => (
                                        <div key={emp.id} className="flex items-center gap-4 p-4 bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-slate-900/50 transition-colors">
                                            <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xs ring-1 ring-red-500/20">
                                                {getInitials(emp)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-200">{emp.name}</p>
                                                <p className="text-xs text-slate-500">{emp.storeName}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Not Working Today Card */}
                        <div className="bg-slate-900/40 border border-slate-800/50 rounded-[3rem] p-8 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                                <div className="p-2 bg-slate-700/30 rounded-xl text-slate-300">
                                    <Moon size={20} />
                                </div>
                                Ausentes Hoy
                            </h3>
                            {restingToday.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">Todos los empleados están trabajando.</p>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                    {restingToday.map(emp => (
                                        <div key={emp.id} className="flex justify-between items-center p-3 rounded-2xl hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-700/50 group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-slate-600 group-hover:bg-slate-500 transition-colors"></div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-300">{emp.name}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{emp.storeName}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black tracking-wide border ${getStatusStyle(emp.reason)}`}>
                                                {emp.reason}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Weekly Vacations Card */}
                        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-[3rem] p-8 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                                <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400">
                                    <Palmtree size={20} />
                                </div>
                                Vacaciones (Semana)
                            </h3>
                            <div className="space-y-4">
                                {onVacationWeek.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-4 p-4 bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-slate-900/50 transition-colors">
                                        <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center ring-1 ring-purple-500/20">
                                            <Palmtree size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-200">{emp.name}</p>
                                            <p className="text-xs text-slate-500">{emp.storeName}</p>
                                        </div>
                                    </div>
                                ))}
                                {onVacationWeek.length === 0 && (
                                    <p className="text-sm text-slate-500 flex items-center gap-2 font-medium">
                                        <CheckCircle size={16} className="text-emerald-500" /> Sin vacaciones esta semana.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Active Sick Leaves Card (Long Term) */}
                        {onSickLeaveWeek.length > 0 && (
                            <div className="bg-gradient-to-br from-red-900/20 to-rose-900/20 border border-red-500/20 rounded-[3rem] p-8 backdrop-blur-sm">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                                    <div className="p-2 bg-red-500/20 rounded-xl text-red-400">
                                        <Stethoscope size={20} />
                                    </div>
                                    Bajas Médicas Activas
                                </h3>
                                <div className="space-y-4">
                                    {onSickLeaveWeek.map(emp => (
                                        <div key={emp.id} className="flex items-center gap-4 p-4 bg-slate-950/50 rounded-2xl border border-white/5 hover:bg-slate-900/50 transition-colors">
                                            <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center ring-1 ring-red-500/20">
                                                <Activity size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-200">{emp.name}</p>
                                                <p className="text-xs text-slate-500">{emp.storeName}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper components & functions
const StoreIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-current">
        <path d="M3 21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 21V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 21V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 7L22 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 7V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const getStatusStyle = (reason: string) => {
    switch (reason) {
        case 'Vacaciones': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        case 'Baja Médica': return 'bg-red-500/10 text-red-400 border-red-500/20';
        case 'Maternidad/Paternidad': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
        default: return 'bg-slate-800 text-slate-400 border-slate-700'; // Descanso
    }
};

export default SupervisorLive;
