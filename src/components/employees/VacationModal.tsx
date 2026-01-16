import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { parseLocalDate, formatLocalDate } from '../../services/dateUtils';
import { Plus, Trash2, Plane, X, Users, History } from 'lucide-react';
import { DatePicker } from '../DatePicker';
import { CustomSelect } from '../CustomSelect';
import ConfirmDialog from '../ConfirmDialog';
import clsx from 'clsx';


interface VacationModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedEmployeeId: string | null;
    onEmployeeSelect: (id: string) => void;
}

const VacationModal: React.FC<VacationModalProps> = ({ isOpen, onClose, selectedEmployeeId, onEmployeeSelect }) => {
    const { employees, timeOffRequests, addTimeOff, removeTimeOff, schedules } = useStore();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [planningYear, setPlanningYear] = useState(new Date().getFullYear());
    const [vacationRanges, setVacationRanges] = useState<{ start: string; end: string }[]>([]);
    const [vacStartDate, setVacStartDate] = useState('');
    const [vacEndDate, setVacEndDate] = useState('');

    // Delete confirmation state
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [deletingVacationId, setDeletingVacationId] = useState<string | null>(null);

    // Reset internal state when modal opens or employee changes
    useEffect(() => {
        if (isOpen) {
            setVacationRanges([]);
            setVacStartDate('');
            setVacEndDate('');
        }
    }, [isOpen, selectedEmployeeId]);

    const storeEmployees = employees.filter(e => e.establishmentId === user?.establishmentId && e.active);

    const isDateLocked = (date: Date) => {
        if (!user?.establishmentId) return false;

        // Find Monday of the week
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);

        const mondayStr = formatLocalDate(monday);

        const schedule = schedules.find(s =>
            s.establishmentId === user.establishmentId &&
            s.weekStartDate === mondayStr
        );

        // Block if schedule is approved
        return schedule?.approvalStatus === 'approved';
    };

    const getVacationDaysForYear = (empId: string, year: number) => {
        let count = 0;
        timeOffRequests
            .filter(r => r.employeeId === empId && r.type === 'vacation')
            .forEach(r => {
                r.dates.forEach(d => {
                    if (new Date(d).getFullYear() === year) count++;
                });
            });
        return count;
    };

    const checkOverlap = (start: number, end: number) => {
        // Check local ranges
        const hasLocalOverlap = vacationRanges.some(r => {
            const rStart = parseLocalDate(r.start).getTime();
            const rEnd = parseLocalDate(r.end).getTime();
            return (start <= rEnd && end >= rStart);
        });
        if (hasLocalOverlap) return { type: 'local' };

        // Check db ranges
        if (selectedEmployeeId) {
            // Note: In a real implementation this might need more robust checking against existing requests
            // For now, simple date overlap check if we had full objects, but here we rely on dates array mostly
            // or simple expansion if needed. The original code used a similar check.
            const empRequests = timeOffRequests.filter(r => r.employeeId === selectedEmployeeId && r.type === 'vacation');
            const hasDbOverlap = empRequests.some(r => {
                const rStart = r.startDate ? new Date(r.startDate).getTime() : new Date(r.dates[0]).getTime();
                const rEnd = r.endDate ? new Date(r.endDate).getTime() : new Date(r.dates[r.dates.length - 1]).getTime();
                // Simple intersection
                return (start <= rEnd && end >= rStart);
            });
            if (hasDbOverlap) return { type: 'db' };
        }
        return null;
    };

    const addRange = () => {
        if (!vacStartDate || !vacEndDate) return;
        if (vacStartDate > vacEndDate) {
            showToast('La fecha de fin debe ser posterior a la de inicio', 'error');
            return;
        }

        if (isDateLocked(parseLocalDate(vacStartDate)) || isDateLocked(parseLocalDate(vacEndDate))) {
            showToast('No se pueden añadir vacaciones en semanas con horario bloqueado/aprobado.', 'error');
            return;
        }

        const start = parseLocalDate(vacStartDate).getTime();
        const end = parseLocalDate(vacEndDate).getTime();

        const overlap = checkOverlap(start, end);

        if (overlap) {
            if (overlap.type === 'local') {
                showToast('El rango se solapa con otro de la lista.', 'error');
            } else {
                showToast('El rango se solapa con vacaciones ya existentes.', 'error');
            }
            return;
        }

        setVacationRanges([...vacationRanges, { start: vacStartDate, end: vacEndDate }]);
        setVacStartDate('');
        setVacEndDate('');
    };

    const removeRange = (index: number) => {
        const newRanges = [...vacationRanges];
        newRanges.splice(index, 1);
        setVacationRanges(newRanges);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId) return;

        const rangesToSave = [...vacationRanges];

        // If there is a pending range in inputs, try to add it (optional, but good UX)
        if (vacStartDate && vacEndDate) {
            // Logic to auto-add pending range if valid, or just warn.
            // Original code did this:
            const start = parseLocalDate(vacStartDate).getTime();
            const end = parseLocalDate(vacEndDate).getTime();

            if (isDateLocked(parseLocalDate(vacStartDate)) || isDateLocked(parseLocalDate(vacEndDate))) {
                showToast('El rango pendiente afecta a una semana bloqueada y no se guardará.', 'error');
            } else {
                const overlap = checkOverlap(start, end);
                if (!overlap) {
                    rangesToSave.push({ start: vacStartDate, end: vacEndDate });
                } else {
                    showToast('El rango pendiente se solapa y no se guardará.', 'error');
                }
            }
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

        const usedDays = getVacationDaysForYear(selectedEmployeeId, planningYear);
        if (usedDays + newDaysCount > 31) {
            showToast(`Error: El total (${usedDays + newDaysCount} días) supera el límite de 31 días.`, 'error');
            return;
        }

        // Save
        rangesToSave.forEach(range => {
            const start = parseLocalDate(range.start);
            const end = parseLocalDate(range.end);
            const dates: string[] = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(formatLocalDate(d));
            }
            addTimeOff({
                employeeId: selectedEmployeeId,
                type: 'vacation',
                dates: dates,
                startDate: range.start,
                endDate: range.end
            });
        });

        showToast('Vacaciones registradas correctamente', 'success');
        onClose();
        setVacationRanges([]);
        setVacStartDate('');
        setVacEndDate('');
    };

    const handleDeleteClick = (id: string) => {
        setDeletingVacationId(id);
        setIsConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = () => {
        if (deletingVacationId) {
            removeTimeOff(deletingVacationId);
            showToast('Vacaciones eliminadas', 'info');
            setDeletingVacationId(null);
        }
        setIsConfirmDeleteOpen(false);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                <div className="bg-white rounded-[2rem] w-full max-w-6xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[85vh] overflow-hidden border border-white/20">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                            <div className="p-2.5 bg-teal-50 rounded-xl text-teal-600">
                                <Plane size={24} />
                            </div>
                            Gestión de Vacaciones
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-slate-100">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        {/* LHS: Sidebar Controls */}
                        <div className="w-full md:w-1/3 bg-slate-50/50 p-8 border-r border-slate-100 flex flex-col gap-6 overflow-y-auto custom-scrollbar">

                            <div className="space-y-4">
                                <label className="premium-label-light">Empleado</label>
                                <CustomSelect
                                    options={storeEmployees.map(e => ({ value: e.id, label: e.name }))}
                                    value={selectedEmployeeId || ''}
                                    onChange={(val) => {
                                        onEmployeeSelect(val as string);
                                        setVacationRanges([]);
                                    }}
                                    placeholder="-- Seleccionar --"
                                    icon={Users}
                                />
                            </div>

                            {!selectedEmployeeId ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 gap-4 min-h-[300px]">
                                    <Users size={48} className="text-slate-400" />
                                    <p className="text-sm font-bold text-slate-500 uppercase">Selecciona un empleado<br />para gestionar sus vacaciones</p>
                                </div>
                            ) : (
                                <>
                                    {/* Year Selector */}
                                    <div className="space-y-2">
                                        <label className="premium-label-light">Año de Planificación</label>
                                        <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                                            {[new Date().getFullYear(), new Date().getFullYear() + 1].map(year => (
                                                <button
                                                    key={year}
                                                    type="button"
                                                    onClick={() => setPlanningYear(year)}
                                                    className={clsx(
                                                        "flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                                        planningYear === year
                                                            ? "bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-100"
                                                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                    )}
                                                >
                                                    {year}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Stats Card */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Plane size={80} className="text-teal-900" />
                                        </div>

                                        {(() => {
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            let enjoyed = 0;
                                            let planned = 0;

                                            timeOffRequests
                                                .filter(req => req.employeeId === selectedEmployeeId && req.type === 'vacation')
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
                                                <div className="relative z-10 space-y-6">
                                                    <div className="text-center pb-6 border-b border-slate-50">
                                                        <div className={clsx("text-5xl font-black tracking-tighter mb-2", remaining < 0 ? "text-red-500" : "text-slate-800")}>
                                                            {remaining}
                                                        </div>
                                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Días Disponibles</div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                                            <div className="text-xl font-black text-slate-700">{enjoyed}</div>
                                                            <div className="text-[9px] font-black uppercase text-slate-400">Gozados</div>
                                                        </div>
                                                        <div className="bg-teal-50 rounded-xl p-3 text-center">
                                                            <div className="text-xl font-black text-teal-700">{planned}</div>
                                                            <div className="text-[9px] font-black uppercase text-teal-600">En Plan</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* RHS: Main Content */}
                        <div className="flex-1 bg-white p-8 flex flex-col gap-6 overflow-hidden">
                            {!selectedEmployeeId ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="bg-slate-50 rounded-3xl p-12 text-center border border-slate-100 border-dashed">
                                        <p className="text-slate-400 font-medium">Configuración inactiva</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Action Area: Add New */}
                                    <div className="bg-white rounded-3xl border border-slate-200 p-1 shadow-sm shrink-0">
                                        <div className="bg-slate-50/50 rounded-[20px] p-5 border border-slate-100/50">
                                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                                <div className="flex-1 w-full space-y-4 md:space-y-0 md:flex md:gap-4">
                                                    <div className="flex-1">
                                                        <DatePicker variant="light" label="Desde" value={vacStartDate} onChange={setVacStartDate} isDateDisabled={isDateLocked} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <DatePicker variant="light" label="Hasta" value={vacEndDate} onChange={setVacEndDate} min={vacStartDate} isDateDisabled={isDateLocked} />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addRange}
                                                    disabled={!vacStartDate || !vacEndDate}
                                                    className="h-[52px] px-8 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 active:scale-95 flex items-center gap-2"
                                                >
                                                    <Plus size={16} /> Añadir
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Area: Lists */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">

                                        {/* Staged Ranges */}
                                        {vacationRanges.length > 0 && (
                                            <div className="animate-in slide-in-from-top-4 duration-300">
                                                <div className="flex items-center gap-2 mb-3 px-1">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                    <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Nuevos Periodos (Sin guardar)</span>
                                                </div>
                                                <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 overflow-hidden">
                                                    {vacationRanges.map((range, idx) => (
                                                        <div key={idx} className="p-4 flex justify-between items-center hover:bg-white/50 transition-colors border-b border-indigo-100/50 last:border-0">
                                                            <div className="flex items-center gap-4">
                                                                <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm"><Plane size={16} /></div>
                                                                <div>
                                                                    <div className="text-sm font-black text-slate-800">
                                                                        {new Date(range.start).toLocaleDateString()} — {new Date(range.end).toLocaleDateString()}
                                                                    </div>
                                                                    <div className="text-[10px] font-bold text-indigo-600 uppercase mt-0.5">
                                                                        {Math.ceil((new Date(range.end).getTime() - new Date(range.start).getTime()) / (1000 * 60 * 60 * 24)) + 1} días
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button type="button" onClick={() => removeRange(idx)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                                                <X size={18} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* History List */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3 px-1">
                                                <History size={14} className="text-slate-300" />
                                                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Historial {planningYear}</span>
                                            </div>

                                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                                {(() => {
                                                    const empRequests = timeOffRequests
                                                        .filter(req => req.employeeId === selectedEmployeeId && req.type === 'vacation')
                                                        .filter(req => req.dates.some(d => new Date(d).getFullYear() === planningYear))
                                                        .sort((a, b) => new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime());

                                                    if (empRequests.length === 0) {
                                                        return (
                                                            <div className="py-12 text-center flex flex-col items-center gap-4 opacity-50">
                                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                                    <Plane size={24} className="text-slate-300" />
                                                                </div>
                                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No hay vacaciones registradas este año</p>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="divide-y divide-slate-50">
                                                            {empRequests.map(req => {
                                                                const daysInYear = req.dates.filter(d => new Date(d).getFullYear() === planningYear).length;
                                                                if (daysInYear === 0) return null;

                                                                const startStr = req.startDate || (req.dates && req.dates[0]) || '';
                                                                const endStr = req.endDate || (req.dates && req.dates[req.dates.length - 1]) || '';
                                                                const isPassed = endStr ? new Date(endStr) < new Date() : false;

                                                                return (
                                                                    <div key={req.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all group">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={clsx(
                                                                                "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border bg-white",
                                                                                isPassed ? "text-slate-300 border-slate-100" : "text-teal-600 border-teal-100 shadow-sm"
                                                                            )}>
                                                                                {daysInYear}d
                                                                            </div>
                                                                            <div>
                                                                                <div className={clsx("text-sm font-bold", isPassed ? "text-slate-400" : "text-slate-700")}>
                                                                                    {startStr ? new Date(startStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '?'}
                                                                                    {' - '}
                                                                                    {endStr ? new Date(endStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '?'}
                                                                                </div>
                                                                                <div className={clsx("text-[10px] font-bold uppercase tracking-wider mt-0.5", isPassed ? "text-slate-300" : "text-teal-500")}>
                                                                                    {isPassed ? 'Finalizado' : 'Programado'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteClick(req.id);
                                                                            }}
                                                                            className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Button */}
                                    <div className="pt-4 border-t border-slate-100 shrink-0">
                                        <button
                                            type="submit"
                                            disabled={vacationRanges.length === 0}
                                            className="w-full py-4 bg-teal-600 text-white font-black text-xs uppercase tracking-widest hover:bg-teal-700 rounded-xl shadow-lg shadow-teal-600/20 active:scale-95 transition-all disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-3"
                                        >
                                            <div className="p-1 bg-white/20 rounded-lg"><Plane size={16} /></div>
                                            Guardar Planificación ({vacationRanges.length})
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            <ConfirmDialog
                isOpen={isConfirmDeleteOpen}
                onCancel={() => setIsConfirmDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Eliminar Vacaciones"
                message="¿Estás seguro de que deseas eliminar este periodo de vacaciones? Esta acción no se puede deshacer."
                isDestructive={true}
            />
        </>
    );
};

export default VacationModal;
