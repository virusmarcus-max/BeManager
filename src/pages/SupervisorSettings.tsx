import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Save, User, Lock, Bell, ShieldCheck, Store, Key } from 'lucide-react';
import clsx from 'clsx';
import type { StoreSettings } from '../types';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';

const SupervisorSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { getSettings, updateSettings } = useStore();

    if (!user || user.role !== 'admin') return null;

    const [formData, setFormData] = useState<StoreSettings>(getSettings('super'));
    const [dirty, setDirty] = useState(false);

    const handleChange = (field: keyof StoreSettings, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setDirty(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateSettings(formData);
        setDirty(false);

        // Toast notification
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-8 right-8 bg-purple-600 text-white px-8 py-4 rounded-2xl shadow-[0_20px_50px_rgba(147,51,234,0.3)] animate-in slide-in-from-bottom duration-500 flex items-center gap-3 z-50 font-bold border border-purple-400/30 backdrop-blur-md';
        toast.innerHTML = '<div class="bg-white/20 p-1.5 rounded-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div> Configuración guardada';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-4', 'transition-all', 'duration-500');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };

    // Use predefined stores + getSettings (which handles defaults/fallbacks)
    const storeSettingsList = Object.keys(DEFAULT_STORE_NAMES).map(id => getSettings(id));

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-0">
            {/* Header */}
            <div className="relative mb-8 p-8 md:p-12 bg-slate-900/60 rounded-[2.5rem] overflow-hidden border border-slate-700 shadow-sm transition-all duration-500 group">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-700" />

                <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                            <div className="bg-purple-600 p-2.5 rounded-2xl shadow-lg shadow-purple-900/50 text-white">
                                <ShieldCheck size={24} />
                            </div>
                            <span className="text-purple-400 font-bold uppercase tracking-[0.2em] text-xs">Administración Global</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-100 tracking-tight leading-tight">
                            Perfil de <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">Supervisor</span>
                        </h1>
                        <p className="text-slate-400 mt-4 text-lg max-w-2xl font-medium leading-relaxed">
                            Gestiona tus credenciales de acceso, datos personales y visualiza los accesos de las tiendas.
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={handleSubmit}
                            disabled={!dirty}
                            className={clsx(
                                "group relative flex items-center gap-3 px-10 py-4 rounded-[1.5rem] font-bold transition-all overflow-hidden",
                                dirty
                                    ? "bg-purple-600 text-white shadow-xl shadow-purple-900/50 hover:scale-[1.02] active:scale-95"
                                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                            )}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <Save size={20} className={dirty ? "animate-pulse" : ""} />
                            <span>Guardar Cambios</span>
                        </button>
                        {dirty && (
                            <span className="text-amber-400 text-xs font-bold animate-bounce flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                                <Bell size={12} /> Tienes cambios sin guardar
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="bg-slate-900/60 rounded-[2.5rem] border border-slate-700 shadow-sm p-8 md:p-12 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

                    {/* Personal Info */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-black text-slate-200 flex items-center gap-3">
                            <User size={20} className="text-purple-400" />
                            Información Personal
                        </h3>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nombre Completo</label>
                            <input
                                type="text"
                                value={formData.managerName}
                                onChange={e => handleChange('managerName', e.target.value)}
                                className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-4 focus:ring-purple-500/20 focus:bg-slate-800 transition-all outline-none font-bold text-slate-200 shadow-inner"
                                placeholder="Tu nombre..."
                            />
                            <p className="text-[10px] text-slate-500 font-medium ml-2">Este nombre aparecerá en la interfaz como el usuario activo.</p>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-black text-slate-200 flex items-center gap-3">
                            <Lock size={20} className="text-amber-400" />
                            Seguridad
                        </h3>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Contraseña de Acceso</label>
                            <input
                                type="text"
                                value={formData.password || ''}
                                onChange={e => handleChange('password', e.target.value)}
                                className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-4 focus:ring-purple-500/20 focus:bg-slate-800 transition-all outline-none font-bold text-slate-200 shadow-inner tracking-widest"
                                placeholder="Nueva contraseña..."
                            />
                            <p className="text-[10px] text-slate-500 font-medium ml-2">Necesaria para iniciar sesión como Supervisión.</p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Stores Passwords Section */}
            <div className="bg-slate-900/60 rounded-[2.5rem] border border-slate-700 shadow-sm p-8 md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h3 className="text-xl font-black text-slate-200 flex items-center gap-3 mb-8">
                    <Store size={20} className="text-emerald-400" />
                    Accesos a Tiendas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {storeSettingsList.map(store => (
                        <div key={store.establishmentId} className="bg-slate-800/10 border border-slate-700/50 rounded-[1.5rem] p-6 group hover:bg-slate-800/30 hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                                    <Store size={18} />
                                </div>
                                <span className="font-bold text-slate-200 text-lg">{store.storeName}</span>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Contraseña Actual</label>
                                <div className="flex items-center gap-3 font-mono text-emerald-400 bg-slate-950/50 px-4 py-3 rounded-xl border border-slate-800/50 group-hover:border-emerald-500/20 transition-colors">
                                    <Key size={14} className="text-slate-600" />
                                    <span className="tracking-wider">{store.password || 'Sin contraseña'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {storeSettingsList.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-500">
                            No hay tiendas configuradas.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupervisorSettingsPage;
