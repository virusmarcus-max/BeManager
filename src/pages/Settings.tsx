import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import {
    Save, Calendar as CalendarIcon, Clock, Mail, User, Phone, MapPin,
    BadgeCheck, Store, Briefcase, ShoppingCart, Package, Truck, Sparkles,
    UserCheck, ChevronDown
} from 'lucide-react';
import type { StoreSettings, WorkRole, RoleScheduleConfig } from '../types';
import { DatePicker } from '../components/DatePicker';
import { CustomTimePicker } from '../components/CustomTimePicker';

const SettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { getSettings, updateSettings } = useStore();

    if (!user) return null;

    const [formData, setFormData] = useState<StoreSettings>(getSettings(user.establishmentId));
    const [dirty, setDirty] = useState(false);
    const [newHoliday, setNewHoliday] = useState('');
    const [newHolidayType, setNewHolidayType] = useState<'full' | 'afternoon' | 'closed_afternoon'>('full');

    useEffect(() => {
        setFormData(getSettings(user.establishmentId));
    }, [user.establishmentId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (field: keyof StoreSettings, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setDirty(true);
    };

    const handleTimeChange = (key: keyof StoreSettings['openingHours'], value: string) => {
        setFormData(prev => ({
            ...prev,
            openingHours: {
                ...prev.openingHours,
                [key]: value
            }
        }));
        setDirty(true);
    };

    const handleRoleScheduleChange = (role: WorkRole, field: keyof RoleScheduleConfig, value: string) => {
        setFormData(prev => {
            const currentRoleConfig = prev.roleSchedules?.[role] || { startTime: '', endTime: '', type: 'morning' };

            const updatedConfig = {
                ...currentRoleConfig,
                [field]: value
            };

            // Reset unrelated fields when switching types
            if (field === 'type') {
                if (value === 'morning') {
                    updatedConfig.morningEndTime = undefined;
                    updatedConfig.afternoonStartTime = undefined;
                } else if (value === 'afternoon') {
                    updatedConfig.morningEndTime = undefined;
                    updatedConfig.afternoonStartTime = undefined;
                }
            }

            return {
                ...prev,
                roleSchedules: {
                    ...prev.roleSchedules,
                    [role]: updatedConfig
                } as Record<WorkRole, RoleScheduleConfig>
            };
        });
        setDirty(true);
    };

    const renderRoleConfig = (role: WorkRole, label: string, Icon: React.ElementType, colorClass: string) => {
        const config = formData.roleSchedules?.[role] || { startTime: '', endTime: '', type: 'morning' };

        return (
            <div className="group relative bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-200 rounded-2xl p-5 transition-all hover:shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${colorClass.replace('text-', 'bg-').replace('600', '100')} ${colorClass}`}>
                            <Icon size={20} />
                        </div>
                        <span className="font-bold text-slate-700 text-sm tracking-tight">{label}</span>
                    </div>

                    <div className="relative">
                        <select
                            value={config.type}
                            onChange={(e) => handleRoleScheduleChange(role, 'type', e.target.value)}
                            className="appearance-none bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
                        >
                            <option value="morning">Turno Mañana</option>
                            <option value="afternoon">Turno Tarde</option>
                            <option value="split">Turno Partido</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex items-center justify-end border-t border-slate-100 pt-3 mt-1">
                    <div className="flex gap-2">
                        {/* Morning / Start Time */}
                        {(config.type === 'morning' || config.type === 'split') && (
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Entrada</span>
                                <CustomTimePicker
                                    value={config.startTime || ''}
                                    onChange={(val) => handleRoleScheduleChange(role, 'startTime', val)}
                                // placeholder={formData.openingHours.morningStart}
                                />
                                <span className="text-slate-300 mx-1">|</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Salida</span>
                                <CustomTimePicker
                                    value={config.type === 'split' ? (config.morningEndTime || '') : (config.endTime || '')}
                                    onChange={(val) => handleRoleScheduleChange(role, config.type === 'split' ? 'morningEndTime' : 'endTime', val)}
                                // placeholder={formData.openingHours.morningEnd}
                                />
                            </div>
                        )}

                        {/* Split Separator */}
                        {config.type === 'split' && (
                            <div className="flex items-center justify-center w-6 text-slate-300">
                                <Clock size={14} />
                            </div>
                        )}

                        {/* Afternoon Time */}
                        {(config.type === 'afternoon' || config.type === 'split') && (
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Entrada</span>
                                <CustomTimePicker
                                    value={config.type === 'split' ? (config.afternoonStartTime || '') : (config.startTime || '')}
                                    onChange={(val) => handleRoleScheduleChange(role, config.type === 'split' ? 'afternoonStartTime' : 'startTime', val)}
                                // placeholder={formData.openingHours.afternoonStart}
                                />
                                <span className="text-slate-300 mx-1">|</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Salida</span>
                                <CustomTimePicker
                                    value={config.endTime || ''}
                                    onChange={(val) => handleRoleScheduleChange(role, 'endTime', val)}
                                // placeholder={formData.openingHours.afternoonEnd}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateSettings(formData);
        setDirty(false);
        // Show simplified toast/alert
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom duration-300 flex items-center gap-2 z-50';
        toast.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Configuración guardada correctamente';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    const toggleHoliday = (date: string) => {
        setFormData(prev => {
            const exists = prev.holidays.some(h => h.date === date);
            const newHolidays = exists
                ? prev.holidays.filter(h => h.date !== date)
                : [...prev.holidays, { date, type: 'full' as const }].sort((a, b) => a.date.localeCompare(b.date));
            return { ...prev, holidays: newHolidays };
        });
        setDirty(true);
    };

    const addHoliday = () => {
        if (!newHoliday) return;
        const exists = formData.holidays.some(h => h.date === newHoliday);

        if (exists) {
            alert('Este festivo ya está en la lista.');
            return;
        }

        setFormData(prev => {
            return {
                ...prev,
                holidays: [...prev.holidays, { date: newHoliday, type: newHolidayType }].sort((a, b) => a.date.localeCompare(b.date))
            };
        });
        setDirty(true);
        setNewHoliday('');
        setNewHolidayType('full');
    };

    return (
        <div className="max-w-6xl mx-auto pb-20">
            {/* Header Section */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración del Establecimiento</h1>
                    <p className="text-slate-500 mt-2 text-lg">Gestiona la información comercial, horarios y calendario laboral de {user.establishmentName}.</p>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={!dirty}
                    className={`
                        flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-md
                        ${dirty
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 hover:shadow-indigo-200'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                    `}
                >
                    <Save size={20} />
                    Guardar Cambios
                </button>

            </div>



            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Basic Info & Contact */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Tarjeta: Información General */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                <Store className="text-indigo-600" size={24} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-lg">Datos Comerciales</h2>
                                <p className="text-slate-500 text-xs">Información básica visible</p>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre del Establecimiento</label>
                                <input
                                    type="text"
                                    value={formData.storeName}
                                    onChange={e => handleChange('storeName', e.target.value)}
                                    placeholder={user.establishmentName}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Gerente Responsable</label>
                                <div className="relative group">
                                    <User size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="text"
                                        value={formData.managerName}
                                        onChange={e => handleChange('managerName', e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                                        placeholder="Nombre completo"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Teléfono de Contacto</label>
                                <div className="relative group">
                                    <Phone size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="tel"
                                        value={formData.phone || ''}
                                        onChange={e => handleChange('phone', e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                                        placeholder="+34 000 000 000"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Corporativo</label>
                                <div className="relative group">
                                    <Mail size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="email"
                                        value={formData.contactEmail}
                                        onChange={e => handleChange('contactEmail', e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                                        placeholder="ejemplo@empresa.com"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta: Ubicación */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                <MapPin className="text-rose-600" size={24} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-lg">Ubicación Física</h2>
                                <p className="text-slate-500 text-xs">Dirección del local</p>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Dirección Completa</label>
                                <input
                                    type="text"
                                    value={formData.address || ''}
                                    onChange={e => handleChange('address', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                                    placeholder="Calle Principal, 123"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Ciudad</label>
                                <input
                                    type="text"
                                    value={formData.city || ''}
                                    onChange={e => handleChange('city', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                                    placeholder="Ej: Madrid"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Código Postal</label>
                                <input
                                    type="text"
                                    value={formData.zipCode || ''}
                                    onChange={e => handleChange('zipCode', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                                    placeholder="28001"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Schedule & Hours */}
                <div className="space-y-8">
                    {/* Tarjeta: Horarios */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                <Clock className="text-amber-500" size={24} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-lg">Horario Laboral</h2>
                                <p className="text-slate-500 text-xs">Apertura y cierre diario</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <div className="flex items-center gap-2 mb-3 text-amber-800 font-bold uppercase text-xs tracking-wider">
                                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                    Turno de Mañana
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={formData.openingHours.morningStart}
                                        onChange={(e) => handleTimeChange('morningStart', e.target.value)}
                                        className="flex-1 text-center bg-white border border-amber-200 text-amber-900 rounded-lg py-2 font-mono font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                    <span className="text-amber-300 font-bold">-</span>
                                    <input
                                        type="time"
                                        value={formData.openingHours.morningEnd}
                                        onChange={(e) => handleTimeChange('morningEnd', e.target.value)}
                                        className="flex-1 text-center bg-white border border-amber-200 text-amber-900 rounded-lg py-2 font-mono font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div className="flex items-center gap-2 mb-3 text-indigo-800 font-bold uppercase text-xs tracking-wider">
                                    <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                    Turno de Tarde
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={formData.openingHours.afternoonStart}
                                        onChange={(e) => handleTimeChange('afternoonStart', e.target.value)}
                                        className="flex-1 text-center bg-white border border-indigo-200 text-indigo-900 rounded-lg py-2 font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <span className="text-indigo-300 font-bold">-</span>
                                    <input
                                        type="time"
                                        value={formData.openingHours.afternoonEnd}
                                        onChange={(e) => handleTimeChange('afternoonEnd', e.target.value)}
                                        className="flex-1 text-center bg-white border border-indigo-200 text-indigo-900 rounded-lg py-2 font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta: FESTIVOS */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                <CalendarIcon className="text-red-500" size={24} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-lg">Festivos y Cierres</h2>
                                <p className="text-slate-500 text-xs">Gestión de días no laborables</p>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="flex gap-2 mb-4">
                                <DatePicker
                                    value={newHoliday}
                                    onChange={setNewHoliday}
                                    className="flex-1 min-w-0"
                                    variant="light"
                                />
                                <button
                                    type="button"
                                    onClick={addHoliday}
                                    className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
                                >
                                    +
                                </button>
                            </div>
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors border ${newHolidayType === 'full' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <input type="radio" className="hidden" name="holidayType" checked={newHolidayType === 'full'} onChange={() => setNewHolidayType('full')} />
                                    Día Completo
                                </label>
                                <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors border ${newHolidayType === 'afternoon' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <input type="radio" className="hidden" name="holidayType" checked={newHolidayType === 'afternoon'} onChange={() => setNewHolidayType('afternoon')} />
                                    Tarde Festiva
                                </label>
                                <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors border ${newHolidayType === 'closed_afternoon' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <input type="radio" className="hidden" name="holidayType" checked={newHolidayType === 'closed_afternoon'} onChange={() => setNewHolidayType('closed_afternoon')} />
                                    Cierre Tarde
                                </label>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {formData.holidays.length === 0 ? (
                                    <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 italic text-sm">
                                        No hay festivos añadidos
                                    </div>
                                ) : (
                                    formData.holidays.map((h: any) => {
                                        const date = h.date;
                                        const type = h.type;
                                        const dateObj = new Date(date);

                                        let typeLabel = '';
                                        let typeStyle = '';
                                        let iconStyle = '';

                                        if (type === 'full') {
                                            typeLabel = 'Cerrado';
                                            typeStyle = 'text-red-500';
                                            iconStyle = 'bg-red-50 border-red-100 text-red-600';
                                        } else if (type === 'afternoon') {
                                            typeLabel = 'Tarde Festiva';
                                            typeStyle = 'text-orange-500';
                                            iconStyle = 'bg-orange-50 border-orange-100 text-orange-600';
                                        } else {
                                            typeLabel = 'Cierre Tarde';
                                            typeStyle = 'text-indigo-500';
                                            iconStyle = 'bg-indigo-50 border-indigo-100 text-indigo-600';
                                        }

                                        return (
                                            <div key={date} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-red-100 hover:shadow-sm transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center border ${iconStyle}`}>
                                                        <span className="text-[10px] font-bold uppercase leading-none">{dateObj.toLocaleDateString(undefined, { month: 'short' }).slice(0, 3)}</span>
                                                        <span className="text-lg font-bold leading-none">{dateObj.getDate()}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-700">{dateObj.toLocaleDateString(undefined, { weekday: 'long' })}</span>
                                                        <span className={`text-[10px] font-bold uppercase ${typeStyle}`}>
                                                            {typeLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleHoliday(date)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <BadgeCheck size={16} className="hidden" />
                                                    {/* Using X icon logic but visually clean */}
                                                    &times;
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta: Horarios por Puesto */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                <Briefcase className="text-emerald-600" size={24} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-lg">Horarios Específicos</h2>
                                <p className="text-slate-500 text-xs">Configuración por puesto</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {renderRoleConfig('sales_register', 'Caja de Ventas', ShoppingCart, 'text-blue-600')}
                            {renderRoleConfig('purchase_register', 'Caja de Compras', Package, 'text-orange-600')}
                            {renderRoleConfig('shuttle', 'Lanzadera', Truck, 'text-purple-600')}
                            {renderRoleConfig('cleaning', 'Limpieza', Sparkles, 'text-emerald-600')}

                            {/* RI Configuration */}
                            <div className="group relative bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-200 rounded-2xl p-5 transition-all hover:shadow-md">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-violet-100 text-violet-600">
                                            <UserCheck size={20} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-sm tracking-tight">Reunión Individual (RI)</span>
                                            <span className="text-[10px] text-slate-400 font-medium">Configuración especial de entrada</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end border-t border-slate-100 pt-3 mt-1">
                                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Hora de Entrada</span>
                                        <CustomTimePicker
                                            value={formData.individualMeetingStartTime || ''}
                                            onChange={(val) => handleChange('individualMeetingStartTime', val)}
                                        // placeholder="--:--"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default SettingsPage;
