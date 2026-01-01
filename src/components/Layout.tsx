import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Users, Calendar, BarChart3, LogOut, Menu, Settings, CheckCircle, Radio, CheckSquare, Coins } from 'lucide-react';
import { LogoBossDirecting } from './BrandLogo';
import clsx from 'clsx';

const Layout = () => {
    const { user, logout } = useAuth();
    const { getSettings, tasks, timeOffRequests, schedules, incentiveReports } = useStore();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const location = useLocation();

    // Check for urgent tasks (Priority based or Overdue)
    const hasUrgentTasks = tasks.some(t => {
        if (!user) return false;
        if (t.isArchived) return false;

        if (user.role === 'admin') {
            // Supervisor: alert for critical/overdue tasks globally
            const isCritical = t.priority === 'critical' || t.priority === 'high';
            const isOverdue = t.date && (new Date(t.date) <= new Date());

            if (!isCritical && !isOverdue) return false;

            // Check if any assigned store is not completed
            if (t.targetStores === 'all') return true;
            return t.targetStores.some(sid => t.status[sid]?.status !== 'completed');
        } else {
            // Manager: alert for critical/overdue tasks assigned to their store
            const isAssigned = t.targetStores === 'all' || (user.establishmentId && t.targetStores.includes(user.establishmentId));
            if (!isAssigned) return false;

            const myStatus = t.status[user.establishmentId]?.status || 'pending';
            if (myStatus === 'completed') return false;

            if (t.priority === 'critical' || t.priority === 'high') return true;

            if (t.date) {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const dueDate = new Date(t.date);
                const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                return dueDay <= today; // Today or overdue
            }
        }
        return false;
    });

    // Check for Pending Approvals (Supervisor)
    const hasPendingApprovals =
        timeOffRequests.some(r => r.status === 'pending') ||
        schedules.some(s => s.approvalStatus === 'pending' || s.modificationStatus === 'requested');

    // Check for Pending Incentives (Manager)
    const hasPendingIncentives = (() => {
        if (!user || user.role === 'admin') return false;

        // 1. Check for changes requested
        const hasChanges = incentiveReports.some(r => r.establishmentId === user.establishmentId && r.status === 'changes_requested');
        if (hasChanges) return true;

        // 2. Check for Previous Month Pending Submission
        const now = new Date();
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const yyyy = prevDate.getFullYear();
        const mm = String(prevDate.getMonth() + 1).padStart(2, '0');
        const prevMonthStr = `${yyyy}-${mm}`;

        const prevReport = incentiveReports.find(r => r.establishmentId === user.establishmentId && r.month === prevMonthStr);

        // If not exists OR is draft -> Pending
        if (!prevReport || prevReport.status === 'draft') return true;

        return false;
    })();

    // BeManager Logo Component
    const Logo = () => (
        <div className="flex flex-col items-center gap-2 mb-6">
            <div className={`transition-all duration-300 ${sidebarOpen ? 'w-16 h-16' : 'w-10 h-10'}`}>
                <LogoBossDirecting className="w-full h-full" />
            </div>
            {sidebarOpen && <span className="text-sm font-bold text-slate-700 tracking-wide mt-2">BeManager</span>}
        </div>
    );

    if (!user) return null;

    const settings = getSettings(user.establishmentId);
    const displayName = settings.managerName || user.name;

    // Role-based Layout Settings
    const isSupervisor = user.role === 'admin';
    const isDarkMode = isSupervisor; // Supervisors are always Dark Mode. Managers are Light.

    // Navigation Items Definition
    const managerNavItems = [
        { to: '/', label: 'Dashboard', icon: BarChart3 },
        { to: '/manager-live', label: 'En Vivo', icon: Radio },
        { to: '/schedule', label: 'Horarios', icon: Calendar },
        { to: '/employees', label: 'Empleados', icon: Users },
        { to: '/tasks', label: 'Tareas', icon: CheckSquare, isUrgent: hasUrgentTasks },
        { to: '/incentives', label: 'Incentivos', icon: Coins, isUrgent: hasPendingIncentives },
    ];

    const supervisorNavItems = [
        { to: '/', label: 'Dashboard', icon: BarChart3 },
        { to: '/live', label: 'En Vivo', icon: Radio },
        { to: '/approvals', label: 'Horarios', icon: CheckCircle, isUrgent: hasPendingApprovals },
        { to: '/tasks', label: 'Tareas', icon: CheckSquare, isUrgent: hasUrgentTasks },
        { to: '/supervision/incentives', label: 'Incentivos', icon: Coins },
    ];

    const navItems = isSupervisor ? supervisorNavItems : managerNavItems;

    const currentPathLabel = navItems.find(item =>
        item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
    )?.label || 'BeManager';

    return (
        <div className={clsx(
            "flex h-screen font-sans overflow-hidden relative transition-colors duration-500",
            isDarkMode ? "bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white" : "bg-[#F1F5F9] text-slate-900 selection:bg-indigo-100 selection:text-indigo-900"
        )}>
            {/* Dynamic Background Elements */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
                {isDarkMode ? (
                    <>
                        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-900/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
                        <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] bg-purple-900/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000" />
                        <div className="absolute -bottom-20 left-[10%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000" />
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 brightness-100 contrast-150 mix-blend-overlay"></div>
                    </>
                ) : (
                    <>
                        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-blue-100/40 rounded-full mix-blend-multiply filter blur-[80px] animate-blob" />
                        <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] bg-purple-100/40 rounded-full mix-blend-multiply filter blur-[80px] animate-blob animation-delay-2000" />
                        <div className="absolute -bottom-20 left-[10%] w-[50vw] h-[50vw] bg-pink-100/40 rounded-full mix-blend-multiply filter blur-[80px] animate-blob animation-delay-4000" />
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                    </>
                )}
            </div>

            {/* Sidebar / Navigation Rail */}
            <aside
                className={clsx(
                    "relative z-50 transition-all duration-500 ease-out flex flex-col fixed inset-y-4 left-4 rounded-[2.5rem] md:relative md:inset-0 md:ml-4 md:my-4 md:h-[calc(100vh-32px)] border",
                    // Glassmorphism variants
                    isDarkMode
                        ? "backdrop-blur-2xl bg-slate-900/70 border-slate-800 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.3)]"
                        : "backdrop-blur-2xl bg-white/80 border-white/60 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.05)]",
                    sidebarOpen ? "w-72" : "w-[96px] -translate-x-[150%] md:translate-x-0"
                )}
            >
                <div className={clsx("py-8 flex flex-col items-center border-b mb-2", isDarkMode ? "border-slate-800" : "border-slate-100/50")}>
                    <Logo />
                </div>

                <nav className="flex-1 px-4 space-y-3 overflow-y-auto flex flex-col items-center mt-2 custom-scrollbar">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            title={!sidebarOpen ? item.label : undefined}
                            className={({ isActive }) => clsx(
                                "relative flex items-center justify-center transition-all duration-300 group cursor-pointer",
                                sidebarOpen ? "w-full px-5 py-4 rounded-[1.5rem] gap-4 justify-start" : "w-14 h-14 rounded-[1.5rem]",
                                isActive
                                    ? (isDarkMode ? "bg-indigo-600/20 text-indigo-300 shadow-lg shadow-indigo-900/20 border border-indigo-500/30" : "bg-slate-900 text-white shadow-lg shadow-slate-900/20")
                                    : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-indigo-300" : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"),
                                (item as any).isUrgent && !isActive && "animate-pulse !text-rose-500 !border-rose-500/50 !bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    {/* Icon */}
                                    <item.icon
                                        size={22}
                                        strokeWidth={isActive ? 2.5 : 2}
                                        className={clsx(
                                            "relative z-10 transition-transform duration-300",
                                            isActive ? "scale-105" : "group-hover:scale-110"
                                        )}
                                    />

                                    {/* Label (Expanded mode) */}
                                    {sidebarOpen && (
                                        <span className={clsx("font-bold text-sm tracking-wide relative z-10")}>{item.label}</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className={clsx("p-5 mt-auto border-t flex flex-col items-center gap-4", isDarkMode ? "border-slate-800" : "border-slate-100/50")}>
                    <NavLink
                        to="/settings"
                        title={!sidebarOpen ? 'Configuración' : undefined}
                        className={({ isActive }) => clsx(
                            "relative flex items-center justify-center transition-all duration-300 group cursor-pointer",
                            sidebarOpen ? "w-full px-5 py-3 rounded-2xl gap-3 justify-start" : "w-12 h-12 rounded-2xl",
                            isActive
                                ? (isDarkMode ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30" : "bg-slate-100 text-indigo-600 border border-slate-200")
                                : (isDarkMode ? "text-slate-400 hover:text-indigo-300" : "text-slate-500 hover:text-indigo-600")
                        )}
                    >
                        <Settings size={20} />
                        {sidebarOpen && <span className="font-bold text-sm">Configuración</span>}
                    </NavLink>

                    <button
                        onClick={logout}
                        title="Cerrar Sesión"
                        className={clsx(
                            "flex items-center justify-center transition-all duration-300",
                            isDarkMode ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20" : "text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100",
                            sidebarOpen ? "w-full gap-3 px-4 py-3 rounded-2xl border border-transparent" : "w-12 h-12 rounded-2xl"
                        )}
                    >
                        <LogOut size={20} />
                        {sidebarOpen && <span className="font-bold text-sm">Salir</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative h-screen z-10">
                {/* Header */}
                <header className="h-32 flex items-center justify-between px-8 md:px-12 shrink-0">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className={clsx(
                                "p-3 rounded-2xl md:hidden transition-all backdrop-blur-sm",
                                isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-lg bg-white/50"
                            )}
                        >
                            <Menu size={24} />
                        </button>
                        <div className="flex flex-col gap-1 anim-enter-fade">
                            <h1 className={clsx("text-4xl font-extrabold tracking-tight leading-none bg-clip-text text-transparent",
                                isDarkMode ? "bg-gradient-to-r from-white to-slate-400" : "bg-gradient-to-r from-slate-900 to-slate-700"
                            )}>
                                {currentPathLabel}
                            </h1>
                            <p className={clsx("font-medium flex items-center gap-2 text-sm", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                                Hola, <span className={clsx("font-bold", isDarkMode ? "text-slate-200" : "text-slate-800")}>{displayName.split(' ')[0]}</span> <span className="text-xl animate-wave origin-[70%_70%]">👋</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center anim-enter-fade animation-delay-100">
                        <div className={clsx(
                            "backdrop-blur-md rounded-[2rem] pl-6 pr-2 py-2 flex items-center gap-6 shadow-sm border hover:shadow-md transition-all group cursor-default",
                            isDarkMode ? "bg-slate-900/60 border-slate-700" : "bg-white/60 border-white/60"
                        )}>
                            <div className="text-right hidden sm:block">
                                <p className={clsx("text-xs font-black uppercase tracking-widest transition-colors",
                                    isDarkMode ? "text-slate-300 group-hover:text-indigo-400" : "text-slate-800 group-hover:text-indigo-600"
                                )}>{settings.storeName || user.establishmentName}</p>
                                <div className="flex items-center justify-end gap-1.5 mt-1">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                    </span>
                                    <p className={clsx("text-[10px] font-bold tracking-wide", isDarkMode ? "text-slate-500" : "text-slate-400")}>En línea</p>
                                </div>
                            </div>
                            <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
                                {displayName.charAt(0)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto px-4 md:px-12 pb-8 scroll-smooth custom-scrollbar">
                    <Outlet />
                </main>
            </div>

            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 10s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
                @keyframes wave {
                    0% { transform: rotate(0.0deg) }
                    10% { transform: rotate(14.0deg) }
                    20% { transform: rotate(-8.0deg) }
                    30% { transform: rotate(14.0deg) }
                    40% { transform: rotate(-4.0deg) }
                    50% { transform: rotate(10.0deg) }
                    60% { transform: rotate(0.0deg) }
                    100% { transform: rotate(0.0deg) }
                }
                .animate-wave {
                    display: inline-block;
                    animation-name: wave;
                    animation-duration: 2.5s;
                    animation-iteration-count: infinite;
                    transform-origin: 70% 70%;
                }
                .anim-enter-fade {
                    animation: enter-fade 0.5s ease-out forwards;
                    opacity: 0;
                    transform: translateY(10px);
                }
                @keyframes enter-fade {
                    to { opacity: 1; transform: translateY(0); }
                }
                .animation-delay-100 { animation-delay: 0.1s; }
            `}</style>
        </div>
    );
};

export default Layout;
