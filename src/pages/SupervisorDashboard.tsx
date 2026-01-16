import React from 'react';
import { useStore } from '../context/StoreContext';
import { formatLocalDate, parseLocalDate } from '../services/dateUtils';
import clsx from 'clsx';
import {
    Users, Activity, TrendingUp, Building2,
    ChevronRight, FileText, Store, X, ChevronLeft, ArrowLeft,
    CalendarDays, Info, Printer, CheckSquare, ArrowUpRight,
    Bell, AlertTriangle, Coins
} from 'lucide-react';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';

const SupervisorDashboard: React.FC = () => {
    const { schedules, employees, settings, timeOffRequests, tasks, notifications, removeNotification, incentiveReports } = useStore();
    const [selectedStore, setSelectedStore] = React.useState<any>(null);
    const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);

    // Task Summary Modal State
    const [isTaskSummaryModalOpen, setIsTaskSummaryModalOpen] = React.useState(false);

    // Microloans Modal State
    const [isMicroloansModalOpen, setIsMicroloansModalOpen] = React.useState(false);
    const [microloansFilterStore, setMicroloansFilterStore] = React.useState('all');
    const [microloansFilterYear, setMicroloansFilterYear] = React.useState(new Date().getFullYear());
    const [dashboardView, setDashboardView] = React.useState<'dashboard' | 'report'>('dashboard');
    const [reportYear, setReportYear] = React.useState(new Date().getFullYear());
    const [reportStoreId, setReportStoreId] = React.useState<string>('all');

    const getMonday = (d: Date) => {
        const monday = new Date(d);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        return formatLocalDate(monday);
    };

    const todayMonday = getMonday(new Date());
    const [selectedWeek, setSelectedWeek] = React.useState(todayMonday);

    const handlePrevWeek = () => {
        const d = parseLocalDate(selectedWeek);
        d.setDate(d.getDate() - 7);
        setSelectedWeek(formatLocalDate(d));
    };

    const handleNextWeek = () => {
        const d = parseLocalDate(selectedWeek);
        d.setDate(d.getDate() + 7);
        setSelectedWeek(formatLocalDate(d));
    };

    const goToCurrentWeek = () => setSelectedWeek(todayMonday);

    const getShiftHours = (shift: any, storeId: string) => {
        if (!shift || ['off', 'vacation', 'sick_leave', 'maternity_paternity', 'holiday'].includes(shift.type)) return 0;

        const storeSettings = settings.find(s => s.establishmentId === storeId);
        const oh = storeSettings?.openingHours;

        const parseTime = (t: string | undefined, fallback: string) => {
            const timeStr = (t && t.includes(':')) ? t : fallback;
            const [h, m] = timeStr.split(':').map(Number);
            if (isNaN(h) || isNaN(m)) return 0;
            return h + m / 60;
        };

        if (shift.type === 'split') {
            const start = parseTime(shift.startTime, oh?.morningStart || '10:00');
            const mEnd = parseTime(shift.morningEndTime, oh?.morningEnd || '14:00');
            const aStart = parseTime(shift.afternoonStartTime, oh?.afternoonStart || '16:30');
            const end = parseTime(shift.endTime, oh?.afternoonEnd || '20:30');
            return Math.max(0, mEnd - start) + Math.max(0, end - aStart);
        }

        const fallbackStart = shift.type === 'morning' ? (oh?.morningStart || '10:00') : (oh?.afternoonStart || '16:30');
        const fallbackEnd = shift.type === 'morning' ? (oh?.morningEnd || '14:00') : (oh?.afternoonEnd || '20:30');

        const start = parseTime(shift.startTime, fallbackStart);
        const end = parseTime(shift.endTime, fallbackEnd);
        return Math.max(0, end - start);
    };

    // 1. Global Metrics
    const now = new Date();
    const nowStr = formatLocalDate(now);

    const activeEmployeesCount = employees.filter(e => {
        if (!e.active) return false;
        if (!e.history || e.history.length === 0) return true;

        const sortedHistory = [...e.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const entriesBefore = sortedHistory.filter(h => h.date.substring(0, 10) <= nowStr);
        let isActive = false;

        if (entriesBefore.length > 0) {
            const lastEntry = entriesBefore[entriesBefore.length - 1];
            isActive = (lastEntry.type === 'hired' || lastEntry.type === 'rehired');
        } else {
            const firstEvent = sortedHistory[0];
            isActive = firstEvent?.type === 'terminated';
        }
        return isActive;
    }).length;
    const totalGlobalDebt = employees.reduce((acc, e) => acc + (e.hoursDebt || 0), 0);

    // Global Vacation Programming %
    const currentYear = new Date().getFullYear();
    const activeEmps = employees.filter(e => e.active);
    let globalTotalVacationDays = 0;
    activeEmps.forEach(emp => {
        const empVacations = timeOffRequests.filter(r =>
            r.employeeId === emp.id &&
            r.type === 'vacation' &&
            r.status === 'approved' &&
            r.dates && Array.isArray(r.dates) &&
            r.dates.some(d => d.startsWith(currentYear.toString()))
        );
        const uniqueDates = new Set<string>();
        empVacations.forEach(r => {
            if (r.dates && Array.isArray(r.dates)) {
                r.dates.forEach(d => {
                    if (d.startsWith(currentYear.toString())) uniqueDates.add(d);
                });
            }
        });
        globalTotalVacationDays += uniqueDates.size;
    });
    const maxGlobalVacationDays = activeEmps.length * 31;
    const globalVacationPercent = maxGlobalVacationDays > 0 ? (globalTotalVacationDays / maxGlobalVacationDays) * 100 : 0;

    // Global Annual Absentismo (Sick Leave) %
    let globalYearlySickHours = 0;
    let globalYearlyContractedHours = 0;

    const allYearWeeks = schedules.filter(s => s.weekStartDate.startsWith(currentYear.toString()));

    allYearWeeks.forEach(s => {
        const weekEmps = employees.filter(e => e.active && e.establishmentId === s.establishmentId);
        weekEmps.forEach(emp => {
            let c = emp.weeklyHours;
            const adj = emp.tempHours?.find(t => s.weekStartDate >= t.start && s.weekStartDate <= t.end);
            if (adj) c += adj.hours;
            globalYearlyContractedHours += c;

            if (adj) c += adj.hours;
            globalYearlyContractedHours += c;

            const weekShifts = s.shifts.filter(sh => sh.employeeId === emp.id);
            const daysInWeek = weekShifts.filter(sh => sh.type === 'sick_leave' || sh.type === 'maternity_paternity').length;

            globalYearlySickHours += (emp.weeklyHours / 5) * Math.min(5, daysInWeek);
        });
    });
    const globalAbsentismoPercent = globalYearlyContractedHours > 0 ? (globalYearlySickHours / globalYearlyContractedHours) * 100 : 0;

    // 2. Data Aggregation by Store
    const storeIds = Array.from(new Set(employees.map(e => e.establishmentId)));

    const getStoreName = (id: string) => {
        const store = settings.find(s => s.establishmentId === id);
        if (store && store.storeName) return store.storeName;
        return DEFAULT_STORE_NAMES[id] || `Tienda ${id}`;
    };

    const storeStats = storeIds.map(id => {
        const storeEmps = employees.filter(e => {
            if (e.establishmentId !== id) return false;
            // Only active employees for current stats? Or also inactive? 
            // The original code filtered active. Keeping it consistent.
            if (!e.active) return false;
            if (!e.history || e.history.length === 0) return true;
            const sortedHistory = [...e.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const entriesBefore = sortedHistory.filter(h => h.date.substring(0, 10) <= nowStr);
            let isActive = false;
            if (entriesBefore.length > 0) {
                const lastEntry = entriesBefore[entriesBefore.length - 1];
                isActive = (lastEntry.type === 'hired' || lastEntry.type === 'rehired');
            } else {
                const firstEvent = sortedHistory[0];
                isActive = firstEvent?.type === 'terminated';
            }
            return isActive;
        });
        const storeSchedules = schedules.filter(s => s.establishmentId === id);
        const currentScheduleValue = storeSchedules.find(s => s.weekStartDate === selectedWeek);
        const weekDates = Array.from({ length: 7 }, (_, i) => {
            const d = parseLocalDate(selectedWeek);
            d.setDate(d.getDate() + i);
            return formatLocalDate(d);
        });

        const debt = storeEmps.reduce((acc, e) => acc + (e.hoursDebt || 0), 0);
        const pending = storeSchedules.filter(s => s.approvalStatus === 'pending').length;
        const approvedCount = storeSchedules.filter(s => s.approvalStatus === 'approved').length;

        let weeklyContractedTotal = 0;
        const empDetails = storeEmps.map(emp => {
            let contracted = emp.weeklyHours;
            const adj = emp.tempHours?.find(t => selectedWeek >= t.start && selectedWeek <= t.end);
            if (adj) contracted += adj.hours;
            const shifts = currentScheduleValue?.shifts.filter(s => s.employeeId === emp.id) || [];
            const worked = shifts.reduce((acc, s) => acc + getShiftHours(s, id), 0);

            // Check ON LEAVE status based on SHIFTS if available, otherwise fallback to requests (for future/draft)
            // Actually, if we are looking at current week, shifts are authoritative if schedule exists.
            const isOnLeave = shifts.some(s => s.type === 'sick_leave' || s.type === 'maternity_paternity');

            weeklyContractedTotal += contracted;
            return {
                id: emp.id, name: emp.name, baseHours: emp.weeklyHours, extension: adj?.hours || 0,
                contracted, worked, isOnLeave, category: emp.category
            };
        });

        const plannedHours = currentScheduleValue ? currentScheduleValue.shifts.reduce((acc, s) => acc + getShiftHours(s, id), 0) : 0;
        const coveragePercent = weeklyContractedTotal > 0 ? (plannedHours / weeklyContractedTotal) * 100 : 0;

        let leaveHoursSum = 0;
        let vacationHoursSum = 0;

        storeEmps.forEach(emp => {
            // Use SHIFTS from current schedule if exists
            if (currentScheduleValue) {
                const shifts = currentScheduleValue.shifts.filter(s => s.employeeId === emp.id);
                const sickDays = shifts.filter(s => s.type === 'sick_leave' || s.type === 'maternity_paternity').length;
                const vacationDays = shifts.filter(s => s.type === 'vacation').length;

                leaveHoursSum += (emp.weeklyHours / 5) * Math.min(5, sickDays);
                vacationHoursSum += (emp.weeklyHours / 5) * Math.min(5, vacationDays);
            } else {
                // Fallback to requests if no schedule generated yet? 
                // Keeping it simple: if no schedule, 0 hours.
            }
        });

        const leaveHoursPercent = weeklyContractedTotal > 0 ? (leaveHoursSum / weeklyContractedTotal) * 100 : 0;
        const weekStatus = !currentScheduleValue ? 'no_generated' : currentScheduleValue.status === 'published' ? (currentScheduleValue.approvalStatus || 'pending') : 'draft';

        let totalYearlyVacationDays = 0;
        storeEmps.forEach(emp => {
            // For Vacation Programming %, we still look at Requests because it's about "Programmed" (future) too.
            const empVacations = timeOffRequests.filter(r =>
                r.employeeId === emp.id && r.type === 'vacation' && r.status === 'approved' &&
                r.dates && Array.isArray(r.dates) && r.dates.some(d => d.startsWith(currentYear.toString()))
            );
            const uniqueDates = new Set<string>();
            empVacations.forEach(r => {
                if (r.dates) r.dates.forEach(d => { if (d.startsWith(currentYear.toString())) uniqueDates.add(d); });
            });
            totalYearlyVacationDays += uniqueDates.size;
        });
        const maxPossibleVacationDays = storeEmps.length * 31;
        const vacationProgrammingPercent = maxPossibleVacationDays > 0 ? (totalYearlyVacationDays / maxPossibleVacationDays) * 100 : 0;

        let storeYearlySickHours = 0;
        let storeYearlyContractedHours = 0;
        const storeYearWeeks = schedules.filter(s => s.establishmentId === id && s.weekStartDate.startsWith(currentYear.toString()));
        storeYearWeeks.forEach(s => {
            storeEmps.forEach(emp => {
                let c = emp.weeklyHours;
                const adj = emp.tempHours?.find(t => s.weekStartDate >= t.start && s.weekStartDate <= t.end);
                if (adj) c += adj.hours;
                storeYearlyContractedHours += c;

                const weekShifts = s.shifts.filter(sh => sh.employeeId === emp.id);
                const daysInWeek = weekShifts.filter(sh => sh.type === 'sick_leave' || sh.type === 'maternity_paternity').length;

                storeYearlySickHours += (emp.weeklyHours / 5) * Math.min(5, daysInWeek);
            });
        });
        const storeAbsentismoPercent = storeYearlyContractedHours > 0 ? (storeYearlySickHours / storeYearlyContractedHours) * 100 : 0;
        const bajasCount = empDetails.filter(e => e.isOnLeave).length;

        return {
            id, name: getStoreName(id), employeeCount: storeEmps.length, debt, pending, approved: approvedCount,
            coveragePercent, plannedHours, leaveHoursPercent, empDetails, weekStatus, weekDates,
            vacationProgrammingPercent, storeAbsentismoPercent, bajasCount, contractedWeeklyTotal: weeklyContractedTotal
        };
    });

    // 3. Annual Report Aggregation Logic
    const getAnnualData = (year: number, filterStoreId: string) => {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return monthNames.map((name, monthIdx) => {
            const monthWeeks = schedules.filter(s => {
                const d = parseLocalDate(s.weekStartDate);
                return d.getFullYear() === year && d.getMonth() === monthIdx && (filterStoreId === 'all' || s.establishmentId === filterStoreId) && s.status === 'published';
            });
            let totalWorked = 0, totalContracted = 0, totalVacation = 0, totalSick = 0, coverageSum = 0, weeksWithData = 0;
            const relevantEmps = employees.filter(e => e.active && (filterStoreId === 'all' || e.establishmentId === filterStoreId));

            monthWeeks.forEach(s => {
                const worked = s.shifts.reduce((acc, shift) => acc + getShiftHours(shift, s.establishmentId), 0);

                let weekContracted = 0;
                relevantEmps.filter(e => e.establishmentId === s.establishmentId).forEach(e => {
                    let c = e.weeklyHours;
                    const adj = e.tempHours?.find(t => s.weekStartDate >= t.start && s.weekStartDate <= t.end);
                    if (adj) c += adj.hours;
                    weekContracted += c;

                    // Calculate Week Sick/Vacation using SHIFTS
                    const empShifts = s.shifts.filter(sh => sh.employeeId === e.id);
                    const sickDays = empShifts.filter(sh => sh.type === 'sick_leave' || sh.type === 'maternity_paternity').length;
                    const vacationDays = empShifts.filter(sh => sh.type === 'vacation').length;

                    if (sickDays > 0) totalSick += (e.weeklyHours / 5) * Math.min(5, sickDays);
                    if (vacationDays > 0) totalVacation += (e.weeklyHours / 5) * Math.min(5, vacationDays);
                });

                totalWorked += worked;
                totalContracted += weekContracted;
                if (weekContracted > 0) { coverageSum += (worked / weekContracted) * 100; weeksWithData++; }
            });

            return { name, worked: totalWorked, contracted: totalContracted, sick: totalSick, vacation: totalVacation, coverage: weeksWithData > 0 ? coverageSum / weeksWithData : 0 };
        });
    };

    const currentYearNum = new Date().getFullYear();
    const dynamicYears = [currentYearNum - 1, currentYearNum, currentYearNum + 1];

    const getAnnualEmployeeData = (year: number, filterStoreId: string) => {
        const relevantEmps = employees.filter(e => (filterStoreId === 'all' || e.establishmentId === filterStoreId) && e.active);
        const yearSchedules = schedules.filter(s => s.weekStartDate.startsWith(year.toString()) && s.status === 'published');
        return relevantEmps.map(emp => {
            let totalWorked = 0, totalSick = 0, totalContracted = 0;
            yearSchedules.forEach(s => {
                const empShifts = s.shifts.filter(sh => sh.employeeId === emp.id);
                totalWorked += empShifts.reduce((acc, sh) => acc + getShiftHours(sh, s.establishmentId), 0);
                if (emp.establishmentId === s.establishmentId) {
                    let c = emp.weeklyHours;
                    const adj = emp.tempHours?.find(t => s.weekStartDate >= t.start && s.weekStartDate <= t.end);
                    if (adj) c += adj.hours;
                    totalContracted += c;

                    // Calculate Week Sick using SHIFTS
                    const days = empShifts.filter(sh => sh.type === 'sick_leave' || sh.type === 'maternity_paternity').length;
                    if (days > 0) totalSick += (emp.weeklyHours / 5) * Math.min(5, days);
                }
            });
            return { id: emp.id, name: emp.name, category: emp.category, worked: totalWorked, sick: totalSick, contracted: totalContracted };
        }).sort((a, b) => b.worked - a.worked);
    };

    const annualData = getAnnualData(reportYear, reportStoreId);
    const annualEmployeeData = getAnnualEmployeeData(reportYear, reportStoreId);
    const totals = annualData.reduce((acc, m) => ({
        worked: acc.worked + m.worked, contracted: acc.contracted + m.contracted,
        sick: acc.sick + m.sick, vacation: acc.vacation + m.vacation, avgCoverage: acc.avgCoverage + m.coverage
    }), { worked: 0, contracted: 0, sick: 0, vacation: 0, avgCoverage: 0 });


    // Task Stats
    const activeTasks = tasks.filter(t => !t.isArchived);
    const totalAssignments = activeTasks.reduce((acc, t) => acc + (t.targetStores === 'all' ? settings.length : t.targetStores.length), 0);
    const completedAssignments = activeTasks.reduce((acc, t) => {
        const targetIds = t.targetStores === 'all' ? settings.map(s => s.establishmentId) : t.targetStores;
        const completed = targetIds.filter(sid => t.status[sid]?.status === 'completed').length;
        return acc + completed;
    }, 0);
    const taskCompletionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

    const urgentTasksCount = activeTasks.filter(t => {
        let dueDate: Date | null = null;
        if (t.type === 'specific_date' && t.date) dueDate = new Date(t.date);

        if (dueDate) {
            const now = new Date();
            const timeDiff = dueDate.getTime() - now.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
            return daysLeft <= 1 && daysLeft >= -1;
        }
        return false;
    }).length;

    // Microloans / Captación Logic
    const prevMonthDate = new Date();
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const yearMonthLabel = prevMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    // 1. Store Totals for Previous Month
    const microloansStoreStats = storeIds.map(id => {
        const report = incentiveReports.find(r => r.establishmentId === id && r.month === prevMonthStr);
        const total = (report?.items || []).reduce((acc, item) => acc + (item.micros_aptacion_qty || 0), 0);
        return { id, name: getStoreName(id), total, hasReport: !!report };
    }).sort((a, b) => b.total - a.total);

    const totalMicroloansGlobal = microloansStoreStats.reduce((acc, s) => acc + s.total, 0);

    // 2. Global Employee Ranking for Previous Month
    const microloansGlobalRanking = (() => {
        const allItems: { name: string; count: number; storeName: string; category: string }[] = [];
        storeIds.forEach(id => {
            const report = incentiveReports.find(r => r.establishmentId === id && r.month === prevMonthStr);
            if (report) {
                report.items.forEach(item => {
                    if ((item.micros_aptacion_qty || 0) > 0) {
                        allItems.push({
                            name: item.employeeName,
                            count: item.micros_aptacion_qty || 0,
                            storeName: getStoreName(id),
                            category: employees.find(e => e.id === item.employeeId)?.category || 'Empleado'
                        });
                    }
                });
            }
        });
        return allItems.sort((a, b) => b.count - a.count).slice(0, 10); // Top 10
        return allItems.sort((a, b) => b.count - a.count).slice(0, 10); // Top 10
    })();

    // 3. Monthly Global Evolution (Last 6 Months)
    const microloansMonthlyEvolution = React.useMemo(() => {
        return Array.from({ length: 6 }).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i - 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            // Sum of all reports for this month across all stores
            const total = incentiveReports
                .filter(r => r.month === mStr)
                .reduce((acc, r) => acc + (r.items || []).reduce((sum, item) => sum + (item.micros_aptacion_qty || 0), 0), 0);

            return {
                month: d.toLocaleDateString('es-ES', { month: 'long' }),
                total,
                mStr
            };
        }).reverse();
    }, [incentiveReports]);

    // 4. Modal Data Calculation
    const microloansModalData = React.useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => i);
        return months.map(monthIndex => {
            const d = new Date(microloansFilterYear, monthIndex, 1);
            const mStr = `${microloansFilterYear}-${String(monthIndex + 1).padStart(2, '0')}`;

            // Filter reports
            const reports = incentiveReports.filter(r =>
                r.month === mStr &&
                (microloansFilterStore === 'all' || r.establishmentId === microloansFilterStore)
            );

            const total = reports.reduce((acc, r) => acc + (r.items || []).reduce((sum, item) => sum + (item.micros_aptacion_qty || 0), 0), 0);

            return {
                label: d.toLocaleDateString('es-ES', { month: 'long' }),
                total
            };
        });
    }, [incentiveReports, microloansFilterStore, microloansFilterYear]);

    const MetricCard: React.FC<{ title: string; value: string | number; icon: any; color: string; bg: string; label: string; children?: React.ReactNode }> = ({ title, value, icon: Icon, color, bg, label, children }) => (
        <div className={clsx("relative p-6 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-[160px] flex flex-col justify-between metric-card-content", bg)}>
            <div className={clsx("absolute top-0 right-0 p-4 opacity-10", color)}><Icon size={60} strokeWidth={1} /></div>
            <div className="relative z-10 flex-grow">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
                <h3 className={clsx("text-4xl font-black", color)}>{value}</h3>
                {children}
            </div>
            <div className="relative z-10 pt-4"><p className="text-xs text-slate-500">{label}</p></div>
        </div>
    );

    if (dashboardView === 'report') {
        return (
            <div id="print-report-container" className="min-h-screen text-slate-100 font-sans pb-20 animate-in fade-in duration-500 print:bg-white print:text-black print:p-0">
                <style>{`
                    @media print {
                        @page { size: A4 portrait; margin: 10mm; } 
                        
                        /* 1. Hide Layout Elements globally */
                        aside, header, .no-print { display: none !important; }
                        
                        /* 2. Reset Root Layout Structure */
                        body, #root, html {
                            width: 100% !important;
                            height: auto !important;
                            overflow: visible !important;
                            background: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }

                        /* 3. Reset Flex Containers (The Layout div and Main wrapper) */
                        div[class*="flex"], main {
                            display: block !important;
                            width: 100% !important;
                            height: auto !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow: visible !important;
                            position: static !important;
                            flex: none !important;
                        }

                        /* 4. Hide everything by default using visibility to preserve hierarchy */
                        body * {
                            visibility: hidden;
                        }

                        #print-report-container, #print-report-container * {
                            visibility: visible;
                        }
                        
                        /* 5. Position the report */
                        #print-report-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background-color: white !important;
                            color: black !important;
                            font-size: 9pt;
                            z-index: 9999;
                        }

                        /* Grid for Metrics */
                        .print-metrics-grid {
                            display: grid !important;
                            grid-template-columns: repeat(4, 1fr) !important;
                            gap: 10px !important;
                            margin-bottom: 20px !important;
                            visibility: visible !important;
                        }

                        /* Metric Cards */
                        .metric-card-content {
                            border: 1px solid #ccc !important;
                            background: white !important;
                            padding: 8px !important;
                            box-shadow: none !important;
                            display: flex !important;
                            flex-direction: column !important;
                            justify-content: space-between !important;
                            overflow: hidden !important; 
                            min-height: 80px !important;
                        }
                        .metric-card-content p.text-sm { /* Title */
                            font-size: 8pt !important;
                            font-weight: bold !important;
                            color: #000 !important;
                            margin-bottom: 4px !important;
                            white-space: nowrap !important; 
                            overflow: visible !important; 
                        }
                        .metric-card-content h3 { 
                            font-size: 16pt !important; 
                            line-height: 1.2 !important;
                            color: black !important;
                            margin: 0 !important;
                        }
                        .metric-card-content p.text-xs { /* Label at bottom */
                            font-size: 7pt !important;
                            color: #444 !important;
                            margin-top: 4px !important;
                        }
                        .metric-card-content svg { display: none !important; } 

                        /* Tables */
                        .print-table-card {
                            border: none !important;
                            box-shadow: none !important;
                            padding: 0 !important;
                            margin-top: 20px !important;
                        }
                        table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                            font-size: 9pt !important;
                            table-layout: auto !important; 
                        }
                        th {
                            background-color: #f0f0f0 !important;
                            color: black !important;
                            padding: 6px 4px !important;
                            border-bottom: 2px solid #000 !important;
                            font-weight: bold !important;
                            font-size: 8pt !important;
                            white-space: nowrap !important; 
                            text-align: center !important;
                        }
                        th:first-child { text-align: left !important; }
                        
                        td {
                            border-bottom: 1px solid #ccc !important;
                            padding: 6px 4px !important;
                            color: black !important;
                            text-align: center !important;
                        }
                        td:first-child { 
                            text-align: left !important; 
                            white-space: nowrap !important;
                            font-weight: bold !important;
                        }

                        /* Header */
                        h1 { font-size: 22pt !important; margin: 0 0 10px 0 !important; color: black !important; }
                        h4 { 
                            font-size: 14pt !important; 
                            margin: 20px 0 10px 0 !important; 
                            color: black !important; 
                            border-bottom: 2px solid #000; 
                            padding-bottom: 5px;
                            display: flex; 
                            gap: 10px;
                        }
                        h4 svg { width: 20px !important; height: 20px !important; color: black !important; display: inline-block !important; }

                        /* Utils */
                        .text-emerald-400, .text-emerald-300 { color: #000 !important; }
                        .text-rose-400, .text-rose-300 { color: #000 !important; }
                        .bg-emerald-500\\/10, .bg-rose-500\\/10 { background: none !important; border: none !important; }
                        
                        .print-break-before { page-break-before: always !important; margin-top: 30px !important; }
                        tr { page-break-inside: avoid; }
                    }
                `}</style>
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6 no-print p-8">
                    <div>
                        <button onClick={() => setDashboardView('dashboard')} className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-[0.2em] mb-4 hover:text-indigo-300 group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Control
                        </button>
                        <h1 className="text-5xl font-black text-white tracking-tight">Informe Anual <span className="text-indigo-500">{reportYear}</span></h1>
                        <p className="text-slate-400 text-lg mt-2 font-medium">{reportStoreId === 'all' ? 'Consolidado Global' : `Análisis: ${getStoreName(reportStoreId)}`}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-[2rem] border border-slate-800 backdrop-blur-xl">
                            <Building2 size={18} className="ml-4 text-slate-500" />
                            <select value={reportStoreId} onChange={(e) => setReportStoreId(e.target.value)} className="bg-transparent border-none text-white font-black text-sm pr-10 focus:ring-0 cursor-pointer appearance-none outline-none">
                                <option value="all" className="bg-slate-900">Todos</option>
                                {storeIds.map(id => <option key={id} value={id} className="bg-slate-900">{getStoreName(id)}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800">
                            {dynamicYears.map(year => (
                                <button key={year} onClick={() => setReportYear(year)} className={clsx("px-4 py-2 rounded-xl font-black text-xs transition-all", reportYear === year ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300")}>{year}</button>
                            ))}
                        </div>
                        <button onClick={() => window.print()} className="px-6 py-3 bg-white text-slate-900 font-black rounded-2xl flex items-center gap-2 text-xs uppercase tracking-widest"><Printer size={16} /> PDF</button>
                    </div>
                </div>

                <div className="px-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print-metrics-grid">
                        <MetricCard title="Total Trabajado" value={`${totals.worked.toLocaleString()}h`} icon={Activity} color="text-indigo-400" bg="bg-indigo-500/10" label="Horas reales año" />
                        <MetricCard title="Total Contratado" value={`${totals.contracted.toLocaleString()}h`} icon={TrendingUp} color="text-emerald-400" bg="bg-emerald-500/10" label="Capacidad teórica" />
                        <MetricCard title="Vacaciones Gozadas" value={`${totals.vacation.toLocaleString()}h`} icon={CalendarDays} color="text-purple-400" bg="bg-purple-500/10" label="Días fuera de tienda" />
                        <MetricCard title="Absentismo IT" value={`${totals.sick.toLocaleString()}h`} icon={Activity} color="text-rose-400" bg="bg-rose-500/10" label="Impacto de bajas" />
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 shadow-2xl overflow-hidden print-table-card">
                        <h4 className="text-xl font-black text-white mb-8 flex items-center gap-3"><Info size={24} className="text-indigo-400" /> Desglose Mensual Detallado</h4>
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 text-center">
                                <tr><th className="py-6 px-8 text-left">Mes</th><th>Trabajado</th><th>Contratado</th><th>Vacaciones</th><th>Bajas IT</th><th className="text-right pr-8">Cobertura %</th></tr>
                            </thead>
                            <tbody className="text-sm">
                                {annualData.map((m, i) => (
                                    <tr key={i} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                                        <td className="py-6 px-8 font-black text-white">{m.name}</td>
                                        <td className="text-center font-bold text-slate-300">{m.worked.toLocaleString()}h</td>
                                        <td className="text-center font-bold text-slate-400">{m.contracted.toLocaleString()}h</td>
                                        <td className="text-center font-bold text-purple-400/80">{m.vacation.toLocaleString()}h</td>
                                        <td className="text-center font-bold text-rose-400/80">{m.sick.toLocaleString()}h</td>
                                        <td className="text-right pr-8"><span className={clsx("px-4 py-1 rounded-full font-black text-xs", m.coverage >= 95 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>{m.coverage.toFixed(1)}%</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 shadow-2xl overflow-hidden page-break-before print-break-before print-table-card">
                        <h4 className="text-xl font-black text-white mb-8 flex items-center gap-3"><Users size={24} className="text-indigo-400" /> Rendimiento Anual por Empleado</h4>
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 text-center">
                                <tr><th className="py-6 px-8 text-left">Empleado</th><th>Trabajado</th><th>Bajas IT</th><th>Contratado</th><th className="text-right pr-8">Eficiencia</th></tr>
                            </thead>
                            <tbody>
                                {annualEmployeeData.map((emp, i) => (
                                    <tr key={i} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                                        <td className="py-6 px-8">
                                            <span className="font-black text-white block">{emp.name}</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{emp.category}</span>
                                        </td>
                                        <td className="text-center font-bold text-slate-200">{emp.worked.toLocaleString()}h</td>
                                        <td className="text-center font-bold text-rose-400/80">{emp.sick.toLocaleString()}h</td>
                                        <td className="text-center font-bold text-slate-400">{emp.contracted.toLocaleString()}h</td>
                                        <td className="text-right pr-8"><span className={clsx("px-4 py-1 rounded-full font-black text-xs", (emp.worked / (emp.contracted || 1)) >= 0.9 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>{((emp.worked / (emp.contracted || 1)) * 100).toFixed(1)}%</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 pb-24 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 opacity-70">Hola, Supervisor 👋</p>
                    <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                        <Activity size={18} /> Global Command Center
                    </h2>
                    <h1 className="text-6xl font-black text-white tracking-tight leading-tight whitespace-nowrap">Monitorización <span className="text-slate-500 italic font-medium">Global</span></h1>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <button onClick={() => setDashboardView('report')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest border border-indigo-500/30">
                        <FileText size={16} /> Informe Anual
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            className={clsx("h-12 w-12 rounded-2xl flex items-center justify-center border transition-all shadow-lg backdrop-blur-md",
                                notifications.filter(n => n.establishmentId === 'admin').length > 0
                                    ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse hover:bg-rose-500/30"
                                    : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-indigo-400 hover:bg-slate-800"
                            )}
                        >
                            <Bell size={20} />
                            {notifications.filter(n => n.establishmentId === 'admin').length > 0 && (
                                <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-500 text-white flex items-center justify-center rounded-full text-[10px] font-black shadow-lg">
                                    {notifications.filter(n => n.establishmentId === 'admin').length}
                                </span>
                            )}
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute right-0 mt-4 w-[350px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-50 p-6 animate-in slide-in-from-top-4 fade-in duration-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Notificaciones Avisos</h3>
                                    <button onClick={() => setIsNotificationsOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500"><X size={16} /></button>
                                </div>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {notifications.filter(n => n.establishmentId === 'admin').length === 0 ? (
                                        <p className="text-slate-600 text-center py-8 text-xs font-bold uppercase tracking-widest leading-loose tabular-nums">Todo bajo control ✨</p>
                                    ) : (
                                        notifications.filter(n => n.establishmentId === 'admin').map(alert => (
                                            <div key={alert.id} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 flex gap-4 group/notif">
                                                <div className={clsx("p-2 rounded-xl h-fit",
                                                    alert.type === 'error' ? "bg-rose-500/20 text-rose-500" :
                                                        alert.type === 'warning' ? "bg-amber-500/20 text-amber-500" : "bg-indigo-500/20 text-indigo-500")}>
                                                    <AlertTriangle size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-slate-200 leading-snug mb-2">{alert.message}</p>
                                                    <button
                                                        onClick={() => removeNotification(alert.id)}
                                                        className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
                                                    >
                                                        Cerrar Aviso
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <MetricCard title="Vacaciones Programadas" value={`${globalVacationPercent.toFixed(1)}%`} icon={CalendarDays} color="text-emerald-400" bg="bg-emerald-500/10" label="Cumplimiento 31 días/año">
                    <div className="mt-4 space-y-1">
                        {storeStats.map(store => (
                            <div key={store.id} className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">{store.name}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: `${store.vacationProgrammingPercent}%` }}></div>
                                    </div>
                                    <span className="text-emerald-300">{store.vacationProgrammingPercent.toFixed(0)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </MetricCard>
                <MetricCard title="Plantilla Global" value={activeEmployeesCount} icon={Users} color="text-blue-400" bg="bg-blue-500/10" label="Empleados activos totales">
                    <div className="mt-4 space-y-1">
                        {storeStats.map(store => (
                            <div key={store.id} className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">{store.name}</span>
                                <span className="text-blue-300">{store.employeeCount}</span>
                            </div>
                        ))}
                    </div>
                </MetricCard>
                <MetricCard title="Bolsa de Horas Global" value={`${totalGlobalDebt > 0 ? '+' : ''}${totalGlobalDebt.toFixed(1)}h`} icon={TrendingUp} color={totalGlobalDebt > 0 ? "text-emerald-400" : "text-rose-400"} bg={totalGlobalDebt > 0 ? "bg-emerald-500/10" : "bg-rose-500/10"} label="Balance neto acumulado">
                    <div className="mt-4 space-y-1">
                        {storeStats.map(store => (
                            <div key={store.id} className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">{store.name}</span>
                                <span className={store.debt > 0 ? "text-emerald-300" : "text-rose-300"}>{store.debt > 0 ? '+' : ''}{store.debt.toFixed(1)}h</span>
                            </div>
                        ))}
                    </div>
                </MetricCard>
                <MetricCard title="Absentismo Anual (IT)" value={`${globalAbsentismoPercent.toFixed(1)}%`} icon={Activity} color="text-rose-400" bg="bg-rose-500/10" label="Impacto bajas médicas">
                    <div className="mt-4 space-y-1">
                        {storeStats.map(store => (
                            <div key={store.id} className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">{store.name}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-rose-500" style={{ width: `${Math.min(store.storeAbsentismoPercent * 5, 100)}%` }}></div>
                                    </div>
                                    <span className="text-rose-300">{store.storeAbsentismoPercent.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </MetricCard>
            </div>

            {/* Split Row: Tasks & Microloans */}
            {/* Split Row: Tasks & Microloans */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 text-left">
                {/* Task Summary Banner (Compact) */}
                <div onClick={() => setIsTaskSummaryModalOpen(true)} className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 relative overflow-hidden shadow-2xl flex flex-col justify-between min-w-0 group hover:border-indigo-500/30 transition-colors duration-500 cursor-pointer">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-16 -mt-16 opacity-0 group-hover:opacity-40 transition-opacity duration-700"></div>

                    <div className="mb-6 relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                                <CheckSquare size={20} />
                            </div>
                            <ArrowUpRight size={16} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                        </div>
                        <h3 className="text-lg font-black text-white tracking-tight">Resumen Tareas</h3>
                        <p className="text-xs text-slate-500 font-medium">Estado de actividades</p>
                    </div>

                    <div className="space-y-3 relative z-10">
                        <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400">Activas</span>
                            <div className="flex items-center gap-2">
                                <span className="text-indigo-500 text-[10px] uppercase font-black tracking-wider">Total</span>
                                <span className="text-xl font-black text-white bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">{activeTasks.length}</span>
                            </div>
                        </div>

                        <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400">Progreso</span>
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${taskCompletionRate}%` }}></div>
                                </div>
                                <span className="text-sm font-black text-emerald-400">{taskCompletionRate.toFixed(0)}%</span>
                            </div>
                        </div>

                        <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400">Urgentes</span>
                            <span className={clsx("text-xl font-black px-2 py-0.5 rounded-lg border", urgentTasksCount > 0 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-slate-600 bg-slate-800 border-transparent")}>
                                {urgentTasksCount}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Microloans Card (New) */}
                <div onClick={() => setIsMicroloansModalOpen(true)} className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between cursor-pointer hover:border-sky-500/30 transition-all duration-500 group/micro">

                    {/* Background Effects */}
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-sky-500/5 rounded-full blur-[100px] -ml-20 -mb-20 opacity-0 group-hover/micro:opacity-100 transition-opacity duration-1000"></div>
                    <div className="absolute top-8 right-8 text-sky-500/20 group-hover/micro:text-sky-400 transition-colors">
                        <ArrowUpRight size={28} />
                    </div>

                    {/* Header */}
                    <div className="flex items-end gap-6 mb-8 relative z-10">
                        <div className="p-4 bg-sky-500/10 rounded-2xl text-sky-400 border border-sky-500/20">
                            <Coins size={32} />
                        </div>
                        <div>
                            <p className="text-xs text-sky-500 font-black uppercase tracking-widest mb-1">Microcréditos</p>
                            <h3 className="text-3xl font-black text-white tracking-tight leading-none mb-1">Captación Clientes</h3>
                            <p className="text-sm text-slate-500 font-bold capitalize">{yearMonthLabel}</p>
                        </div>
                        <div className="ml-auto flex flex-col items-end">
                            <div className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">
                                {totalMicroloansGlobal}
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Global</span>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 min-h-0 border-t border-slate-800 pt-6">
                        {/* Store Breakdown */}
                        <div className="space-y-4 pr-2">
                            <div className="flex items-center gap-2 mb-2">
                                <Store size={14} className="text-slate-500" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Por Tienda</p>
                            </div>
                            <div className="space-y-3 overflow-y-auto custom-scrollbar max-h-[160px] pr-2">
                                {microloansStoreStats.map((store) => (
                                    <div key={store.id} className="relative group/item">
                                        <div className="flex justify-between items-center text-xs relative z-10 mb-1">
                                            <span className={clsx("font-bold truncate max-w-[120px]", store.hasReport ? "text-slate-200" : "text-slate-600")}>
                                                {store.name}
                                            </span>
                                            <span className={clsx("font-black", store.total > 0 ? "text-sky-300" : "text-slate-700")}>
                                                {store.total}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={clsx("h-full rounded-full transition-all duration-1000", store.total > 0 ? "bg-sky-500" : "bg-slate-700")}
                                                style={{ width: `${totalMicroloansGlobal > 0 ? (store.total / totalMicroloansGlobal) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Employees */}
                        <div className="space-y-4 px-4 border-x border-slate-800/50">
                            <div className="flex items-center gap-2 mb-2">
                                <Users size={14} className="text-slate-500" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Top Performers</p>
                            </div>
                            <div className="space-y-3 overflow-y-auto custom-scrollbar max-h-[160px] pr-2">
                                {microloansGlobalRanking.length > 0 ? microloansGlobalRanking.map((emp, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/20 border border-slate-800/50 hover:bg-slate-800/60 transition-colors group/emp">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-lg",
                                                i === 0 ? "bg-amber-400 text-amber-950 shadow-amber-500/20" :
                                                    i === 1 ? "bg-slate-300 text-slate-800 shadow-slate-400/20" :
                                                        i === 2 ? "bg-amber-700 text-amber-100 shadow-amber-900/20" :
                                                            "bg-slate-800 text-slate-500"
                                            )}>{i + 1}</div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-300 group-hover/emp:text-white transition-colors capitalize">{emp.name.toLowerCase().split(' ')[0]}</span>
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">{emp.storeName}</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-sky-400">{emp.count}</span>
                                    </div>
                                )) : (
                                    <div className="text-center py-6">
                                        <p className="text-[10px] text-slate-600 italic">Sin actividad registrada</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Visual Chart - Monthly Evolution */}
                        <div className="space-y-4 pl-2 hidden md:block">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={14} className="text-slate-500" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tendencia (6 Meses)</p>
                            </div>

                            <div className="h-[160px] flex items-end justify-between gap-2 pt-4 pb-2">
                                {microloansMonthlyEvolution.map((m, i) => {
                                    // Calculate relative height, max is roughly based on the highest value or a fixed cap if 0 
                                    const maxVal = Math.max(...microloansMonthlyEvolution.map(ev => ev.total), 1);
                                    const heightPercent = Math.max((m.total / maxVal) * 100, 5); // Min 5% height

                                    return (
                                        <div key={i} className="flex flex-col items-center gap-2 group/bar flex-1 h-full justify-end">
                                            <span className="text-[10px] font-bold text-sky-400 opacity-0 group-hover/bar:opacity-100 transition-opacity -translate-y-1">{m.total}</span>
                                            <div
                                                className={clsx(
                                                    "w-full rounded-t-lg transition-all duration-500 relative overflow-hidden",
                                                    m.total > 0 ? "bg-slate-800 hover:bg-sky-500" : "bg-slate-800/30"
                                                )}
                                                style={{ height: `${heightPercent}%` }}
                                            >
                                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent"></div>
                                            </div>
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider truncate w-full text-center group-hover/bar:text-slate-400 transition-colors">
                                                {m.month.substring(0, 3)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-10 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] -mr-48 -mt-48 opacity-50 group-hover:opacity-100 transition-all duration-1000"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-4">
                            <Store className="text-indigo-400" size={32} /> Comparativa de Establecimientos
                        </h3>
                        <div className="flex items-center gap-2 bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                            <button onClick={handlePrevWeek} className="p-2 text-slate-500 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                            <div onClick={goToCurrentWeek} className="px-6 py-2 bg-slate-800 rounded-xl text-white font-black text-xs cursor-pointer hover:bg-slate-700 transition-all flex flex-col items-center">
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest leading-none mb-1">Semana del</span>
                                <span className="leading-none">{selectedWeek}</span>
                            </div>
                            <button onClick={handleNextWeek} className="p-2 text-slate-500 hover:text-white transition-colors"><ChevronRight size={20} /></button>
                        </div>
                    </div>
                    <div className="bg-slate-950/30 border border-slate-800/50 rounded-3xl overflow-x-auto custom-scrollbar shadow-2xl">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <th className="p-6">Establecimiento</th>
                                    <th className="p-4 text-center">Plantilla</th>
                                    <th className="p-4 text-center">Bajas (Sem)</th>
                                    <th className="p-4 text-center">Cobertura</th>
                                    <th className="p-4 text-center whitespace-nowrap">Hrs Trabajadas</th>
                                    <th className="p-4 text-center whitespace-nowrap">Hrs Contratadas</th>
                                    <th className="p-4 text-center">Vacaciones</th>
                                    <th className="p-4 text-center">Bolsa Horas</th>
                                    <th className="p-4 text-center">Estado</th>
                                    <th className="p-4 text-right pr-8">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {storeStats.map(store => (
                                    <tr key={store.id} className="border-b border-slate-800/30 hover:bg-white/[0.02] transition-all">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 font-black shadow-inner border border-white/5">{store.name.substring(0, 2).toUpperCase()}</div>
                                                <div><span className="text-white block font-black text-base">{store.name}</span></div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center text-white font-black text-lg">{store.employeeCount}</td>
                                        <td className="p-4 text-center">
                                            {store.bajasCount > 0 ? <span className="bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-black border border-rose-500/20">{store.bajasCount}</span> : <span className="text-slate-600 font-bold">0</span>}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className={clsx("text-sm font-black", store.coveragePercent >= 95 ? "text-emerald-400" : "text-rose-400")}>{store.coveragePercent.toFixed(1)}%</span>
                                                <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden"><div className={clsx("h-full transition-all duration-1000", store.coveragePercent >= 95 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]")} style={{ width: `${Math.min(store.coveragePercent, 100)}%` }}></div></div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center text-white font-bold">{store.plannedHours.toFixed(1)}h</td>
                                        <td className="p-4 text-center text-slate-400 font-bold">{store.contractedWeeklyTotal.toFixed(1)}h</td>
                                        <td className="p-4 text-center text-slate-500 font-bold">0.0h</td>
                                        <td className="p-4 text-center font-bold">
                                            <span className={clsx("px-3 py-1 rounded-lg text-xs font-black", store.debt > 0 ? "text-emerald-400 bg-emerald-500/5" : "text-rose-400 bg-rose-500/5")}>{store.debt > 0 ? '+' : ''}{store.debt.toFixed(1)}h</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center">
                                                {store.weekStatus === 'approved' ? (
                                                    <span className="bg-emerald-500 text-emerald-950 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 leading-none h-7">Aprobado</span>
                                                ) : store.weekStatus === 'pending' ? (
                                                    <span className="bg-amber-500 text-amber-950 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20 leading-none h-7">Pendiente</span>
                                                ) : <span className="bg-slate-800 text-slate-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest leading-none h-7">Draft</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right pr-8"><button onClick={() => setSelectedStore(store)} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-300 transition-all hover:scale-110 active:scale-95 group"><ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {selectedStore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-300 backdrop-blur-md bg-slate-950/80">
                    <div className="bg-slate-900 w-full max-w-5xl rounded-[3rem] border border-slate-700 shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-10 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950/20 flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-4xl font-black text-white tracking-tight mb-2">{selectedStore.name}</h3>
                                <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Semana del {selectedWeek} | ID Establecimiento: {selectedStore.id}</p>
                            </div>
                            <button onClick={() => setSelectedStore(null)} className="p-4 bg-slate-800/50 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded-[2rem] transition-all relative z-10 active:scale-90"><X size={24} /></button>
                        </div>
                        <div className="p-10 overflow-y-auto custom-scrollbar flex-grow bg-slate-900/50">
                            <div className="bg-slate-950/40 border border-slate-800/50 rounded-3xl overflow-hidden p-8 mb-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800"><p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-1">Hrs Semana (Real)</p><p className="text-3xl font-black text-white">{selectedStore.plannedHours.toFixed(1)}h</p></div>
                                <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800"><p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-1">Bolsa Horas (Centro)</p><p className={clsx("text-3xl font-black", selectedStore.debt > 0 ? "text-emerald-400" : "text-rose-400")}>{selectedStore.debt > 0 ? '+' : ''}{selectedStore.debt.toFixed(1)}h</p></div>
                                <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800"><p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-1">Cobertura Operativa</p><p className={clsx("text-3xl font-black", selectedStore.coveragePercent >= 95 ? "text-emerald-400" : "text-rose-400")}>{selectedStore.coveragePercent.toFixed(1)}%</p></div>
                            </div>
                            <div className="bg-slate-950/30 border border-slate-800 rounded-3xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead><tr className="bg-slate-900 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800"><th className="p-6">Empleado</th><th className="p-4 text-center">Horas</th><th className="p-4 text-center">Ampliación</th><th className="p-4 text-center">Worked</th><th className="p-4 text-right pr-6">Estado</th></tr></thead>
                                    <tbody className="text-sm font-medium">
                                        {selectedStore.empDetails.map((emp: any) => (
                                            <tr key={emp.id} className="border-b border-slate-800/20 hover:bg-white/[0.01]">
                                                <td className="p-6"><span className="text-white block font-bold">{emp.name}</span><span className="text-[10px] text-slate-500 font-bold uppercase">{emp.category}</span></td>
                                                <td className="p-4 text-center text-slate-400">{emp.baseHours}h</td>
                                                <td className="p-4 text-center">{emp.extension > 0 ? <span className="text-emerald-400">+{emp.extension}h</span> : <span className="text-slate-600">-</span>}</td>
                                                <td className="p-4 text-center text-white font-bold">{emp.worked.toFixed(1)}h</td>
                                                <td className="p-4 text-right pr-6"><span className={clsx("px-3 py-1 rounded-full text-[10px] font-black uppercase", emp.isOnLeave ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20")}>{emp.isOnLeave ? 'Baja/Mat' : 'Activo'}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="p-8 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                            <button onClick={() => setSelectedStore(null)} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all shadow-xl">Cerrar Detalle</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Task Summary Detail Modal */}
            {isTaskSummaryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/80 animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-5xl rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <div>
                                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                    <CheckSquare size={28} className="text-indigo-400" /> Detalle de Tareas
                                </h3>
                                <p className="text-slate-500 font-medium text-sm mt-1">Supervisión en tiempo real de actividades.</p>
                            </div>
                            <button onClick={() => setIsTaskSummaryModalOpen(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            {activeTasks.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {activeTasks.map(task => {
                                        // Calculate completion for this specific task
                                        const targetIds = task.targetStores === 'all' ? settings.map(s => s.establishmentId) : task.targetStores;
                                        const completedCount = targetIds.filter(sid => task.status[sid]?.status === 'completed').length;
                                        const totalTarget = targetIds.length;
                                        const percent = totalTarget > 0 ? (completedCount / totalTarget) * 100 : 0;

                                        return (
                                            <div key={task.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 hover:bg-slate-900/80 transition-colors">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h4 className="text-lg font-bold text-white">{task.title}</h4>
                                                            {task.priority === 'high' && (
                                                                <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase border border-rose-500/20">Urgente</span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-400 max-w-2xl">{task.description}</p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-xs font-bold text-slate-500 uppercase">Progreso Global</span>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                                <div className={clsx("h-full rounded-full", percent === 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${percent}%` }}></div>
                                                            </div>
                                                            <span className={clsx("font-black text-sm", percent === 100 ? "text-emerald-400" : "text-indigo-400")}>{percent.toFixed(0)}%</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Per Store Status Grid */}
                                                <div className="mt-4 pt-4 border-t border-slate-800/50">
                                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Estado por Tienda</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                        {targetIds.map(storeId => {
                                                            const st = task.status[storeId];
                                                            const isCompleted = st?.status === 'completed';
                                                            return (
                                                                <div key={storeId} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                                                                    <span className="text-xs font-bold text-slate-300 truncate pr-2">{getStoreName(storeId)}</span>
                                                                    {isCompleted ? (
                                                                        <span className="text-emerald-400"><CheckSquare size={14} /></span>
                                                                    ) : (
                                                                        <div className="w-3 h-3 rounded-full border-2 border-slate-700"></div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                                    <CheckSquare size={48} className="mb-4 opacity-20" />
                                    <p className="text-lg font-bold">No hay tareas activas</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Microloans Detail Modal */}
            {
                isMicroloansModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/80 animate-in fade-in duration-300">
                        <div className="bg-slate-900 w-full max-w-4xl rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div>
                                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                        <Coins size={28} className="text-sky-500" /> Captación de Clientes
                                    </h3>
                                    <p className="text-slate-500 font-medium text-sm mt-1">Informe detallado de actividad comercial.</p>
                                </div>
                                <button onClick={() => setIsMicroloansModalOpen(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Filters */}
                            <div className="p-6 bg-slate-950/30 flex gap-4 border-b border-slate-800">
                                <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-2xl border border-slate-800">
                                    <Building2 size={16} className="ml-3 text-slate-500" />
                                    <select
                                        value={microloansFilterStore}
                                        onChange={(e) => setMicroloansFilterStore(e.target.value)}
                                        className="bg-transparent border-none text-white font-bold text-sm pr-8 focus:ring-0 cursor-pointer outline-none w-[180px]"
                                    >
                                        <option value="all" className="bg-slate-900">Todas las Tiendas</option>
                                        {storeIds.map(id => <option key={id} value={id} className="bg-slate-900">{getStoreName(id)}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-2xl border border-slate-800">
                                    <CalendarDays size={16} className="ml-3 text-slate-500" />
                                    <select
                                        value={microloansFilterYear}
                                        onChange={(e) => setMicroloansFilterYear(Number(e.target.value))}
                                        className="bg-transparent border-none text-white font-bold text-sm pr-8 focus:ring-0 cursor-pointer outline-none"
                                    >
                                        {[2024, 2025, 2026].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-8 overflow-y-auto custom-scrollbar">
                                <div className="bg-slate-950/50 rounded-3xl border border-slate-800/50 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-900/50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                                            <tr>
                                                <th className="p-5">Mes</th>
                                                <th className="p-5 text-right w-full">Captaciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {microloansModalData.map((row, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-5 font-bold text-slate-300 capitalize flex items-center gap-3">
                                                        <span className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500 text-xs font-black group-hover:bg-sky-500 group-hover:text-white transition-colors">
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
        </div >
    );
};

export default SupervisorDashboard;
