import React, { useState, useEffect } from 'react';
import { DatePicker } from '../DatePicker';
import { CustomSelect } from '../CustomSelect';
import { Briefcase, Clock, UserMinus } from 'lucide-react';
import type { EmployeeCategory } from '../../types';
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
    contractType: 'indefinido' | 'temporal' | 'sustitucion';
    substitutingId?: string;
}



interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (employeeData: AddEmployeeData) => void;
    sickEmployees: { id: string; name: string }[];
}

export default function AddEmployeeModal({ isOpen, onClose, onAdd, sickEmployees }: AddEmployeeModalProps) {
    // Form State
    const [newName, setNewName] = useState('');
    const [newInitial, setNewInitial] = useState('');
    const [newCategory, setNewCategory] = useState<EmployeeCategory>('Empleado');
    const [newHours, setNewHours] = useState(40);
    const [newSeniority, setNewSeniority] = useState('');
    const [newBirthDate, setNewBirthDate] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [contractEndDate, setContractEndDate] = useState('');
    const [contractType, setContractType] = useState<'indefinido' | 'temporal' | 'sustitucion'>('indefinido');
    const [substitutionId, setSubstitutionId] = useState('');
    const [isNewEmployee, setIsNewEmployee] = useState(true);



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
            setContractType('indefinido');
            setSubstitutionId('');
            setIsNewEmployee(true);

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
            contractEndDate: contractType === 'indefinido' ? undefined : contractEndDate,
            initials: newInitial.toUpperCase(),
            contractType,
            substitutingId: contractType === 'sustitucion' ? substitutionId : undefined
        };

        onAdd(employeeData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nuevo Empleado</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">Completa la información para dar de alta un nuevo trabajador.</p>
                    </div>
                    <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100">
                        Alta de Personal
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* LEFT COLUMN: PERSONAL INFO */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
                                Información Personal
                            </h3>

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
                                <div className="w-24">
                                    <label className="premium-label-light">Iniciales</label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        value={newInitial}
                                        onChange={e => setNewInitial(e.target.value.toUpperCase())}
                                        className="premium-input-light w-full uppercase text-center font-bold text-indigo-900"
                                        placeholder="JP"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="premium-label-light">Email de Contacto</label>
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
                        </div>

                        {/* RIGHT COLUMN: WORK INFO */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
                                Datos del Puesto
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="premium-label-light">Categoría</label>
                                    <CustomSelect
                                        value={newCategory}
                                        onChange={(val) => setNewCategory(val as EmployeeCategory)}
                                        options={[
                                            { value: 'Empleado', label: 'Empleado' },
                                            { value: 'Responsable', label: 'Responsable' },
                                            { value: 'Subgerente', label: 'Subgerente' },
                                            { value: 'Gerente', label: 'Gerente' },
                                            { value: 'Limpieza', label: 'Limpieza' }
                                        ]}
                                        icon={Briefcase}
                                    />
                                </div>
                                <div>
                                    <label className="premium-label-light">Horas/Semana</label>
                                    <CustomSelect
                                        value={newHours}
                                        onChange={(val) => setNewHours(Number(val))}
                                        options={Array.from({ length: 15 }, (_, i) => 12 + (i * 2)).map(h => ({
                                            value: h,
                                            label: `${h}h`
                                        }))}
                                        icon={Clock}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="premium-label-light">Antigüedad</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl mb-3 border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setIsNewEmployee(true)}
                                        className={clsx(
                                            "flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all",
                                            isNewEmployee ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        Nuevo Ingreso
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsNewEmployee(false)}
                                        className={clsx(
                                            "flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all",
                                            !isNewEmployee ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        Ya en Plantilla
                                    </button>
                                </div>

                                {!isNewEmployee && (
                                    <div className="animate-in fade-in slide-in-from-top-1">
                                        <DatePicker variant="light"
                                            label="Fecha de Inicio Real"
                                            value={newSeniority}
                                            onChange={setNewSeniority}
                                            required={!isNewEmployee}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* FULL WIDTH: CONTRACT DETAILS */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">
                            Detalles del Contrato
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div>
                                <label className="premium-label-light mb-2 block">Tipo de Contrato</label>
                                <div className="grid grid-cols-3 gap-2 p-1 bg-white border border-slate-200 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setContractType('indefinido')}
                                        className={clsx(
                                            "py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                            contractType === 'indefinido' ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "text-slate-400 hover:bg-slate-50"
                                        )}
                                    >
                                        Indefinido
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setContractType('temporal')}
                                        className={clsx(
                                            "py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                            contractType === 'temporal' ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "text-slate-400 hover:bg-slate-50"
                                        )}
                                    >
                                        Temporal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setContractType('sustitucion')}
                                        className={clsx(
                                            "py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                            contractType === 'sustitucion' ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "text-slate-400 hover:bg-slate-50"
                                        )}
                                    >
                                        Sustitución
                                    </button>
                                </div>
                            </div>

                            {/* Conditional Contract Fields */}
                            <div>
                                {contractType === 'temporal' && (
                                    <div className="animate-in fade-in slide-in-from-left-2">
                                        <DatePicker variant="light"
                                            label="Fecha Fin Contrato"
                                            value={contractEndDate}
                                            onChange={setContractEndDate}
                                            required={true}
                                        />
                                    </div>
                                )}

                                {contractType === 'sustitucion' && (
                                    <div className="animate-in fade-in slide-in-from-left-2">
                                        <label className="premium-label-light">Sustituir a (Baja Médica)</label>
                                        <CustomSelect
                                            value={substitutionId}
                                            onChange={(val) => setSubstitutionId(val as string)}
                                            options={sickEmployees.map(emp => ({
                                                value: emp.id,
                                                label: emp.name
                                            }))}
                                            placeholder="Seleccionar empleado..."
                                            icon={UserMinus}
                                        />
                                        {sickEmployees.length === 0 && (
                                            <p className="text-[10px] font-bold text-amber-600 mt-2 uppercase tracking-widest px-1">⚠️ No hay bajas activas</p>
                                        )}
                                    </div>
                                )}

                                {contractType === 'indefinido' && (
                                    <div className="h-[68px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl">
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Sin fecha de fin</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-4 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-200"
                        >
                            Cancelar Operación
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="text-lg">+</span> Crear Ficha de Empleado
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
