import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

import { useNavigate } from 'react-router-dom';
import { LogoBossDirecting } from '../components/BrandLogo';
import { clsx } from 'clsx';
import { Lock, X, ChevronRight, Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const LoginPage: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // State for Password Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStore, setSelectedStore] = useState<{ id: string, name: string } | null>(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    const handleStoreClick = (store: { id: string, name: string }) => {
        setSelectedStore(store);
        setIsModalOpen(true);
        setPassword('');
        setError('');
    };

    // Auth State
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const getEmailForStore = (storeId: string) => {
        if (storeId === '1') return 'tienda1@bemanager.com';
        if (storeId === '2') return 'tienda2@bemanager.com';
        if (storeId === 'super') return 'admin@bemanager.com';
        // Fallback for others (3, 4, 5, 6, 7)
        return `tienda${storeId}@bemanager.com`;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStore) return;

        setIsAuthenticating(true);
        setError('');

        const email = getEmailForStore(selectedStore.id);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err: any) {
            console.error("Login Error:", err);

            // Auto-Seeding: If user not found, create it (ONLY FOR MIGRATION PHASE)
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                try {
                    // Check if it's invalid creds (exists but wrong pass) vs not found.
                    // 'auth/invalid-credential' is returned for both in newer SDKs for security? 
                    // Let's try to create, if it exists it will fail with email-already-in-use.

                    await createUserWithEmailAndPassword(auth, email, password);
                    // If successful, we are logged in
                    navigate('/');
                } catch (createErr: any) {
                    if (createErr.code === 'auth/email-already-in-use') {
                        setError('Contraseña incorrecta');
                    } else {
                        setError('Error al iniciar sesión: ' + createErr.message);
                    }
                }
            } else {
                setError('Error: ' + err.message);
            }
        } finally {
            setIsAuthenticating(false);
        }
    };

    // BeManager Logo Component (Large Version)
    const LogoLarge = () => (
        <div className="flex flex-col items-center gap-4 mb-2">
            <div className="w-24 h-24 transition-all duration-500 hover:scale-110 drop-shadow-2xl">
                <LogoBossDirecting className="w-full h-full text-indigo-600" />
            </div>
            {/* Removed text here as it's below in the main layout */}
        </div>
    );

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#F1F5F9] font-sans selection:bg-indigo-100 selection:text-indigo-900">

            {/* Dynamic Background Elements - Light Mode */}
            <div className="absolute inset-0 w-full h-full overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] bg-blue-200/40 rounded-full mix-blend-multiply filter blur-[80px] animate-blob" />
                <div className="absolute top-[-10%] right-[-20%] w-[60vw] h-[60vw] bg-purple-200/40 rounded-full mix-blend-multiply filter blur-[80px] animate-blob animation-delay-2000" />
                <div className="absolute -bottom-32 left-[20%] w-[60vw] h-[60vw] bg-pink-200/40 rounded-full mix-blend-multiply filter blur-[80px] animate-blob animation-delay-4000" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            {/* Main Glass Container */}
            <div className={clsx("relative z-10 w-full max-w-5xl mx-4 transition-all duration-500", isModalOpen ? "blur-sm scale-95 opacity-50 pointer-events-none" : "")}>
                <div className="backdrop-blur-2xl bg-white/70 border border-white/60 rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] p-8 md:p-16 overflow-hidden">

                    {/* Decorative Top Line */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-30"></div>

                    <div className="flex flex-col items-center text-center mb-16 space-y-4">
                        <div className="relative group cursor-default">
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-40 group-hover:animate-shine" />
                            <div className="relative transition-transform duration-500 hover:scale-[1.02] drop-shadow-xl">
                                <LogoLarge />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-900 animate-gradient-x pb-2">
                                BeManager
                            </h2>
                            <p className="text-slate-500 font-medium text-lg tracking-wide">
                                Sistema de Gestión Inteligente
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 md:gap-8">
                        {[
                            {
                                id: '1',
                                name: 'Sevilla 1',
                                initials: 'S1',
                                role: 'Gestión de Tienda',
                                gradient: 'from-amber-100 to-orange-100',
                                iconColor: 'text-orange-600',
                                border: 'hover:border-orange-200',
                                shadow: 'hover:shadow-orange-200'
                            },
                            {
                                id: '2',
                                name: 'Sevilla 2',
                                initials: 'S2',
                                role: 'Gestión de Tienda',
                                gradient: 'from-cyan-100 to-blue-100',
                                iconColor: 'text-blue-600',
                                border: 'hover:border-blue-200',
                                shadow: 'hover:shadow-blue-200'
                            },
                            {
                                id: 'super',
                                name: 'Supervisión',
                                initials: 'HQ',
                                role: 'Control Global',
                                gradient: 'from-fuchsia-100 to-purple-100',
                                iconColor: 'text-purple-600',
                                border: 'hover:border-purple-200',
                                shadow: 'hover:shadow-purple-200',
                                isSpecial: true
                            },
                        ].map((store) => (
                            <button
                                key={store.id}
                                onClick={() => handleStoreClick({ id: store.id, name: store.name })}
                                className={`
                                    group relative w-full md:w-64 p-1 rounded-[2.5rem] transition-all duration-300
                                    hover:-translate-y-2
                                `}
                            >
                                <div className={`
                                    relative h-full bg-white rounded-[2.2rem] border border-slate-100 p-6 flex flex-col items-center overflow-hidden transition-all duration-300
                                    shadow-sm hover:shadow-xl ${store.shadow} ${store.border}
                                `}>

                                    {/* Icon Container */}
                                    <div className={`
                                        w-20 h-20 mb-6 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-3
                                        bg-gradient-to-br ${store.gradient} ${store.iconColor}
                                    `}>
                                        {store.initials}
                                    </div>

                                    {/* Text Content */}
                                    <div className="text-center space-y-2 relative z-10">
                                        <h3 className="text-xl font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                                            {store.name}
                                        </h3>
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-indigo-400 transition-colors">
                                            {store.role}
                                        </p>
                                    </div>

                                    {/* Arrow Indicator */}
                                    <div className="mt-6 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 text-indigo-400">
                                        <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                    </div>

                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-16 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-400 shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Sistema Operativo v3.0
                        </div>
                    </div>

                </div>
            </div>

            {/* Password Modal */}
            {isModalOpen && selectedStore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0" onClick={() => setIsModalOpen(false)}></div>
                    <form
                        onSubmit={handleLogin}
                        className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 animate-in fade-in zoom-in-95 duration-200"
                    >
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-6 right-6 p-2 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="mb-8 text-center">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-sm">
                                <Lock size={28} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-1">Acceso Seguro</h3>
                            <p className="text-slate-500 font-medium text-sm">Introduce la contraseña para <strong className="text-indigo-600">{selectedStore.name}</strong></p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError('');
                                    }}
                                    className={clsx(
                                        "w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-lg text-center tracking-widest transition-all",
                                        "placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal",
                                        error
                                            ? "border-rose-200 text-rose-600 focus:ring-4 focus:ring-rose-500/10"
                                            : "border-slate-100 text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white"
                                    )}
                                    placeholder="••••••••"
                                    autoFocus
                                />
                                {error && (
                                    <p className="text-center text-xs font-bold text-rose-500 animate-in slide-in-from-top-1">
                                        {error}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:pointer-events-none"
                                disabled={isAuthenticating}
                            >
                                <span>Entrar</span>
                                {isAuthenticating ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
                .animate-shine {
                    animation: shine 1s;
                }
                @keyframes shine {
                    100% { left: 125%; }
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
