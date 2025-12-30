import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, User, Briefcase } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import clsx from 'clsx';

interface AnnualPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    establishmentId: string;
}

const AnnualPlanModal: React.FC<AnnualPlanModalProps> = ({ isOpen, onClose, establishmentId }) => {
    if (!isOpen) return null;

    const { getSettings, employees, timeOffRequests } = useStore();
    const settings = getSettings(establishmentId);

    // Explicitly handle holidays which are objects { date: string, type: ... }
    const holidaysList = settings?.holidays || [];
    const holidaysDates = holidaysList.map(h => h.date);

    const [year, setYear] = useState(new Date().getFullYear());
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Filter employees for this establishment
    const storeEmployees = employees.filter(e => e.establishmentId === establishmentId);

    // Filter requests for store employees
    const storeTimeOffRequests = timeOffRequests.filter(req =>
        storeEmployees.some(e => e.id === req.employeeId)
    );

    const getDayEvents = (dateStr: string) => {
        const isStoreHoliday = holidaysDates.includes(dateStr);
        const reqs = storeTimeOffRequests.filter(req =>
            (req.type === 'vacation' || req.type === 'sick_leave') && (
                req.dates?.includes(dateStr) ||
                (req.startDate && req.endDate && dateStr >= req.startDate && dateStr <= req.endDate)
            )
        );
        return { isStoreHoliday, requests: reqs };
    };

    const handleDayClick = (dateStr: string) => {
        setSelectedDate(dateStr);
    };


    const renderMonth = (monthIndex: number) => {
        const firstDay = new Date(year, monthIndex, 1);
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        // Adjust start day to Monday (0=Mon, 6=Sun)
        const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

        return (
            <div key={monthIndex} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                <h4 className="font-bold text-sm text-slate-800 mb-3 text-center border-b border-slate-100 pb-2 capitalize">
                    {months[monthIndex]}
                </h4>
                <div className="grid grid-cols-7 gap-1 text-center mb-2 px-1">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                        <span key={d} className="text-[10px] font-bold text-slate-400">{d}</span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-sm justify-items-center">
                    {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="h-7 w-7" />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const { isStoreHoliday, requests } = getDayEvents(dateStr);

                        const hasVacation = requests.some(r => r.type === 'vacation');
                        const hasSickLeave = requests.some(r => r.type === 'sick_leave');
                        const isSelected = selectedDate === dateStr;

                        let bgClass = "bg-white border-slate-100 text-slate-600 hover:border-indigo-300";
                        if (isStoreHoliday) bgClass = "bg-red-50 text-red-700 border-red-200 font-bold";
                        else if (hasVacation && hasSickLeave) bgClass = "bg-gradient-to-br from-teal-100 to-orange-100 text-slate-800 font-bold border-indigo-200";
                        else if (hasVacation) bgClass = "bg-teal-50 text-teal-700 border-teal-100 font-bold";
                        else if (hasSickLeave) bgClass = "bg-orange-50 text-orange-700 border-orange-100 font-bold";

                        return (
                            <button
                                key={day}
                                onClick={() => handleDayClick(dateStr)}
                                className={clsx(
                                    "h-7 w-7 flex items-center justify-center rounded-lg relative text-[11px] font-medium transition-all group",
                                    isSelected ? "ring-2 ring-indigo-500 ring-offset-1 z-10" : "border",
                                    bgClass
                                )}
                            >
                                {day}
                                <div className="absolute -bottom-0.5 -right-0.5 flex gap-0.5">
                                    {!isStoreHoliday && hasVacation && <div className="w-1.5 h-1.5 rounded-full bg-teal-500 border border-white"></div>}
                                    {!isStoreHoliday && hasSickLeave && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 border border-white"></div>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-50 rounded-[2rem] w-full max-w-7xl h-[90vh] shadow-2xl animate-in fade-in zoom-in-95 duration-300 flex flex-col overflow-hidden border border-white/20">

                {/* Header */}
                <div className="bg-white px-8 py-5 flex justify-between items-center border-b border-slate-100 shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-5">
                        <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Planificación Anual</h3>
                            <div className="flex gap-4 mt-1">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                    <div className="w-3 h-3 rounded-full bg-teal-500"></div> Vacaciones
                                </span>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                    <div className="w-3 h-3 rounded-full bg-orange-500"></div> Bajas
                                </span>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                    <div className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></div> Festivos
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                            <button
                                onClick={() => setYear(y => y - 1)}
                                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span className="px-6 font-black text-slate-800 text-lg min-w-[100px] text-center">{year}</span>
                            <button
                                onClick={() => setYear(y => y + 1)}
                                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-10 w-10 rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex grow overflow-hidden">
                    {/* Calendar Grid (Left) */}
                    <div className="grow overflow-y-auto p-8 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {months.map((_, i) => renderMonth(i))}
                        </div>
                    </div>

                    {/* Side Panel (Right) */}
                    <div className="w-96 shrink-0 bg-white border-l border-slate-100 flex flex-col shadow-xl z-10">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Detalles del Día</h4>
                            {selectedDate ? (
                                <div className="space-y-2">
                                    <p className="text-3xl font-black text-slate-900 capitalize leading-none">
                                        {new Date(selectedDate).getDate()}
                                    </p>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 capitalize">
                                            {new Date(selectedDate).toLocaleDateString('es-ES', { month: 'long' })}
                                        </p>
                                        <p className="text-xs text-slate-400 font-medium capitalize">
                                            {new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long' })}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-24 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                                    <p className="text-sm font-bold">Selecciona una fecha</p>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {selectedDate ? (
                                <div className="space-y-6">
                                    {(() => {
                                        const { isStoreHoliday, requests } = getDayEvents(selectedDate);

                                        if (!isStoreHoliday && requests.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                                                    <Briefcase size={40} className="mb-3 opacity-20" />
                                                    <p className="text-sm font-bold">Día Ordinario</p>
                                                    <p className="text-xs">No hay eventos especiales</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-4">
                                                {isStoreHoliday && (
                                                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-4">
                                                        <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm border border-red-100">
                                                            <Briefcase size={18} />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-red-700 text-sm">Festivo en Tienda</p>
                                                            <p className="text-xs text-red-600 font-medium mt-0.5">La tienda permanece cerrada según configuración actual.</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {requests.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Personal Ausente</h5>
                                                        {requests.map(req => {
                                                            const emp = storeEmployees.find(e => e.id === req.employeeId);
                                                            return (
                                                                <div key={req.id} className={clsx(
                                                                    "p-4 rounded-2xl border shadow-sm flex items-center gap-4 transition-all hover:translate-x-1",
                                                                    req.type === 'vacation' ? "bg-teal-50/30 border-teal-100" : "bg-orange-50/30 border-orange-100"
                                                                )}>
                                                                    <div className={clsx(
                                                                        "h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm shadow-inner border",
                                                                        req.type === 'vacation' ? "bg-white text-teal-600 border-teal-100" : "bg-white text-orange-600 border-orange-100"
                                                                    )}>
                                                                        {emp?.name.charAt(0)}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="font-bold text-slate-800 text-sm">{emp?.name}</p>
                                                                        <p className={clsx(
                                                                            "text-[10px] font-black uppercase tracking-wider mt-0.5",
                                                                            req.type === 'vacation' ? "text-teal-600" : "text-orange-600"
                                                                        )}>
                                                                            {req.type === 'vacation' ? 'Vacaciones' : 'Baja Médica'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-60">
                                    <User size={48} className="mb-4" />
                                    <p className="text-sm font-bold">Sin fecha seleccionada</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnnualPlanModal;
