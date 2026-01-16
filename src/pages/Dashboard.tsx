import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import {
    Users, Calendar, Clock, AlertTriangle, Check, X, Bell, TrendingUp,
    ArrowUpRight, Activity, Search, ChevronRight, ChevronLeft,
    Coins, FileText, UserX, AlertCircle, LayoutGrid, LayoutList,
    Zap, UserCheck, CheckSquare, Plane, Trophy, Medal
} from 'lucide-react';
import { FilterSelect } from '../components/FilterSelect';
import AnnualPlanModal from '../components/AnnualPlanModal';
import ILTReportModal from '../components/employees/ILTReportModal';
import SupervisorDashboard from './SupervisorDashboard';
import { clsx } from 'clsx';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();

    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isMicroloansModalOpen, setIsMicroloansModalOpen] = useState(false); // New state for interactivity
    const [microloansFilterYear, setMicroloansFilterYear] = useState(new Date().getFullYear());

    // Redirect to Supervisor Dashboard if admin
    if (user?.role === 'admin') {
        return <SupervisorDashboard />;
    }

    const {
        employees, schedules, timeOffRequests, updateHoursDebt, getSettings,
        hoursDebtLogs, notifications, markNotificationAsRead, tasks, updateTaskStatus,
        incentiveReports, updateIncentiveReport, employeeLogs, getManagerNames, iltReports
    } = useStore();
    const { showToast } = useToast();

    // Memoize published weeks for efficiency (Admin sees all, manager sees their store)
    const publishedWeeks = useMemo(() => {
        if (!user) return new Set<string>();
        return new Set(
            schedules
                .filter(s => s.status === 'published' && (user.role === 'admin' || s.establishmentId === user.establishmentId))
                .map(s => s.weekStartDate)
        );
    }, [schedules, user]);

    const isDateInPublishedWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        const mondayStr = monday.toISOString().split('T')[0];
        return publishedWeeks.has(mondayStr);
    };

    // UI States
    const [isDebtHistoryOpen, setIsDebtHistoryOpen] = useState(false);
    const [isDebtSummaryOpen, setIsDebtSummaryOpen] = useState(false);
    const [isWeeklyScheduleOpen, setIsWeeklyScheduleOpen] = useState(false);
    const [isHoursSummaryOpen, setIsHoursSummaryOpen] = useState(false);
    const [isCoverageSummaryOpen, setIsCoverageSummaryOpen] = useState(false);
    const [isRequestHistoryOpen, setIsRequestHistoryOpen] = useState(false);
    const [isPersonnelHistoryOpen, setIsPersonnelHistoryOpen] = useState(false);
    const [showPersonnelLogs, setShowPersonnelLogs] = useState(false);
    const [selectedDebtYear, setSelectedDebtYear] = useState(new Date().getFullYear());
    const [isAnnualPlanOpen, setIsAnnualPlanOpen] = useState(false);
    const [debtTab, setDebtTab] = useState<'balance' | 'adjust' | 'pay' | 'history'>('balance');
    const [selectedDebtMonth, setSelectedDebtMonth] = useState<number | 'all'>('all');
    const [isILTModalOpen, setIsILTModalOpen] = useState(false);
    const [iltModalTab, setIltModalTab] = useState<'current' | 'history'>('current');

    const [alertState, setAlertState] = useState<Record<string, number>>(() => {
        try {
            return JSON.parse(localStorage.getItem('dashboard_dismissed_alerts') || '{}');
        } catch { return {}; }
    });

    const updateAlertState = (id: string, snoozeUntil: number) => {
        const newState = { ...alertState, [id]: snoozeUntil };
        setAlertState(newState);
        localStorage.setItem('dashboard_dismissed_alerts', JSON.stringify(newState));
    };

    // Manual Debt Adjustment State
    const [selectedDebtEmp, setSelectedDebtEmp] = useState('');
    const [manualDebtAmount, setManualDebtAmount] = useState<number | ''>('');
    const [manualDebtReason, setManualDebtReason] = useState('');
    const [debtSearchQuery, setDebtSearchQuery] = useState('');

    // Pay Incentives State
    const [isPayIncentivesOpen, setIsPayIncentivesOpen] = useState(false);
    const [payIncentivesData, setPayIncentivesData] = useState<{
        employeeId: string;
        amount: string;
        targetMonth: string;
    }>({ employeeId: '', amount: '', targetMonth: '' });

    // Helper Functions
    const getOpenIncentiveMonths = () => {
        if (!user) return [];
        const options: { value: string, label: string }[] = [];
        const now = new Date();
        const candidates = [
            new Date(now.getFullYear(), now.getMonth() - 1, 1),
            new Date(now.getFullYear(), now.getMonth(), 1),
            new Date(now.getFullYear(), now.getMonth() + 1, 1)
        ];
        candidates.forEach(d => {
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const report = incentiveReports.find(r => r.establishmentId === user.establishmentId && r.month === mStr);
            if (!report || (report.status === 'draft' || report.status === 'changes_requested')) {
                options.push({ value: mStr, label: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) });
            }
        });
        return options;
    };

    const handlePayIncentives = async () => {
        if (!user) return;
        const { employeeId, amount, targetMonth } = payIncentivesData;
        const qty = parseFloat(amount);

        if (!employeeId || !qty || qty <= 0) {
            showToast('Revisa los datos del formulario', 'error');
            return;
        }
        if (!targetMonth) {
            showToast('Selecciona un mes de destino', 'error');
            return;
        }

        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return;

        if (employee.hoursDebt < qty) {
            showToast('El empleado no tiene suficientes horas en su bolsa.', 'error');
            return;
        }

        try {
            await updateHoursDebt(employeeId, -qty, 'Transferencia a Incentivos');
        } catch (error) {
            showToast('Error al actualizar la bolsa de horas', 'error');
            return;
        }

        let report = incentiveReports.find(r => r.establishmentId === user.establishmentId && r.month === targetMonth);

        if (!report) {
            const storeEmployees = employees.filter(e => e.establishmentId === user.establishmentId && e.active);
            report = {
                id: crypto.randomUUID(),
                establishmentId: user.establishmentId,
                month: targetMonth,
                status: 'draft',
                items: storeEmployees.map(e => ({
                    employeeId: e.id,
                    employeeName: e.name,
                    baseAmount: 0,
                    pluses: [],
                    deductions: [],
                    micros_aptacion_qty: 0,
                    micros_mecanizacion_qty: 0,
                    hours_payment_qty: 0,
                    total: 0
                })),
                updatedAt: new Date().toISOString()
            };
        }

        const updatedItems = report.items.map(item => {
            if (item.employeeId === employeeId) {
                const newHours = (item.hours_payment_qty || 0) + qty;
                const plus = item.pluses.reduce((a, b) => a + b.amount, 0);
                const deduc = item.deductions.reduce((a, b) => a + b.amount, 0);
                const microsVal = (item.micros_aptacion_qty || 0) * (report!.value_per_captacion || 0) +
                    (item.micros_mecanizacion_qty || 0) * (report!.value_per_mecanizacion || 0);
                const respVal = item.responsibility_bonus_amount || 0;
                const hoursVal = newHours * (report!.value_per_extra_hour || 0);

                return {
                    ...item,
                    hours_payment_qty: newHours,
                    total: item.baseAmount + plus - deduc + microsVal + respVal + hoursVal
                };
            }
            return item;
        });

        updateIncentiveReport({ ...report, items: updatedItems, updatedAt: new Date().toISOString() });
        showToast(`Se han transferido ${qty} horas a los incentivos de ${targetMonth}`, 'success');
        setIsPayIncentivesOpen(false);
        setPayIncentivesData({ employeeId: '', amount: '', targetMonth: '' });
    };

    const calculatePerformance = (itDays: number, matDays: number, totalDays: number = 0) => {
        // If no days were evaluated, performance is 0%
        if (totalDays === 0) return 0;

        // Proportional penalty: missing all days = 0%
        // IT and Mat/Pat count equally (1.0 weight each)
        const totalPenaltyDays = itDays + matDays;
        const penaltyPercentage = (totalPenaltyDays / totalDays) * 100;

        const score = 100 - penaltyPercentage;
        return Math.max(0, Math.min(100, Math.round(score)));
    };

    const handleAddManualDebt = async () => {
        if (!selectedDebtEmp) {
            showToast('Debes seleccionar un empleado', 'error');
            return;
        }
        if (manualDebtAmount === '' || manualDebtAmount === 0) {
            showToast('Introduce una cantidad válida', 'error');
            return;
        }
        if (!manualDebtReason) {
            showToast('El motivo es obligatorio', 'error');
            return;
        }

        try {
            await updateHoursDebt(selectedDebtEmp, Number(manualDebtAmount), manualDebtReason);
            setManualDebtAmount('');
            setManualDebtReason('');
            setSelectedDebtEmp('');
            showToast('Ajuste de horas registrado', 'success');
        } catch (error) {
            showToast('Error al registrar las horas', 'error');
        }
    };

    if (!user) return null;

    const settings = getSettings(user.establishmentId);
    const myEmployees = employees.filter(e => e.establishmentId === user.establishmentId);
    const currentWeekStart = (() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    })();

    const currentSchedule = schedules.find(s => s.weekStartDate === currentWeekStart && s.establishmentId === user.establishmentId);
    const activeEmployees = myEmployees.filter(e => e.active);

    // Calculations

    const hoursThisWeek = currentSchedule ? currentSchedule.shifts
        .filter(s => s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
        .reduce((acc, s) => {
            if (s.type === 'split') return acc + 8;
            return acc + 4;
        }, 0) : 0;



    const detailedDailyHours = useMemo(() => {
        const days = Array(7).fill(null).map(() => ({ morning: 0, afternoon: 0, total: 0 }));
        if (!currentSchedule) return days;

        currentSchedule.shifts.forEach(s => {
            if (s.type === 'morning' || s.type === 'afternoon' || s.type === 'split') {
                const d = new Date(s.date);
                const dayIndex = (d.getDay() + 6) % 7; // Mon=0, Sun=6

                if (s.type === 'morning') {
                    days[dayIndex].morning += 4;
                    days[dayIndex].total += 4;
                } else if (s.type === 'afternoon') {
                    days[dayIndex].afternoon += 4;
                    days[dayIndex].total += 4;
                } else if (s.type === 'split') {
                    days[dayIndex].morning += 4;
                    days[dayIndex].afternoon += 4;
                    days[dayIndex].total += 8;
                }
            }
        });
        return days;
    }, [currentSchedule]);

    const totalContractedHours = myEmployees.reduce((acc, e) => acc + e.weeklyHours, 0);

    // Filter out inactive employees from total debt calculation and top debtors list
    const totalDebt = useMemo(() =>
        myEmployees.filter(e => e.active).reduce((acc, e) => acc + (e.hoursDebt || 0), 0)
        , [myEmployees]);

    const topDebtors = useMemo(() =>
        [...myEmployees.filter(e => e.active)]
            .sort((a, b) => (b.hoursDebt || 0) - (a.hoursDebt || 0))
            .slice(0, 6)
        , [myEmployees]);

    const weeklyDetailedTable = useMemo(() => {
        if (!currentSchedule) return [];

        return myEmployees.filter(e => e.active).map(emp => {
            const shifts = Array(7).fill(null).map((_, i) => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                return currentSchedule.shifts.find(s => s.employeeId === emp.id && s.date === dateStr);
            });

            const worked = shifts.reduce((acc, s) => {
                if (!s) return acc;
                if (s.type === 'split') return acc + 8;
                if (s.type === 'morning' || s.type === 'afternoon') return acc + 4;
                return acc;
            }, 0);

            return {
                id: emp.id,
                name: emp.name,
                contracted: emp.weeklyHours,
                worked,
                shifts: shifts.map(s => {
                    if (!s) return '-';
                    if (s.type === 'split') return 'M/T';
                    if (s.type === 'morning') return 'Mañana';
                    if (s.type === 'afternoon') return 'Tarde';
                    if (s.type === 'off') return 'Libre';
                    if (s.type === 'vacation') return 'Vacaciones';
                    if (s.type === 'sick_leave') return 'Baja Médica';
                    return '-';
                })
            };
        });
    }, [currentSchedule, myEmployees, currentWeekStart]);

    const currentActiveAbsences = useMemo(() => {
        const weekStart = new Date(currentWeekStart);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        return timeOffRequests.filter(r => {
            if (r.type !== 'sick_leave' && r.type !== 'maternity_paternity' && r.type !== 'vacation') return false;
            if (r.status !== 'approved') return false;

            // 1. Filter by Store: Ensure employee belongs to this store
            const emp = myEmployees.find(e => e.id === r.employeeId);
            if (!emp) return false;

            // 2. Filter by Date: Check intersection with current week
            const start = r.startDate || r.dates[0];
            const end = r.endDate || (r.dates ? r.dates[r.dates.length - 1] : start);

            // Intersection: (StartA <= EndB) and (EndA >= StartB)
            return start <= weekEndStr && end >= weekStartStr;
        }).map(r => {
            const emp = myEmployees.find(e => e.id === r.employeeId);
            let typeLabel = 'BAJA MÉDICA';
            if (r.type === 'maternity_paternity') typeLabel = 'MAT/PAT';
            if (r.type === 'vacation') typeLabel = 'VACACIONES';
            if (r.type === 'sick_leave') typeLabel = 'BAJA MÉDICA';

            // Calculate hours for this week
            let weeklyAbsenceHours = 0;
            if (emp) {
                const start = r.startDate || r.dates[0];
                const end = r.endDate || (r.dates ? r.dates[r.dates.length - 1] : start);

                const rangeStart = start > currentWeekStart ? start : currentWeekStart;
                const rangeEnd = end < weekEndStr ? end : weekEndStr;

                if (rangeStart <= rangeEnd) {
                    const d1 = new Date(rangeStart);
                    const d2 = new Date(rangeEnd);
                    const diffDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    weeklyAbsenceHours = (emp.weeklyHours / 5) * diffDays;
                }
            }

            return {
                id: r.id,
                name: emp?.name || 'Desconocido',
                type: typeLabel,
                endDate: r.endDate,
                weeklyAbsenceHours: Math.round(weeklyAbsenceHours)
            };
        });
    }, [timeOffRequests, myEmployees, currentWeekStart]);

    const weeklyStats = useMemo(() => {
        const uniqueSchedules = new Map<string, (typeof schedules)[0]>();
        [...schedules]
            .filter(s => s.establishmentId === user.establishmentId)
            .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
            .forEach(s => {
                if (!uniqueSchedules.has(s.weekStartDate)) {
                    uniqueSchedules.set(s.weekStartDate, s);
                }
            });

        return Array.from(uniqueSchedules.values()).map(s => {
            const worked = s.shifts
                .filter(sh => sh.type === 'morning' || sh.type === 'afternoon' || sh.type === 'split')
                .reduce((acc, sh) => acc + (sh.type === 'split' ? 8 : 4), 0);
            const contracted = totalContractedHours;
            const coverage = contracted > 0 ? (worked / contracted) * 100 : 0;
            return { label: s.weekStartDate, worked, contracted, coverage };
        });
    }, [schedules, user.establishmentId, totalContractedHours]);

    const pastWeeklyStats = useMemo(() =>
        weeklyStats.filter(s => s.label < currentWeekStart).slice(0, 4)
        , [weeklyStats, currentWeekStart]);

    const monthlyStatsData = useMemo(() => {
        const months: Record<string, { worked: number, contracted: number }> = {};
        schedules
            .filter(s => s.establishmentId === user.establishmentId)
            .forEach(s => {
                const yearMonth = s.weekStartDate.substring(0, 7);
                if (!months[yearMonth]) months[yearMonth] = { worked: 0, contracted: 0 };
                const worked = s.shifts
                    .filter(sh => sh.type === 'morning' || sh.type === 'afternoon' || sh.type === 'split')
                    .reduce((acc, sh) => acc + (sh.type === 'split' ? 8 : 4), 0);
                months[yearMonth].worked += worked;
                months[yearMonth].contracted += totalContractedHours;
            });
        return Object.entries(months)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 6)
            .map(([month, data]) => ({ label: month, worked: data.worked, contracted: data.contracted, coverage: (data.worked / data.contracted) * 100 }));
    }, [schedules, totalContractedHours, user.establishmentId]);

    const yearlyStatsData = useMemo(() => {
        const years: Record<string, { worked: number, contracted: number }> = {};
        schedules
            .filter(s => s.establishmentId === user.establishmentId)
            .forEach(s => {
                const year = s.weekStartDate.substring(0, 4);
                if (!years[year]) years[year] = { worked: 0, contracted: 0 };
                const worked = s.shifts
                    .filter(sh => sh.type === 'morning' || sh.type === 'afternoon' || sh.type === 'split')
                    .reduce((acc, sh) => acc + (sh.type === 'split' ? 8 : 4), 0);
                years[year].worked += worked;
                years[year].contracted += totalContractedHours;
            });
        return Object.entries(years)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([year, data]) => ({ label: year, worked: data.worked, contracted: data.contracted, coverage: (data.worked / data.contracted) * 100 }));

    }, [schedules, totalContractedHours, user.establishmentId]);

    const microloansData = useMemo(() => {
        const currentMonthStr = new Date().toISOString().substring(0, 7);
        // Get current report
        const currentReport = incentiveReports.find(r => r.establishmentId === user.establishmentId && r.month === currentMonthStr);

        const totalThisMonth = (currentReport?.items || []).reduce((acc, item) => acc + (item.micros_aptacion_qty || 0), 0);

        // Previous Month Data
        const dPrev = new Date();
        dPrev.setMonth(dPrev.getMonth() - 1);
        const prevMonthStr = `${dPrev.getFullYear()}-${String(dPrev.getMonth() + 1).padStart(2, '0')}`;
        const prevReport = incentiveReports.find(r => r.establishmentId === user.establishmentId && r.month === prevMonthStr);

        const prevMonthEmployeePerformance = (prevReport?.items || [])
            .map(item => ({
                employeeId: item.employeeId,
                name: item.employeeName,
                count: item.micros_aptacion_qty || 0
            }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const totalPrevMonth = (prevReport?.items || []).reduce((acc, item) => acc + (item.micros_aptacion_qty || 0), 0);
        const prevMonthLabel = dPrev.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

        // Annual Data (Current Year)
        const currentYear = new Date().getFullYear();
        const annualEmployeeCounts: Record<string, { id: string, name: string, count: number }> = {};

        incentiveReports
            .filter(r => r.establishmentId === user.establishmentId && r.month.startsWith(`${currentYear}-`))
            .forEach(report => {
                report.items.forEach(item => {
                    if (!annualEmployeeCounts[item.employeeId]) {
                        annualEmployeeCounts[item.employeeId] = { id: item.employeeId, name: item.employeeName, count: 0 };
                    }
                    annualEmployeeCounts[item.employeeId].count += (item.micros_aptacion_qty || 0);
                });
            });

        const annualRanking = Object.values(annualEmployeeCounts)
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Historical data (Last 6 months)
        const history = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i - 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const rep = incentiveReports.find(r => r.establishmentId === user.establishmentId && r.month === mStr);
            const total = (rep?.items || []).reduce((acc, item) => acc + (item.micros_aptacion_qty || 0), 0);
            history.push({ month: mStr, total, label: d.toLocaleDateString('es-ES', { month: 'short' }) });
        }

        return {
            totalThisMonth,
            history: history.reverse(),
            prevMonthData: {
                label: prevMonthLabel,
                total: totalPrevMonth,
                ranking: prevMonthEmployeePerformance
            },
            annualRanking
        };
    }, [incentiveReports, user.establishmentId]);

    // Microloans Modal Data
    const microloansModalData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => i);
        return months.map(monthIndex => {
            const d = new Date(microloansFilterYear, monthIndex, 1);
            const mStr = `${microloansFilterYear}-${String(monthIndex + 1).padStart(2, '0')}`;

            const report = incentiveReports.find(r =>
                r.month === mStr && r.establishmentId === user.establishmentId
            );

            const total = (report?.items || []).reduce((sum, item) => sum + (item.micros_aptacion_qty || 0), 0);

            return {
                label: d.toLocaleDateString('es-ES', { month: 'long' }),
                total
            };
        });
    }, [incentiveReports, user.establishmentId, microloansFilterYear]);


    const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear());
    const [saturdaysYear, setSaturdaysYear] = useState(new Date().getFullYear());
    const [vacationYear, setVacationYear] = useState(new Date().getFullYear());

    const vacationDaysPerEmployee = myEmployees.map(emp => {
        const empVacationDates = timeOffRequests
            .filter(r => r.employeeId === emp.id && r.type === 'vacation')
            .flatMap(r => r.dates)
            .filter(d => {
                const targetDate = new Date(d);
                if (targetDate.getFullYear() !== vacationYear) return false;
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



    // Alerts Logic
    const activeAlerts = useMemo(() => {
        const alerts: { id: string; type: 'warning' | 'error' | 'info' | 'success'; message: string; icon: any; isSystem?: boolean; contextNotifId?: string }[] = [];

        const myNotifs = notifications.filter(n => n.establishmentId === user.establishmentId && !n.read);
        myNotifs.forEach(n => {
            alerts.push({
                id: `notif_${n.id}`, type: n.type, message: n.message,
                icon: n.type === 'success' ? Check : (n.type === 'error' ? AlertTriangle : Bell),
                isSystem: false, contextNotifId: n.id
            });
        });

        myEmployees.forEach(emp => {
            if (emp.contractEndDate) {
                const daysUntil = Math.ceil((new Date(emp.contractEndDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                if (daysUntil >= 0 && daysUntil <= 30) {
                    alerts.push({ id: `contract_${emp.id}`, type: 'warning', message: `Contrato de ${emp.name} vence en ${daysUntil} días`, icon: FileText, isSystem: true });
                }
            }
            if (emp.tempHours) {
                emp.tempHours.forEach(th => {
                    const daysUntil = Math.ceil((new Date(th.end).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    if (daysUntil >= 0 && daysUntil <= 15) {
                        alerts.push({ id: `temp_${emp.id}_${th.id}`, type: 'info', message: `Ampliación de ${emp.name} termina en ${daysUntil} días`, icon: Clock, isSystem: true });
                    }
                });
            }
            if (new Date().getDay() === 3 && Math.abs(emp.hoursDebt) > 30) {
                alerts.push({ id: `debt_${emp.id}`, type: 'error', message: `${emp.name} tiene déuda horaria de ${emp.hoursDebt}h`, icon: TrendingUp, isSystem: true });
            }
        });

        // Pending Requests
        const pendingRequestsCount: Record<string, number> = {};
        timeOffRequests.forEach(r => {
            if (r.status === 'pending') pendingRequestsCount[r.employeeId] = (pendingRequestsCount[r.employeeId] || 0) + 1;
        });
        Object.entries(pendingRequestsCount).forEach(([id, count]) => {
            if (count > 2) {
                const emp = myEmployees.find(e => e.id === id);
                if (emp) alerts.push({ id: `req_${id}`, type: 'warning', message: `${emp.name} tiene ${count} peticiones pendientes`, icon: AlertCircle, isSystem: true });
            }
        });

        // Schedule Warning Logic: Only Friday(5), Saturday(6), Sunday(0) for Next Week
        const today = new Date();
        const dayOfWeek = today.getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
            const nextWeekDate = new Date(currentWeekStart);
            nextWeekDate.setDate(nextWeekDate.getDate() + 7);
            const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

            const nextWeekSchedule = schedules.find(s => s.establishmentId === user.establishmentId && s.weekStartDate === nextWeekStr);

            // Alert if NO schedule found OR schedule is not in a "safe" state (published or pending approval)
            // Safe states: status === 'published' OR approvalStatus === 'pending'
            // Unsafe states: status === 'draft' (and not pending) OR approvalStatus === 'rejected'

            const isPendingApproval = nextWeekSchedule?.approvalStatus === 'pending';
            const isPublished = nextWeekSchedule?.status === 'published';

            if (!nextWeekSchedule || (!isPublished && !isPendingApproval)) {
                alerts.push({
                    id: `sched_needed_${nextWeekStr}`,
                    type: 'warning',
                    message: `Pendiente realizar horario (Semana ${nextWeekDate.toLocaleDateString()})`,
                    icon: Calendar,
                    isSystem: true
                });
            }
        }

        // ILT Report Alert (4th-10th)
        // const today = new Date(); // Moved up
        const dayOfMonth = today.getDate();
        if (dayOfMonth >= 20 && dayOfMonth <= 30) {
            const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            const safeReports = Array.isArray(iltReports) ? iltReports : [];
            const hasReport = safeReports.some(r => r.establishmentId === user.establishmentId && r.month === currentMonthStr);

            if (!hasReport) {
                alerts.push({
                    id: `ilt_report_${currentMonthStr}`,
                    type: 'warning',
                    message: `Pendiente Generar Informe ILT de ${today.toLocaleDateString('es-ES', { month: 'long' })}`,
                    icon: FileText,
                    isSystem: true
                });
            }
        }

        return alerts.filter(a => {
            if (a.isSystem === false) return true;
            const state = alertState[a.id];
            if (state === -1) return false;
            if (state && state > Date.now()) return false;
            return true;
        });
    }, [myEmployees, timeOffRequests, alertState, currentWeekStart, notifications, user.establishmentId, iltReports]);

    const pendingTasks = useMemo(() => {
        if (!user?.establishmentId) return [];
        // Use local date to avoid timezone issues (ISOString is UTC)
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        return tasks.filter(t => {
            if (t.isArchived) return false;

            // Check Start Date (Filter out future tasks)
            const taskStart = t.startDate || t.date;
            if (taskStart && taskStart > today) return false;

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
        <div className="min-h-screen bg-slate-50/5 p-6 md:p-10 space-y-8 max-w-[1920px] mx-auto animate-in fade-in duration-700">

            {/* HEADER */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
                <div>
                    <div className="flex items-center gap-3 text-slate-400 mb-2 font-medium">
                        <span className="bg-white/50 backdrop-blur px-3 py-1 rounded-full border border-slate-200 text-xs uppercase tracking-widest shadow-sm">
                            {settings.storeName || 'Mi Tienda'}
                        </span>
                        <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                        <span className="text-xs uppercase tracking-widest">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                        Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">{getManagerNames(user.establishmentId) || user.name}</span>
                    </h1>
                    <p className="text-slate-500 text-lg mt-2 font-medium max-w-2xl">
                        Aquí tienes el resumen de tu tienda hoy. Tienes <span className="text-indigo-600 font-bold">{pendingTasks.length} tareas</span> pendientes y <span className="text-rose-500 font-bold">{activeAlerts.length} alertas</span> que requieren atención.
                    </p>
                </div>

                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={() => setIsAnnualPlanOpen(true)}
                        className="px-5 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-[1.5rem] hover:bg-slate-50 hover:border-indigo-200 hover:shadow-lg transition-all flex items-center gap-3 shadow-sm group"
                    >
                        <div className="p-2 bg-slate-100 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                            <Calendar size={20} />
                        </div>
                        <span>Plan Anual</span>
                    </button>

                    {(() => {
                        const now = new Date();
                        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                        const isSaved = iltReports.some(r => r.establishmentId === user.establishmentId && r.month === currentMonthStr);
                        const isPeriod = now.getDate() >= 22;

                        if (isPeriod && !isSaved) {
                            return (
                                <button
                                    onClick={() => {
                                        setIltModalTab('current');
                                        setIsILTModalOpen(true);
                                    }}
                                    className="px-5 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-[1.5rem] hover:bg-slate-50 hover:border-indigo-200 hover:shadow-lg transition-all flex items-center gap-3 shadow-sm group relative"
                                >
                                    <div className="absolute -inset-0.5 bg-indigo-500 rounded-[1.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                                    <div className="p-2 bg-slate-100 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors relative">
                                        <FileText size={20} />
                                    </div>
                                    <span className="relative">Generar Informe ILT</span>
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-white animate-bounce shadow-sm">
                                        !
                                    </div>
                                </button>
                            );
                        }
                        return null;
                    })()}

                    <div className="relative">
                        <button
                            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            className={clsx("h-14 w-14 rounded-[1.5rem] flex items-center justify-center border-2 transition-all shadow-lg",
                                activeAlerts.length > 0 ? "bg-rose-500 border-rose-600 text-white animate-pulse" : "bg-white border-slate-200 text-slate-400 hover:text-indigo-600"
                            )}
                        >
                            <Bell size={24} />
                            {activeAlerts.length > 0 && <span className="absolute -top-1 -right-1 h-6 w-6 bg-white text-rose-600 border-2 border-rose-100 flex items-center justify-center rounded-full text-xs font-black shadow-sm">{activeAlerts.length}</span>}
                        </button>
                        {isNotificationsOpen && (
                            <div className="absolute right-0 mt-4 w-[400px] bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] shadow-2xl z-50 p-6 animate-in slide-in-from-top-4 fade-in duration-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-lg text-slate-800">Notificaciones</h3>
                                    <button onClick={() => setIsNotificationsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
                                </div>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {activeAlerts.length === 0 ? <p className="text-slate-400 text-center py-4">Todo limpio ✨</p> : activeAlerts.map(alert => (
                                        <div key={alert.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
                                            <div className={clsx("p-3 rounded-xl h-fit", alert.type === 'error' ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500")}>
                                                <alert.icon size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-700 leading-snug mb-2">{alert.message}</p>
                                                {alert.isSystem ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => updateAlertState(alert.id, -1)}
                                                            className="text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-100"
                                                        >
                                                            Marcar Hecho
                                                        </button>
                                                        <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                                                            {[1, 3, 5, 7].map(days => (
                                                                <button
                                                                    key={days}
                                                                    onClick={() => updateAlertState(alert.id, Date.now() + days * 86400000)}
                                                                    className="text-[9px] font-black text-slate-500 hover:bg-white hover:text-indigo-600 px-2 py-1.5 rounded-lg transition-all"
                                                                    title={`Posponer ${days} día${days > 1 ? 's' : ''}`}
                                                                >
                                                                    {days}D
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => alert.contextNotifId && markNotificationAsRead(alert.contextNotifId)}
                                                        className="text-xs text-indigo-500 font-bold hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                                                    >
                                                        Marcar leído
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {[
                    {
                        id: 'worked',
                        label: 'Distribución Semanal',
                        val: 'Vistazo Semanal',
                        icon: LayoutList,
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-50',
                        border: 'border-indigo-100/50',
                        onClick: () => setIsWeeklyScheduleOpen(true),
                        extra: (
                            <div className="mt-6 border-t border-indigo-100/10 pt-6 flex-1 flex flex-col">
                                <div className="grid grid-cols-7 gap-3 mb-4 px-1 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                                    {['Lunes', 'Martes', 'Miérc', 'Jueves', 'Viernes', 'Sábado', 'Dom'].map(d => (
                                        <div key={d} className="text-center truncate">{d.substring(0, 3)}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-3 flex-1 items-stretch">
                                    {detailedDailyHours.map((stats, i) => {
                                        const isToday = i === (new Date().getDay() + 6) % 7;
                                        return (
                                            <div key={i} className={clsx(
                                                "flex flex-col gap-2 h-full justify-end group/day relative",
                                                isToday && "after:absolute after:-bottom-3 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-indigo-500 after:rounded-full"
                                            )}>
                                                <div className="flex-1 flex flex-col gap-1.5 min-h-0">
                                                    <div
                                                        className={clsx(
                                                            "w-full rounded-xl transition-all duration-500 shadow-sm flex items-center justify-center text-xs font-black",
                                                            stats.afternoon > 0 ? (isToday ? "bg-violet-600 text-white shadow-lg shadow-violet-200" : "bg-violet-100 group-hover/day:bg-violet-200 text-violet-600") : "bg-slate-50/50 text-transparent",
                                                            stats.afternoon > 0 ? "flex-[2]" : "h-6 opacity-30"
                                                        )}
                                                    >
                                                        {stats.afternoon > 0 ? `${stats.afternoon}h` : ''}
                                                    </div>
                                                    <div
                                                        className={clsx(
                                                            "w-full rounded-xl transition-all duration-500 shadow-sm flex items-center justify-center text-xs font-black",
                                                            stats.morning > 0 ? (isToday ? "bg-amber-500 text-white shadow-lg shadow-amber-200" : "bg-amber-100 group-hover/day:bg-amber-200 text-amber-600") : "bg-slate-50/50 text-transparent",
                                                            stats.morning > 0 ? "flex-[2]" : "h-6 opacity-30"
                                                        )}
                                                    >
                                                        {stats.morning > 0 ? `${stats.morning}h` : ''}
                                                    </div>
                                                </div>
                                                <div className={clsx("text-center text-xs font-black mt-2", isToday ? "text-indigo-600" : "text-slate-900")}>
                                                    {stats.total}h
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    },
                    {
                        id: 'personnel',
                        label: 'Personal Plantilla',
                        val: `${activeEmployees.length - currentActiveAbsences.length} / ${myEmployees.length}`,
                        icon: Users,
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50',
                        border: 'border-emerald-100/50',
                        onClick: () => setIsPersonnelHistoryOpen(true),
                        extra: (
                            <div className="mt-4 border-t border-emerald-100/30 pt-4 flex-1">
                                {currentActiveAbsences.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 bg-rose-50 px-3 py-2 rounded-xl border border-rose-100/50 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                            <span className="text-xs font-black text-rose-600 uppercase tracking-widest leading-none">
                                                {currentActiveAbsences.length} Ausencias Esta Semana
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {currentActiveAbsences.slice(0, 5).map((abs, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-white/80 px-3 py-2 rounded-xl border border-slate-100 shadow-sm hover:translate-x-1 transition-transform">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-700 uppercase leading-none mb-0.5">{abs.name.split(' ')[0]}</span>
                                                        <span className={clsx(
                                                            "text-[8px] font-black uppercase tracking-wider",
                                                            abs.type === 'VACACIONES' ? "text-indigo-400" : "text-rose-400"
                                                        )}>
                                                            {abs.type === 'VACACIONES' ? 'Vacaciones' : abs.type === 'BAJA MÉDICA' ? 'Baja Médica' : 'Mat/Pat'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-black text-rose-500">-{abs.weeklyAbsenceHours}H</span>
                                                        <span className="text-[7px] font-bold text-slate-400 uppercase">semanales</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 bg-emerald-50/20 rounded-2xl border border-emerald-100/20">
                                        <UserCheck size={24} className="text-emerald-500 opacity-60 mb-2" />
                                        <span className="text-xs font-black text-emerald-600/50 uppercase tracking-widest">Plena Disponibilidad</span>
                                    </div>
                                )}
                            </div>
                        )
                    },
                    {
                        id: 'coverage',
                        label: 'Cobertura Semanal',
                        val: `${totalContractedHours > 0 ? Math.round((hoursThisWeek / totalContractedHours) * 100) : 0}%`,
                        icon: Zap,
                        color: 'text-violet-600',
                        bg: 'bg-violet-50',
                        border: 'border-violet-100/50',
                        onClick: () => setIsCoverageSummaryOpen(true),
                        extra: (
                            <div className="mt-4 border-t border-violet-100/30 pt-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Historial Reciente</p>
                                    {pastWeeklyStats.length > 0 ? pastWeeklyStats.map((stat, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[10px] font-bold bg-violet-50/50 px-3 py-1.5 rounded-xl border border-violet-100/20">
                                            <span className="text-slate-500">Semana {new Date(stat.label).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                                            <span className={clsx("font-black", stat.coverage >= 100 ? "text-violet-600" : "text-amber-600")}>
                                                {stat.coverage.toFixed(0)}%
                                            </span>
                                        </div>
                                    )) : (
                                        <p className="text-[9px] text-slate-400 italic text-center py-4">Sin datos anteriores</p>
                                    )}
                                </div>
                            </div>
                        )
                    },
                    {
                        id: 'debt',
                        label: 'Total Deuda Horas',
                        val: `${totalDebt.toFixed(1)}h`,
                        icon: Activity,
                        color: 'text-amber-600',
                        bg: 'bg-amber-50',
                        border: 'border-amber-100/50',
                        onClick: () => setIsDebtSummaryOpen(true),
                        extra: (
                            <div className="mt-4 border-t border-amber-100/30 pt-4 flex-1">
                                <div className="flex flex-col gap-2">
                                    {topDebtors.map((emp, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs font-black bg-white/80 px-4 py-2.5 rounded-2xl border border-amber-100/50 hover:bg-amber-50 shadow-sm transition-all hover:scale-[1.02]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                                <span className="text-slate-700 uppercase">{emp.name.split(' ')[0]}</span>
                                            </div>
                                            <span className="text-amber-600 font-black text-sm">
                                                {emp.hoursDebt > 0 ? `+${emp.hoursDebt}` : emp.hoursDebt}h
                                            </span>
                                        </div>
                                    ))}
                                    {topDebtors.length === 0 && (
                                        <p className="text-[10px] text-slate-400 font-bold text-center py-4">Sin deudas pendientes</p>
                                    )}
                                </div>
                            </div>
                        )

                    },
                    {
                        id: 'microloans',
                        label: 'MICROCRÉDITOS',
                        val: `${microloansData.prevMonthData.total}`,
                        icon: Coins,
                        color: 'text-indigo-600',
                        bg: 'bg-white',
                        border: 'border-white',
                        onClick: () => setIsMicroloansModalOpen(true),

                        extra: (
                            <div className="mt-2 flex-1 h-full min-h-[160px] flex flex-col justify-end">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">

                                    {/* 1. MVP Module */}
                                    <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 rounded-[2rem] p-5 flex flex-col justify-between shadow-lg shadow-indigo-200/50 text-white overflow-hidden group/mvp">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/20 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none"></div>

                                        <div className="relative z-10 flex justify-between items-start">
                                            <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-sm">
                                                <Trophy size={18} className="text-yellow-300 drop-shadow-sm" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-white/10 px-2.5 py-1 rounded-lg border border-white/5 backdrop-blur-sm">
                                                {microloansData.prevMonthData.label}
                                            </span>
                                        </div>

                                        <div className="relative z-10 flex-1 flex flex-col justify-end">
                                            <p className="text-[9px] font-bold text-indigo-100 uppercase tracking-widest mb-1 opacity-80">Ranking del Mes</p>
                                            {microloansData.prevMonthData.ranking.length > 0 ? (
                                                <div className="flex items-end justify-center gap-2 pb-1">
                                                    {(() => {
                                                        const top3 = microloansData.prevMonthData.ranking.slice(0, 3);
                                                        const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

                                                        return podiumOrder.map((emp) => {
                                                            const employeeData = myEmployees.find(e => e.id === emp.employeeId);
                                                            const initials = employeeData?.initials || emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                                                            let rank = 0;
                                                            let height = 'h-16'; // Increased Base Height
                                                            let color = 'bg-white/10';
                                                            let shadow = '';
                                                            let medalColor = 'text-white/40';

                                                            if (emp === top3[0]) {
                                                                rank = 1;
                                                                height = 'h-24'; // Taller for winner
                                                                color = 'bg-gradient-to-t from-yellow-400/30 to-yellow-300/10 border border-yellow-300/30';
                                                                shadow = 'shadow-[0_0_25px_rgba(253,224,71,0.25)]';
                                                                medalColor = 'text-yellow-300';
                                                            } else if (emp === top3[1]) {
                                                                rank = 2;
                                                                height = 'h-16';
                                                                color = 'bg-white/15 border border-white/10';
                                                                medalColor = 'text-slate-300';
                                                            } else {
                                                                rank = 3;
                                                                height = 'h-12';
                                                                color = 'bg-white/5 border border-white/5';
                                                                medalColor = 'text-orange-300/80';
                                                            }

                                                            return (
                                                                <div key={emp.employeeId || emp.name} className="flex flex-col items-center w-1/3 group/item">
                                                                    <div className="mb-2 text-center relative">
                                                                        {/* Medal Icon floating above */}
                                                                        <div className={`absolute -top-7 left-1/2 -translate-x-1/2 ${medalColor} drop-shadow-sm transition-transform group-hover/item:scale-110 duration-300`}>
                                                                            <Medal size={emp === top3[0] ? 24 : 18} />
                                                                        </div>

                                                                        <span className="block text-2xl font-black text-white tracking-tighter mb-0.5">{emp.count}</span>
                                                                        <span className="block text-base font-black text-indigo-100 opacity-90 tracking-wide">{initials}</span>
                                                                    </div>
                                                                    <div className={`w-full ${height} ${color} rounded-t-xl relative flex items-start justify-center pt-2 ${shadow} backdrop-blur-md transition-all duration-300 group-hover/item:bg-white/20`}>
                                                                        <span className={`text-[10px] font-black text-white/30`}>{rank}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="text-sm italic text-indigo-200/70">Sin datos</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Annual Top 3 (Podium) */}
                                    <div className="bg-white rounded-[2rem] p-5 flex flex-col justify-between shadow-sm border border-slate-100 group/ranking hover:shadow-md transition-all duration-300 relative overflow-hidden">
                                        <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-50 rounded-full blur-3xl opacity-50 pointer-events-none group-hover/ranking:opacity-80 transition-opacity"></div>

                                        <div className="flex items-center gap-2 mb-4 relative z-10">
                                            <Trophy size={14} className="fill-amber-400 text-amber-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Líderes Anuales</span>
                                        </div>

                                        <div className="flex-1 flex items-end justify-center gap-2 relative z-10 pb-2">
                                            {microloansData.annualRanking.length > 0 ? (() => {
                                                const top3 = microloansData.annualRanking.slice(0, 3);
                                                // Podium order: 2nd, 1st, 3rd
                                                const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

                                                return podiumOrder.map((emp) => {
                                                    // Determine Rank based on original index in top3
                                                    // if emp === top3[0] -> Rank 1 (Gold)
                                                    // if emp === top3[1] -> Rank 2 (Silver)
                                                    // if emp === top3[2] -> Rank 3 (Bronze)
                                                    let rank = 0;
                                                    let height = 'h-16';
                                                    let color = 'bg-slate-200';
                                                    let shadow = '';

                                                    if (emp === top3[0]) {
                                                        rank = 1;
                                                        height = 'h-24';
                                                        color = 'bg-gradient-to-t from-amber-400 to-amber-300';
                                                        shadow = 'shadow-[0_0_15px_rgba(251,191,36,0.4)]';
                                                    } else if (emp === top3[1]) {
                                                        rank = 2;
                                                        height = 'h-20';
                                                        color = 'bg-gradient-to-t from-slate-300 to-slate-200';
                                                    } else {
                                                        rank = 3;
                                                        height = 'h-14';
                                                        color = 'bg-gradient-to-t from-orange-300 to-orange-200';
                                                    }

                                                    return (
                                                        <div key={emp.id} className="flex flex-col items-center group/podium w-1/3">
                                                            <div className="mb-2 text-center transition-transform group-hover/podium:-translate-y-1">
                                                                <span className="block text-[10px] font-bold text-slate-600 truncate max-w-[60px] mx-auto">{emp.name.split(' ')[0]}</span>
                                                                <span className="block text-xs font-black text-slate-800">{emp.count}</span>
                                                            </div>
                                                            <div className={`w-full ${height} ${color} rounded-t-lg relative flex items-start justify-center pt-2 ${shadow} transition-all duration-300`}>
                                                                <span className={`text-[10px] font-black text-white drop-shadow-sm opacity-80`}>{rank}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })() : (
                                                <div className="flex-1 flex items-center justify-center text-slate-300 text-xs italic">Ranking vacío</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Trend Chart */}
                                    <div className="bg-white rounded-[2rem] p-5 flex flex-col justify-between shadow-sm border border-slate-100 group/trend hover:shadow-md transition-all duration-300">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                                                    <TrendingUp size={12} /> Tendencia 6 Meses
                                                </p>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-black text-slate-800 tracking-tighter">
                                                        {microloansData.history.reduce((a, b) => a + b.total, 0)}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-normal">total acumulado</span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5">
                                                <div className="flex -space-x-1">
                                                    <div className="w-1.5 h-3 rounded-full bg-indigo-300"></div>
                                                    <div className="w-1.5 h-3 rounded-full bg-indigo-500"></div>
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-500">Objetivo</span>
                                            </div>
                                        </div>

                                        <div className="flex items-end justify-between gap-3 flex-1 min-h-[120px] px-1">
                                            {microloansData.history.map((h, i) => {
                                                const max = Math.max(...microloansData.history.map(x => x.total)) || 1;
                                                const height = Math.max(15, Math.min(100, (h.total / max) * 100));
                                                return (
                                                    <div key={i} className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end group/bar relative">
                                                        {/* Tooltip on Hover */}
                                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                                            {h.total}
                                                        </div>
                                                        <div className="w-full relative flex items-end justify-center h-full rounded-t-lg bg-slate-100 overflow-hidden">
                                                            <div
                                                                className="w-full absolute bottom-0 bg-gradient-to-t from-indigo-500 to-sky-400 group-hover/bar:from-indigo-600 group-hover/bar:to-purple-500 transition-all duration-500 rounded-t-lg shadow-sm"
                                                                style={{ height: `${height}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{h.label.substring(0, 3)}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )
                    }
                ].map((stat, i) => (
                    <div
                        key={i}
                        onClick={stat.onClick}
                        className={clsx(
                            "bg-white p-6 rounded-[2.5rem] border shadow-sm transition-all duration-500 group relative flex flex-col h-[340px] overflow-hidden",
                            stat.border,
                            stat.id === 'worked' ? "xl:col-span-2" : stat.id === 'microloans' ? "xl:col-span-5" : "xl:col-span-1",
                            !!stat.onClick && "cursor-pointer hover:shadow-2xl hover:-translate-y-1 active:scale-[0.99]"
                        )}
                    >
                        {!!stat.onClick && (
                            <div className="absolute top-5 right-5 h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all border border-transparent group-hover:border-indigo-100 shadow-sm z-20">
                                <ArrowUpRight size={16} />
                            </div>
                        )}

                        <div className={clsx(
                            "absolute top-0 right-0 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-all duration-700 blur-2xl",
                            stat.bg
                        )}></div>

                        {stat.id === 'microloans' ? (
                            <div className="flex items-center gap-3 py-1">
                                <div className={clsx(
                                    "p-2.5 rounded-xl transition-all duration-500 shadow-sm flex items-center justify-center bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white"
                                )}>
                                    <stat.icon size={22} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 tracking-tighter drop-shadow-sm animate-in zoom-in-50 duration-500 origin-left">
                                    MICROCRÉDITOS
                                </h2>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <div className={clsx(
                                    "p-3 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-sm",
                                    stat.bg, stat.color
                                )}>
                                    <stat.icon size={22} strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-1 truncate">
                                        {stat.val}
                                    </p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <span className={clsx("w-1 h-3 rounded-full", stat.color.replace('text-', 'bg-'))}></span>
                                        {stat.label}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 relative z-10">
                            {stat.extra}
                        </div>
                    </div>
                ))
                }
            </div >

            {/* MAIN CONTENT GRID */}
            < div className="grid grid-cols-1 xl:grid-cols-12 gap-8" >

                {/* LEFT COL (8) */}
                < div className="xl:col-span-7 space-y-8" >

                    {/* TASK BANNER */}
                    {
                        pendingTasks.length > 0 && (
                            <div className="rounded-[2.5rem] bg-slate-900 overflow-hidden relative shadow-2xl">
                                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px] -mt-20 -mr-20 pointer-events-none"></div>
                                <div className="relative z-10 p-8 flex flex-col md:flex-row gap-8 items-center justify-between">
                                    <div className="flex gap-6 items-center">
                                        <div className="h-16 w-16 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                            <CheckSquare size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-white mb-2">Tareas Pendientes</h3>
                                            <p className="text-slate-400">Tienes {pendingTasks.length} tareas que requieren tu atención inmediata.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto max-w-full pb-2 md:pb-0">
                                        {pendingTasks.slice(0, 3).map(task => {
                                            const myStatus = task.status[user.establishmentId]?.status || 'pending';
                                            return (
                                                <div key={task.id} className="min-w-[220px] bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-colors">
                                                    <p className="text-white font-bold text-sm mb-3 truncate">{task.title}</p>
                                                    <div className="flex justify-between items-center">
                                                        <span className={clsx("text-[10px] font-bold px-2 py-1 rounded-lg uppercase",
                                                            myStatus === 'pending' ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"
                                                        )}>{myStatus === 'pending' ? 'Pendiente' : 'En Curso'}</span>
                                                        {myStatus === 'pending' ? (
                                                            <button onClick={() => handleQuickTaskUpdate(task.id, 'in_progress')} className="h-8 w-8 rounded-lg bg-white text-slate-900 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors" title="Empezar"><Clock size={16} /></button>
                                                        ) : (
                                                            <button onClick={() => handleQuickTaskUpdate(task.id, 'completed')} className="h-8 w-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-400 transition-colors" title="Completar"><Check size={16} /></button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* CURRENT STATUS & SCHEDULE - REMOVED */}

                    {/* FINANCE & HOURS (Replaces Debt Control) */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 overflow-visible">
                        <div className="flex flex-col items-center text-center mb-10 gap-6">
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 flex items-center justify-center gap-3">
                                    <Coins className="text-amber-500" /> Finanzas & Horas
                                </h3>
                                <p className="text-slate-400 font-medium mt-1">Gestión de deuda y pagos de incentivos</p>
                            </div>
                            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl backdrop-blur-sm shadow-inner border border-slate-200/50">
                                {(['balance', 'adjust', 'pay', 'history'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setDebtTab(tab)}
                                        className={clsx("px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all",
                                            debtTab === tab ? "bg-white text-indigo-600 shadow-md transform scale-105" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {tab === 'balance' ? 'Bolsa' : tab === 'adjust' ? 'Ajustes' : tab === 'pay' ? 'Pagos' : 'Historial'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {debtTab === 'balance' && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                {myEmployees.filter(e => e.active).map((emp) => (
                                    <div key={emp.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center gap-1 group hover:border-indigo-200 transition-colors cursor-default">
                                        <p className="text-sm font-black uppercase text-slate-500 tracking-widest mb-1">
                                            {emp.initials || emp.name.split(' ').map(n => n[0]).join('').substring(0, 3)}
                                        </p>
                                        <p className={clsx("text-3xl font-black tracking-tight", emp.hoursDebt > 0 ? "text-emerald-500" : emp.hoursDebt < 0 ? "text-rose-500" : "text-slate-300")}>
                                            {emp.hoursDebt > 0 && '+'}{emp.hoursDebt}
                                        </p>
                                        <span className="text-[10px] font-bold text-slate-400">horas</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {debtTab === 'adjust' && (
                            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="md:col-span-1">
                                        <FilterSelect
                                            options={[{ value: '', label: 'Seleccionar...' }, ...myEmployees.filter(e => e.active).map(e => ({ value: e.id, label: e.name }))]}
                                            value={selectedDebtEmp || ''}
                                            onChange={setSelectedDebtEmp}
                                            placeholder="Empleado"
                                            icon={Users}
                                            theme="light"
                                        />
                                    </div>
                                    <div className="md:col-span-1 space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest pl-1">Cantidad (h)</label>
                                        <input type="number" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors"
                                            value={manualDebtAmount} onChange={e => setManualDebtAmount(Number(e.target.value))} placeholder="0.00"
                                        />
                                    </div>
                                    <div className="md:col-span-1 space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest pl-1">Motivo</label>
                                        <input type="text" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors"
                                            value={manualDebtReason} onChange={e => setManualDebtReason(e.target.value)} placeholder="Ej: Devolución..."
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <button onClick={handleAddManualDebt} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">
                                            Guardar Cambios
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {debtTab === 'pay' && (
                            <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95 duration-300">
                                <div className="p-4 bg-indigo-50 rounded-full text-indigo-500 mb-4">
                                    <Coins size={48} />
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">Transferencia a Incentivos</h4>
                                <p className="text-slate-400 text-center max-w-md mb-6">Mueve horas acumuladas de la bolsa directamente al reporte de incentivos del mes seleccionado.</p>
                                <button onClick={() => setIsPayIncentivesOpen(true)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-200 transition-all hover:-translate-y-1">
                                    Iniciar Transferencia
                                </button>
                            </div>
                        )}

                        {debtTab === 'history' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-visible">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>

                                    <div className="space-y-1.5">
                                        <FilterSelect
                                            options={[{ value: '', label: 'Todos los empleados' }, ...myEmployees.map(e => ({ value: e.id, label: e.name }))]}
                                            value={selectedDebtEmp || ''}
                                            onChange={setSelectedDebtEmp}
                                            placeholder="Filtrar Empleado"
                                            icon={Users}
                                            theme="light"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <FilterSelect
                                            options={[
                                                { value: 'all', label: 'Cualquier mes' },
                                                ...["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => ({ value: i, label: m }))
                                            ]}
                                            value={selectedDebtMonth}
                                            onChange={setSelectedDebtMonth}
                                            placeholder="Mes"
                                            icon={Calendar}
                                            theme="light"
                                        />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 shadow-sm group transition-all duration-300">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-500 group-hover:scale-110 transition-transform duration-300">
                                                    <Calendar size={16} />
                                                </div>
                                                <div className="flex flex-col items-start truncate leading-tight">
                                                    <span className="text-[9px] uppercase font-black tracking-[0.15em] mb-0.5 text-slate-400">Año de Consulta</span>
                                                    <span className="text-xs font-black text-slate-700">{selectedDebtYear}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white/50 p-1 rounded-lg border border-slate-200/50 shadow-inner">
                                                <button
                                                    onClick={() => setSelectedDebtYear(y => y - 1)}
                                                    className="p-1 hover:bg-white hover:text-indigo-600 rounded-md text-slate-400 transition-all active:scale-95"
                                                    title="Año anterior"
                                                >
                                                    <ChevronRight className="rotate-180" size={14} />
                                                </button>
                                                <div className="w-[1px] h-3 bg-slate-200"></div>
                                                <button
                                                    onClick={() => setSelectedDebtYear(y => y + 1)}
                                                    className="p-1 hover:bg-white hover:text-indigo-600 rounded-md text-slate-400 transition-all active:scale-95"
                                                    title="Año siguiente"
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {(() => {
                                        const filteredLogs = hoursDebtLogs.filter(log => {
                                            const logDate = new Date(log.date);
                                            const matchesYear = logDate.getFullYear() === selectedDebtYear;
                                            const matchesMonth = selectedDebtMonth === 'all' || logDate.getMonth() === selectedDebtMonth;
                                            const matchesEmp = !selectedDebtEmp || log.employeeId === selectedDebtEmp;
                                            return matchesYear && matchesMonth && matchesEmp;
                                        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                        if (filteredLogs.length === 0) return (
                                            <div className="py-12 flex flex-col items-center justify-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                                                <Search size={32} className="text-slate-300 mb-2" />
                                                <p className="text-slate-400 font-bold text-sm">No hay registros con estos filtros</p>
                                            </div>
                                        );

                                        return filteredLogs.map(log => {
                                            const emp = myEmployees.find(e => e.id === log.employeeId);
                                            return (
                                                <div key={log.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center font-black text-slate-400 text-xs shadow-sm group-hover:text-indigo-500 transition-colors">
                                                            {emp?.initials || emp?.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold text-slate-700">{emp?.name}</p>
                                                                <span className="text-[10px] text-slate-400">•</span>
                                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">
                                                                    {new Date(log.date).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-slate-500 font-medium">{log.reason}</p>
                                                        </div>
                                                    </div>
                                                    <span className={clsx("text-lg font-black", log.amount > 0 ? "text-emerald-500" : "text-rose-500")}>
                                                        {log.amount > 0 ? '+' : ''}{log.amount}h
                                                    </span>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SÁBADOS LIBRES PANEL - Matrix Redesign */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-6 flex flex-col h-fit overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                    <LayoutGrid size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 leading-tight">Sábados Libres</h3>
                                    <p className="text-xs text-slate-400 font-medium">Conteo anual excluyendo vacaciones y bajas</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                <button onClick={() => setSaturdaysYear(y => y - 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-indigo-600">
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-sm font-black text-slate-700 w-12 text-center">{saturdaysYear}</span>
                                <button onClick={() => setSaturdaysYear(y => y + 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-indigo-600">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="relative overflow-x-auto custom-scrollbar pb-2">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 z-20 bg-white p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[200px]">
                                            Empleado
                                        </th>
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <th key={i} className="p-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center w-[calc((100%-250px)/12)]">
                                                {new Date(2024, i).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}
                                            </th>
                                        ))}
                                        <th className="p-3 text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 text-center w-[50px] bg-slate-50">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {myEmployees.filter(e => e.active).map(emp => {
                                        let empTotal = 0;
                                        const monthlyCounts = Array.from({ length: 12 }, (_, monthIndex) => {
                                            const daysInMonth = new Date(saturdaysYear, monthIndex + 1, 0).getDate();
                                            let count = 0;
                                            for (let d = 1; d <= daysInMonth; d++) {
                                                const date = new Date(saturdaysYear, monthIndex, d);
                                                if (date.getDay() === 6) { // Saturday
                                                    // Fix: Construct YYYY-MM-DD using local time components to avoid timezone shifts from toISOString()
                                                    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                                                    // 1. Check if Holiday (Global or Calendar)
                                                    const isHoliday = settings.holidays.some(h => h.date === dateStr);
                                                    if (isHoliday) continue;

                                                    // 2. Check if Schedule Published
                                                    const schedule = schedules.find(s => s.establishmentId === user.establishmentId && s.status === 'published' &&
                                                        dateStr >= s.weekStartDate && dateStr <= new Date(new Date(s.weekStartDate).getTime() + 6 * 86400000).toISOString().split('T')[0]);

                                                    if (schedule) {
                                                        const shift = schedule.shifts.find(s => s.employeeId === emp.id && s.date === dateStr);

                                                        // 3. Shift MUST exist in the schedule to count
                                                        // If no shift exists, it means the employee was not included in this schedule (e.g. not hired yet), so it shouldn't count.
                                                        if (!shift) continue;

                                                        // 4. Check for work
                                                        const hasWork = shift.type === 'morning' || shift.type === 'afternoon' || shift.type === 'split';

                                                        // 5. Check for Absences (Vacation/Sick Leave)
                                                        const isAbsent = timeOffRequests.some(r =>
                                                            r.employeeId === emp.id && r.status !== 'rejected' &&
                                                            (r.dates && r.dates.includes(dateStr) || (r.startDate && r.endDate && dateStr >= r.startDate && dateStr <= r.endDate))
                                                        );

                                                        // 6. Check if it's explicitly marked as "Free" (Off) in schedule OR just not working and not absent
                                                        // "Sábado Libre" usually means they were ABLE to work but were given the day off.
                                                        // Ideally, shift.type === 'off'.
                                                        // But if no shift exists in a published schedule, it's also effectively off.

                                                        if (!hasWork && !isAbsent) {
                                                            count++;
                                                        }
                                                    }
                                                }
                                            }
                                            empTotal += count;
                                            return count;
                                        });

                                        return (
                                            <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/50 p-3 border-r border-slate-50/50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] shadow-sm">
                                                            {emp.initials || emp.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{emp.name}</span>
                                                    </div>
                                                </td>
                                                {monthlyCounts.map((count, i) => (
                                                    <td key={i} className="p-2 text-center">
                                                        <span className={clsx(
                                                            "text-[10px] font-black px-2 py-1 rounded-md transition-all",
                                                            count > 0 ? "bg-indigo-100 text-indigo-600" : "text-slate-300"
                                                        )}>
                                                            {count > 0 ? count : '-'}
                                                        </span>
                                                    </td>
                                                ))}
                                                <td className="p-3 text-center bg-slate-50/30">
                                                    <span className="text-xs font-black text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                                                        {empTotal}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div >


                {/* RIGHT COL (4) */}
                < div className="xl:col-span-5 space-y-8" >

                    {/* SICK LEAVE HISTORY WIDGET */}
                    < div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-6 flex flex-col h-auto min-h-[400px]" >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><UserX className="text-rose-500" /> Historial Bajas</h3>
                            <button onClick={() => setIsRequestHistoryOpen(true)} className="text-xs font-bold text-indigo-500 hover:underline">Ver Detalle Completo</button>
                        </div>
                        <div className="flex-1 overflow-visible">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Empleado</th>
                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center" title="Incapacidad Temporal (Año Actual)">IT</th>
                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center" title="Maternidad/Paternidad (Año Actual)">Mat/Pat</th>
                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Rendimiento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {myEmployees.filter(e => e.active).map(emp => {
                                            const currentYear = new Date().getFullYear();


                                            // Helper to count days for a specific year and type
                                            const countDays = (type: 'sick_leave' | 'maternity_paternity', year: number) => {
                                                return timeOffRequests
                                                    .filter(r => r.employeeId === emp.id && r.type === type)
                                                    .reduce((acc, req) => {
                                                        if (req.dates && req.dates.length > 0) {
                                                            return acc + req.dates.filter(d => {
                                                                const date = new Date(d);
                                                                return date.getFullYear() === year && isDateInPublishedWeek(date);
                                                            }).length;
                                                        }
                                                        if (req.startDate && req.endDate) {
                                                            const s = new Date(req.startDate);
                                                            const e = new Date(req.endDate);
                                                            let days = 0;
                                                            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                                                                if (d.getFullYear() === year && isDateInPublishedWeek(d)) days++;
                                                            }
                                                            return acc + days;
                                                        }
                                                        return acc;
                                                    }, 0);
                                            };

                                            // Get number of days in published weeks for this employee
                                            const publishedWeeks = schedules.filter(s => s.establishmentId === user.establishmentId && s.status === 'published' && s.weekStartDate.startsWith(currentYear.toString()));
                                            // Each published week has 7 days.
                                            const totalPublishedDays = publishedWeeks.length * 7;

                                            const itDays = countDays('sick_leave', currentYear);
                                            const matDays = countDays('maternity_paternity', currentYear);
                                            const perf = calculatePerformance(itDays, matDays, totalPublishedDays);

                                            return (
                                                <tr key={emp.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600">
                                                                {emp.initials || emp.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-700">{emp.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-md", itDays > 0 ? "bg-rose-50 text-rose-600" : "text-slate-300")}>
                                                            {itDays}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-md", matDays > 0 ? "bg-purple-50 text-purple-600" : "text-slate-300")}>
                                                            {matDays}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <span className={clsx("text-xs font-black", perf < 90 ? "text-amber-500" : "text-emerald-600")}>{perf}%</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div >

                    {/* VACATIONS WIDGET - Timeline Style */}
                    < div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-6" >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Plane className="text-teal-500" /> Vacaciones</h3>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                    <button onClick={() => setVacationYear(y => y - 1)} className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-indigo-600">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-black text-slate-600 w-10 text-center">{vacationYear}</span>
                                    <button onClick={() => setVacationYear(y => y + 1)} className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-indigo-600">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <span className="w-2 h-2 rounded-full bg-teal-500"></span><span className="text-[10px] text-slate-400 font-bold uppercase mr-2">Hecho</span>
                                    <span className="w-2 h-2 rounded-full bg-teal-200"></span><span className="text-[10px] text-slate-400 font-bold uppercase">Prog</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-5 pr-2">
                            {vacationDaysPerEmployee.map(item => (
                                <div key={item.name}>
                                    <div className="flex justify-between text-xs mb-1.5 font-bold">
                                        <span className="text-slate-700">{item.name}</span>
                                        <span className="text-slate-400">{item.total}/31</span>
                                    </div>
                                    <div className="flex h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                        <div style={{ width: `${(item.enjoyed / 31) * 100}%` }} className="h-full bg-teal-500"></div>
                                        <div style={{ width: `${(item.scheduled / 31) * 100}%` }} className="h-full bg-teal-200"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div >


                </div >

                {/* MODALS RETAINED FOR FUNCTIONALITY */}
                {
                    isDebtHistoryOpen && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl relative overflow-hidden">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-2xl font-black text-slate-900">Historial de Ajustes</h3>
                                    <button onClick={() => setIsDebtHistoryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
                                </div>
                                <div className="flex gap-4 mb-6">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                        <input type="text" placeholder="Buscar..." value={debtSearchQuery} onChange={e => setDebtSearchQuery(e.target.value)}
                                            className="w-full bg-slate-50 border-none rounded-xl py-3 pl-12 font-medium focus:ring-2 focus:ring-indigo-100 outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                                        <button onClick={() => setSelectedDebtYear(y => y - 1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition-all text-slate-600"><ChevronRight className="rotate-180" size={16} /></button>
                                        <span className="text-sm font-black text-slate-800 tabular-nums px-2">{selectedDebtYear}</span>
                                        <button onClick={() => setSelectedDebtYear(y => y + 1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition-all text-slate-600"><ChevronRight size={16} /></button>
                                    </div>
                                </div>
                                <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    {hoursDebtLogs.filter(l => new Date(l.date).getFullYear() === selectedDebtYear && (!selectedDebtEmp || l.employeeId === selectedDebtEmp) && (!debtSearchQuery || myEmployees.find(e => e.id === l.employeeId)?.name.toLowerCase().includes(debtSearchQuery.toLowerCase()))).length === 0 ? (
                                        <p className="text-center text-slate-400 py-8">No se encontraron registros.</p>
                                    ) : hoursDebtLogs.filter(l => new Date(l.date).getFullYear() === selectedDebtYear && (!selectedDebtEmp || l.employeeId === selectedDebtEmp) && (!debtSearchQuery || myEmployees.find(e => e.id === l.employeeId)?.name.toLowerCase().includes(debtSearchQuery.toLowerCase())))
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(log => {
                                            const emp = myEmployees.find(e => e.id === log.employeeId);
                                            return (
                                                <div key={log.id} className="bg-slate-50 p-4 rounded-xl flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                                    <div>
                                                        <p className="font-bold text-slate-700">{emp?.name}</p>
                                                        <p className="text-sm text-slate-500">{log.reason}</p>
                                                        <p className="text-[10px] text-slate-400 mt-1">{new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString()}</p>
                                                    </div>
                                                    <span className={clsx("font-black text-lg", log.amount > 0 ? "text-emerald-500" : "text-rose-500")}>
                                                        {log.amount > 0 ? '+' : ''}{log.amount}h
                                                    </span>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    isRequestHistoryOpen && (
                        <div id="detailed-history-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 overflow-y-auto">
                            {/* Print Styles */}
                            <style>{`
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 10mm;
                            }
                            body * { visibility: hidden; }
                            #detailed-history-modal, #detailed-history-modal * { visibility: visible; }
                            #detailed-history-modal { 
                                position: fixed; left: 0; top: 0; width: 210mm; height: auto; 
                                margin: 0; padding: 0; background: white; 
                                display: block; overflow: visible;
                                transform-origin: top left;
                                zoom: 0.75;
                            }
                            .no-print { display: none !important; }
                            
                            /* Ensure table fits A4 */
                            .print-container { max-height: none !important; overflow: visible !important; border: none !important; border-radius: 0 !important; }
                            table { width: 100% !important; border: 1px solid #000 !important; font-size: 10px !important; border-collapse: collapse !important; }
                            th, td { padding: 4px !important; border: 1px solid #eee !important; box-shadow: none !important; }
                            
                            /* Force Background Colors */
                            .bg-rose-500 { background-color: #f43f5e !important; color: white !important; -webkit-print-color-adjust: exact; }
                            .bg-purple-500 { background-color: #a855f7 !important; color: white !important; -webkit-print-color-adjust: exact; }
                            .bg-rose-50\/30 { background-color: rgba(254, 242, 242, 0.4) !important; -webkit-print-color-adjust: exact; }
                            .bg-purple-50\/30 { background-color: rgba(250, 245, 255, 0.4) !important; -webkit-print-color-adjust: exact; }
                            
                            /* Hide Scrollbars */
                            ::-webkit-scrollbar { display: none; }
                        }
                    `}</style>
                            <div className="bg-white rounded-[2.5rem] w-full max-w-6xl p-8 shadow-2xl max-h-[90vh] print:max-h-none flex flex-col relative print:shadow-none print:w-full print:max-w-none print:rounded-none">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 no-print">
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                            <UserX className="text-rose-500" size={32} /> Historial Detallado de Bajas
                                        </h2>
                                        <p className="text-slate-500 text-sm font-medium mt-1">Desglose anual por empleado, tipo y mensualidad.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button title="Imprimir Informe" onClick={() => window.print()} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors bg-white border border-slate-200 text-slate-700 font-bold flex items-center gap-2">
                                            <FileText size={20} /> <span className="hidden md:inline">Imprimir</span>
                                        </button>
                                        <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1.5">
                                            <button onClick={() => setDashboardYear(y => y - 1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition-all text-slate-600"><ChevronRight className="rotate-180" size={16} /></button>
                                            <span className="text-lg font-black text-slate-800 tabular-nums px-2">{dashboardYear}</span>
                                            <button onClick={() => setDashboardYear(y => y + 1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition-all text-slate-600"><ChevronRight size={16} /></button>
                                        </div>
                                        <button onClick={() => setIsRequestHistoryOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors bg-slate-50 border border-slate-200 text-slate-600">
                                            <X size={24} />
                                        </button>
                                    </div>
                                </div>

                                {/* Print Header */}
                                <div className="hidden print:block mb-6">
                                    <h1 className="text-2xl font-black text-slate-900">Informe de Bajas y Absentismo - {dashboardYear}</h1>
                                    <p className="text-sm text-slate-500">Generado el {new Date().toLocaleDateString()}</p>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-3xl shadow-inner bg-slate-50/50 print-container print:border-none print:shadow-none print:bg-white print:overflow-visible">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th rowSpan={2} className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white border-b border-r border-slate-100">Empleado</th>
                                                <th rowSpan={2} className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white border-b border-r border-slate-100 text-center">Rendimiento</th>
                                                <th colSpan={3} className="p-2 text-[10px] font-black text-white uppercase tracking-[0.2em] bg-rose-500 border-b border-r border-rose-600 text-center">Incapacidad Temporal (IT)</th>
                                                <th colSpan={3} className="p-2 text-[10px] font-black text-white uppercase tracking-[0.2em] bg-purple-500 border-b border-purple-600 text-center">Maternidad / Paternidad</th>
                                            </tr>
                                            <tr>
                                                {/* IT Subheaders */}
                                                <th className="p-3 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-rose-50 border-b border-r border-rose-100 text-center">Año {dashboardYear}</th>
                                                <th className="p-3 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-rose-50 border-b border-r border-rose-100 text-center">Histórico</th>
                                                <th className="p-3 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-rose-50 border-b border-r border-slate-100 text-center min-w-[200px]">Desglose Mensual ({dashboardYear})</th>

                                                {/* Mat Subheaders */}
                                                <th className="p-3 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-purple-50 border-b border-r border-purple-100 text-center">Año {dashboardYear}</th>
                                                <th className="p-3 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-purple-50 border-b border-r border-purple-100 text-center">Histórico</th>
                                                <th className="p-3 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-purple-50 border-b border-slate-100 text-center min-w-[200px]">Desglose Mensual ({dashboardYear})</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/50 bg-white">
                                            {myEmployees.filter(e => e.active).map(emp => {
                                                const currentYear = dashboardYear;

                                                // Helper to calculate worked hours for a specific year
                                                const getWorkedHours = (year: number) => {
                                                    if (!user) return 0;
                                                    return schedules
                                                        .filter(s => s.establishmentId === user.establishmentId && s.status === 'published' && s.weekStartDate.startsWith(year.toString()))
                                                        .reduce((acc, s) => {
                                                            const shifts = s.shifts.filter(sh => sh.employeeId === emp.id);
                                                            const worked = shifts.reduce((sum, sh) => {
                                                                if (sh.type === 'split') return sum + 8;
                                                                if (sh.type === 'morning' || sh.type === 'afternoon') return sum + 4;
                                                                return sum;
                                                            }, 0);
                                                            return acc + worked;
                                                        }, 0);
                                                };

                                                // Calculation Helpers
                                                const getDays = (type: 'sick_leave' | 'maternity_paternity', year?: number) => {
                                                    return timeOffRequests
                                                        .filter(r => r.employeeId === emp.id && r.type === type)
                                                        .reduce((acc, req) => {
                                                            let days = 0;
                                                            if (req.dates && req.dates.length > 0) {
                                                                req.dates.forEach(dStr => {
                                                                    const d = new Date(dStr);
                                                                    if ((!year || d.getFullYear() === year) && isDateInPublishedWeek(d)) {
                                                                        days++;
                                                                    }
                                                                });
                                                            } else if (req.startDate && req.endDate) {
                                                                const s = new Date(req.startDate);
                                                                const e = new Date(req.endDate);
                                                                // inclusive dates
                                                                for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                                                                    if ((!year || d.getFullYear() === year) && isDateInPublishedWeek(d)) {
                                                                        days++;
                                                                    }
                                                                }
                                                            }
                                                            return acc + days;
                                                        }, 0);
                                                };

                                                const getMonthlyBreakdown = (type: 'sick_leave' | 'maternity_paternity') => {
                                                    const months = Array(12).fill(0);
                                                    timeOffRequests
                                                        .filter(r => r.employeeId === emp.id && r.type === type)
                                                        .forEach(req => {
                                                            if (req.dates && req.dates.length > 0) {
                                                                req.dates.forEach(dStr => {
                                                                    const date = new Date(dStr);
                                                                    if (date.getFullYear() === currentYear && isDateInPublishedWeek(date)) {
                                                                        months[date.getMonth()]++;
                                                                    }
                                                                });
                                                            } else if (req.startDate && req.endDate) {
                                                                const s = new Date(req.startDate);
                                                                const e = new Date(req.endDate);
                                                                for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                                                                    if (d.getFullYear() === currentYear && isDateInPublishedWeek(d)) {
                                                                        months[d.getMonth()]++;
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    return months; // Returns array of 12 numbers
                                                };

                                                return {
                                                    emp,
                                                    itYear: getDays('sick_leave', currentYear),
                                                    itTotal: getDays('sick_leave'),
                                                    itMonths: getMonthlyBreakdown('sick_leave'),
                                                    matYear: getDays('maternity_paternity', currentYear),
                                                    matTotal: getDays('maternity_paternity'),
                                                    matMonths: getMonthlyBreakdown('maternity_paternity'),
                                                    workedHours: getWorkedHours(currentYear),
                                                    currentYear
                                                };
                                            })
                                                .sort((a, b) => b.itYear - a.itYear)
                                                .map(({ emp, itYear, itTotal, itMonths, matYear, matTotal, matMonths, workedHours }) => {
                                                    const perf = calculatePerformance(itYear, matYear, workedHours);
                                                    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

                                                    const renderMonths = (daysArr: number[], colorClass: string) => {
                                                        const activeMonths = daysArr.map((d, i) => ({ d, name: monthNames[i] })).filter(m => m.d > 0);
                                                        if (activeMonths.length === 0) return <span className="text-slate-300 text-[10px] italic">Sin registros</span>;
                                                        return (
                                                            <div className="flex flex-wrap gap-1">
                                                                {activeMonths.map((m, i) => (
                                                                    <span key={`${m.name}-${i}`} className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase whitespace-nowrap", colorClass)}>
                                                                        {m.name}: {m.d}d
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-4 border-r border-slate-100">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={clsx("h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm bg-slate-100 text-slate-600")}>
                                                                        {emp.initials || emp.name.substring(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-slate-900 text-sm">{emp.name}</p>
                                                                        <p className="text-[10px] font-semibold text-slate-400 uppercase">{emp.category}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-center border-r border-slate-100">
                                                                <span className={clsx("font-black bg-opacity-10 px-2 py-1 rounded-lg border",
                                                                    perf < 90 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-emerald-600 bg-emerald-50 border-emerald-100"
                                                                )}>{perf}%</span>
                                                            </td>

                                                            {/* IT Data */}
                                                            <td className="p-4 text-center border-r border-slate-100 font-bold text-rose-600 bg-rose-50/30">{itYear}</td>
                                                            <td className="p-4 text-center border-r border-slate-100 font-medium text-slate-500 bg-rose-50/30">{itTotal}</td>
                                                            <td className="p-4 border-r border-slate-100 bg-rose-50/30">
                                                                {renderMonths(itMonths, "bg-white border-rose-100 text-rose-600")}
                                                            </td>

                                                            {/* Mat Data */}
                                                            <td className="p-4 text-center border-r border-slate-100 font-bold text-purple-600 bg-purple-50/30">{matYear}</td>
                                                            <td className="p-4 text-center border-r border-slate-100 font-medium text-slate-500 bg-purple-50/30">{matTotal}</td>
                                                            <td className="p-4 bg-purple-50/30">
                                                                {renderMonths(matMonths, "bg-white border-purple-100 text-purple-600")}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    isDebtSummaryOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl max-h-[80vh] flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-bl-full -mr-20 -mt-20 opacity-50"></div>

                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                            <Activity className="text-amber-500" size={28} /> Resumen de Deuda
                                        </h2>
                                        <p className="text-slate-500 text-sm font-medium">Estado actual de la bolsa de horas por empleado.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setIsDebtSummaryOpen(false);
                                                setIsDebtHistoryOpen(true);
                                            }}
                                            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
                                        >
                                            <Clock size={16} /> Ver Historial Completo
                                        </button>
                                        <button onClick={() => setIsDebtSummaryOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors bg-slate-50 border border-slate-200 text-slate-600">
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar space-y-3 pr-2 relative z-10">
                                    {myEmployees.filter(e => e.active).sort((a, b) => (b.hoursDebt || 0) - (a.hoursDebt || 0)).map(emp => (
                                        <div key={emp.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between hover:border-amber-200 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-500 text-base shadow-sm">
                                                    {emp.initials || emp.name.split(' ').map(n => n[0]).join('').substring(0, 3)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{emp.name}</p>
                                                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{emp.category}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className={clsx("text-lg font-black", (emp.hoursDebt || 0) > 0 ? "text-amber-600" : "text-emerald-600")}>
                                                        {(emp.hoursDebt || 0) > 0 ? '+' : ''}{emp.hoursDebt || 0}h
                                                    </p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">Pendiente</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }

                {isAnnualPlanOpen && <AnnualPlanModal isOpen={isAnnualPlanOpen} onClose={() => setIsAnnualPlanOpen(false)} establishmentId={user.establishmentId} />}

                {
                    isPayIncentivesOpen && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in zoom-in-95 duration-200">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative overflow-visible">
                                {/* Decoración recortada sólo al fondo */}
                                <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8"></div>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-6 relative z-10">Transferir a Incentivos</h3>

                                <div className="space-y-4 relative z-10">
                                    <div className="space-y-1">
                                        <FilterSelect
                                            options={[{ value: '', label: 'Seleccionar...' }, ...myEmployees.filter(e => e.active && e.hoursDebt > 0).map(e => ({ value: e.id, label: `${e.name} (${e.hoursDebt}h)` }))]}
                                            value={payIncentivesData.employeeId}
                                            onChange={val => setPayIncentivesData({ ...payIncentivesData, employeeId: val })}
                                            placeholder="Empleado"
                                            icon={Users}
                                            theme="light"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest pl-1">Cantidad</label>
                                        <input
                                            type="number"
                                            value={payIncentivesData.amount}
                                            onChange={e => setPayIncentivesData({ ...payIncentivesData, amount: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <FilterSelect
                                            options={[{ value: '', label: 'Seleccionar...' }, ...getOpenIncentiveMonths()]}
                                            value={payIncentivesData.targetMonth}
                                            onChange={val => setPayIncentivesData({ ...payIncentivesData, targetMonth: val })}
                                            placeholder="Mes Destino"
                                            icon={Calendar}
                                            theme="light"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button onClick={() => setIsPayIncentivesOpen(false)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                                        <button onClick={handlePayIncentives} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all">Confirmar</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    isWeeklyScheduleOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-5xl p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-bl-full -mr-20 -mt-20 opacity-50"></div>
                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                            <LayoutList className="text-indigo-500" size={28} /> Horario de la Semana
                                        </h2>
                                        <p className="text-slate-500 text-sm font-medium">Del {new Date(currentWeekStart).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })} al {(() => {
                                            const d = new Date(currentWeekStart);
                                            d.setDate(d.getDate() + 6);
                                            return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                                        })()}</p>
                                    </div>
                                    <button onClick={() => setIsWeeklyScheduleOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors bg-slate-50 border border-slate-200 text-slate-600">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar relative z-10">
                                    <div className="bg-slate-50 border border-slate-100 rounded-[2rem] overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100/50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                    <th className="p-4 sticky left-0 bg-slate-100 z-20">Empleado</th>
                                                    {['Lunes', 'Martes', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                                                        <th key={d} className="p-4 text-center">{d}</th>
                                                    ))}
                                                    <th className="p-4 text-center whitespace-nowrap">H. Contr.</th>
                                                    <th className="p-4 text-center whitespace-nowrap">H. Trab.</th>
                                                    <th className="p-4 text-right">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {weeklyDetailedTable.map(row => {
                                                    const diff = row.worked - row.contracted;
                                                    return (
                                                        <tr key={row.id} className="hover:bg-white transition-colors">
                                                            <td className="p-4 font-bold text-slate-700 text-sm sticky left-0 bg-white/80 backdrop-blur-sm z-10">
                                                                {row.name}
                                                            </td>
                                                            {row.shifts.map((s, idx) => (
                                                                <td key={idx} className="p-4 text-center">
                                                                    <span className={clsx(
                                                                        "text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider",
                                                                        s === 'Mañana' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                                                            s === 'Tarde' ? "bg-orange-50 text-orange-600 border border-orange-100" :
                                                                                s === 'M/T' ? "bg-purple-50 text-purple-600 border border-purple-100" :
                                                                                    s === 'Libre' ? "bg-slate-50 text-slate-400" :
                                                                                        s === 'Vacaciones' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                                                            s === 'Baja Médica' ? "bg-rose-50 text-rose-600 border border-rose-100" :
                                                                                                "text-slate-300"
                                                                    )}>
                                                                        {s === 'Mañana' ? 'Mañ' : s === 'Tarde' ? 'Tar' : s === 'Libre' ? 'Lib' : s === 'Vacaciones' ? 'Vac' : s === 'Baja Médica' ? 'IT' : s}
                                                                    </span>
                                                                </td>
                                                            ))}
                                                            <td className="p-4 text-center font-bold text-slate-400 text-sm">{row.contracted}h</td>
                                                            <td className="p-4 text-center font-black text-indigo-600 text-sm">{row.worked}h</td>
                                                            <td className="p-4 text-right">
                                                                <span className={clsx(
                                                                    "px-2 py-1 rounded-lg text-[10px] font-black",
                                                                    diff === 0 ? "bg-emerald-100 text-emerald-700" :
                                                                        diff > 0 ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
                                                                )}>
                                                                    {diff === 0 ? 'OK' : diff > 0 ? `+${diff}h` : `${diff}h`}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                                    <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Total Horas Tienda</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-indigo-600">{weeklyDetailedTable.reduce((acc, r) => acc + r.worked, 0)}h</span>
                                            <span className="text-sm font-bold text-indigo-400">esta semana</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Diferencia Plantilla</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className={clsx(
                                                "text-3xl font-black",
                                                weeklyDetailedTable.reduce((acc, r) => acc + (r.worked - r.contracted), 0) >= 0 ? "text-emerald-600" : "text-amber-600"
                                            )}>
                                                {weeklyDetailedTable.reduce((acc, r) => acc + (r.worked - r.contracted), 0) > 0 ? '+' : ''}
                                                {weeklyDetailedTable.reduce((acc, r) => acc + (r.worked - r.contracted), 0)}h
                                            </span>
                                            <span className="text-sm font-bold text-slate-400">vs contrato</span>
                                        </div>
                                    </div>
                                    <div className="bg-violet-50/50 p-6 rounded-[2rem] border border-violet-100">
                                        <p className="text-[10px] font-black uppercase text-violet-400 mb-1">Cobertura Media</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-violet-600">
                                                {Math.round((weeklyDetailedTable.reduce((acc, r) => acc + r.worked, 0) / (weeklyDetailedTable.reduce((acc, r) => acc + r.contracted, 0) || 1)) * 100)}%
                                            </span>
                                            <span className="text-sm font-bold text-violet-400">de objetivo</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    isHoursSummaryOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-bl-full -mr-20 -mt-20 opacity-50"></div>
                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                            <Clock className="text-blue-500" size={28} /> Resumen de Horas
                                        </h2>
                                        <p className="text-slate-500 text-sm font-medium">Contraste entre horas contratadas y trabajadas.</p>
                                    </div>
                                    <button onClick={() => setIsHoursSummaryOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors bg-slate-50 border border-slate-200 text-slate-600">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar relative z-10 space-y-8">
                                    <section>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Desglose por Semanas (Último Mes)</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-100/50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                        <th className="p-4">Semana</th>
                                                        <th className="p-4 text-center">Contratadas</th>
                                                        <th className="p-4 text-center">Trabajadas</th>
                                                        <th className="p-4 text-center">Diferencia</th>
                                                        <th className="p-4 text-right">Cobertura</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {weeklyStats.map(w => (
                                                        <tr key={w.label} className="hover:bg-white transition-colors">
                                                            <td className="p-4 font-bold text-slate-700 text-sm">
                                                                {w.label.includes('-') ? w.label.split('-').reverse().join('/') : w.label}
                                                            </td>
                                                            <td className="p-4 text-center font-bold text-slate-500 text-sm">{w.contracted.toFixed(0)}h</td>
                                                            <td className="p-4 text-center font-black text-indigo-600 text-sm">{w.worked.toFixed(0)}h</td>
                                                            <td className={clsx("p-4 text-center font-bold text-sm", (w.worked - w.contracted) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                                {(w.worked - w.contracted) > 0 ? '+' : ''}{(w.worked - w.contracted).toFixed(0)}h
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <span className={clsx("px-2 py-1 rounded-lg text-[10px] font-black", w.coverage >= 95 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                                                    {w.coverage.toFixed(0)}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Resumen Mensual (Histórico)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {monthlyStatsData.map(m => (
                                                <div key={m.label} className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
                                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-3">
                                                        {new Date(m.label + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                                    </p>
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-2xl font-black text-slate-800">{m.worked.toFixed(0)}h</p>
                                                            <p className="text-[10px] font-bold text-slate-400">Total Trabajadas</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-black text-blue-500">{m.coverage.toFixed(1)}%</p>
                                                            <p className="text-[9px] font-bold text-slate-400">Cobertura</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    isPersonnelHistoryOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-bl-full -mr-20 -mt-20 opacity-50"></div>
                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setShowPersonnelLogs(false)}
                                            className={clsx(
                                                "pb-2 text-xl font-black uppercase tracking-tight transition-all",
                                                !showPersonnelLogs ? "text-slate-900 border-b-4 border-emerald-500" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            Horas Contratadas
                                        </button>
                                        <button
                                            onClick={() => setShowPersonnelLogs(true)}
                                            className={clsx(
                                                "pb-2 text-xl font-black uppercase tracking-tight transition-all",
                                                showPersonnelLogs ? "text-slate-900 border-b-4 border-emerald-500" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            Altas / Bajas
                                        </button>
                                    </div>
                                    <button onClick={() => setIsPersonnelHistoryOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors bg-slate-50 border border-slate-200 text-slate-600">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar relative z-10">
                                    {!showPersonnelLogs ? (
                                        <div className="space-y-8">
                                            <section>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Histórico Mensual (Estimado)</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    {[...Array(6)].map((_, i) => {
                                                        const d = new Date();
                                                        d.setMonth(d.getMonth() - i);
                                                        const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                                                        // Simplified: Using current total for the demo, but logic would check seniority/contractEnd
                                                        const totalH = myEmployees.filter(e => {
                                                            const hireDate = e.seniorityDate ? new Date(e.seniorityDate) : new Date(0);
                                                            hireDate.setHours(0, 0, 0, 0);
                                                            const refDate = new Date(d);
                                                            refDate.setHours(23, 59, 59, 999);
                                                            return hireDate <= refDate;
                                                        }).reduce((acc, e) => acc + e.weeklyHours, 0) * 4.33;

                                                        return (
                                                            <div key={label} className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
                                                                <p className="text-[10px] font-black uppercase text-slate-400 mb-3">{label}</p>
                                                                <p className="text-2xl font-black text-slate-800">{totalH.toFixed(0)}h</p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Horas Contratadas</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </section>

                                            <section>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Histórico Anual</h4>
                                                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] overflow-hidden">
                                                    <table className="w-full text-left">
                                                        <thead className="bg-slate-100/50 text-[10px] font-black uppercase text-slate-500">
                                                            <tr>
                                                                <th className="p-4">Año</th>
                                                                <th className="p-4 text-center">Media Plantilla</th>
                                                                <th className="p-4 text-right">Horas / Año</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {[2026, 2025, 2024].map(year => (
                                                                <tr key={year} className="hover:bg-white transition-colors">
                                                                    <td className="p-4 font-black text-slate-700">{year}</td>
                                                                    <td className="p-4 text-center font-bold text-slate-500">{myEmployees.length} empleados</td>
                                                                    <td className="p-4 text-right font-black text-emerald-600">
                                                                        {(totalContractedHours * 52).toFixed(0)}h
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </section>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 pr-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">Registro de Altas y Bajas</h4>
                                            {employeeLogs
                                                .filter(l => (l.type === 'hire' || l.type === 'termination') && l.establishmentId === user.establishmentId)
                                                .map(log => (
                                                    <div key={log.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between hover:border-emerald-200 transition-colors">
                                                        <div className="flex items-center gap-4">
                                                            <div className={clsx(
                                                                "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm",
                                                                log.type === 'hire' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                                            )}>
                                                                {log.type === 'hire' ? <UserCheck size={20} /> : <UserX size={20} />}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900">{log.details}</p>
                                                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{new Date(log.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                            </div>
                                                        </div>
                                                        <div className={clsx(
                                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                            log.type === 'hire' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                                        )}>
                                                            {log.type === 'hire' ? 'Alta' : 'Baja'}
                                                        </div>
                                                    </div>
                                                ))}
                                            {employeeLogs.filter(l => (l.type === 'hire' || l.type === 'termination') && l.establishmentId === user.establishmentId).length === 0 && (
                                                <div className="text-center py-12">
                                                    <Activity className="mx-auto text-slate-200 mb-3" size={48} />
                                                    <p className="text-slate-400 font-bold">No hay registros de movimientos de personal.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    isCoverageSummaryOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-50 rounded-bl-full -mr-20 -mt-20 opacity-50"></div>
                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                            <Zap className="text-violet-500" size={28} /> Resumen de Cobertura
                                        </h2>
                                        <p className="text-slate-500 text-sm font-medium">Cumplimiento de horas contratadas por periodo.</p>
                                    </div>
                                    <button onClick={() => setIsCoverageSummaryOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors bg-slate-50 border border-slate-200 text-slate-600">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar relative z-10 space-y-8">
                                    <section>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Cobertura por Meses</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                            {monthlyStatsData.map(m => (
                                                <div key={m.label} className="bg-slate-50 border border-slate-100 p-6 rounded-[2.5rem] relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 h-1.5 w-full bg-slate-200">
                                                        <div style={{ width: `${Math.min(m.coverage, 100)}%` }} className={clsx("h-full transition-all duration-1000", m.coverage >= 98 ? "bg-emerald-500" : m.coverage >= 90 ? "bg-violet-500" : "bg-amber-500")}></div>
                                                    </div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2 mt-2">{new Date(m.label + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                                                    <p className="text-3xl font-black text-slate-800 mb-1">{m.coverage.toFixed(1)}%</p>
                                                    <p className="text-[10px] font-bold text-slate-400">Target: {m.contracted.toFixed(0)}h</p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Histórico Anual</h4>
                                        <div className="space-y-3">
                                            {yearlyStatsData.map(y => (
                                                <div key={y.label} className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center justify-between hover:shadow-md transition-shadow">
                                                    <div className="flex items-center gap-6">
                                                        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                                                            {y.label}
                                                        </div>
                                                        <div>
                                                            <p className="text-lg font-black text-slate-800">{y.coverage.toFixed(1)}% Cobertura Media</p>
                                                            <p className="text-xs font-bold text-slate-400">Total Horas: {y.worked.toFixed(0)}h (Contratadas: {y.contracted.toFixed(0)}h)</p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="text-slate-300" />
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Microloans Detail Modal */}
                {
                    isMicroloansModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/80 animate-in fade-in duration-300">
                            <div className="bg-white w-full max-w-4xl rounded-[2.5rem] border border-slate-100 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                                {/* Header */}
                                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                            <Coins size={28} className="text-indigo-500" /> Captación de Clientes
                                        </h3>
                                        <p className="text-slate-500 font-medium text-sm mt-1">Informe detallado de actividad comercial.</p>
                                    </div>
                                    <button onClick={() => setIsMicroloansModalOpen(false)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-800 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Filters */}
                                <div className="p-6 bg-slate-50 flex gap-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                                        <Calendar size={16} className="ml-3 text-slate-400" />
                                        <select
                                            value={microloansFilterYear}
                                            onChange={(e) => setMicroloansFilterYear(Number(e.target.value))}
                                            className="bg-transparent border-none text-slate-700 font-bold text-sm pr-8 focus:ring-0 cursor-pointer outline-none"
                                        >
                                            {[2024, 2025, 2026].map(y => <option key={y} value={y} className="bg-white text-slate-900">{y}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-8 overflow-y-auto custom-scrollbar">
                                    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <tr>
                                                    <th className="p-5">Mes</th>
                                                    <th className="p-5 text-right w-full">Captaciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {microloansModalData.map((row, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="p-5 font-bold text-slate-700 capitalize flex items-center gap-3">
                                                            <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 text-xs font-black group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                                                {(i + 1).toString().padStart(2, '0')}
                                                            </span>
                                                            {row.label}
                                                        </td>
                                                        <td className="p-5 text-right">
                                                            <span className={clsx("text-lg font-black", row.total > 0 ? "text-white" : "text-slate-600")}>
                                                                {row.total}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-sky-500/10">
                                                    <td className="p-5 font-black text-sky-400 uppercase tracking-wider text-xs">Total Anual</td>
                                                    <td className="p-5 text-right font-black text-2xl text-sky-400">
                                                        {microloansModalData.reduce((a, b) => a + b.total, 0)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }



                <ILTReportModal
                    isOpen={isILTModalOpen}
                    onClose={() => setIsILTModalOpen(false)}
                    initialTab={iltModalTab}
                />
            </div >
        </div >
    );
};

export default DashboardPage;
