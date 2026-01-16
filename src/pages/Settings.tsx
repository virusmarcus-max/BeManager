import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import {
    Save, Calendar as CalendarIcon, Clock, Mail, User, Phone,
    BadgeCheck, Store, Briefcase, ShoppingCart, Package, Truck, Sparkles,
    UserCheck, ChevronRight, Settings as SettingsIcon, Globe, Map, Bell, Lock
} from 'lucide-react';
import type { StoreSettings, WorkRole, RoleScheduleConfig } from '../types';
import { DatePicker } from '../components/DatePicker';
import { CustomTimePicker } from '../components/CustomTimePicker';
import { clsx } from 'clsx';

const SettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { getSettings, updateSettings, settings } = useStore();

    if (!user) return null;

    const [formData, setFormData] = useState<StoreSettings>(getSettings(user.establishmentId));
    const [dirty, setDirty] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'hours' | 'roles' | 'holidays'>('general');
    const [newHoliday, setNewHoliday] = useState('');
    const [newHolidayType, setNewHolidayType] = useState<'full' | 'afternoon' | 'closed_afternoon'>('full');
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) return;
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
    };

    const sendTestNotification = async () => {
        if (Notification.permission === 'granted') {
            try {
                if ('serviceWorker' in navigator) {
                    console.log("Checking Service Worker registration...");
                    const registration = await navigator.serviceWorker.getRegistration();

                    if (registration && registration.active) {
                        console.log("Service Worker active. Sending notification via SW.");
                        await registration.showNotification('BeManager: Prueba SW', {
                            body: 'El sistema de notificaciones funciona correctamente.',
                            icon: '/vite.svg',
                            tag: 'test-notification',
                            // @ts-ignore
                            renotify: true,
                            requireInteraction: true
                        });
                        return;
                    }
                }
            } catch (err) {
                console.error("SW Notification failed, falling back:", err);
            }

            // Fallback
            console.log("Falling back to standard Notification API.");
            try {
                new Notification('BeManager: Prueba Estándar', {
                    body: 'El sistema de notificaciones funciona correctamente.',
                    icon: '/vite.svg',
                    tag: 'test-notification',
                    // @ts-ignore
                    renotify: true,
                    requireInteraction: true
                });
            } catch (err) {
                console.error("Error crítico al enviar notificación estándar:", err);
            }
        } else {
            console.warn("Permiso de notificaciones no concedido:", Notification.permission);
        }
    };

    useEffect(() => {
        setFormData(getSettings(user.establishmentId));
    }, [user.establishmentId, settings]); // eslint-disable-line react-hooks/exhaustive-deps

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

            // Fix for cleaning which sometimes doesn't have split type logic correctly handled in the UI
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateSettings(formData);
            setDirty(false);
            // Toast notification
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-8 right-8 bg-indigo-600 text-white px-8 py-4 rounded-2xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] animate-in slide-in-from-bottom duration-500 flex items-center gap-3 z-50 font-bold border border-indigo-400/30 backdrop-blur-md';
            toast.innerHTML = '<div class="bg-white/20 p-1.5 rounded-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div> Configuración guardada con éxito';
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-4', 'transition-all', 'duration-500');
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            // Error Toast
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-8 right-8 bg-red-600 text-white px-8 py-4 rounded-2xl shadow-[0_20px_50px_rgba(220,38,38,0.3)] animate-in slide-in-from-bottom duration-500 flex items-center gap-3 z-50 font-bold border border-red-400/30 backdrop-blur-md';
            toast.innerHTML = '<div class="bg-white/20 p-1.5 rounded-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div> Error al guardar cambios';
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-4', 'transition-all', 'duration-500');
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        }
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
        if (exists) return;

        setFormData(prev => ({
            ...prev,
            holidays: [...prev.holidays, { date: newHoliday, type: newHolidayType }].sort((a, b) => a.date.localeCompare(b.date))
        }));
        setDirty(true);
        setNewHoliday('');
    };

    const renderRoleConfig = (role: WorkRole, label: string, Icon: React.ElementType, colorClass: string) => {
        const config = formData.roleSchedules?.[role] || { startTime: '', endTime: '', type: 'morning' };

        return (
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className={clsx("p-3 rounded-2xl", colorClass.replace('text-', 'bg-').replace('600', '100'), colorClass)}>
                            <Icon size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 text-lg">{label}</h4>
                            <p className="text-slate-400 text-xs font-medium">Configurar tipo de jornada</p>
                        </div>
                    </div>

                    <div className="flex p-1 bg-slate-100 rounded-xl">
                        {(['morning', 'afternoon', 'split'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => handleRoleScheduleChange(role, 'type', type)}
                                className={clsx(
                                    "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                    config.type === type
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {type === 'morning' ? 'Mañana' : type === 'afternoon' ? 'Tarde' : 'Partido'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {/* Morning / Start Section */}
                    {(config.type === 'morning' || config.type === 'split') && (
                        <div className={clsx(
                            "group p-4 rounded-2xl border transition-all duration-300",
                            config.type === 'split' ? "bg-amber-50/50 border-amber-100" : "bg-slate-50 border-slate-100"
                        )}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={clsx("w-2 h-2 rounded-full", config.type === 'split' ? "bg-amber-500" : "bg-indigo-500")} />
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        {config.type === 'split' ? 'Bloque Mañana' : 'Jornada Mañana'}
                                    </span>
                                </div>
                                <Clock size={14} className="text-slate-300" />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Entrada</label>
                                    <CustomTimePicker
                                        className="w-full justify-between py-2.5 !bg-white"
                                        value={config.startTime || ''}
                                        onChange={(val) => handleRoleScheduleChange(role, 'startTime', val)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Salida</label>
                                    <CustomTimePicker
                                        className="w-full justify-between py-2.5 !bg-white"
                                        value={config.type === 'split' ? (config.morningEndTime || '') : (config.endTime || '')}
                                        onChange={(val) => handleRoleScheduleChange(role, config.type === 'split' ? 'morningEndTime' : 'endTime', val)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Afternoon Section */}
                    {(config.type === 'afternoon' || config.type === 'split') && (
                        <div className={clsx(
                            "group p-4 rounded-2xl border transition-all duration-300",
                            config.type === 'split' ? "bg-indigo-50/50 border-indigo-100" : "bg-slate-50 border-slate-100"
                        )}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={clsx("w-2 h-2 rounded-full", config.type === 'split' ? "bg-indigo-500" : "bg-indigo-500")} />
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        {config.type === 'split' ? 'Bloque Tarde' : 'Jornada Tarde'}
                                    </span>
                                </div>
                                <Clock size={14} className="text-slate-300" />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Entrada</label>
                                    <CustomTimePicker
                                        className="w-full justify-between py-2.5 !bg-white"
                                        value={config.type === 'split' ? (config.afternoonStartTime || '') : (config.startTime || '')}
                                        onChange={(val) => handleRoleScheduleChange(role, config.type === 'split' ? 'afternoonStartTime' : 'startTime', val)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Salida</label>
                                    <CustomTimePicker
                                        className="w-full justify-between py-2.5 !bg-white"
                                        value={config.endTime || ''}
                                        onChange={(val) => handleRoleScheduleChange(role, 'endTime', val)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const tabs = [
        { id: 'general', label: 'General', icon: Store, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { id: 'hours', label: 'Horarios', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { id: 'roles', label: 'Puestos', icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { id: 'holidays', label: 'Festivos', icon: CalendarIcon, color: 'text-rose-600', bg: 'bg-rose-50' },
    ] as const;

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-0">
            {/* Header Moderno con Glassmorphism */}
            <div className="relative mb-12 p-8 md:p-12 bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm transition-all duration-500 group">
                {/* Background Shapes */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-rose-50 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity duration-700" />

                <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-indigo-200 shadow-lg text-white">
                                <SettingsIcon size={24} className="animate-spin-slow" />
                            </div>
                            <span className="text-indigo-600 font-bold uppercase tracking-[0.2em] text-xs">Configuración Maestra</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                            Personaliza tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Establecimiento</span>
                        </h1>
                        <p className="text-slate-500 mt-4 text-lg max-w-2xl font-medium leading-relaxed">
                            Gestiona horarios, puestos y calendarios para {user.establishmentName} de forma centralizada.
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={handleSubmit}
                            disabled={!dirty}
                            className={clsx(
                                "group relative flex items-center gap-3 px-10 py-4 rounded-[1.5rem] font-bold transition-all overflow-hidden",
                                dirty
                                    ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <Save size={20} className={dirty ? "animate-pulse" : ""} />
                            <span>Guardar Cambios</span>
                        </button>
                        {dirty && (
                            <span className="text-amber-600 text-xs font-bold animate-bounce flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                                <Bell size={12} /> Tienes cambios sin guardar
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 pb-32">
                {/* Navigation Sidebar */}
                <aside className="lg:w-72 flex-shrink-0">
                    <div className="sticky top-6 space-y-2 p-2 bg-white/50 backdrop-blur-sm rounded-[2rem] border border-slate-100 shadow-sm">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all group",
                                    activeTab === tab.id
                                        ? "bg-white text-indigo-600 shadow-sm border border-slate-100 outline outline-4 outline-indigo-50/50"
                                        : "text-slate-500 hover:bg-white hover:text-slate-900"
                                )}
                            >
                                <div className={clsx(
                                    "p-2 rounded-xl transition-all",
                                    activeTab === tab.id ? tab.bg : "bg-slate-50 group-hover:bg-white"
                                )}>
                                    <tab.icon size={20} className={activeTab === tab.id ? tab.color : "text-slate-400 group-hover:text-slate-600"} />
                                </div>
                                <span className="flex-1 text-left">{tab.label}</span>
                                {activeTab === tab.id && <ChevronRight size={18} className="text-indigo-400" />}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[600px] flex flex-col">
                        {/* Tab Content Header */}
                        <div className="p-8 border-b border-slate-50">
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                {tabs.find(t => t.id === activeTab)?.label}
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            </h2>
                            <p className="text-slate-400 text-sm mt-1 font-medium italic">
                                {activeTab === 'general' && 'Información básica y contacto del local'}
                                {activeTab === 'hours' && 'Rango horario de apertura del establecimiento'}
                                {activeTab === 'roles' && 'Personalizar turnos según la función del empleado'}
                                {activeTab === 'holidays' && 'Días no laborables y festividades especiales'}
                            </p>
                        </div>

                        <div className="p-8 flex-1">
                            {/* ACTIVE TAB: GENERAL */}
                            {activeTab === 'general' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="md:col-span-2">
                                            <div className="flex items-center gap-2 mb-3 ml-1">
                                                <Globe size={14} className="text-indigo-500" />
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Público</label>
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.storeName}
                                                onChange={e => handleChange('storeName', e.target.value)}
                                                className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-bold text-slate-700 shadow-inner"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-3 ml-1">
                                                <User size={14} className="text-indigo-500" />
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gerente Responsable</label>
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.managerName}
                                                onChange={e => handleChange('managerName', e.target.value)}
                                                className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium text-slate-700 shadow-inner"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-3 ml-1">
                                                <Phone size={14} className="text-indigo-500" />
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono</label>
                                            </div>
                                            <input
                                                type="tel"
                                                value={formData.phone || ''}
                                                onChange={e => handleChange('phone', e.target.value)}
                                                className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium text-slate-700 shadow-inner"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <div className="flex items-center gap-2 mb-3 ml-1">
                                                <Mail size={14} className="text-indigo-500" />
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Corporativo</label>
                                            </div>
                                            <input
                                                type="email"
                                                value={formData.contactEmail}
                                                onChange={e => handleChange('contactEmail', e.target.value)}
                                                className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium text-slate-700 shadow-inner"
                                            />
                                        </div>

                                        <div className="md:col-span-2 mt-4 pt-8 border-t border-slate-50">
                                            <div className="flex items-center gap-2 mb-6 ml-1">
                                                <Map size={14} className="text-rose-500" />
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Geolocalización</label>
                                            </div>
                                            <div className="space-y-6">
                                                <input
                                                    type="text"
                                                    placeholder="Dirección completa"
                                                    value={formData.address || ''}
                                                    onChange={e => handleChange('address', e.target.value)}
                                                    className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium text-slate-700 shadow-inner"
                                                />
                                                <div className="grid grid-cols-2 gap-6">
                                                    <input
                                                        type="text"
                                                        placeholder="Ciudad"
                                                        value={formData.city || ''}
                                                        onChange={e => handleChange('city', e.target.value)}
                                                        className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium text-slate-700 shadow-inner"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="CP"
                                                        value={formData.zipCode || ''}
                                                        onChange={e => handleChange('zipCode', e.target.value)}
                                                        className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium text-slate-700 shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 mt-4 pt-8 border-t border-slate-50">
                                            <div className="flex items-center gap-2 mb-6 ml-1">
                                                <Lock size={14} className="text-amber-500" />
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Seguridad</label>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Contraseña de Acceso</label>
                                                <input
                                                    type="text"
                                                    value={formData.password || ''}
                                                    onChange={e => handleChange('password', e.target.value)}
                                                    className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-bold text-slate-700 shadow-inner tracking-widest"
                                                    placeholder="Establecer contraseña..."
                                                />
                                                <p className="text-[10px] text-slate-400 font-medium ml-2">Esta contraseña será requerida para acceder al establecimiento.</p>
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 mt-4 pt-8 border-t border-slate-50">
                                            <div className="flex items-center gap-2 mb-6 ml-1">
                                                <Bell size={14} className="text-indigo-500" />
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notificaciones</label>
                                            </div>
                                            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                                                <div>
                                                    <h5 className="font-bold text-slate-700 flex items-center gap-2">
                                                        Avisos de Escritorio
                                                        {notificationPermission === 'granted' && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-black uppercase tracking-wide">Activas</span>}
                                                    </h5>
                                                    <p className="text-xs text-slate-400 font-medium mt-1 max-w-md leading-relaxed">
                                                        {notificationPermission === 'granted' ? 'Las notificaciones están correctamente configuradas.' :
                                                            notificationPermission === 'denied' ? 'Has bloqueado las notificaciones. Debes habilitarlas manualmente en la configuración de tu navegador.' :
                                                                'Actívalas para recibir alertas instantáneas cuando se asignen nuevas tareas.'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {notificationPermission === 'default' && (
                                                        <button
                                                            type="button"
                                                            onClick={requestNotificationPermission}
                                                            className="px-5 py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95"
                                                        >
                                                            Activar Avisos
                                                        </button>
                                                    )}
                                                    {notificationPermission === 'granted' && (
                                                        <button
                                                            type="button"
                                                            onClick={sendTestNotification}
                                                            className="px-5 py-3 bg-white text-indigo-600 text-xs font-bold rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                                                        >
                                                            Probar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ACTIVE TAB: HOURS */}
                            {activeTab === 'hours' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-2xl">
                                    <div className="p-8 bg-amber-50/50 rounded-[2rem] border border-amber-100 shadow-sm">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                                                <Clock size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-amber-900 text-xl tracking-tight">Turno de Mañana</h4>
                                                <p className="text-amber-700/60 text-xs font-bold uppercase tracking-widest">Apertura estándar</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-center gap-6">
                                            <div className="w-full">
                                                <label className="block text-[10px] font-black text-amber-700 uppercase mb-2 ml-1">Hora de entrada</label>
                                                <input
                                                    type="time"
                                                    value={formData.openingHours.morningStart}
                                                    onChange={(e) => handleTimeChange('morningStart', e.target.value)}
                                                    className="w-full px-6 py-4 text-center bg-white border border-amber-200 text-amber-900 rounded-[1.25rem] font-bold text-xl focus:ring-8 focus:ring-amber-500/10 outline-none shadow-sm transition-all"
                                                />
                                            </div>
                                            <div className="hidden sm:block text-amber-300">
                                                <ChevronRight size={32} />
                                            </div>
                                            <div className="w-full">
                                                <label className="block text-[10px] font-black text-amber-700 uppercase mb-2 ml-1">Cierre mañana</label>
                                                <input
                                                    type="time"
                                                    value={formData.openingHours.morningEnd}
                                                    onChange={(e) => handleTimeChange('morningEnd', e.target.value)}
                                                    className="w-full px-6 py-4 text-center bg-white border border-amber-200 text-amber-900 rounded-[1.25rem] font-bold text-xl focus:ring-8 focus:ring-amber-500/10 outline-none shadow-sm transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 shadow-sm">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                                <Clock size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-indigo-900 text-xl tracking-tight">Turno de Tarde</h4>
                                                <p className="text-indigo-700/60 text-xs font-bold uppercase tracking-widest">Cierre estándar</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-center gap-6">
                                            <div className="w-full">
                                                <label className="block text-[10px] font-black text-indigo-700 uppercase mb-2 ml-1">Apertura tarde</label>
                                                <input
                                                    type="time"
                                                    value={formData.openingHours.afternoonStart}
                                                    onChange={(e) => handleTimeChange('afternoonStart', e.target.value)}
                                                    className="w-full px-6 py-4 text-center bg-white border border-indigo-200 text-indigo-900 rounded-[1.25rem] font-bold text-xl focus:ring-8 focus:ring-indigo-500/10 outline-none shadow-sm transition-all"
                                                />
                                            </div>
                                            <div className="hidden sm:block text-indigo-200">
                                                <ChevronRight size={32} />
                                            </div>
                                            <div className="w-full">
                                                <label className="block text-[10px] font-black text-indigo-700 uppercase mb-2 ml-1">Hora de cierre</label>
                                                <input
                                                    type="time"
                                                    value={formData.openingHours.afternoonEnd}
                                                    onChange={(e) => handleTimeChange('afternoonEnd', e.target.value)}
                                                    className="w-full px-6 py-4 text-center bg-white border border-indigo-200 text-indigo-900 rounded-[1.25rem] font-bold text-xl focus:ring-8 focus:ring-indigo-500/10 outline-none shadow-sm transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ACTIVE TAB: ROLES */}
                            {activeTab === 'roles' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {renderRoleConfig('sales_register', 'Caja de Ventas', ShoppingCart, 'text-blue-600')}
                                        {renderRoleConfig('purchase_register', 'Caja de Compras', Package, 'text-orange-600')}
                                        {renderRoleConfig('shuttle', 'Lanzadera', Truck, 'text-purple-600')}
                                        {renderRoleConfig('cleaning', 'Limpieza', Sparkles, 'text-emerald-600')}
                                    </div>

                                    {/* RI Config Especial */}
                                    <div className="mt-8 p-8 bg-violet-50/30 rounded-[2.5rem] border border-violet-100 flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-violet-600 shadow-sm border border-violet-100">
                                                <UserCheck size={32} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-lg">Reunión Individual (RI)</h4>
                                                <p className="text-slate-500 text-xs font-medium">Configura la hora de entrada exclusiva para RIs</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                                            <span className="text-[10px] font-black text-slate-400 uppercase ml-4">Entrada RI:</span>
                                            <CustomTimePicker
                                                className="!border-none !shadow-none !px-4 !py-3 font-black text-indigo-600 text-lg"
                                                value={formData.individualMeetingStartTime || ''}
                                                onChange={(val) => handleChange('individualMeetingStartTime', val)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ACTIVE TAB: HOLIDAYS */}
                            {activeTab === 'holidays' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                                                <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                                    <CalendarIcon size={18} className="text-rose-500" />
                                                    Añadir Nuevo Festivo
                                                </h4>

                                                <div className="space-y-6">
                                                    <div className="relative group">
                                                        <DatePicker
                                                            value={newHoliday}
                                                            onChange={setNewHoliday}
                                                            className="w-full !rounded-2xl !py-4 !px-6 border-slate-200"
                                                            variant="light"
                                                        />
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {(['full', 'afternoon', 'closed_afternoon'] as const).map(type => (
                                                            <button
                                                                key={type}
                                                                onClick={() => setNewHolidayType(type)}
                                                                className={clsx(
                                                                    "flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                                                                    newHolidayType === type
                                                                        ? "bg-rose-500 text-white border-rose-600 shadow-md"
                                                                        : "bg-white text-slate-500 border-slate-100 hover:border-rose-200"
                                                                )}
                                                            >
                                                                {type === 'full' ? 'Cerrado' : type === 'afternoon' ? 'Tarde Festiva' : 'Cierre Tarde'}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <button
                                                        onClick={addHoliday}
                                                        disabled={!newHoliday}
                                                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50"
                                                    >
                                                        <BadgeCheck size={18} />
                                                        Registrar Festivo
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2 ml-2">
                                                Próximos Cierres
                                                <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black">{formData.holidays.length}</span>
                                            </h4>

                                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                                {formData.holidays.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-slate-400">
                                                        <CalendarIcon size={40} className="mb-4 opacity-20" />
                                                        <p className="font-bold italic text-sm">No hay fechas configuradas</p>
                                                    </div>
                                                ) : (
                                                    formData.holidays.map((h, idx) => {
                                                        const dateObj = new Date(h.date);
                                                        const isFull = h.type === 'full';
                                                        const isAfternoon = h.type === 'afternoon';

                                                        return (
                                                            <div key={idx} className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl hover:border-rose-200 hover:shadow-xl hover:shadow-rose-100/30 transition-all duration-300">
                                                                <div className="flex items-center gap-5">
                                                                    <div className={clsx(
                                                                        "w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white font-bold",
                                                                        isFull ? "bg-rose-500" : isAfternoon ? "bg-amber-500" : "bg-indigo-500"
                                                                    )}>
                                                                        <span className="text-[9px] leading-none uppercase">{dateObj.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</span>
                                                                        <span className="text-lg leading-none mt-0.5">{dateObj.getDate()}</span>
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="font-bold text-slate-800 capitalize leading-none">{dateObj.toLocaleDateString('es-ES', { weekday: 'long' })}</h5>
                                                                        <span className={clsx(
                                                                            "text-[10px] font-black uppercase tracking-widest mt-1 inline-block",
                                                                            isFull ? "text-rose-600" : isAfternoon ? "text-amber-600" : "text-indigo-600"
                                                                        )}>
                                                                            {h.type === 'full' ? 'Cerrado' : h.type === 'afternoon' ? 'Tarde Festiva' : 'Cierre Tarde'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => toggleHoliday(h.date)}
                                                                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all group-hover:scale-100 scale-90 opacity-0 group-hover:opacity-100 font-bold"
                                                                >
                                                                    &times;
                                                                </button>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SettingsPage;
