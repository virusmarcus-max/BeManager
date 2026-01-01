import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import {
    Calendar,
    Clock,
    Moon,
    Palmtree,
    Stethoscope,
    CheckCircle,
    Activity,
    UserCheck,
    Coffee
} from 'lucide-react';
import clsx from 'clsx';
import { formatLocalDate } from '../services/dateUtils';
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
    shift: Shift;
}

interface RestingEmployee extends Employee {
    reason: string;
}

const ManagerLive: React.FC = () => {
    const { schedules, employees, settings } = useStore();
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update clock every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    if (!user) return null;

    // 1. Determine Current Context
    const today = new Date();
    const todayStr = formatLocalDate(today);
    const currentWeekStart = formatLocalDate(getMonday(today));
    const storeId = user.establishmentId;

    // 2. Filter Data
    // Get schedule for the current week for THIS store
    const currentSchedule = schedules.find(s => s.weekStartDate === currentWeekStart && s.establishmentId === storeId);

    // Store Settings for opening hours fallback
    const storeSettings = settings.find(s => s.establishmentId === storeId);
    const openingHours = storeSettings?.openingHours;

    // Helper to get initials
    const getInitials = (emp: Employee) => {
        if (emp.initials) return emp.initials;
        return emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    // 3. Process Data
    const workingToday: WorkingEmployee[] = [];
    const restingToday: RestingEmployee[] = [];
    const sickToday: Employee[] = [];
    const onVacationWeek: Employee[] = [];
    const onSickLeaveWeek: Employee[] = [];

    // Filter employees for this store
    const myEmployees = employees.filter(e => {
        if (e.establishmentId !== storeId) return false;
        if (!e.active) return false;
        // Basic active check. For robust check like SupervisorLive, we could add history check if needed.
        return true;
    });

    myEmployees.forEach(emp => {
        if (!currentSchedule) return;

        // Check for today's shift
        const todayShift = currentSchedule.shifts.find(s => s.employeeId === emp.id && s.date === todayStr);

        // Check for vacations/sick leave in the whole week
        const weekShifts = currentSchedule.shifts.filter(s => s.employeeId === emp.id);
        const hasVacation = weekShifts.some(s => s.type === 'vacation');
        const hasSickLeave = weekShifts.some(s => s.type === 'sick_leave');

        if (hasVacation && !onVacationWeek.some(x => x.id === emp.id)) onVacationWeek.push(emp);
        if (hasSickLeave && !onSickLeaveWeek.some(x => x.id === emp.id)) onSickLeaveWeek.push(emp);

        if (todayShift && !['off', 'vacation', 'sick_leave', 'maternity_paternity'].includes(todayShift.type)) {
            workingToday.push({ ...emp, shift: todayShift });
        } else if (todayShift?.type === 'sick_leave') {
            sickToday.push(emp);
        } else {
            let reason = 'Descanso';
            if (todayShift?.type === 'vacation') reason = 'Vacaciones';
            else if (todayShift?.type === 'maternity_paternity') reason = 'Baja Maternal';
            restingToday.push({ ...emp, reason });
        }
    });



    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 space-y-8 animate-in fade-in duration-500">

            {/* Header Area */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                        <span className="text-xs font-black uppercase tracking-widest text-rose-500">En Vivo</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                        Monitor de la Tienda
                    </h1>
                    <p className="text-slate-500 font-medium mt-2 text-lg">
                        Visión en tiempo real de tu equipo y operación hoy.
                    </p>
                </div>

                <div className="flex gap-6">
                    {/* Time Widget */}
                    <div className="flex items-center gap-4 bg-slate-50 rounded-[2rem] px-8 py-4 border border-slate-100">
                        <div className="text-right">
                            <p className="text-xs font-bold uppercase text-slate-400 tracking-widest">Hora Actual</p>
                            <p className="text-3xl font-black text-slate-800 tabular-nums leading-none">
                                {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Clock size={24} />
                        </div>
                    </div>

                    {/* Calendar Widget */}
                    <div className="hidden md:flex items-center gap-4 bg-slate-50 rounded-[2rem] px-8 py-4 border border-slate-100">
                        <div className="text-right">
                            <p className="text-xs font-bold uppercase text-slate-400 tracking-widest">Fecha</p>
                            <p className="text-xl font-bold text-slate-800 capitalize leading-none">
                                {today.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Calendar size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* LEFT COL: PRESENCE (8) */}
                <div className="xl:col-span-8 space-y-8">

                    {/* WORKING NOW SECTION */}
                    <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                        <div className="flex justify-between items-center mb-5 relative z-10">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                    <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-xl"><UserCheck size={20} /></div>
                                    Trabajando Ahora
                                </h2>
                            </div>
                            <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 text-xs">
                                {workingToday.length} Activos
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 relative z-10">
                            {workingToday.length === 0 ? (
                                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                                    <Moon size={32} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-slate-400 font-medium text-sm">No hay nadie trabajando en este momento.</p>
                                </div>
                            ) : workingToday.map(emp => {
                                const { shift } = emp;
                                const isSplit = shift.type === 'split';

                                // Status Logic
                                let isWorkingNow = false;
                                let timeText = '';

                                if (isSplit) {
                                    const mStart = shift.startTime || openingHours?.morningStart || '10:00';
                                    const mEnd = shift.morningEndTime || openingHours?.morningEnd || '14:00';
                                    const aStart = shift.afternoonStartTime || openingHours?.afternoonStart || '16:30';
                                    const aEnd = shift.endTime || openingHours?.afternoonEnd || '20:30';
                                    isWorkingNow = isTimeInRange(currentTime, mStart, mEnd) || isTimeInRange(currentTime, aStart, aEnd);
                                    timeText = `${mStart}-${mEnd} / ${aStart}-${aEnd}`;
                                } else {
                                    const start = shift.startTime || (shift.type === 'morning' ? openingHours?.morningStart : openingHours?.afternoonStart) || '00:00';
                                    const end = shift.endTime || (shift.type === 'morning' ? openingHours?.morningEnd : openingHours?.afternoonEnd) || '00:00';
                                    isWorkingNow = isTimeInRange(currentTime, start, end);
                                    timeText = `${start}-${end}`;
                                }

                                return (
                                    <div key={emp.id} className={clsx("group p-3 rounded-2xl border transition-all duration-300 hover:-translate-y-1 relative overflow-hidden",
                                        isWorkingNow ? "bg-white border-indigo-200 shadow-md shadow-indigo-100" : "bg-slate-50 border-slate-100 opacity-75"
                                    )}>
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 font-black text-xs flex items-center justify-center border border-slate-200 shadow-sm shrink-0">
                                                    {getInitials(emp)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-800 text-sm truncate leading-tight">{emp.name.split(' ')[0]}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{emp.category}</p>
                                                </div>
                                            </div>
                                            <div className={clsx("h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-white shrink-0", isWorkingNow ? "bg-emerald-500 animate-pulse" : "bg-amber-400")} title={isWorkingNow ? "En Puesto" : "Descanso / Fuera"}></div>
                                        </div>

                                        <div className="relative z-10 flex flex-col gap-1">
                                            <span className={clsx("text-[10px] font-bold px-2 py-1 rounded-md border text-center whitespace-nowrap overflow-hidden text-ellipsis",
                                                isSplit ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-blue-50 text-blue-700 border-blue-100"
                                            )}>
                                                {timeText}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>



                </div>

                {/* RIGHT COL: ABSENCE & ALERTS (4) */}
                <div className="xl:col-span-4 space-y-6">

                    {/* RESTING TODAY */}
                    <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Coffee className="text-amber-500" size={20} />
                            Fuera de Turno
                        </h3>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {restingToday.length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-4">Todos manos a la obra 💪</p>
                            ) : restingToday.map(emp => (
                                <div key={emp.id} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-500">
                                            {getInitials(emp)}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{emp.name}</p>
                                            <p className="text-[10px] text-slate-400">{emp.category}</p>
                                        </div>
                                    </div>
                                    <span className={clsx("text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-lg",
                                        emp.reason === 'Vacaciones' ? "bg-teal-100 text-teal-600" :
                                            emp.reason === 'Baja Maternal' ? "bg-pink-100 text-pink-600" : "bg-slate-200 text-slate-500"
                                    )}>
                                        {emp.reason}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SICK LEAVES WIDGET */}
                    <div className="bg-rose-50 rounded-[2.5rem] p-6 border border-rose-100">
                        <h3 className="text-lg font-bold text-rose-800 mb-6 flex items-center gap-2">
                            <Activity className="text-rose-500" size={20} />
                            Bajas (Semana)
                        </h3>
                        <div className="space-y-3">
                            {onSickLeaveWeek.length === 0 ? (
                                <div className="flex items-center gap-2 text-rose-400 text-sm font-medium justify-center py-4">
                                    <CheckCircle size={16} /> Sin bajas registradas
                                </div>
                            ) : onSickLeaveWeek.map(emp => (
                                <div key={emp.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-rose-100 shadow-sm">
                                    <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center">
                                        <Stethoscope size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                                        <p className="text-xs text-rose-500 font-medium">Baja Médica Activa</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* VACATIONS WIDGET */}
                    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-[2.5rem] p-6 border border-indigo-100">
                        <h3 className="text-lg font-bold text-indigo-800 mb-6 flex items-center gap-2">
                            <Palmtree className="text-indigo-500" size={20} />
                            Vacaciones (Semana)
                        </h3>
                        <div className="space-y-3">
                            {onVacationWeek.length === 0 ? (
                                <p className="text-sm text-indigo-400 italic text-center py-4">Sin vacaciones esta semana</p>
                            ) : onVacationWeek.map(emp => (
                                <div key={emp.id} className="flex items-center gap-3 p-3 bg-white/60 backdrop-blur rounded-2xl border border-indigo-100">
                                    <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-500 flex items-center justify-center font-bold text-xs">
                                        {getInitials(emp)}
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">{emp.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default ManagerLive;
