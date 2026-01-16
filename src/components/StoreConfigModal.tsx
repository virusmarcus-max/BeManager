import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import type { StoreSettings } from '../types';
import {
    Plus, Trash2, Store, Clock, Calendar, X, XCircle, Coffee
} from 'lucide-react';
import { DatePicker } from './DatePicker';
import { CustomSelect } from './CustomSelect';

interface StoreConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    establishmentId: string;
    onSave?: (settings: StoreSettings) => void;
}

type TabType = 'schedule' | 'holidays';

const StoreConfigModal: React.FC<StoreConfigModalProps> = ({ isOpen, onClose, establishmentId, onSave }) => {
    const { getSettings, updateSettings, settings: globalSettings } = useStore();
    const { showToast } = useToast();
    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('schedule');

    // States for adding items
    const [newHoliday, setNewHoliday] = useState('');
    const [newHolidayType, setNewHolidayType] = useState<'full' | 'afternoon' | 'closed_afternoon'>('full');
    const [newOpenSunday, setNewOpenSunday] = useState('');

    useEffect(() => {
        if (isOpen && establishmentId) {
            const data = getSettings(establishmentId);
            if (!Array.isArray(data.holidays)) data.holidays = [];
            if (!Array.isArray(data.openSundays)) data.openSundays = [];

            setSettings(JSON.parse(JSON.stringify(data)));
            setLoading(false);
        }
    }, [isOpen, establishmentId, getSettings, globalSettings]);

    const handleSave = async () => {
        if (settings) {
            try {
                await updateSettings(settings);
                if (onSave) onSave(settings);

                // Immediately sync back to ensure local state matches global if needed (though effect usage covers it)
                // But let's force a refresh from the source to be safe
                setSettings(JSON.parse(JSON.stringify(settings)));

                showToast('Configuración guardada correctamente', 'success');
                onClose();
            } catch (error) {
                console.error(error);
                showToast('Error al guardar configuración.', 'error');
            }
        }
    };

    const handleTimeChange = (key: keyof StoreSettings['openingHours'], value: string) => {
        if (settings) {
            setSettings({
                ...settings,
                openingHours: {
                    ...settings.openingHours,
                    [key]: value
                }
            });
        }
    };

    const addHoliday = () => {
        if (!newHoliday || !settings) return;
        const currentHolidays = Array.isArray(settings.holidays) ? settings.holidays : [];
        const normalizedHolidays = currentHolidays.map(h =>
            typeof h === 'string' ? { date: h, type: 'full' as const } : h
        );

        const existingIndex = normalizedHolidays.findIndex(h => h.date === newHoliday);

        if (existingIndex >= 0) {
            if (normalizedHolidays[existingIndex].type !== newHolidayType) {
                const updatedHolidays = [...normalizedHolidays];
                updatedHolidays[existingIndex] = { date: newHoliday, type: newHolidayType };
                setSettings({
                    ...settings,
                    holidays: updatedHolidays.sort((a, b) => a.date.localeCompare(b.date))
                });
                setNewHoliday('');
                setNewHolidayType('full');
            } else {
                alert('Este festivo ya existe con el mismo tipo.');
            }
        } else {
            const holidayObj = { date: newHoliday, type: newHolidayType };
            const updatedHolidays = [...normalizedHolidays, holidayObj].sort((a, b) => a.date.localeCompare(b.date));
            setSettings({ ...settings, holidays: updatedHolidays });
            setNewHoliday('');
            setNewHolidayType('full');
        }
    };

    const removeHoliday = (date: string) => {
        if (settings) {
            const cleanHolidays = settings.holidays.map(h => typeof h === 'string' ? { date: h, type: 'full' as const } : h);
            setSettings({ ...settings, holidays: cleanHolidays.filter(h => h.date !== date) });
        }
    };

    const addOpenSunday = () => {
        if (newOpenSunday && settings) {
            const current = settings.openSundays || [];
            if (!current.includes(newOpenSunday)) {
                setSettings({ ...settings, openSundays: [...current, newOpenSunday].sort() });
                setNewOpenSunday('');
            }
        }
    };

    const removeOpenSunday = (date: string) => {
        if (settings) {
            const current = settings.openSundays || [];
            setSettings({ ...settings, openSundays: current.filter(d => d !== date) });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] shadow-2xl">

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Configuración de Tienda</h2>
                        <p className="text-slate-500 text-sm font-medium">Administra los horarios y festivos del establecimiento</p>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Navigation */}
                    <div className="w-64 bg-slate-50 border-r border-slate-100 p-6 flex flex-col gap-3 shrink-0 hidden md:flex">
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-left font-black tracking-wide transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm'}`}
                        >
                            <Clock size={20} />
                            <span className="text-[10px] uppercase">Horarios Apertura</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('holidays')}
                            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-left font-black tracking-wide transition-all ${activeTab === 'holidays' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm'}`}
                        >
                            <Calendar size={20} />
                            <span className="text-[10px] uppercase">Festivos / Cierres</span>
                        </button>
                    </div>

                    {/* Mobile Navigation */}
                    <div className="md:hidden flex overflow-x-auto border-b border-slate-100 p-3 gap-2 bg-slate-50 shrink-0">
                        <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'schedule' ? 'bg-indigo-600 text-white' : 'text-slate-500 bg-white shadow-sm'}`}>Horarios</button>
                        <button onClick={() => setActiveTab('holidays')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'holidays' ? 'bg-indigo-600 text-white' : 'text-slate-500 bg-white shadow-sm'}`}>Festivos</button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                        {loading || !settings ? (
                            <div className="flex items-center justify-center h-full text-slate-600 font-bold uppercase tracking-widest text-xs">Cargando configuración...</div>
                        ) : (
                            <div className="max-w-5xl mx-auto">
                                {/* TAB: SCHEDULE */}
                                {activeTab === 'schedule' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex gap-4 text-indigo-600 text-sm font-medium">
                                            <Clock className="shrink-0 mt-0.5 text-indigo-500" size={20} />
                                            <p className="leading-relaxed">Define las horas de apertura y cierre para cada turno. Estos horarios se usarán para calcular las horas de los empleados y generar los cuadrantes automáticos.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Morning Shift */}
                                            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all group duration-300 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>

                                                <div className="flex items-center gap-5 mb-8 relative">
                                                    <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                                                        <SunIcon />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-xl text-slate-800 tracking-tight leading-none">Turno de Mañana</h3>
                                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1.5">Configuración Jornada Matinal</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6 relative">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Entrada</label>
                                                        <div className="relative group/input">
                                                            <input
                                                                type="time"
                                                                value={settings.openingHours.morningStart}
                                                                onChange={(e) => handleTimeChange('morningStart', e.target.value)}
                                                                className="w-full bg-slate-50 border-2 border-slate-100 text-slate-700 text-center font-black text-xl rounded-2xl h-14 outline-none focus:border-amber-400 focus:bg-white transition-all focus:shadow-lg shadow-amber-100/50"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Salida</label>
                                                        <div className="relative group/input">
                                                            <input
                                                                type="time"
                                                                value={settings.openingHours.morningEnd}
                                                                onChange={(e) => handleTimeChange('morningEnd', e.target.value)}
                                                                className="w-full bg-slate-50 border-2 border-slate-100 text-slate-700 text-center font-black text-xl rounded-2xl h-14 outline-none focus:border-amber-400 focus:bg-white transition-all focus:shadow-lg shadow-amber-100/50"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Afternoon Shift */}
                                            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group duration-300 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>

                                                <div className="flex items-center gap-5 mb-8 relative">
                                                    <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                                                        <MoonIcon />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-xl text-slate-800 tracking-tight leading-none">Turno de Tarde</h3>
                                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1.5">Configuración Jornada Vespertina</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6 relative">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Entrada</label>
                                                        <div className="relative group/input">
                                                            <input
                                                                type="time"
                                                                value={settings.openingHours.afternoonStart}
                                                                onChange={(e) => handleTimeChange('afternoonStart', e.target.value)}
                                                                className="w-full bg-slate-50 border-2 border-slate-100 text-slate-700 text-center font-black text-xl rounded-2xl h-14 outline-none focus:border-indigo-400 focus:bg-white transition-all focus:shadow-lg shadow-indigo-100/50"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Salida</label>
                                                        <div className="relative group/input">
                                                            <input
                                                                type="time"
                                                                value={settings.openingHours.afternoonEnd}
                                                                onChange={(e) => handleTimeChange('afternoonEnd', e.target.value)}
                                                                className="w-full bg-slate-50 border-2 border-slate-100 text-slate-700 text-center font-black text-xl rounded-2xl h-14 outline-none focus:border-indigo-400 focus:bg-white transition-all focus:shadow-lg shadow-indigo-100/50"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB: HOLIDAYS */}
                                {activeTab === 'holidays' && (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">

                                        {/* Holidays Section */}
                                        <div className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full flex flex-col">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500 shadow-sm">
                                                    <Calendar size={24} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Días de Cierre</h3>
                                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Festivos y eventos especiales</p>
                                                </div>
                                            </div>

                                            {/* Add Form */}
                                            <div className="bg-white p-2 rounded-[2rem] border border-slate-200 shadow-sm mb-8">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 p-2">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Fecha</label>
                                                        <DatePicker
                                                            variant="light"
                                                            value={newHoliday}
                                                            onChange={setNewHoliday}
                                                            className="w-full"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Tipo</label>
                                                        <CustomSelect
                                                            options={[
                                                                { value: 'full', label: 'Cerrado' },
                                                                { value: 'afternoon', label: 'Tarde Festiva' },
                                                                { value: 'closed_afternoon', label: 'Cierre Tarde' }
                                                            ]}
                                                            value={newHolidayType}
                                                            onChange={(val) => setNewHolidayType(val as 'full' | 'afternoon' | 'closed_afternoon')}
                                                            placeholder="Tipo..."
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addHoliday}
                                                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
                                                >
                                                    <Plus size={16} strokeWidth={3} />
                                                    Añadir Festivo
                                                </button>
                                            </div>

                                            {/* List */}
                                            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[200px]">
                                                {settings.holidays.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl opacity-50">
                                                        <Calendar size={32} className="text-slate-300 mb-2" />
                                                        <span className="text-slate-400 font-bold text-sm">Sin festivos configurados</span>
                                                    </div>
                                                ) : (
                                                    settings.holidays.map((h: any) => {
                                                        const date = typeof h === 'string' ? h : h.date;
                                                        const type = typeof h === 'string' ? 'full' : h.type;

                                                        let styles = {
                                                            bg: 'bg-rose-50 border-rose-100',
                                                            text: 'text-rose-700',
                                                            icon: <XCircle size={16} />,
                                                            label: 'Cerrado'
                                                        };

                                                        if (type === 'afternoon') {
                                                            styles = {
                                                                bg: 'bg-orange-50 border-orange-100',
                                                                text: 'text-orange-700',
                                                                icon: <Clock size={16} />,
                                                                label: 'Red. Jornada'
                                                            };
                                                        } else if (type === 'closed_afternoon') {
                                                            styles = {
                                                                bg: 'bg-indigo-50 border-indigo-100',
                                                                text: 'text-indigo-700',
                                                                icon: <Coffee size={16} />,
                                                                label: 'Descanso'
                                                            };
                                                        }

                                                        return (
                                                            <div key={date} className="group relative flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.bg} ${styles.text}`}>
                                                                        {styles.icon}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-800 text-sm capitalize">
                                                                            {new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                                                                        </div>
                                                                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                                            {new Date(date).getFullYear()} • {styles.label}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => removeHoliday(date)}
                                                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            {/* Open Sundays Section */}
                                            <div className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full flex flex-col">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                                                        <Store size={24} strokeWidth={2.5} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Domingos</h3>
                                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Aperturas extraordinarias</p>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-2 rounded-[2rem] border border-slate-200 shadow-sm mb-8">
                                                    <div className="p-2 space-y-1.5 mb-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Seleccionar Domingo</label>
                                                        <DatePicker
                                                            variant="light"
                                                            value={newOpenSunday}
                                                            onChange={setNewOpenSunday}
                                                            className="w-full"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={addOpenSunday}
                                                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95"
                                                    >
                                                        <Plus size={16} strokeWidth={3} />
                                                        Añadir Apertura
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 flex-1 content-start overflow-y-auto custom-scrollbar pr-2 max-h-[400px]">
                                                    {(settings.openSundays || []).map(date => (
                                                        <div key={date} className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between group hover:border-emerald-300 hover:shadow-md transition-all relative overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-50 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none opacity-50" />

                                                            <div className="mb-2">
                                                                <span className="text-[10px] font-black uppercase text-emerald-600/60 tracking-wider block mb-0.5">Domingo</span>
                                                                <span className="text-lg font-black text-slate-800 capitalize leading-tight block">
                                                                    {new Date(date).toLocaleDateString(undefined, { day: 'numeric' })}
                                                                </span>
                                                                <span className="text-xs font-bold text-slate-400 capitalize block">
                                                                    {new Date(date).toLocaleDateString(undefined, { month: 'long' })}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => removeOpenSunday(date)}
                                                                className="w-full py-2 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-[10px] uppercase tracking-wider hover:bg-rose-50 hover:text-rose-500 transition-colors flex items-center justify-center gap-2 mt-2"
                                                            >
                                                                <Trash2 size={12} /> Eliminar
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(settings.openSundays || []).length === 0 && (
                                                        <div className="col-span-2 h-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-3xl opacity-50">
                                                            <span className="text-slate-400 font-bold text-sm">Sin aperturas</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="px-8 py-6 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-8 py-3.5 text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:text-slate-700 hover:bg-slate-100 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:scale-[1.02] transition-all active:scale-95"
                    >
                        Guardar Cambios
                    </button>
                </div>

                <div className="absolute top-4 right-4 md:hidden">
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500">
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper Icons
const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
);
const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
);

export default StoreConfigModal;
