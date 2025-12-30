import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Clock, Calendar, TrendingUp, FileText, UserCheck, UserX, Briefcase, Plane, AlertTriangle, AlertCircle, Bell, X, Check, Search, CheckSquare } from 'lucide-react';
import AnnualPlanModal from '../components/AnnualPlanModal';
import SupervisorDashboard from './SupervisorDashboard';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();

    // Redirect to Supervisor Dashboard if admin
    if (user?.role === 'admin') {
        return <SupervisorDashboard />;
    }

    const { employees, schedules, timeOffRequests, updateHoursDebt, getSettings, hoursDebtLogs, notifications, removeNotification, tasks, updateTaskStatus } = useStore();
    const [selectedEmpForHistory] = useState<string | null>(null);
    const [isRequestHistoryOpen, setIsRequestHistoryOpen] = useState(false);
    const [isDebtHistoryOpen, setIsDebtHistoryOpen] = useState(false);
    const [selectedDebtYear, setSelectedDebtYear] = useState(new Date().getFullYear());
    const [isAnnualPlanOpen, setIsAnnualPlanOpen] = useState(false);

    // Notification State
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [alertState, setAlertState] = useState<Record<string, number>>(() => {
        try {
            return JSON.parse(localStorage.getItem('dashboard_dismissed_alerts') || '{}');
        } catch { return {}; }
    });

    const updateAlertState = (id: string, snoozeUntil: number) => {
        // snoozeUntil: -1 (Dismissed/Read), or Timestamp (Snoozed)
        const newState = { ...alertState, [id]: snoozeUntil };
        setAlertState(newState);
        localStorage.setItem('dashboard_dismissed_alerts', JSON.stringify(newState));
    };

    // Manual Debt Adjustment State
    const [selectedDebtEmp, setSelectedDebtEmp] = useState('');
    const [manualDebtAmount, setManualDebtAmount] = useState<number | ''>('');
    const [manualDebtReason, setManualDebtReason] = useState('');
    const [debtSearchQuery, setDebtSearchQuery] = useState('');

    const handleAddManualDebt = () => {
        if (selectedDebtEmp && manualDebtAmount && manualDebtReason) {
            updateHoursDebt(selectedDebtEmp, Number(manualDebtAmount), manualDebtReason);
            setManualDebtAmount('');
            setManualDebtReason('');
            setSelectedDebtEmp('');
        }
    };

    if (!user) return null;

    const settings = getSettings(user.establishmentId);
    const myEmployees = employees.filter(e => e.establishmentId === user.establishmentId);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Get current week dates
    const currentWeekStart = (() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    })();

    const currentSchedule = schedules.find(s => s.weekStartDate === currentWeekStart && s.establishmentId === user.establishmentId);

    // Calculate Hours Today
    const hoursToday = currentSchedule ? currentSchedule.shifts
        .filter(s => s.date === today && (s.type === 'morning' || s.type === 'afternoon' || s.type === 'split'))
        .reduce((acc, s) => {
            // Simple calc: 4h for morning/afternoon, 8h for split if exact times not parsed. 
            // Better: Parse if available.
            const parseTime = (t?: string) => t ? parseInt(t.split(':')[0]) + parseInt(t.split(':')[1]) / 60 : 0;
            if (s.type === 'split') {
                if (s.startTime && s.endTime) {
                    const mStart = parseTime(s.startTime);
                    const mEnd = parseTime(s.morningEndTime);
                    const aStart = parseTime(s.afternoonStartTime);
                    const aEnd = parseTime(s.endTime);
                    return acc + (mEnd - mStart) + (aEnd - aStart);
                }
                return acc + 8;
            }
            if (s.startTime && s.endTime) {
                return acc + (parseTime(s.endTime) - parseTime(s.startTime));
            }
            return acc + 4;
        }, 0) : 0;

    // Calculate Hours This Week
    const hoursThisWeek = currentSchedule ? currentSchedule.shifts
        .filter(s => s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
        .reduce((acc, s) => {
            if (s.type === 'split') return acc + 8; // Simplify for total view
            return acc + 4;
        }, 0) : 0;

    const employeesWorkingToday = currentSchedule?.shifts.filter(s => s.date === today && (s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')).length || 0;
    const totalContractedHours = myEmployees.reduce((acc, e) => acc + e.weeklyHours, 0);



    const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear());

    const sickLeavePerEmployee = myEmployees.map(emp => {
        const totalSick = schedules
            .filter(s => s.status === 'published' && s.establishmentId === user.establishmentId)
            // Use dashboardYear instead of selectedSickYear
            .filter(s => {
                const startY = new Date(s.weekStartDate).getFullYear();
                const endY = new Date(s.weekStartDate);
                endY.setDate(endY.getDate() + 6);
                return startY === dashboardYear || endY.getFullYear() === dashboardYear;
            })
            .flatMap(s => s.shifts)
            .filter(s => s.employeeId === emp.id && s.type === 'sick_leave')
            // Double check individual shift date if needed, but week filter is usually enough. 
            // Let's rely on weekStartDate overlap or check shift date if available.
            // Simplified: Filter shifts roughly by year if they fall in that schedule
            .length;
        return { name: emp.name, days: totalSick };
    }).filter(i => i.days > 0).sort((a, b) => b.days - a.days);

    // Calculate Vacation Days (Year) - Disfrutadas vs Programadas
    const vacationDaysPerEmployee = myEmployees.map(emp => {
        const empVacationDates = timeOffRequests
            .filter(r => r.employeeId === emp.id && r.type === 'vacation')
            .flatMap(r => r.dates)
            .filter(d => {
                const targetDate = new Date(d);
                if (targetDate.getFullYear() !== dashboardYear) return false;

                // Check overlap with Sick Leave
                const empSickLeaves = timeOffRequests.filter(r => r.employeeId === emp.id && r.type === 'sick_leave');
                const isOverlapped = empSickLeaves.some(sick => {
                    const start = new Date(sick.startDate || sick.dates[0]);
                    const end = sick.endDate ? new Date(sick.endDate) : new Date('2099-12-31');
                    start.setHours(0, 0, 0, 0);
                    end.setHours(0, 0, 0, 0);
                    const t = new Date(d);
                    t.setHours(0, 0, 0, 0);
                    return t >= start && t <= end;
                });

                return !isOverlapped;
            });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const enjoyed = empVacationDates.filter(d => new Date(d) < today).length;
        const scheduled = empVacationDates.filter(d => new Date(d) >= today).length;

        return { name: emp.name, enjoyed, scheduled, total: enjoyed + scheduled };
    }).sort((a, b) => b.total - a.total);

    const saturdaysOffPerEmployee = myEmployees.map(emp => {
        const empShifts = schedules
            .filter(s => s.establishmentId === user.establishmentId)
            .flatMap(s => s.shifts)
            .filter(s => s.employeeId === emp.id);

        const saturdaysOff = empShifts.filter(s => {
            const d = new Date(s.date);
            // Use dashboardYear
            return d.getFullYear() === dashboardYear && d.getDay() === 6 && s.type === 'off';
        });

        // Group by month
        const monthlyCounts = saturdaysOff.reduce((acc, s) => {
            const monthIndex = new Date(s.date).getMonth(); // 0-11
            acc[monthIndex] = (acc[monthIndex] || 0) + 1;
            return acc;
        }, {} as Record<number, number>);

        return {
            name: emp.name,
            total: saturdaysOff.length,
            monthly: monthlyCounts
        };
    }).sort((a, b) => b.total - a.total);

    // Monthly/Annual requests per employee





    // Generate Alerts Logic
    const activeAlerts = React.useMemo(() => {
        const alerts: { id: string; type: 'warning' | 'error' | 'info' | 'success'; message: string; icon: any; isSystem?: boolean; contextNotifId?: string }[] = [];

        // 0. Context Notifications (Supervisor/System messages)
        const myNotifs = notifications.filter(n => n.establishmentId === user.establishmentId && !n.read);
        myNotifs.forEach(n => {
            alerts.push({
                id: `notif_${n.id}`,
                type: n.type,
                message: n.message,
                icon: n.type === 'success' ? Check : (n.type === 'error' ? AlertTriangle : Bell),
                isSystem: false,
                contextNotifId: n.id
            });
        });

        // 1. Contract Expirations (Next 30 days)
        myEmployees.forEach(emp => {
            if (emp.contractEndDate) {
                const daysUntil = Math.ceil((new Date(emp.contractEndDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                if (daysUntil >= 0 && daysUntil <= 30) {
                    alerts.push({ id: `contract_${emp.id}`, type: 'warning', message: `Contrato de ${emp.name} vence en ${daysUntil} días`, icon: FileText });
                }
            }
            // 2. Temp Hours Expirations
            if (emp.tempHours) {
                emp.tempHours.forEach(th => {
                    const daysUntil = Math.ceil((new Date(th.end).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    if (daysUntil >= 0 && daysUntil <= 15) {
                        alerts.push({ id: `temp_${emp.id}_${th.id}`, type: 'info', message: `Ampliación de ${emp.name} termina en ${daysUntil} días`, icon: Clock });
                    }
                });
            }
            // 3. High Debt (>20h or <-20h)
            if (Math.abs(emp.hoursDebt) > 20) {
                alerts.push({ id: `debt_${emp.id}`, type: 'error', message: `${emp.name} tiene déuda horaria de ${emp.hoursDebt}h`, icon: TrendingUp });
            }
        });

        // 4. Pending Requests
        const pendingRequestsCount: Record<string, number> = {};
        timeOffRequests.forEach(r => {
            if (r.status === 'pending') pendingRequestsCount[r.employeeId] = (pendingRequestsCount[r.employeeId] || 0) + 1;
        });
        Object.entries(pendingRequestsCount).forEach(([id, count]) => {
            if (count > 2) {
                const emp = myEmployees.find(e => e.id === id);
                if (emp) alerts.push({ id: `req_${id}`, type: 'warning', message: `${emp.name} tiene ${count} peticiones pendientes`, icon: AlertCircle });
            }
        });

        // 5. Unpublished Schedules (Current or Past) that are generated
        const unpublished = schedules.filter(s =>
            s.establishmentId === user.establishmentId &&
            s.status !== 'published' &&
            s.weekStartDate <= currentWeekStart
        );

        unpublished.forEach(s => {
            alerts.push({
                id: `unpub_${s.id}`,
                type: 'warning',
                message: `Tienes pendiente publicar el horario de la semana del ${new Date(s.weekStartDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })}`,
                icon: AlertTriangle
            });
        });

        // 5.1 Rejected Schedules
        const rejected = schedules.filter(s =>
            s.establishmentId === user.establishmentId &&
            s.approvalStatus === 'rejected'
        );

        rejected.forEach(s => {
            alerts.push({
                id: `rejected_${s.id}`,
                type: 'error',
                message: `¡ATENCIÓN! Horario rechazado (Semana ${new Date(s.weekStartDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })}). Motivo: ${s.supervisorNotes || 'Sin notas'}`,
                icon: AlertTriangle
            });
        });

        // 6. Thursday Reminder (Next Week Publication)
        const todayDate = new Date();
        const isThursday = todayDate.getDay() === 4;

        if (isThursday) {
            const nextWeek = new Date(currentWeekStart);
            nextWeek.setDate(nextWeek.getDate() + 7);
            const nextWeekStr = nextWeek.toISOString().split('T')[0];

            const nextWeekPublished = schedules.some(s =>
                s.establishmentId === user.establishmentId &&
                s.weekStartDate === nextWeekStr &&
                s.status === 'published'
            );

            if (!nextWeekPublished) {
                alerts.push({
                    id: 'thursday_publish_reminder',
                    type: 'info',
                    message: 'Es jueves: Recuerda preparar y publicar el horario de la semana que viene',
                    icon: Calendar
                });
            }
        }

        // 7. Substitution End Warnings
        // Find active employees in this store who are substituting someone
        const substitutes = myEmployees.filter(e => e.active && e.substitutingId);

        substitutes.forEach(sub => {
            // Find the original employee (could be in the same store list)
            const substitutedEmp = employees.find(e => e.id === sub.substitutingId);
            if (!substitutedEmp) return;

            // Check if the substituted employee has an ACTIVE sick leave
            // Active = Start Date <= Today <= End Date (or End Date is null)
            const hasActiveSickLeave = timeOffRequests.some(req => {
                if (req.employeeId !== substitutedEmp.id || req.type !== 'sick_leave') return false;

                const start = new Date(req.startDate || req.dates[0]);
                const end = req.endDate ? new Date(req.endDate) : null;
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                // Check if currently active
                return start <= now && (!end || end >= now);
            });

            // If NO active sick leave is found, but substitution is active -> Alert
            if (!hasActiveSickLeave) {
                alerts.push({
                    id: `substitution_end_${sub.id}`,
                    type: 'warning',
                    message: `La baja de ${substitutedEmp.name} ha finalizado. Revisar contrato de sustitución de ${sub.name}.`,
                    icon: UserCheck
                });
            }
        });

        // 8. Sick Leave vs Vacation Overlap Warning
        myEmployees.forEach(emp => {
            const empVacations = timeOffRequests.filter(r => r.employeeId === emp.id && r.type === 'vacation');
            const empSickLeaves = timeOffRequests.filter(r => r.employeeId === emp.id && r.type === 'sick_leave');

            if (empSickLeaves.length > 0 && empVacations.length > 0) {
                // Check for overlaps in the CURRENT week
                const weekStart = new Date(currentWeekStart);
                const weekEnd = new Date(currentWeekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);

                let hasWeekOverlap = false;

                empVacations.forEach(vac => {
                    vac.dates.forEach(dateStr => {
                        const d = new Date(dateStr);
                        // Check if this vacation day is in current week
                        if (d >= weekStart && d <= weekEnd) {
                            // Check if this day is covered by a sick leave
                            const isOverlapped = empSickLeaves.some(sick => {
                                const start = new Date(sick.startDate || sick.dates[0]);
                                const end = sick.endDate ? new Date(sick.endDate) : new Date('2099-12-31'); // Open ended
                                start.setHours(0, 0, 0, 0);
                                end.setHours(0, 0, 0, 0);
                                const target = new Date(dateStr);
                                target.setHours(0, 0, 0, 0);
                                return target >= start && target <= end;
                            });

                            if (isOverlapped) hasWeekOverlap = true;
                        }
                    });
                });

                if (hasWeekOverlap) {
                    alerts.push({
                        id: `sick_vac_overlap_${emp.id}_${currentWeekStart}`, // Unique per week
                        type: 'warning',
                        message: `La baja de ${emp.name} coincide con vacaciones programadas esta semana. Las vacaciones no se contarán como disfrutadas.`,
                        icon: UserX
                    });
                }
            }
        });

        // Task Alerts REMOVED per user request


        // Filter based on state (Dismissed or Snoozed)
        return alerts.filter(a => {
            if (a.isSystem === false) return true; // Context notifications are filtered by 'read' property above

            const state = alertState[a.id];
            if (state === -1) return false; // Dismissed forever/read
            if (state && state > Date.now()) return false; // Snoozed and still sleeping
            return true;
        });
    }, [myEmployees, timeOffRequests, alertState, currentWeekStart, notifications, user.establishmentId, tasks]);


    // Tasks Banner Logic
    const pendingTasks = React.useMemo(() => {
        if (!user?.establishmentId) return [];
        return tasks.filter(t => {
            if (t.isArchived) return false;
            const isAssigned = t.targetStores === 'all' || t.targetStores.includes(user.establishmentId);
            if (!isAssigned) return false;
            const status = t.status[user.establishmentId]?.status || 'pending';
            return status !== 'completed';
        });
    }, [tasks, user?.establishmentId]);

    const handleQuickTaskUpdate = (taskId: string, newStatus: any) => {
        if (user?.establishmentId) updateTaskStatus(taskId, user.establishmentId, newStatus, user.id);
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">


            {/* Header with Welcome & Date */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-slate-100">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                        Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">{settings.managerName || user.name || 'Gerente'}</span>
                    </h1>
                    <p className="text-slate-500 font-medium">Resumen ejecutivo de {settings.storeName || user.establishmentName || 'tu tienda'}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('es-ES', { weekday: 'long' })}</p>
                        <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-slate-800">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
                            <div className="bg-slate-100 rounded-lg p-1 flex items-center ml-2 border border-slate-200">
                                <button onClick={() => setDashboardYear(y => y - 1)} className="hover:bg-white rounded px-1.5 py-0.5 text-slate-500 hover:text-indigo-600 transition-colors">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                                <span className="font-bold text-sm text-slate-700 mx-1">{dashboardYear}</span>
                                <button onClick={() => setDashboardYear(y => y + 1)} className="hover:bg-white rounded px-1.5 py-0.5 text-slate-500 hover:text-indigo-600 transition-colors">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            className={`p-4 rounded-2xl border-2 shadow-lg relative transition-all active:scale-95 ${activeAlerts.length > 0
                                ? 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600 animate-pulse shadow-rose-200'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            <Bell size={32} />
                            {activeAlerts.length > 0 && (
                                <span className="absolute -top-1 -right-1 h-5 w-5 bg-white text-rose-600 text-xs font-bold rounded-full flex items-center justify-center border-2 border-rose-100 shadow-sm">
                                    {activeAlerts.length}
                                </span>
                            )}
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute right-0 mt-4 w-[480px] bg-white rounded-3xl shadow-2xl shadow-slate-300/50 border border-slate-100 z-50 animate-in fade-in slide-in-from-top-2 origin-top-right ring-1 ring-slate-100">
                                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 backdrop-blur rounded-t-3xl">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                            <Bell size={20} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-800 leading-none">Centro de Alertas</h3>
                                            <p className="text-xs text-slate-500 mt-1 font-medium">{activeAlerts.length} pendientes</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsNotificationsOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                                </div>
                                <div className="max-h-[600px] overflow-y-auto">
                                    {activeAlerts.length === 0 ? (
                                        <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                                            <div className="bg-slate-50 p-4 rounded-full mb-4">
                                                <Bell size={32} className="opacity-20" />
                                            </div>
                                            <p className="font-medium text-slate-600">¡Todo al día!</p>
                                            <p className="text-sm mt-1">No tienes notificaciones pendientes</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-50">
                                            {activeAlerts.map(alert => (
                                                <div key={alert.id} className="p-5 hover:bg-indigo-50/30 transition-colors group relative">
                                                    <div className="flex gap-4">
                                                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-white/50 ${alert.type === 'error' ? 'bg-rose-100 text-rose-600' :
                                                            alert.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                                                alert.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                                                    'bg-indigo-100 text-indigo-600'
                                                            }`}>
                                                            <alert.icon size={24} />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex justify-between items-start">
                                                                <p className="font-semibold text-slate-800 text-[15px] leading-snug">{alert.message}</p>
                                                                {alert.isSystem === false && (
                                                                    <span className="shrink-0 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">NUEVO</span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-400 font-medium">Hace un momento</p>
                                                        </div>
                                                    </div>

                                                    {/* Action Area */}
                                                    <div className="mt-4 pl-16 flex items-center justify-between gap-3">
                                                        {alert.isSystem !== false ? (
                                                            // System Alert Options
                                                            <>
                                                                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                                                    <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Posponer:</span>
                                                                    {[1, 3, 7].map(days => (
                                                                        <button
                                                                            key={days}
                                                                            onClick={() => updateAlertState(alert.id, Date.now() + (days * 24 * 60 * 60 * 1000))}
                                                                            className="text-xs font-bold text-slate-500 hover:text-indigo-600 px-2.5 py-1 hover:bg-white rounded-md shadow-sm transition-all"
                                                                        >
                                                                            {days}d
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <button
                                                                    onClick={() => updateAlertState(alert.id, -1)}
                                                                    className="text-xs font-bold text-slate-400 hover:text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-1"
                                                                >
                                                                    <Check size={14} /> Completado
                                                                </button>
                                                            </>
                                                        ) : (
                                                            // Context Notification Options
                                                            <div className="w-full flex justify-end">
                                                                <button
                                                                    onClick={() => alert.contextNotifId && removeNotification(alert.contextNotifId)}
                                                                    className="w-full py-2 bg-indigo-50 text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                                                                >
                                                                    <Check size={16} />
                                                                    Marcar como leído
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {activeAlerts.length > 0 && (
                                    <div className="p-4 bg-slate-50 rounded-b-3xl border-t border-slate-100 text-center">
                                        <button
                                            onClick={() => activeAlerts.forEach(a => updateAlertState(a.id, -1))}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline"
                                        >
                                            Limpiar todas las notificaciones
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setIsAnnualPlanOpen(true)}
                    className="bg-slate-900 text-white px-5 py-3 rounded-xl font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2 group"
                >
                    <Calendar size={18} className="group-hover:scale-110 transition-transform" />
                    Plan Anual
                </button>
            </header>

            {/* NEW KPI ROW - Gradient Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {
                    [
                        { label: 'Horas Hoy', val: `${hoursToday.toFixed(1)}h`, icon: Clock, color: 'from-blue-500 to-cyan-400', shadow: 'shadow-blue-100' },
                        { label: 'Personal Activo', val: `${employeesWorkingToday} / ${myEmployees.length}`, icon: UserCheck, color: 'from-emerald-500 to-teal-400', shadow: 'shadow-emerald-100' },
                        { label: 'Horas Semana', val: `${hoursThisWeek.toFixed(1)}h`, icon: Calendar, color: 'from-violet-500 to-purple-400', shadow: 'shadow-violet-100' },
                        { label: 'Bajas Activas', val: myEmployees.filter(e => currentSchedule?.shifts.find(s => s.employeeId === e.id && s.date === today)?.type === 'sick_leave').length, icon: UserX, color: 'from-orange-500 to-amber-400', shadow: 'shadow-orange-100' }
                    ].map((stat, i) => (
                        <div key={i} className={`relative overflow-hidden bg-white p-6 rounded-2xl shadow-lg border border-slate-50 group hover:-translate-y-1 transition-transform duration-300 ${stat.shadow}`}>
                            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
                                <stat.icon size={80} />
                            </div>
                            <div className="relative z-10">
                                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white mb-4 shadow-md`}>
                                    <stat.icon size={24} />
                                </div>
                                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">{stat.label}</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">{stat.val}</p>
                            </div>
                        </div>
                    ))
                }
            </div >

            {/* Task Banner - Moved below KPIs */}
            {pendingTasks.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                <CheckSquare size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Tienes {pendingTasks.length} {pendingTasks.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}</h3>
                                <p className="text-indigo-100 text-sm">Gestiona tus tareas asignadas directamente desde aquí.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
                            {pendingTasks.slice(0, 3).map(task => {
                                const myStatus = task.status[user.establishmentId]?.status || 'pending';
                                return (
                                    <div key={task.id} className="min-w-[200px] bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-xl flex flex-col gap-2 hover:bg-white/20 transition-colors">
                                        <span className="text-xs font-bold line-clamp-1">{task.title}</span>
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${myStatus === 'pending' ? 'bg-amber-400/20 text-amber-200' : 'bg-blue-400/20 text-blue-200'}`}>
                                                {myStatus === 'pending' ? 'Pendiente' : 'En Curso'}
                                            </span>
                                            {myStatus === 'pending' ? (
                                                <button onClick={() => handleQuickTaskUpdate(task.id, 'in_progress')} className="bg-white text-indigo-600 p-1 rounded hover:bg-indigo-50 transition-colors" title="Iniciar"><Clock size={14} /></button>
                                            ) : (
                                                <button onClick={() => handleQuickTaskUpdate(task.id, 'completed')} className="bg-emerald-400 text-emerald-950 p-1 rounded hover:bg-emerald-300 transition-colors" title="Finalizar"><Check size={14} /></button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {pendingTasks.length > 3 && (
                                <div className="flex items-center justify-center min-w-[50px] bg-white/5 border border-white/10 rounded-xl text-xs font-bold">
                                    +{pendingTasks.length - 3}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* BENTO GRID LAYOUT */}
            < div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8" >

                {/* LEFT COLUMN (Wide) */}
                < div className="lg:col-span-8 space-y-8" >


                    {/* TODAY'S SCHEDULE QUADRANT */}
                    < section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6" >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2">
                                <Calendar size={20} className="text-indigo-500" />
                                Cuadrante de Hoy
                            </h3>
                            <span className="text-sm text-slate-500 font-medium bg-slate-50 px-3 py-1 rounded-full">
                                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(() => {
                                const workingToday = myEmployees
                                    .map(emp => {
                                        const shift = currentSchedule?.shifts.find(s => s.employeeId === emp.id && s.date === today);
                                        // Only show active working shifts
                                        if (!shift || ['off', 'sick_leave', 'vacation', 'holiday'].includes(shift.type)) return null;
                                        return { emp, shift };
                                    })
                                    .filter((item): item is { emp: typeof myEmployees[0], shift: NonNullable<typeof currentSchedule>['shifts'][0] } => item !== null)
                                    .sort((a, b) => {
                                        const getStart = (s: any) => parseInt(s.startTime?.split(':')[0] || '0');
                                        return getStart(a.shift) - getStart(b.shift);
                                    });

                                if (workingToday.length === 0) return <p className="col-span-full text-slate-400 italic text-center py-4">No hay personal trabajando hoy.</p>;

                                return workingToday.map(({ emp, shift }) => {
                                    let timeText = '';
                                    let isWorkingNow = false;
                                    const now = new Date();
                                    const currentHour = now.getHours() + now.getMinutes() / 60;

                                    const parseTime = (t?: string) => t ? parseInt(t.split(':')[0]) + parseInt(t.split(':')[1]) / 60 : 0;

                                    if (shift.type === 'split') {
                                        const ms = parseTime(shift.startTime) || 10;
                                        const me = parseTime(shift.morningEndTime) || 14;
                                        const as = parseTime(shift.afternoonStartTime) || 17;
                                        const ae = parseTime(shift.endTime) || 21;

                                        if ((currentHour >= ms && currentHour < me) || (currentHour >= as && currentHour < ae)) {
                                            isWorkingNow = true;
                                        }
                                        timeText = `${shift.startTime}-${shift.morningEndTime} / ${shift.afternoonStartTime}-${shift.endTime}`;
                                    } else {
                                        const start = parseTime(shift.startTime) || (shift.type === 'morning' ? 10 : 17);
                                        const end = parseTime(shift.endTime) || (shift.type === 'morning' ? 14 : 21);

                                        if (currentHour >= start && currentHour < end) {
                                            isWorkingNow = true;
                                        }
                                        timeText = `${shift.startTime || (shift.type === 'morning' ? '10:00' : '17:00')} - ${shift.endTime || (shift.type === 'morning' ? '14:00' : '21:00')}`;
                                    }

                                    // Fallback initials generation
                                    const displayInitials = emp.initials || emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                                    return (
                                        <div key={emp.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2 hover:border-indigo-200 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                                                        {displayInitials}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-800 leading-tight truncate w-20" title={emp.name}>{emp.name.split(' ')[0]}</span>
                                                        <span className="text-[10px] text-slate-500 leading-tight">{emp.category}</span>
                                                    </div>
                                                </div>
                                                <div className={`h-2.5 w-2.5 rounded-full ${isWorkingNow ? 'bg-emerald-500 shadow-sm shadow-emerald-200 animate-pulse' : 'bg-rose-400'}`} title={isWorkingNow ? 'Trabajando ahora' : 'Fuera de turno'}></div>
                                            </div>
                                            <div title={timeText} className={`text-[10px] font-bold px-2 py-1 rounded text-center truncate ${shift.type === 'split' ? 'bg-orange-100 text-orange-700' :
                                                shift.type === 'morning' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-purple-100 text-purple-700'
                                                }`}>
                                                {timeText}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </section >



                    {/* DEBT CONTROL - Cleaner UI */}
                    < section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6" >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div>
                                <h3 className="font-bold text-xl text-slate-900">Bolsa de Horas</h3>
                                <p className="text-slate-400 text-sm">Control de saldo horario</p>
                            </div>
                            <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl w-full sm:w-auto items-center">
                                <select
                                    className="bg-transparent text-sm font-medium outline-none px-3 py-1.5 min-w-[120px]"
                                    value={selectedDebtEmp} onChange={e => setSelectedDebtEmp(e.target.value)}
                                >
                                    <option value="">Empleado</option>
                                    {myEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                                <div className="w-px bg-slate-200 h-6 mx-1"></div>
                                <input type="number" placeholder="H" className="bg-transparent w-16 text-sm px-2 outline-none"
                                    value={manualDebtAmount} onChange={e => setManualDebtAmount(Number(e.target.value))}
                                />
                                <div className="w-px bg-slate-200 h-6 mx-1"></div>
                                {/* Added Reason Input */}
                                <input
                                    type="text"
                                    placeholder="Motivo (Obligatorio)"
                                    className="bg-transparent w-32 text-sm px-2 outline-none"
                                    value={manualDebtReason}
                                    onChange={e => setManualDebtReason(e.target.value)}
                                />
                                <div className="w-px bg-slate-200 h-6 mx-1"></div>
                                <button onClick={handleAddManualDebt} className="bg-white shadow-sm border border-slate-200 rounded-lg p-1.5 hover:text-indigo-600 hover:border-indigo-200 transition-all" title="Añadir ajuste">
                                    <TrendingUp size={16} />
                                </button>
                                <button onClick={() => setIsDebtHistoryOpen(true)} className="bg-white shadow-sm border border-slate-200 rounded-lg p-1.5 ml-1 hover:text-indigo-600 hover:border-indigo-200 transition-all" title="Ver Historial">
                                    <Search size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {myEmployees.map((emp, i) => {
                                const debt = emp.hoursDebt || 0;
                                return (
                                    <div key={emp.id} className={`p-4 rounded-2xl border ${i % 2 === 0 ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'} text-center`}>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{emp.initials || emp.name}</p>
                                        <p className={`text-2xl font-black ${debt > 0 ? 'text-emerald-500' : debt < 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                                            {debt > 0 ? '+' : ''}{debt}h
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </section >

                    {/* HISTORY OF DEBT MODAL */}
                    {
                        isDebtHistoryOpen && (
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex flex-col gap-4 mb-6">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                <TrendingUp size={20} className="text-indigo-500" />
                                                Historial de Ajustes
                                            </h3>
                                            <button onClick={() => setIsDebtHistoryOpen(false)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">×</button>
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar empleado..."
                                                    value={debtSearchQuery}
                                                    onChange={(e) => setDebtSearchQuery(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                                                />
                                            </div>
                                            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                                                <button
                                                    onClick={() => setSelectedDebtYear(y => y - 1)}
                                                    className="px-2 text-slate-500 hover:text-indigo-600 font-bold hover:bg-white rounded-lg transition-all"
                                                >&lt;</button>
                                                <span className="px-2 text-sm font-bold text-slate-700 flex items-center">{selectedDebtYear}</span>
                                                <button
                                                    onClick={() => setSelectedDebtYear(y => y + 1)}
                                                    className="px-2 text-slate-500 hover:text-indigo-600 font-bold hover:bg-white rounded-lg transition-all"
                                                >&gt;</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                                        {(() => {
                                            let logs = [...hoursDebtLogs]
                                                .filter(l => new Date(l.date).getFullYear() === selectedDebtYear) // Filter by Year
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                            // Filter if an employee is selected in the main dropdown (legacy support)
                                            if (selectedDebtEmp) {
                                                logs = logs.filter(l => l.employeeId === selectedDebtEmp);
                                            }

                                            // Filter by search query
                                            if (debtSearchQuery) {
                                                const query = debtSearchQuery.toLowerCase();
                                                logs = logs.filter(l => {
                                                    const emp = myEmployees.find(e => e.id === l.employeeId);
                                                    return emp?.name.toLowerCase().includes(query);
                                                });
                                            }

                                            if (logs.length === 0) return <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2"><FileText size={32} className="opacity-20" />Sin registros en {selectedDebtYear}.</div>;

                                            return logs.map(log => {
                                                const emp = myEmployees.find(e => e.id === log.employeeId);
                                                return (
                                                    <div key={log.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-colors">
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">{emp?.name || 'Empleado desconocido'}</p>
                                                            <p className="text-xs text-slate-500">{log.reason}</p>
                                                            <p className="text-[10px] text-slate-400 mt-1">{new Date(log.date).toLocaleString()}</p>
                                                        </div>
                                                        <div className={`text-sm font-bold px-2 py-1 rounded-lg ${log.amount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {log.amount > 0 ? '+' : ''}{log.amount}h
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Saturdays Visuals - Moved & Horizontal */}
                    <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-xl text-slate-900 flex gap-2 items-center">
                                <Calendar size={20} className="text-indigo-500" /> Sábados Libres {dashboardYear}
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {saturdaysOffPerEmployee.map((item) => (
                                <div key={item.name} className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                {item.name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 truncate max-w-[100px]">{item.name}</span>
                                        </div>
                                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">Total: {item.total}</span>
                                    </div>

                                    <div className="grid grid-cols-6 gap-1">
                                        {Array.from({ length: 12 }).map((_, mIdx) => {
                                            const count = item.monthly[mIdx] || 0;
                                            const monthName = new Date(dashboardYear, mIdx, 1).toLocaleDateString('es-ES', { month: 'short' }).slice(0, 3);
                                            return (
                                                <div key={mIdx} className={`flex flex-col items-center justify-center p-1 rounded border ${count > 0 ? 'bg-white border-indigo-200 shadow-sm' : 'bg-slate-100/50 border-transparent opacity-40'}`}>
                                                    <span className="text-[8px] uppercase text-slate-400 leading-none mb-0.5">{monthName}</span>
                                                    <span className={`text-[10px] font-bold leading-none ${count > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{count}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                </div >

                {/* RIGHT COLUMN (Widgets) */}
                < div className="lg:col-span-4 space-y-6" >

                    {/* Plantilla Progress Widget */}
                    < div className="bg-slate-900 text-slate-200 p-6 rounded-3xl shadow-xl" >
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-white font-bold text-lg">Cobertura</h3>
                                <p className="text-slate-400 text-xs">Horas vs Contrato</p>
                            </div>
                            <Briefcase size={20} className="text-indigo-400" />
                        </div>
                        <div className="relative pt-2">
                            <div className="flex justify-between text-sm font-semibold mb-2">
                                <span>{Math.round((hoursThisWeek / totalContractedHours) * 100)}%</span>
                                <span className="text-slate-400">{hoursThisWeek}/{totalContractedHours}h</span>
                            </div>
                            <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.min((hoursThisWeek / totalContractedHours) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                    </div >


                    {/* Sick Leave (Bajas Médicas) - Swapped Position & Added Year Selector */}
                    < div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100" >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex gap-2 items-center">
                                <UserX size={18} className="text-rose-500" /> Bajas {dashboardYear}
                            </h3>
                        </div>
                        {
                            sickLeavePerEmployee.filter(i => i.days > 0).length > 0 ? (
                                <div className="space-y-3">
                                    {sickLeavePerEmployee.map(item => (
                                        <div key={item.name} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl">
                                            <span className="font-semibold text-red-900 text-sm">{item.name}</span>
                                            <span className="bg-white text-red-600 text-xs font-bold px-2 py-1 rounded shadow-sm">
                                                {item.days} días
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-slate-400 text-center py-4 italic">Sin bajas este año 🎉</p>
                        }
                    </div >

                    {/* Vacation Visuals - Swapped Position */}
                    < div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100" >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex gap-2 items-center">
                                <Plane size={18} className="text-teal-500" /> Vacaciones {dashboardYear}
                            </h3>
                            <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                                    <span className="text-slate-500">Disfrutadas</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-teal-200"></div>
                                    <span className="text-slate-500">Programadas</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {vacationDaysPerEmployee.map(item => (
                                <div key={item.name}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-semibold text-slate-700">{item.name}</span>
                                        <div className="flex gap-1 text-[10px] font-medium">
                                            <span className="text-teal-600" title="Disfrutadas">{item.enjoyed}</span>
                                            <span className="text-slate-300">/</span>
                                            <span className="text-teal-400" title="Programadas">{item.scheduled}</span>
                                            <span className="text-slate-300">of</span>
                                            <span className="text-slate-600">31</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-0.5 h-2">
                                        {Array.from({ length: 31 }).map((_, i) => {
                                            let bgClass = 'bg-slate-100';
                                            if (i < item.enjoyed) bgClass = 'bg-teal-500'; // Disfrutadas
                                            else if (i < item.enjoyed + item.scheduled) bgClass = 'bg-teal-200'; // Programadas

                                            return (
                                                <div key={i} className={`flex-1 rounded-[1px] ${bgClass}`} title={i < item.enjoyed ? 'Disfrutada' : i < item.enjoyed + item.scheduled ? 'Programada' : 'Disponible'}></div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div >

                </div >
            </div >


            {/* Request History Modal */}
            {
                isRequestHistoryOpen && selectedEmpForHistory && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900">Historial (90 días)</h3>
                                <button onClick={() => setIsRequestHistoryOpen(false)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">×</button>
                            </div>
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                                {(() => {
                                    const ninetyDaysAgo = new Date();
                                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

                                    const histRequests = timeOffRequests
                                        .filter(r => r.employeeId === selectedEmpForHistory)
                                        .filter(r => r.dates.some(d => new Date(d) >= ninetyDaysAgo))
                                        .sort((a, b) => new Date(b.dates[0]).getTime() - new Date(a.dates[0]).getTime());

                                    if (histRequests.length === 0) return <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2"><FileText size={32} className="opacity-20" />Sin peticiones recientes.</div>;

                                    return histRequests.map(req => (
                                        <div key={req.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
                                            <div className="flex justify-between mb-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${req.type === 'day_off' ? 'bg-slate-200 text-slate-700' :
                                                    req.type === 'vacation' ? 'bg-teal-100 text-teal-700' :
                                                        req.type === 'sick_leave' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {req.type === 'day_off' ? 'Día Libre' :
                                                        req.type === 'vacation' ? 'Vacaciones' :
                                                            req.type === 'sick_leave' ? 'Baja' : 'Parcial'}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">{new Date(req.dates[0]).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {req.dates.map(d => (
                                                    <span key={d} className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                                                        {new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Annual Planning Modal */}
            {
                isAnnualPlanOpen && (
                    <AnnualPlanModal
                        isOpen={isAnnualPlanOpen}
                        onClose={() => setIsAnnualPlanOpen(false)}
                        establishmentId={user.establishmentId}
                    />
                )
            }

        </div >
    );
};

export default DashboardPage;
