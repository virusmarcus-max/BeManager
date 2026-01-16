import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { TrendingUp, X, Trash2, Users } from 'lucide-react';
import { DatePicker } from '../DatePicker';
import { CustomSelect } from '../CustomSelect';
import ConfirmDialog from '../ConfirmDialog';

interface TempHoursModalProps {
    isOpen: boolean;
    onClose: () => void;
    preSelectedEmployeeId?: string;
    editData?: { empId: string, adjId: string } | null;
}

const TempHoursModal: React.FC<TempHoursModalProps> = ({ isOpen, onClose, preSelectedEmployeeId, editData }) => {
    const { employees, addTempHours, removeTempHours, schedules } = useStore();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [tempEmpId, setTempEmpId] = useState('');
    const [tempStart, setTempStart] = useState('');
    const [tempEnd, setTempEnd] = useState('');
    const [tempHoursVal, setTempHoursVal] = useState(40);

    // For delete confirmation within the modal
    const [deletingTempId, setDeletingTempId] = useState<{ empId: string, adjId: string } | null>(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    const activeEmployees = employees.filter(e => e.establishmentId === user?.establishmentId && e.active);
    const filteredEmployees = activeEmployees; // Can add more filters if needed

    useEffect(() => {
        if (isOpen) {
            if (editData) {
                const emp = employees.find(e => e.id === editData.empId);
                const adj = emp?.tempHours?.find(h => h.id === editData.adjId);
                if (emp && adj) {
                    setTempEmpId(emp.id);
                    setTempStart(adj.start);
                    setTempEnd(adj.end);
                    setTempHoursVal(adj.hours);
                }
            } else if (preSelectedEmployeeId) {
                setTempEmpId(preSelectedEmployeeId);
                const emp = employees.find(e => e.id === preSelectedEmployeeId);
                if (emp) {
                    setTempHoursVal(Math.min(40, emp.weeklyHours + 4));
                }
                setTempStart('');
                setTempEnd('');
            } else {
                setTempEmpId('');
                setTempStart('');
                setTempEnd('');
                setTempHoursVal(40);
            }
        }
    }, [isOpen, editData, preSelectedEmployeeId, employees]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempEmpId || !tempStart || !tempEnd) {
            showToast('Completa todos los campos', 'error');
            return;
        }

        if (editData) {
            removeTempHours(editData.empId, editData.adjId);
        }

        // VALIDATION: Check if schedule is closed (approved) for the requested range
        const startD = new Date(tempStart);
        const endD = new Date(tempEnd);

        // Normalize time to avoid issues
        startD.setHours(0, 0, 0, 0);
        endD.setHours(23, 59, 59, 999);

        const hasClosedSchedule = schedules.some(s => {
            if (s.establishmentId !== user?.establishmentId) return false;

            // Check if schedule is effectively closed (Published and not Rejected)
            // If it's pending approval or approved, it should be locked.
            // If it's draft or rejected, it's open.
            const isLocked = s.status === 'published' && s.approvalStatus !== 'rejected';

            if (!isLocked) return false;

            const sStart = new Date(s.weekStartDate);
            sStart.setHours(0, 0, 0, 0);
            const sEnd = new Date(sStart);
            sEnd.setDate(sEnd.getDate() + 6);
            sEnd.setHours(23, 59, 59, 999);

            // Check overlap
            return (startD <= sEnd && endD >= sStart);
        });

        if (hasClosedSchedule) {
            showToast('No se pueden modificar horas en semanas con horario cerrado o pendiente de aprobación', 'error');
            return;
        }

        addTempHours(tempEmpId, {
            hours: tempHoursVal,
            start: tempStart,
            end: tempEnd
        });

        showToast(editData ? 'Ampliación editada' : 'Horas ampliadas correctamente', 'success');
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                            <TrendingUp className="text-orange-500" /> Ampliación
                        </h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="premium-label-light">Empleado</label>
                            <CustomSelect
                                options={filteredEmployees
                                    .filter(e => e.weeklyHours < 40)
                                    .map(e => ({ value: e.id, label: `${e.name} (${e.weeklyHours}h)` }))}
                                value={tempEmpId}
                                onChange={(val) => {
                                    setTempEmpId(val as string);
                                    const selectedEmp = employees.find(emp => emp.id === val);
                                    if (selectedEmp) {
                                        setTempHoursVal(Math.min(40, selectedEmp.weeklyHours + 4));
                                    }
                                }}
                                placeholder="-- Seleccionar --"
                                disabled={!!editData}
                                icon={Users}
                            />
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
                            <button type="button" onClick={onClose} className="flex-1 px-4 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
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
                                                        setIsConfirmDeleteOpen(true);
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

            <ConfirmDialog
                isOpen={isConfirmDeleteOpen}
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
                    setIsConfirmDeleteOpen(false);
                }}
                onCancel={() => {
                    setIsConfirmDeleteOpen(false);
                    setDeletingTempId(null);
                }}
                isDestructive={true}
            />
        </>
    );
};

export default TempHoursModal;
