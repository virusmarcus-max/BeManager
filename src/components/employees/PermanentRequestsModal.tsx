import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Trash2, Clock, Users } from 'lucide-react';
import clsx from 'clsx';
import { DatePicker } from '../DatePicker';
import { CustomSelect } from '../CustomSelect';
import type { Employee, PermanentRequest, PermanentRequestType } from '../../types';

interface PermanentRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    requests: PermanentRequest[];
    onAdd: (req: any) => void;
    onRemove: (id: string) => void;
    initialEmployeeId?: string | null;
}

const PermanentRequestsModal: React.FC<PermanentRequestsModalProps> = ({
    isOpen,
    onClose,
    employees,
    requests,
    onAdd,
    onRemove,
    initialEmployeeId
}) => {
    const [permEmpId, setPermEmpId] = useState<string | null>(initialEmployeeId || null);
    const [newPermType, setNewPermType] = useState<PermanentRequestType>('morning_only');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [maxAfternoons, setMaxAfternoons] = useState(3);
    const [isConfirmDeletePermOpen, setIsConfirmDeletePermOpen] = useState(false);
    const [reqToDelete, setReqToDelete] = useState<string | null>(null);

    // Rotating Days State
    const [rotatingCycleWeeks, setRotatingCycleWeeks] = useState(2);
    const [rotatingCycleDays, setRotatingCycleDays] = useState<number[][]>([[], []]); // [[week1days], [week2days]]
    const [rotatingRefDate, setRotatingRefDate] = useState('');
    const [fixedRotatingStartDay, setFixedRotatingStartDay] = useState<number>(1); // 1 = Monday

    useEffect(() => {
        if (isOpen && initialEmployeeId) {
            setPermEmpId(initialEmployeeId);
        }
    }, [isOpen, initialEmployeeId]);

    // Reset form when employee changes
    useEffect(() => {
        setNewPermType('morning_only');
        setSelectedDays([]);
        setMaxAfternoons(3);
        setRotatingCycleWeeks(2);
        setRotatingCycleDays([[], []]);
        setRotatingRefDate('');
        setFixedRotatingStartDay(1);
    }, [permEmpId]);

    if (!isOpen) return null;

    const employeePermRequests = requests.filter(r => r.employeeId === permEmpId);
    const filteredEmployees = employees.filter(e => e.active);

    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const handleAddClick = async () => {
        if (!permEmpId) return;
        const emp = employees.find(e => e.id === permEmpId);

        if (newPermType === 'fixed_rotating_shift' && emp && emp.weeklyHours < 40) {
            alert('El turno rotativo fijo solo es aplicable a empleados de 40 horas');
            return;
        }

        if (newPermType === 'rotating_days_off' || newPermType === 'fixed_rotating_shift') {
            if (!rotatingRefDate) {
                alert('Selecciona una fecha de inicio para el ciclo (Lunes)');
                return;
            }
        }

        const requestData: any = {
            employeeId: permEmpId,
            type: newPermType,
        };

        if (newPermType === 'max_afternoons_per_week') {
            requestData.value = maxAfternoons;
        } else if (newPermType === 'rotating_days_off') {
            const weeksData = Array.from({ length: rotatingCycleWeeks }).map((_, i) => ({
                days: rotatingCycleDays[i] || []
            }));
            requestData.cycleWeeks = weeksData;
            requestData.referenceDate = rotatingRefDate;
        } else if (newPermType === 'fixed_rotating_shift') {
            requestData.referenceDate = rotatingRefDate;
            requestData.value = fixedRotatingStartDay;
        } else {
            requestData.days = selectedDays;
        }

        try {
            await onAdd(requestData);
            // Only reset if successful
            // Reset logic is in useEffect dependent on permEmpId, or manually here?
            // The user might want to add another restriction for the same employee, so we shouldn't reset permEmpId.
            // But we might want to reset the form fields.
            setNewPermType('morning_only');
            setSelectedDays([]);
            setMaxAfternoons(3);
            setRotatingCycleWeeks(2);
            setRotatingCycleDays([[], []]);
            setRotatingRefDate('');
            setFixedRotatingStartDay(1);

            // Initial employee reset? No, keep selected.
        } catch (error) {
            console.error("Failed to add component request", error);
            alert("Error al guardar la petición. Revisa la consola.");
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Peticiones</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <div className={clsx("flex-1 pr-2", permEmpId ? "overflow-y-auto custom-scrollbar" : "overflow-visible")}>
                    {!permEmpId ? (
                        <div className="mb-8">
                            <label className="premium-label-light">Selecciona Empleado</label>
                            <CustomSelect
                                options={filteredEmployees.map(e => ({ value: e.id, label: e.name }))}
                                value={permEmpId || ''}
                                onChange={(val) => setPermEmpId(val as string)}
                                placeholder="-- Seleccionar --"
                                icon={Users}
                            />
                        </div>
                    ) : (
                        <div className="mb-6 flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Empleado Seleccionado</p>
                                <p className="text-xl font-black text-slate-900 tracking-tight">{employees.find(e => e.id === permEmpId)?.name}</p>
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
                                                        req.type === 'max_afternoons_per_week' ? `Máximo ${req.value} Tardes / Semana` :
                                                            req.type === 'force_full_days' ? 'Descanso en Días Completos' :
                                                                req.type === 'rotating_days_off' ? 'Días Rotativos (Ciclos)' :
                                                                    req.type === 'early_morning_shift' ? 'Entrada 9:00' :
                                                                        req.type === 'fixed_rotating_shift' ? 'Turno Rotativo Fijo' : 'Días Libres Fijos'}
                                            </div>
                                            {(req.days && req.days.length > 0) && (
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                                    {req.days.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ')}
                                                </div>
                                            )}
                                            {req.type === 'rotating_days_off' && (
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 flex flex-col gap-1">
                                                    <span>Ciclo de {req.cycleWeeks?.length || 2} semanas (Inicio: {req.referenceDate ? new Date(req.referenceDate).toLocaleDateString() : '?'})</span>
                                                    {req.cycleWeeks?.map((weekData, i) => (
                                                        <span key={i} className="text-slate-400 pl-2">
                                                            Semana {i + 1}: {weekData.days && weekData.days.length > 0
                                                                ? weekData.days.map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ')
                                                                : 'Sin libranza'}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {req.type === 'fixed_rotating_shift' && (
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                                    Rotativo - Empieza: {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][req.value || 0]}
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
                                    <CustomSelect
                                        options={[
                                            { value: "morning_only", label: "Solo Mañanas" },
                                            { value: "afternoon_only", label: "Solo Tardes" },
                                            { value: "specific_days_off", label: "Días Libres Fijos" },
                                            { value: "rotating_days_off", label: "Turnos Rotativos (Libranzas Alternas)" },
                                            { value: "fixed_rotating_shift", label: "Turno Rotativo Fijo (Salto de día)" },
                                            { value: "max_afternoons_per_week", label: "Máximo de Tardes Semanales" },
                                            { value: "force_full_days", label: "Descanso en Días Completos" },
                                            { value: "early_morning_shift", label: "Entrada 9:00 (Bloque 9-14h)" },
                                        ]}
                                        value={newPermType}
                                        onChange={(val) => setNewPermType(val as PermanentRequestType)}
                                        placeholder="Seleccionar tipo de restricción..."
                                        icon={Clock}
                                    />

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
                                                                // Safer resize logic
                                                                const newArr = Array.from({ length: n }, (_, i) => rotatingCycleDays[i] || []);
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
                                        ) : newPermType === 'fixed_rotating_shift' ? (
                                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                                                <div className="flex gap-4">
                                                    <div className="flex-1">
                                                        <label className="premium-label-light">Semana Inicio</label>
                                                        <DatePicker variant="light"
                                                            value={rotatingRefDate}
                                                            onChange={setRotatingRefDate}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="premium-label-light">Libranza Inicial</label>
                                                        <select
                                                            value={fixedRotatingStartDay}
                                                            onChange={(e) => setFixedRotatingStartDay(Number(e.target.value))}
                                                            className="premium-select-light w-full text-xs"
                                                        >
                                                            <option value={1} className="bg-white text-slate-900">Lunes</option>
                                                            <option value={2} className="bg-white text-slate-900">Martes</option>
                                                            <option value={3} className="bg-white text-slate-900">Miércoles</option>
                                                            <option value={4} className="bg-white text-slate-900">Jueves</option>
                                                            <option value={5} className="bg-white text-slate-900">Viernes</option>
                                                            <option value={6} className="bg-white text-slate-900">Sábado</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-3">
                                                    <AlertCircle size={16} className="text-indigo-600 shrink-0" />
                                                    <p className="text-[10px] text-indigo-600 font-medium leading-relaxed uppercase">
                                                        El día de descanso rotará cada semana: Lunes → Martes → ... → Sábado → Lunes.
                                                    </p>
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
                                        onClick={handleAddClick}
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

            {/* Sub-confirmation for delete */}
            {isConfirmDeletePermOpen && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-black text-slate-900 mb-2">Eliminar Petición</h3>
                        <p className="text-sm text-slate-500 mb-6">¿Estás seguro de que quieres eliminar esta restricción?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setIsConfirmDeletePermOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancelar</button>
                            <button onClick={() => {
                                if (reqToDelete) onRemove(reqToDelete);
                                setIsConfirmDeletePermOpen(false);
                                setReqToDelete(null);
                            }} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermanentRequestsModal;
