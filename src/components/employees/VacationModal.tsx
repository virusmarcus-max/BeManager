import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { parseLocalDate, formatLocalDate } from '../../services/dateUtils';
import { Plus, Trash2, Plane, AlertCircle, X } from 'lucide-react';
import { DatePicker } from '../DatePicker';
import ConfirmDialog from '../ConfirmDialog';
import clsx from 'clsx';


interface VacationModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedEmployeeId: string | null;
    onEmployeeSelect: (id: string) => void;
}

const VacationModal: React.FC<VacationModalProps> = ({ isOpen, onClose, selectedEmployeeId, onEmployeeSelect }) => {
    const { employees, timeOffRequests, addTimeOff, removeTimeOff } = useStore();
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
            const overlap = checkOverlap(start, end);
            if (!overlap) {
                rangesToSave.push({ start: vacStartDate, end: vacEndDate });
            } else {
                showToast('El rango pendiente se solapa y no se guardará.', 'error');
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
                <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                            <Plane className="text-teal-600" /> Vacaciones
                        </h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-2">
                        <div>
                            <label className="premium-label-light">Selecciona Empleado</label>
                            <select
                                className="premium-select-light w-full"
                                onChange={(e) => {
                                    onEmployeeSelect(e.target.value);
                                    setVacationRanges([]);
                                }}
                                value={selectedEmployeeId || ''}
                                required
                            >
                                <option value="" className="bg-white text-slate-900">-- Seleccionar --</option>
                                {storeEmployees.map(e => (
                                    <option key={e.id} value={e.id} className="bg-white text-slate-900">{e.name}</option>
                                ))}
                            </select>
                        </div>

                        {!selectedEmployeeId ? (
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
                                                .filter(req => req.employeeId === selectedEmployeeId && req.type === 'vacation')
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
                                                                        handleDeleteClick(req.id);
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
