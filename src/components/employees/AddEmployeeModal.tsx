import React, { useState, useEffect } from 'react';
import { DatePicker } from '../DatePicker';
import type { EmployeeCategory, PermanentRequestType } from '../../types';
import clsx from 'clsx';

interface AddEmployeeData {
    name: string;
    category: EmployeeCategory;
    weeklyHours: number;
    seniorityDate: string;
    birthDate: string;
    email: string;
    contractEndDate?: string;
    initials: string;
}

interface AddPermanentRequestData {
    type: PermanentRequestType;
    days?: number[];
}

interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (employeeData: AddEmployeeData, permRequestData?: AddPermanentRequestData) => void;
}

export default function AddEmployeeModal({ isOpen, onClose, onAdd }: AddEmployeeModalProps) {
    // Form State
    const [newName, setNewName] = useState('');
    const [newInitial, setNewInitial] = useState('');
    const [newCategory, setNewCategory] = useState<EmployeeCategory>('Empleado');
    const [newHours, setNewHours] = useState(40);
    const [newSeniority, setNewSeniority] = useState('');
    const [newBirthDate, setNewBirthDate] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [contractEndDate, setContractEndDate] = useState('');
    const [isIndefinite, setIsIndefinite] = useState(false);
    const [isNewEmployee, setIsNewEmployee] = useState(true);

    // Perm Request State
    const [addPermRequest, setAddPermRequest] = useState(false);
    const [addPermType, setAddPermType] = useState<PermanentRequestType>('morning_only');
    const [addPermDays, setAddPermDays] = useState<number[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Reset state when opening
            setNewName('');
            setNewInitial('');
            setNewCategory('Empleado');
            setNewHours(40);
            setNewSeniority('');
            setNewBirthDate('');
            setNewEmail('');
            setContractEndDate('');
            setIsIndefinite(false);
            setIsNewEmployee(true);
            setAddPermRequest(false);
            setAddPermType('morning_only');
            setAddPermDays([]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const employeeData: AddEmployeeData = {
            name: newName,
            category: newCategory,
            weeklyHours: newHours,
            seniorityDate: isNewEmployee ? new Date().toISOString() : newSeniority,
            birthDate: newBirthDate,
            email: newEmail,
            contractEndDate: isIndefinite ? undefined : contractEndDate,
            initials: newInitial.toUpperCase()
        };

        const permRequestData: AddPermanentRequestData | undefined = addPermRequest ? {
            type: addPermType,
            days: addPermDays.length > 0 ? addPermDays : undefined
        } : undefined;

        onAdd(employeeData, permRequestData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Nuevo Empleado</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
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
                            label="Fecha de Nacimiento"
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
                                                    onClick={() => { /* Placeholder */ }}
                                                    className={clsx(
                                                        "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                                                        "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
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
                            onClick={onClose}
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
    );
}
