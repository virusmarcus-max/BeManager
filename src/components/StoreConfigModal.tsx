import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import type { StoreSettings } from '../types';
import {
    Plus, Trash2, Store, Clock, Calendar, X
} from 'lucide-react';
import { DatePicker } from './DatePicker';

interface StoreConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    establishmentId: string;
    onSave?: (settings: StoreSettings) => void;
}

type TabType = 'schedule' | 'holidays';

const StoreConfigModal: React.FC<StoreConfigModalProps> = ({ isOpen, onClose, establishmentId, onSave }) => {
    const { getSettings, updateSettings } = useStore();
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
    }, [isOpen, establishmentId, getSettings]);

    const handleSave = () => {
        if (settings) {
            updateSettings(settings);
            if (onSave) onSave(settings);
            onClose();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] shadow-2xl shadow-indigo-500/10">

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Configuración de Tienda</h2>
                        <p className="text-slate-500 text-sm font-medium">Administra los horarios y festivos del establecimiento</p>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Navigation */}
                    <div className="w-64 bg-slate-950 border-r border-slate-800 p-6 flex flex-col gap-3 shrink-0 hidden md:flex">
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-left font-black tracking-wide transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}
                        >
                            <Clock size={20} />
                            <span className="text-[10px] uppercase">Horarios Apertura</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('holidays')}
                            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-left font-black tracking-wide transition-all ${activeTab === 'holidays' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}
                        >
                            <Calendar size={20} />
                            <span className="text-[10px] uppercase">Festivos / Cierres</span>
                        </button>
                    </div>

                    {/* Mobile Navigation */}
                    <div className="md:hidden flex overflow-x-auto border-b border-slate-800 p-3 gap-2 bg-slate-950 shrink-0">
                        <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'schedule' ? 'bg-indigo-600 text-white' : 'text-slate-500 bg-slate-900'}`}>Horarios</button>
                        <button onClick={() => setActiveTab('holidays')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeTab === 'holidays' ? 'bg-indigo-600 text-white' : 'text-slate-500 bg-slate-900'}`}>Festivos</button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-900">
                        {loading || !settings ? (
                            <div className="flex items-center justify-center h-full text-slate-600 font-bold uppercase tracking-widest text-xs">Cargando configuración...</div>
                        ) : (
                            <div className="max-w-3xl mx-auto">
                                {/* TAB: SCHEDULE */}
                                {activeTab === 'schedule' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 flex gap-4 text-indigo-400 text-sm font-medium">
                                            <Clock className="shrink-0 mt-0.5 text-indigo-500" size={20} />
                                            <p className="leading-relaxed">Define las horas de apertura y cierre para cada turno. Estos horarios se usarán para calcular las horas de los empleados y generar los cuadrantes automáticos.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Morning Shift */}
                                            <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-7 hover:border-indigo-500/30 transition-all shadow-sm group">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="p-3 bg-amber-500/20 text-amber-500 rounded-2xl group-hover:scale-110 transition-transform">
                                                        <SunIcon />
                                                    </div>
                                                    <h3 className="font-black text-xl text-white tracking-tight">Turno de Mañana</h3>
                                                </div>

                                                <div className="space-y-6">
                                                    <div className="flex justify-between items-center">
                                                        <label className="premium-label !mb-0">Apertura</label>
                                                        <input
                                                            type="time"
                                                            value={settings.openingHours.morningStart}
                                                            onChange={(e) => handleTimeChange('morningStart', e.target.value)}
                                                            className="premium-input w-32 text-center text-lg"
                                                        />
                                                    </div>
                                                    <div className="h-px bg-slate-800/50 w-full" />
                                                    <div className="flex justify-between items-center">
                                                        <label className="premium-label !mb-0">Cierre</label>
                                                        <input
                                                            type="time"
                                                            value={settings.openingHours.morningEnd}
                                                            onChange={(e) => handleTimeChange('morningEnd', e.target.value)}
                                                            className="premium-input w-32 text-center text-lg"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Afternoon Shift */}
                                            <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-7 hover:border-indigo-500/30 transition-all shadow-sm group">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform">
                                                        <MoonIcon />
                                                    </div>
                                                    <h3 className="font-black text-xl text-white tracking-tight">Turno de Tarde</h3>
                                                </div>

                                                <div className="space-y-6">
                                                    <div className="flex justify-between items-center">
                                                        <label className="premium-label !mb-0">Apertura</label>
                                                        <input
                                                            type="time"
                                                            value={settings.openingHours.afternoonStart}
                                                            onChange={(e) => handleTimeChange('afternoonStart', e.target.value)}
                                                            className="premium-input w-32 text-center text-lg"
                                                        />
                                                    </div>
                                                    <div className="h-px bg-slate-800/50 w-full" />
                                                    <div className="flex justify-between items-center">
                                                        <label className="premium-label !mb-0">Cierre</label>
                                                        <input
                                                            type="time"
                                                            value={settings.openingHours.afternoonEnd}
                                                            onChange={(e) => handleTimeChange('afternoonEnd', e.target.value)}
                                                            className="premium-input w-32 text-center text-lg"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB: HOLIDAYS */}
                                {activeTab === 'holidays' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">

                                        {/* Holidays Section */}
                                        <div className="bg-slate-950/30 border border-slate-800 rounded-3xl p-8 shadow-sm">
                                            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3 tracking-tight">
                                                <div className="p-2 bg-rose-500/20 rounded-xl">
                                                    <Calendar className="text-rose-500" size={20} />
                                                </div>
                                                Días de Cierre
                                            </h3>

                                            <div className="flex flex-col md:flex-row gap-4 p-5 bg-slate-950/80 rounded-3xl border border-slate-800 mb-8 items-end">
                                                <div className="flex-1 space-y-2">
                                                    <label className="premium-label">Fecha</label>
                                                    <DatePicker
                                                        value={newHoliday}
                                                        onChange={setNewHoliday}
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <label className="premium-label">Tipo de Cierre</label>
                                                    <select
                                                        value={newHolidayType}
                                                        onChange={(e) => setNewHolidayType(e.target.value as 'full' | 'afternoon' | 'closed_afternoon')}
                                                        className="premium-select w-full"
                                                    >
                                                        <option value="full" className="bg-slate-900">Día Completo (Cerrado)</option>
                                                        <option value="afternoon" className="bg-slate-900">Tarde Festiva (Red. Jornada)</option>
                                                        <option value="closed_afternoon" className="bg-slate-900">Cierre Tarde (Descanso)</option>
                                                    </select>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addHoliday}
                                                    className="bg-rose-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95 border border-rose-500/50"
                                                >
                                                    <Plus size={18} /> Añadir
                                                </button>
                                            </div>

                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                {settings.holidays.length === 0 ? (
                                                    <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                        No hay festivos configurados
                                                    </div>
                                                ) : (
                                                    settings.holidays.map((h: any) => {
                                                        const date = typeof h === 'string' ? h : h.date;
                                                        const type = typeof h === 'string' ? 'full' : h.type;

                                                        let styles = {
                                                            dot: 'bg-rose-500',
                                                            pill: 'bg-rose-100 text-rose-700',
                                                            container: 'hover:border-rose-100 hover:bg-rose-50/30',
                                                            label: 'Cerrado'
                                                        };

                                                        if (type === 'afternoon') {
                                                            styles = {
                                                                dot: 'bg-orange-500',
                                                                pill: 'bg-orange-100 text-orange-700',
                                                                container: 'hover:border-orange-100 hover:bg-orange-50/30',
                                                                label: 'Tarde Festiva'
                                                            };
                                                        } else if (type === 'closed_afternoon') {
                                                            styles = {
                                                                dot: 'bg-indigo-500',
                                                                pill: 'bg-indigo-100 text-indigo-700',
                                                                container: 'hover:border-indigo-100 hover:bg-indigo-50/30',
                                                                label: 'Cierre Tarde'
                                                            };
                                                        }

                                                        return (
                                                            <div key={date} className={`flex justify-between items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800 transition-all group ${styles.container}`}>
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-2.5 h-2.5 rounded-full ${styles.dot} shadow-[0_0_8px_currentColor]`} />
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-white text-sm capitalize">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(date).getFullYear()}</span>
                                                                    </div>
                                                                    <span className={`text-[9px] uppercase font-black px-2.5 py-1 rounded-full border border-current opacity-80 ${styles.pill}`}>
                                                                        {styles.label}
                                                                    </span>
                                                                </div>
                                                                <button onClick={() => removeHoliday(date)} className="text-slate-600 hover:text-rose-500 transition-all p-2.5 hover:bg-rose-500/10 rounded-xl">
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        {/* Open Sundays Section */}
                                        <div className="bg-slate-950/30 border border-slate-800 rounded-3xl p-8 shadow-sm">
                                            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3 tracking-tight">
                                                <div className="p-2 bg-emerald-500/20 rounded-xl">
                                                    <Store className="text-emerald-500" size={20} />
                                                </div>
                                                Domingos de Apertura
                                            </h3>

                                            <div className="flex gap-4 p-5 bg-slate-950/80 rounded-3xl border border-slate-800 mb-8 items-end">
                                                <div className="flex-1 space-y-2">
                                                    <label className="premium-label">Seleccionar Domingo</label>
                                                    <DatePicker
                                                        value={newOpenSunday}
                                                        onChange={setNewOpenSunday}
                                                        className="w-full"
                                                    />
                                                </div>
                                                <button
                                                    onClick={addOpenSunday}
                                                    className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 border border-emerald-500/50"
                                                >
                                                    <Plus size={18} /> Añadir
                                                </button>
                                            </div>

                                            <div className="flex flex-wrap gap-3">
                                                {(settings.openSundays || []).map(date => (
                                                    <div key={date} className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:bg-emerald-500/20">
                                                        <span>{new Date(date).toLocaleDateString()}</span>
                                                        <button onClick={() => removeOpenSunday(date)} className="hover:text-white hover:bg-emerald-500/40 rounded-full p-1 transition-all">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {(settings.openSundays || []).length === 0 && (
                                                    <div className="text-slate-600 italic text-sm w-full py-4 text-center border border-dashed border-slate-800 rounded-2xl uppercase tracking-widest font-bold text-[10px]">No hay domingos de apertura configurados</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="px-8 py-6 bg-slate-900 border-t border-slate-800 flex justify-end gap-4 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-8 py-3.5 text-slate-400 bg-slate-950 border border-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest hover:text-white hover:bg-slate-800 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 hover:scale-[1.02] transition-all active:scale-95 border border-indigo-500/50"
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
