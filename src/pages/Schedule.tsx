import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Calendar, ChevronLeft, ChevronRight, User, X, CheckCircle, Settings, Loader2, Printer, Search, AlertTriangle, TrendingDown, Clock, ArrowRight, ShieldAlert, Activity, Plane, Sun, Moon, Trash2, FileSpreadsheet, TrendingUp, Info, Send } from 'lucide-react';
import clsx from 'clsx';
import type { Shift, ShiftType, TimeOffType, PermanentRequest, WorkRole, StoreSettings, TimeOffRequest } from '../types';
import StoreConfigModal from '../components/StoreConfigModal';
import { DatePicker } from '../components/DatePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import { validatePermanentRestrictions, validateRegisterCoverage } from '../services/scheduler';

const calculateShiftDuration = (shift: Shift, settings: StoreSettings): string => {
    if (shift && (shift.type === 'off' || shift.type === 'vacation' || shift.type === 'sick_leave' || shift.type === 'holiday' || shift.type === 'maternity_paternity')) return '';

    const getMinutes = (timeStr?: string) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    let totalMinutes = 0;

    if (shift.type === 'split') {
        const start = shift.startTime || settings.openingHours.morningStart;
        const morningEnd = shift.morningEndTime || settings.openingHours.morningEnd;
        const afternoonStart = shift.afternoonStartTime || settings.openingHours.afternoonStart;
        const end = shift.endTime || settings.openingHours.afternoonEnd;

        totalMinutes = (getMinutes(morningEnd) - getMinutes(start)) + (getMinutes(end) - getMinutes(afternoonStart));
    } else if (shift.type === 'morning') {
        const start = shift.startTime || settings.openingHours.morningStart;
        const end = shift.endTime || settings.openingHours.morningEnd;
        totalMinutes = getMinutes(end) - getMinutes(start);
    } else if (shift.type === 'afternoon') {
        const start = shift.startTime || settings.openingHours.afternoonStart;
        const end = shift.endTime || settings.openingHours.afternoonEnd;
        totalMinutes = getMinutes(end) - getMinutes(start);
    }

    if (totalMinutes <= 0) return '';

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
};

const Schedule = () => {
    const { user } = useAuth();
    const { employees, schedules, createSchedule, updateShift, publishSchedule, getSettings, updateSettings, addTimeOff, updateTimeOff, removeTimeOff, timeOffRequests, permanentRequests, updateHoursDebt, removePermanentRequest, updatePermanentRequest, requestScheduleModification } = useStore();
    const { showToast } = useToast();
    if (!user) return null;
    const [currentWeekStart, setCurrentWeekStart] = useState<string>(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today);
        monday.setDate(diff);

        // Manual string construction to avoid timezone issues
        const y = monday.getFullYear();
        const m = String(monday.getMonth() + 1).padStart(2, '0');
        const d = String(monday.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });



    // Modals State
    const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isConfirmRegenerateOpen, setIsConfirmRegenerateOpen] = useState(false);
    const [isModificationModalOpen, setIsModificationModalOpen] = useState(false);
    const [modificationReason, setModificationReason] = useState('');



    // Shift Edit State
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [editingShift] = useState<Shift | null>(null);
    const [editShiftType, setEditShiftType] = useState<ShiftType>('morning');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    const [editMorningEnd, setEditMorningEnd] = useState('');
    const [editAfternoonStart, setEditAfternoonStart] = useState('');



    // Sick Leave Modal State
    const [isSickLeaveModalOpen, setIsSickLeaveModalOpen] = useState(false);
    const [selectedEmployeeForSickLeave, setSelectedEmployeeForSickLeave] = useState<string>('');
    const [selectedSickLeaveDates, setSelectedSickLeaveDates] = useState<string[]>([]);
    const [pendingDebtAdjustments, setPendingDebtAdjustments] = useState<{ empId: string, name: string, amount: number, worked: number, contract: number }[]>([]);
    const [pendingStrictWarnings, setPendingStrictWarnings] = useState<string[]>([]);
    const [showLowHoursDialog, setShowLowHoursDialog] = useState(false);
    const [dialogMode, setDialogMode] = useState<'warning' | 'publish'>('warning');

    // Availability Request State
    const [selectedEmployeeForRequest, setSelectedEmployeeForRequest] = useState<string>('');
    const [selectedDatesForRequest, setSelectedDatesForRequest] = useState<string[]>([]);
    const [requestType, setRequestType] = useState<TimeOffType>('day_off');
    const [showingExpDetails, setShowingExpDetails] = useState<{
        name: string,
        hours: number,
        start: string,
        end: string
    } | null>(null);

    const handleSaveRequest = () => {
        if (!selectedEmployeeForRequest || selectedDatesForRequest.length === 0) return;

        addTimeOff({
            employeeId: selectedEmployeeForRequest,
            dates: selectedDatesForRequest,
            type: requestType
        });

        showToast('Solicitud añadida correctamente', 'success');
        setSelectedDatesForRequest([]);
        setSelectedEmployeeForRequest('');
    };

    const toggleRequestDate = (date: string) => {
        setSelectedDatesForRequest(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
    };

    // Lock state for published schedules
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingPermanentRequest, setEditingPermanentRequest] = useState<PermanentRequest | null>(null);
    const [editingSickInfo, setEditingSickInfo] = useState<TimeOffRequest | null>(null);

    const changeWeek = (offset: number) => {
        const [y, m, d] = currentWeekStart.split('-').map(Number);
        // Create date at NOON to avoid DST shifts causing day jumps when adding hours
        const date = new Date(y, m - 1, d, 12, 0, 0);

        date.setDate(date.getDate() + (offset * 7));

        // Force Monday just in case
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        date.setDate(diff);

        const newY = date.getFullYear();
        const newM = String(date.getMonth() + 1).padStart(2, '0');
        const newD = String(date.getDate()).padStart(2, '0');
        setCurrentWeekStart(`${newY}-${newM}-${newD}`);
    };

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    // Helper to format date header
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' });
    };

    const currentSchedule = schedules.find(s => s.establishmentId === user.establishmentId && s.weekStartDate === currentWeekStart);
    // Updated Locked Logic: Locked if published AND approved AND (modification NOT approved), unless actively editing (which handles 'unlock' manually if we allowed it, but here we drive it via approval)
    // Actually, if modificationStatus is approved, we treat it as unlocked.
    const isLocked = (
        (currentSchedule?.status === 'published' && currentSchedule?.approvalStatus === 'approved' && currentSchedule?.modificationStatus !== 'approved') ||
        (currentSchedule?.approvalStatus === 'pending')
    ) && !isEditing;

    const settings = getSettings(user.establishmentId);

    const storeEmployees = employees.filter(e => {
        if (e.establishmentId !== user.establishmentId) return false;

        // If no history, assume active (or use active flag as fallback, but 'active' flag might be current status)
        if (!e.history || e.history.length === 0) return e.active;

        const weekStartStr = currentWeekStart;
        const d = new Date(weekStartStr);
        d.setDate(d.getDate() + 6);
        const weekEndStr = d.toISOString().split('T')[0];

        const sortedHistory = [...e.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Status at beginning of week
        const entriesBefore = sortedHistory.filter(h => h.date < weekStartStr);

        let activeAtStart = false;

        if (entriesBefore.length > 0) {
            const lastEntry = entriesBefore[entriesBefore.length - 1];
            activeAtStart = (lastEntry.type === 'hired' || lastEntry.type === 'rehired');
        } else {
            // No history before this week.
            // Check the first event ever recorded.
            const firstEvent = sortedHistory[0];
            // If the first recorded event is a TERMINATION, it means they were active from the dawn of time until that point.
            if (firstEvent && firstEvent.type === 'terminated') {
                activeAtStart = true;
            } else {
                // Presumably 'hired' is the first event, so before that they were inactive.
                activeAtStart = false;
            }
        }

        // Events during week
        const eventsDuring = sortedHistory.filter(h => h.date >= weekStartStr && h.date <= weekEndStr);
        const becomesActive = eventsDuring.some(h => h.type === 'hired' || h.type === 'rehired');

        return activeAtStart || becomesActive;
    }).sort((a, b) => {
        const priority: Record<string, number> = {
            'Gerente': 1,
            'Subgerente': 2,
            'Responsable': 3,
            'Empleado': 4,
            'Limpieza': 5
        };
        const pA = priority[a.category] || 99;
        const pB = priority[b.category] || 99;
        return pA - pB;
    });

    const handleRequestModification = () => {
        if (!currentSchedule || !modificationReason.trim()) return;
        requestScheduleModification(currentSchedule.id, modificationReason);
        showToast('Solicitud de modificación enviada', 'success');
        setIsModificationModalOpen(false);
        setModificationReason('');
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        // Simulate processing time for visual effect
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const newSchedule = createSchedule(user.establishmentId, currentWeekStart);
            showToast('Horario generado correctamente', 'success');

            // Check for warnings immediately
            validateAndShowWarnings(newSchedule);

            // Check strict constraints
            const strictWarnings = validatePermanentRestrictions(newSchedule, permanentRequests, storeEmployees);
            if (strictWarnings.length > 0) {
                alert("ADVERTENCIA: El horario generado viola restricciones permanentes:\n\n" + strictWarnings.join('\n'));
            }

        } catch (error: any) {
            showToast(error.message || 'Error al generar horario', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePublish = async () => {
        if (!currentSchedule) return;

        setIsGenerating(true);
        // Simulate analysis visual delay
        await new Promise(resolve => setTimeout(resolve, 800));
        setIsGenerating(false);

        validateAndShowWarnings(currentSchedule, 'publish');
    };

    const confirmPublish = () => {
        if (currentSchedule) {
            // Apply debt adjustments
            pendingDebtAdjustments.forEach(adj => {
                updateHoursDebt(adj.empId, adj.amount, `Cierre Horario Semana ${currentSchedule.weekStartDate}`, currentSchedule.id);
            });

            publishSchedule(currentSchedule.id);
            setIsEditing(false);
            showToast('Horario publicado y ajustes de deuda aplicados', 'success');
        }
        setShowLowHoursDialog(false);
    };

    const validateAndShowWarnings = (schedule: any, mode: 'warning' | 'publish' = 'warning') => {
        const debtWarnings: string[] = [];
        const debtAdjustments: { empId: string, name: string, amount: number, worked: number, contract: number }[] = [];
        let calculatedStrictWarnings: string[] = [];

        // Calculate Strict Warnings (Permanent Restrictions + Coverage if publishing)
        if (mode === 'publish' || mode === 'warning') {
            calculatedStrictWarnings = validatePermanentRestrictions(schedule, permanentRequests, storeEmployees, false);

            // Register coverage warnings only for publication
            if (mode === 'publish') {
                const registerWarnings = validateRegisterCoverage(schedule, settings);
                calculatedStrictWarnings = [...calculatedStrictWarnings, ...registerWarnings];
            }
        }

        storeEmployees.forEach(emp => {
            const employeeShifts = schedule.shifts.filter((s: any) => s.employeeId === emp.id);
            const workedHours = employeeShifts.reduce((acc: number, s: any) => {
                if (s.type === 'morning' || s.type === 'afternoon') {
                    if (s.startTime && s.endTime) {
                        const start = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                        const end = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                        return acc + (end - start);
                    }
                    return acc + 4;
                }
                if (s.type === 'split') {
                    if (s.startTime && s.endTime && s.morningEndTime && s.afternoonStartTime) {
                        const mStart = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                        const mEnd = parseInt(s.morningEndTime.split(':')[0]) + parseInt(s.morningEndTime.split(':')[1]) / 60;
                        const aStart = parseInt(s.afternoonStartTime.split(':')[0]) + parseInt(s.afternoonStartTime.split(':')[1]) / 60;
                        const aEnd = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                        return acc + (mEnd - mStart) + (aEnd - aStart);
                    }
                    return acc + 8;
                }
                return acc;
            }, 0);

            // Calculate target hours with holiday reduction
            let targetHours = emp.weeklyHours;

            // Check for Temporary Hours
            if (emp.tempHours && emp.tempHours.length > 0) {
                const activeTemp = emp.tempHours.find((t: any) => {
                    return currentWeekStart >= t.start && currentWeekStart <= t.end;
                });
                if (activeTemp) {
                    targetHours = activeTemp.hours;
                }
            }

            // Count days to reduce (Full Holidays + Vacations)
            // Count days to reduce (Full Holidays + Absences)
            const currentHolidays = getSettings(user.establishmentId).holidays;
            const contractHours = targetHours;

            let numDaysToReduce = 0;
            weekDates.forEach(d => {
                const h = currentHolidays.find((holiday: any) => (typeof holiday === 'string' ? holiday : holiday.date) === d);
                const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');
                const isPartialHoliday = h && typeof h !== 'string' && (h.type === 'afternoon' || h.type === 'closed_afternoon');

                const isAbsence = timeOffRequests.some(r =>
                    r.employeeId === emp.id &&
                    (r.type === 'vacation' || r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                    (r.dates.includes(d) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
                );

                if (isFullHoliday || isAbsence) {
                    numDaysToReduce++;
                } else if (isPartialHoliday && contractHours === 40) {
                    // EXCEPTION: 40h employees get 0.5 reduction for partial holidays (closing afternoon)
                    numDaysToReduce += 0.5;
                }
            });

            const rReduction = Math.round(numDaysToReduce * 10) / 10;
            const baseHours = targetHours;

            // Columns correspond to days to reduce: [0.5, 1, 1.5, 2, 3]
            const reductionTable: Record<number, number[]> = {
                40: [36, 32, 28, 24, 16],
                36: [33, 30, 27, 23, 18],
                32: [30, 27, 24, 21, 16],
                28: [25, 23, 21, 19, 14],
                24: [22, 20, 18, 16, 12],
                20: [18, 17, 15, 13, 10],
                16: [14, 13, 12, 10, 8]
            };

            if (rReduction > 0) {
                const tableRow = reductionTable[baseHours];
                if (tableRow) {
                    if (rReduction === 0.5) targetHours = tableRow[0];
                    else if (rReduction === 1) targetHours = tableRow[1];
                    else if (rReduction === 1.5) targetHours = tableRow[2];
                    else if (rReduction === 2) targetHours = tableRow[3];
                    else if (rReduction === 3) targetHours = tableRow[4];
                    else if (rReduction >= 5) {
                        targetHours = 0;
                    }
                    else if (rReduction > 3) {
                        targetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                    }
                } else {
                    targetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                }
            }

            // Round to 1 decimal to avoid float precision issues warning
            let diff = Math.round((workedHours - targetHours) * 10) / 10;

            // Check if employee is on full week vacation/sick (vacation/sick or off for all shifts)
            const nonOffShifts = employeeShifts.filter((s: any) => s.type !== 'off' && s.type !== 'holiday');
            const isFullAbsence = nonOffShifts.length > 0 && nonOffShifts.every((s: any) => s.type === 'vacation' || s.type === 'sick_leave');

            if (isFullAbsence) {
                diff = 0;
            }

            if (diff !== 0) {
                debtAdjustments.push({
                    empId: emp.id,
                    name: emp.name,
                    amount: diff,
                    worked: Math.round(workedHours * 10) / 10,
                    contract: targetHours
                });
                if (diff > 0) {
                    debtWarnings.push(`${emp.name}: Excede en +${diff.toFixed(1)}h (Trabajado/Compensado: ${workedHours.toFixed(1)}h / Objetivo: ${targetHours}h)`);
                } else {
                    debtWarnings.push(`${emp.name}: Le faltan ${Math.abs(diff).toFixed(1)}h (Trabajado/Compensado: ${workedHours.toFixed(1)}h / Objetivo: ${targetHours}h)`);
                }
            }
        });

        // Calculate Daily Coverage Warnings


        // NEW: Check for Low Coverage Days (< 48h)
        weekDates.forEach(date => {
            // Count total hours for this date
            const shiftsOnDate = schedule.shifts.filter((s: any) => s.date === date);
            const morningHours = shiftsOnDate.filter((s: any) => s.type === 'morning' || s.type === 'split').length * 4;
            const afternoonHours = shiftsOnDate.filter((s: any) => s.type === 'afternoon' || s.type === 'split').length * 4;
            const totalHours = morningHours + afternoonHours;

            // Ignore Sundays if closed
            const isSunday = new Date(date).getDay() === 0;
            const settings = getSettings(user.establishmentId);
            const isOpenSunday = settings.openSundays.includes(date);

            if (isSunday && !isOpenSunday) return;

            // Check for holidays
            const holidayObj = settings.holidays.find((h: any) => (typeof h === 'string' ? h === date : h.date === date));
            const isFullHoliday = holidayObj && (typeof holidayObj === 'string' || holidayObj.type === 'full');
            const isAfternoonHoliday = holidayObj && typeof holidayObj !== 'string' && (holidayObj.type === 'afternoon' || holidayObj.type === 'closed_afternoon');

            if (isFullHoliday) return;

            // Reduce threshold for partial closure days
            let threshold = 48;
            if (isAfternoonHoliday) threshold = 24;

            if (totalHours < threshold) {
                calculatedStrictWarnings.push(`Baja Cobertura: El ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()} solo tiene ${totalHours}h planificadas (Mínimo recomendado: ${threshold}h).`);
            }
        });

        if (debtWarnings.length > 0 || calculatedStrictWarnings.length > 0) {
            setPendingDebtAdjustments(debtAdjustments);
            setPendingStrictWarnings(calculatedStrictWarnings);
            setDialogMode(mode);
            setShowLowHoursDialog(true);
        } else if (mode === 'publish') {
            confirmPublish();
        }
    };



    const handleSaveSickLeave = () => {
        if (!selectedEmployeeForSickLeave || selectedSickLeaveDates.length === 0) return;

        // If schedule exists, update specific shifts
        if (currentSchedule) {
            selectedSickLeaveDates.forEach(date => {
                const existingShift = currentSchedule.shifts.find(s => s.employeeId === selectedEmployeeForSickLeave && s.date === date);
                if (existingShift) {
                    updateShift(currentSchedule.id, existingShift.id, { type: 'sick_leave' });
                }
            });
        }

        // Calculate start and end dates for "Long Term" structure consistency
        const sortedDates = [...selectedSickLeaveDates].sort();
        const startDate = sortedDates[0];
        const endDate = sortedDates[sortedDates.length - 1];

        addTimeOff({
            employeeId: selectedEmployeeForSickLeave,
            dates: selectedSickLeaveDates,
            startDate: startDate,
            endDate: endDate,
            type: 'sick_leave'
        });

        showToast('Baja registrada correctamente', 'success');
        setIsSickLeaveModalOpen(false);
        setSelectedSickLeaveDates([]);
        setSelectedEmployeeForSickLeave('');
    };

    const handleUpdateSickLeaveEndDate = () => {
        if (!editingSickInfo || !editingSickInfo.endDate) return;
        updateTimeOff(editingSickInfo.id, { endDate: editingSickInfo.endDate });
        showToast('Fecha de fin de baja actualizada', 'success');
        setEditingSickInfo(null);
    };

    const toggleSickDate = (date: string) => {
        setSelectedSickLeaveDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
    };



    const handleRegenerateClick = () => {
        setIsConfirmRegenerateOpen(true);
    };

    const handleConfirmRegenerate = async () => {
        setIsConfirmRegenerateOpen(false);
        setIsGenerating(true);
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const newSchedule = createSchedule(user.establishmentId, currentWeekStart, true);
            showToast('Horario regenerado correctamente', 'success');

            // Check for warnings
            validateAndShowWarnings(newSchedule);

            // Check strict constraints
            const strictWarnings = validatePermanentRestrictions(newSchedule, permanentRequests, storeEmployees);
            if (strictWarnings.length > 0) {
                alert("ADVERTENCIA: El horario generado viola restricciones permanentes:\n\n" + strictWarnings.join('\n'));
            }

        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsGenerating(false);
        }
    };



    // Locked definition moved up

    // Locked definition moved up

    const [isConfirmDeletePermOpen, setIsConfirmDeletePermOpen] = useState(false);
    const [isConfirmDeleteRequestOpen, setIsConfirmDeleteRequestOpen] = useState(false);
    const [requestToDelete, setRequestToDelete] = useState<string | null>(null);

    // Get time-off requests for current week
    // Get time-off requests for current week
    const weekTimeOffRequests = timeOffRequests.filter(req => {
        const emp = employees.find(e => e.id === req.employeeId);
        if (!emp || emp.establishmentId !== user.establishmentId) return false;

        // Check explicit dates
        if (req.dates && req.dates.some(date => weekDates.includes(date))) return true;

        // Check ranges (e.g. sick leave, maternity)
        if (req.startDate && req.endDate) {
            return req.startDate <= weekDates[6] && req.endDate >= weekDates[0];
        }

        return false;
    });

    // Filter employees for current establishment (1) and ACTIVE status (2)


    const handlePrint = () => {
        if (!currentSchedule) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permite ventanas emergentes para imprimir.');
            return;
        }

        const settings = getSettings(user.establishmentId);

        // Calculate Debt for Summary
        const debtSummary: { name: string, weeklyAdj: number, totalAccumulated: number }[] = [];
        const isAlreadyPublished = currentSchedule.status === 'published';

        storeEmployees.forEach(emp => {
            const employeeShifts = currentSchedule.shifts.filter((s: any) => s.employeeId === emp.id);
            const workedHours = employeeShifts.reduce((acc: number, s: any) => {
                if (s.type === 'morning' || s.type === 'afternoon') {
                    if (s.startTime && s.endTime) {
                        const start = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                        const end = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                        return acc + (end - start);
                    }
                    return acc + 4;
                }
                if (s.type === 'split') {
                    if (s.startTime && s.endTime && s.morningEndTime && s.afternoonStartTime) {
                        const mStart = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                        const mEnd = parseInt(s.morningEndTime.split(':')[0]) + parseInt(s.morningEndTime.split(':')[1]) / 60;
                        const aStart = parseInt(s.afternoonStartTime.split(':')[0]) + parseInt(s.afternoonStartTime.split(':')[1]) / 60;
                        const aEnd = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                        return acc + (mEnd - mStart) + (aEnd - aStart);
                    }
                    return acc + 8;
                }
                return acc;
            }, 0);

            let targetHours = emp.weeklyHours;
            if (emp.tempHours && emp.tempHours.length > 0) {
                const activeTemp = emp.tempHours.find((t: any) => currentWeekStart >= t.start && currentWeekStart <= t.end);
                if (activeTemp) targetHours = activeTemp.hours;
            }

            const currentHolidays = settings.holidays;
            let numDaysToReduce = 0;
            weekDates.forEach(d => {
                const h = currentHolidays.find((holiday: any) => (typeof holiday === 'string' ? holiday : holiday.date) === d);
                const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');
                const isAbsence = timeOffRequests.some(r =>
                    r.employeeId === emp.id &&
                    (r.type === 'vacation' || r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                    (r.dates.includes(d) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
                );
                if (isFullHoliday || isAbsence) numDaysToReduce++;
            });

            const rReduction = Math.round(numDaysToReduce * 10) / 10;
            const baseHours = targetHours;
            const reductionTable: Record<number, number[]> = {
                40: [36, 32, 28, 24, 16], 36: [33, 30, 27, 23, 18], 32: [30, 27, 24, 21, 16],
                28: [25, 23, 21, 19, 14], 24: [22, 20, 18, 16, 12], 20: [18, 17, 15, 13, 10], 16: [14, 13, 12, 10, 8]
            };

            if (rReduction > 0) {
                const tableRow = reductionTable[baseHours];
                if (tableRow) {
                    if (rReduction === 0.5) targetHours = tableRow[0];
                    else if (rReduction === 1) targetHours = tableRow[1];
                    else if (rReduction === 1.5) targetHours = tableRow[2];
                    else if (rReduction === 2) targetHours = tableRow[3];
                    else if (rReduction === 3) targetHours = tableRow[4];
                    else if (rReduction >= 5) targetHours = 0;
                    else if (rReduction > 3) targetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                } else {
                    targetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                }
            }

            let weeklyAdj = Math.round((workedHours - targetHours) * 10) / 10;
            const nonOffShifts = employeeShifts.filter((s: any) => s.type !== 'off' && s.type !== 'holiday');
            const isFullAbsence = nonOffShifts.length > 0 && nonOffShifts.every((s: any) => s.type === 'vacation' || s.type === 'sick_leave');
            if (isFullAbsence) weeklyAdj = 0;

            const existingDebt = emp.hoursDebt || 0;
            // If draft, total reflects what it WILL be. If published, existingDebt already includes the adjustment.
            const totalAccumulated = isAlreadyPublished ? existingDebt : existingDebt + weeklyAdj;

            if (Math.abs(weeklyAdj) > 0.01 || Math.abs(totalAccumulated) > 0.01) {
                debtSummary.push({ name: emp.name, weeklyAdj, totalAccumulated });
            }
        });

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Horario Semanal</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #1f2937; }
                    h1 { text-align: center; margin-bottom: 20px; color: #111827; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px; }
                    th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: center; }
                    th { background-color: #f9fafb; font-weight: 700; color: #374151; }
                    .header-cell { background-color: #f3f4f6; }
                    .employee-cell { text-align: left; font-weight: 600; width: 140px; }
                    .shift-morning { background-color: #dbeafe; color: #1e40af; }
                    .shift-afternoon { background-color: #ffedd5; color: #9a3412; }
                    .shift-split { background-color: #f3e8ff; color: #6b21a8; }
                    .shift-vacation { background-color: #ccfbf1; color: #0f766e; }
                    .shift-off { background-color: #f3f4f6; color: #6b7280; }
                    .shift-holiday { background-color: #fee2e2; color: #991b1b; }
                    .shift-sick { background-color: #fef9c3; color: #854d0e; }
                    
                    .debt-heading { font-size: 14px; font-weight: 800; margin-bottom: 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; color: #374151; }
                    .debt-table { max-width: 600px; margin-left: 0; }
                    .debt-positive { color: #059669; font-weight: 700; }
                    .debt-negative { color: #dc2626; font-weight: 700; }
                    .print-footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 10px; }
                </style>
            </head>
            <body>
                <h1>Horario Semanal: ${new Date(weekDates[0]).toLocaleDateString('es-ES')} - ${new Date(weekDates[6]).toLocaleDateString('es-ES')}</h1>
                <table>
                    <thead>
                        <tr>
                            <th class="header-cell">Empleado</th>
                            ${weekDates.map(date => `<th class="header-cell">${new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${storeEmployees.map(emp => {
            const shifts = currentSchedule.shifts.filter(s => s.employeeId === emp.id);
            const cells = weekDates.map(date => {
                const shift = shifts.find(s => s.date === date);
                if (!shift) return '<td>-</td>';

                let className = '';
                let content = '';

                const roleMap: Record<string, string> = { 'sales_register': 'Caja Venta', 'purchase_register': 'Caja Compra', 'shuttle': 'Lanzadera', 'cleaning': 'Limpieza' };
                const roleName = shift.role ? roleMap[shift.role] : '';
                const roleHtml = roleName ? `<div style="font-weight:700; font-size:10px; margin-bottom:2px; text-transform:uppercase">${roleName}</div>` : '';
                const riHtml = shift.isIndividualMeeting ? `<div style="display:inline-block; background-color:#4f46e5; color:white; padding:1px 3px; border-radius:3px; font-size:9px; font-weight:800; margin-bottom:2px; margin-right:2px;">RI</div>` : '';
                const prefixHtml = `<div style="display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:2px;">${riHtml}${roleHtml}</div>`;

                switch (shift.type) {
                    case 'morning':
                        className = 'shift-morning';
                        content = `${prefixHtml}MAÑANA<br>${shift.startTime || '10:00'} - ${shift.endTime || '14:00'}`;
                        break;
                    case 'afternoon':
                        className = 'shift-afternoon';
                        content = `${prefixHtml}TARDE<br>${shift.startTime || '16:30'} - ${shift.endTime || '20:30'}`;
                        break;
                    case 'split':
                        className = 'shift-split';
                        content = `${prefixHtml}PARTIDO<br>${shift.startTime || '10:00'}-${shift.morningEndTime || settings.openingHours.morningEnd}<br>${shift.afternoonStartTime || settings.openingHours.afternoonStart}-${shift.endTime || '20:30'}`;
                        break;
                    case 'vacation': className = 'shift-vacation'; content = 'VACACIONES'; break;
                    case 'off': className = 'shift-off'; content = 'DESCANSO'; break;
                    case 'holiday': className = 'shift-holiday'; content = 'FESTIVO'; break;
                    case 'sick_leave': className = 'shift-sick'; content = 'BAJA'; break;
                    case 'maternity_paternity': className = 'shift-sick'; content = 'PATERNIDAD/<br>MATERNIDAD'; break;
                    default: content = '-';
                }

                return `<td class="${className}">${content}</td>`;
            }).join('');

            return `<tr><td class="employee-cell">${emp.name}<br><span style="font-size: 10px; color: #6b7280; font-weight: 400">${emp.category}</span></td>${cells}</tr>`;
        }).join('')}
                    </tbody>
                </table>

                ${debtSummary.length > 0 ? `
                    <div style="page-break-inside: avoid; margin-top: 40px;">
                        <h2 class="debt-heading">RESUMEN DE DEUDA SEMANAL</h2>
                        <table class="debt-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left">Empleado</th>
                                    <th>Ajuste Semana</th>
                                    <th>Total Acumulado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${debtSummary.map(d => `
                                    <tr>
                                        <td style="text-align: left; font-weight: 600">${d.name}</td>
                                        <td class="${d.weeklyAdj > 0 ? 'debt-positive' : d.weeklyAdj < 0 ? 'debt-negative' : ''}">
                                            ${d.weeklyAdj > 0 ? '+' : ''}${d.weeklyAdj.toFixed(1)}h
                                        </td>
                                        <td class="${d.totalAccumulated > 0 ? 'debt-positive' : d.totalAccumulated < 0 ? 'debt-negative' : ''}" style="background-color: #f9fafb">
                                            ${d.totalAccumulated > 0 ? '+' : ''}${d.totalAccumulated.toFixed(1)}h
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <p style="font-size: 10px; color: #6b7280; margin-top: 10px;">* El ajuste de deuda se suma a la bolsa de horas acumulada (deuda positiva = horas a favor del empleado).</p>
                    </div>
                ` : ''}

                <div class="print-footer">
                    Documento generado por Hour IA - ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}
                </div>
                <script>
                    window.onload = () => {
                        window.print();
                        // window.close(); // Optional: close after printing
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="p-6 space-y-6">
            {/* 1. Top Toolbar & Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col xl:flex-row items-center justify-between gap-4">

                {/* Left: Title & Subtitle */}
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                        <Calendar size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Horarios</h1>
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-slate-500 font-medium">Gestión de turnos</p>
                            {currentSchedule?.approvalStatus === 'pending' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1"><Clock size={10} /> Supervisión</span>}
                            {currentSchedule?.approvalStatus === 'approved' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1"><CheckCircle size={10} /> Aprobado</span>}
                            {currentSchedule?.approvalStatus === 'rejected' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1"><X size={10} /> Rechazado</span>}
                        </div>
                    </div>
                </div>

                {/* Supervisor Notes Banner if Rejected */}
                {currentSchedule?.approvalStatus === 'rejected' && currentSchedule.supervisorNotes && (
                    <div className="w-full xl:w-auto flex-1 max-w-2xl bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <span className="text-xs font-bold text-red-700 block mb-0.5">Nota de Supervisión:</span>
                            <p className="text-xs text-red-600">{currentSchedule.supervisorNotes}</p>
                        </div>
                    </div>
                )}

                {/* Center: Week Navigation */}
                <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                    <button
                        onClick={() => changeWeek(-1)}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 hover:text-indigo-600 transition-all"
                        title="Semana Anterior"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="px-6 py-1 text-center min-w-[200px]">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Semana del</span>
                        <span className="text-sm font-bold text-slate-800">
                            {new Date(currentWeekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                    <button
                        onClick={() => changeWeek(1)}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 hover:text-indigo-600 transition-all"
                        title="Semana Siguiente"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Right: Actions Toolbar */}
                <div className="flex items-center gap-2 w-full xl:w-auto justify-end flex-wrap">
                    {/* Secondary Utilities */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                        <button
                            onClick={() => setIsConfigOpen(true)}
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-sm rounded-md transition-all"
                            title="Configuración"
                        >
                            <Settings size={18} />
                        </button>
                        <button
                            onClick={() => setIsAvailabilityModalOpen(true)}
                            className={clsx("p-2 rounded-md transition-all hover:bg-white hover:shadow-sm",
                                isLocked ? "text-slate-400 hover:text-slate-600" : "text-blue-600 hover:text-blue-800"
                            )}
                            title={isLocked ? "Ver Solicitudes (Solo Lectura)" : "Gestionar Disponibilidad"}
                        >
                            <User size={18} />
                        </button>
                        <button
                            onClick={() => setIsSickLeaveModalOpen(true)}
                            disabled={currentSchedule?.approvalStatus === 'pending'}
                            className="p-2 text-amber-600 hover:text-amber-900 hover:bg-white hover:shadow-sm rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title={currentSchedule?.approvalStatus === 'pending' ? "No disponible en revisión" : "Gestionar Bajas"}
                        >
                            <span className="font-bold text-lg leading-none">+</span>
                        </button>

                        {isLocked && (
                            <>
                                <button
                                    onClick={() => {
                                        // CSV Export Logic
                                        if (!currentSchedule) return;

                                        // Header
                                        const header = ['Empleado', ...weekDates.map(d => new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' }))].join(';');

                                        // Rows
                                        const rows = storeEmployees.map(emp => {
                                            const shifts = currentSchedule.shifts.filter(s => s.employeeId === emp.id);
                                            const cells = weekDates.map(date => {
                                                const shift = shifts.find(s => s.date === date);
                                                if (!shift) return '-';

                                                // STRICT EXPLICIT DATA ONLY
                                                if (shift.type === 'morning') return `MAÑANA (${shift.startTime || ''}-${shift.endTime || ''})`;
                                                if (shift.type === 'afternoon') return `TARDE (${shift.startTime || ''}-${shift.endTime || ''})`;
                                                if (shift.type === 'split') return `PARTIDO (${shift.startTime || ''}-${shift.morningEndTime || ''} / ${shift.afternoonStartTime || ''}-${shift.endTime || ''})`;

                                                if (shift.type === 'vacation') return 'VACACIONES';
                                                if (shift.type === 'off') return 'DESC';
                                                if (shift.type === 'holiday') return 'FESTIVO';
                                                if (shift.type === 'sick_leave') return 'BAJA';
                                                if (shift.type === 'maternity_paternity') return 'MATERNIDAD / PATERNIDAD';
                                                return '-';
                                            });
                                            // Quote cells to handle existing semicolons or newlines if any, and join with semicolon
                                            return [emp.name, ...cells].map(c => `"${c.replace(/"/g, '""')}"`).join(';');
                                        });

                                        const csvContent = [header, ...rows].join('\n');
                                        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.setAttribute('href', url);
                                        link.setAttribute('download', `Horario_${currentWeekStart}.csv`);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                    disabled={currentSchedule?.approvalStatus !== 'approved'}
                                    className="p-2 text-green-600 hover:text-green-900 hover:bg-white hover:shadow-sm rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={currentSchedule?.approvalStatus !== 'approved' ? "Requiere Aprobación" : "Exportar a Excel"}
                                >
                                    <FileSpreadsheet size={18} />
                                </button>
                                <button
                                    onClick={handlePrint}
                                    disabled={currentSchedule?.approvalStatus !== 'approved'}
                                    className="p-2 text-purple-600 hover:text-purple-900 hover:bg-white hover:shadow-sm rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={currentSchedule?.approvalStatus !== 'approved' ? "Requiere Aprobación" : "Imprimir / Guardar en PDF"}
                                >
                                    <Printer size={18} />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="w-px h-8 bg-slate-200 mx-1 hidden xl:block"></div>

                    {/* Management Actions */}
                    {isLocked ? (
                        <div className="flex gap-2">
                            {currentSchedule?.approvalStatus === 'pending' ? (
                                <span className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold border border-amber-200 flex items-center gap-2">
                                    <Clock size={18} /> En Supervisión
                                </span>
                            ) : (
                                <>
                                    {/* Modification Request Logic */}
                                    {currentSchedule?.modificationStatus === 'requested' ? (
                                        <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-sm font-medium border border-amber-200 flex items-center gap-2 cursor-help" title={`Motivo: ${currentSchedule.modificationReason}`}>
                                            <Clock size={16} /> Solicitud Enviada
                                        </span>
                                    ) : currentSchedule?.modificationStatus === 'rejected' ? (
                                        <button
                                            onClick={() => setIsModificationModalOpen(true)}
                                            className="bg-red-100 text-red-700 px-4 py-2 rounded-xl text-sm font-medium border border-red-200 flex items-center gap-2 hover:bg-red-200 transition-colors"
                                            title="Su solicitud anterior fue denegada. Click para solicitar de nuevo."
                                        >
                                            <ShieldAlert size={16} /> Denegada - Reintentar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setIsModificationModalOpen(true)}
                                            className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-medium border border-indigo-200 flex items-center gap-2 hover:bg-indigo-100 transition-colors"
                                        >
                                            <ShieldAlert size={16} /> Solicitar Modificación
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {currentSchedule && (
                                <button
                                    onClick={handleRegenerateClick}
                                    disabled={isGenerating}
                                    className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all font-medium flex items-center gap-2"
                                >
                                    <TrendingUp size={18} /> Regenerar
                                </button>
                            )}
                            {(!currentSchedule) && (
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Settings size={20} />}
                                    Generar IA
                                </button>
                            )}
                            {(currentSchedule) && (
                                <button
                                    onClick={handlePublish}
                                    disabled={isGenerating || currentSchedule.approvalStatus === 'pending'}
                                    className={clsx(
                                        "px-5 py-2 rounded-xl transition-all font-bold shadow-lg flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait",
                                        currentSchedule.approvalStatus === 'pending' ? "bg-amber-100 text-amber-700 shadow-none" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
                                    )}
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <ShieldAlert size={20} />}
                                    {currentSchedule.approvalStatus === 'pending' ? 'En Supervisión' : (currentSchedule.status === 'published' ? 'Republicar' : 'Publicar')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
            {/* Request Deletion Confirm Dialog */}
            <ConfirmDialog
                isOpen={isConfirmDeleteRequestOpen}
                title="Eliminar Solicitud"
                message="¿Estás seguro de que quieres eliminar esta solicitud de disponibilidad?"
                confirmText="Eliminar"
                cancelText="Cancelar"
                onConfirm={() => {
                    if (requestToDelete) {
                        removeTimeOff(requestToDelete);
                        showToast('Solicitud eliminada', 'success');
                        setRequestToDelete(null);
                    }
                    setIsConfirmDeleteRequestOpen(false);
                }}
                onCancel={() => {
                    setIsConfirmDeleteRequestOpen(false);
                    setRequestToDelete(null);
                }}
                isDestructive={true}
            />

            {
                (weekTimeOffRequests.length > 0 ||
                    permanentRequests.some(r => storeEmployees.some(e => e.id === r.employeeId)) ||
                    storeEmployees.some(emp => emp.tempHours?.some(t => currentWeekStart >= t.start && currentWeekStart <= t.end))) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">

                        {/* Sick Leave Card (Bajas y Maternidad) */}
                        {timeOffRequests.some(r => (r.type === 'sick_leave' || r.type === 'maternity_paternity') && storeEmployees.some(e => e.id === r.employeeId) && (
                            (r.dates && r.dates.some(d => weekDates.includes(d))) ||
                            (r.startDate && r.endDate && r.startDate <= weekDates[6] && r.endDate >= weekDates[0])
                        )) && (
                                <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4 relative overflow-hidden group hover:border-amber-200 transition-colors">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Loader2 size={64} className="text-amber-500" />
                                    </div>
                                    <h3 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2 relative z-10">
                                        <div className="p-1 bg-amber-100 rounded text-amber-600"><Loader2 size={14} /></div>
                                        Bajas
                                    </h3>
                                    <div className="flex flex-wrap gap-2 relative z-10">
                                        {timeOffRequests
                                            .filter(r => r.type === 'sick_leave' || r.type === 'maternity_paternity')
                                            .filter(r => storeEmployees.some(e => e.id === r.employeeId))
                                            .filter(r => (
                                                (r.dates && r.dates.some(d => weekDates.includes(d))) ||
                                                (r.startDate && r.endDate && r.startDate <= weekDates[6] && r.endDate >= weekDates[0])
                                            ))
                                            .map(req => {
                                                const emp = storeEmployees.find(e => e.id === req.employeeId);
                                                let dateLabel = '';
                                                if (req.endDate) {
                                                    dateLabel = `Hasta ${new Date(req.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`;
                                                } else if (req.dates) {
                                                    const relevantDates = req.dates.filter(d => weekDates.includes(d));
                                                    if (relevantDates.length === 7) dateLabel = 'Semana Completa';
                                                    else dateLabel = `${relevantDates.length} días`;
                                                }

                                                return (
                                                    <div key={req.id} className={`bg-amber-50/50 border border-amber-100 hover:border-amber-300 rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-default ${req.type === 'maternity_paternity' ? 'bg-pink-50/50 border-pink-100' : ''}`}>
                                                        <span className={`font-semibold ${req.type === 'maternity_paternity' ? 'text-pink-900' : 'text-amber-900'}`}>{emp?.initials || emp?.name.substring(0, 2).toUpperCase()}</span>
                                                        <span className={`${req.type === 'maternity_paternity' ? 'text-pink-500' : 'text-amber-500'}`}>•</span>
                                                        <span className={`${req.type === 'maternity_paternity' ? 'text-pink-700' : 'text-amber-700'}`}>{req.type === 'maternity_paternity' ? 'Maternidad' : dateLabel}</span>
                                                        <button
                                                            onClick={() => setEditingSickInfo(req)}
                                                            className="ml-1 p-0.5 hover:bg-amber-200 rounded text-amber-500 hover:text-amber-800 transition-colors"
                                                        >
                                                            <Search size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                        {/* Permanent Restrictions Card */}
                        {permanentRequests.some(r => storeEmployees.some(e => e.id === r.employeeId)) && (
                            <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 relative overflow-hidden group hover:border-purple-200 transition-colors">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <CheckCircle size={64} className="text-purple-500" />
                                </div>
                                <h3 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2 relative z-10">
                                    <div className="p-1 bg-purple-100 rounded text-purple-600"><CheckCircle size={14} /></div>
                                    Restricciones Fijas
                                </h3>
                                <div className="flex flex-wrap gap-2 relative z-10">
                                    {permanentRequests
                                        .filter(r => storeEmployees.some(e => e.id === r.employeeId))
                                        .filter(r => !r.exceptions?.includes(currentWeekStart))
                                        .map(req => {
                                            const emp = storeEmployees.find(e => e.id === req.employeeId);
                                            const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

                                            let displayLabel = '';
                                            let displaySubLabel = '';

                                            if (req.type === 'rotating_days_off' && req.cycleWeeks && req.referenceDate) {
                                                displayLabel = 'Rotativo';
                                                const cycleStart = new Date(req.referenceDate);
                                                const currentStart = new Date(currentWeekStart);
                                                const diffTime = currentStart.getTime() - cycleStart.getTime();
                                                const diffWeeks = Math.floor(Math.round(diffTime / (1000 * 60 * 60 * 24)) / 7);

                                                if (diffWeeks >= 0) {
                                                    const cycleIndex = diffWeeks % req.cycleWeeks.length;
                                                    const currentDays = req.cycleWeeks[cycleIndex] || [];
                                                    if (currentDays.length > 0) {
                                                        displaySubLabel = `(${currentDays.map(d => dayNames[d]).join(', ')})`;
                                                    }
                                                }
                                            } else {
                                                displayLabel = req.type === 'morning_only' ? 'Solo Mañanas' :
                                                    req.type === 'afternoon_only' ? 'Solo Tardes' :
                                                        req.type === 'force_full_days' ? 'Descanso en Días Completos' :
                                                            req.type === 'early_morning_shift' ? 'Entrada 9:00' :
                                                                req.type === 'max_afternoons_per_week' ? `Máx ${req.value || 'X'} Tardes` :
                                                                    'Días Libres';

                                                if (['morning_only', 'afternoon_only', 'specific_days_off'].includes(req.type) && req.days && req.days.length > 0 && req.days.length < 7) {
                                                    displaySubLabel = `(${req.days.map(d => dayNames[d]).join(', ')})`;
                                                }
                                            }

                                            return (
                                                <div key={req.id} className="bg-purple-50/50 border border-purple-100 hover:border-purple-300 rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-default">
                                                    <span className="font-semibold text-purple-900">{emp?.initials || emp?.name.substring(0, 2).toUpperCase()}</span>
                                                    <span className="text-purple-500">•</span>
                                                    <span className="text-purple-700">
                                                        {displayLabel}
                                                        {displaySubLabel && <span className="text-xs text-purple-500 ml-1">{displaySubLabel}</span>}
                                                    </span>
                                                    <button
                                                        onClick={() => setEditingPermanentRequest(req)}
                                                        className="ml-1 p-0.5 hover:bg-purple-200 rounded text-purple-500 hover:text-purple-800 transition-colors"
                                                    >
                                                        <Search size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Vacations Card (NEW) */}
                        {weekTimeOffRequests.some(r => r.type === 'vacation') && (
                            <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 relative overflow-hidden group hover:border-teal-200 transition-colors">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Plane size={64} className="text-teal-500" />
                                </div>
                                <h3 className="text-sm font-bold text-teal-900 mb-3 flex items-center gap-2 relative z-10">
                                    <div className="p-1 bg-teal-100 rounded text-teal-600"><Plane size={14} /></div>
                                    Vacaciones
                                    <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded-full">
                                        {weekTimeOffRequests.filter(r => r.type === 'vacation').length}
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 relative z-10">
                                    {weekTimeOffRequests
                                        .filter(r => r.type === 'vacation')
                                        .map(req => {
                                            const emp = storeEmployees.find(e => e.id === req.employeeId);
                                            return (
                                                <div key={req.id} className="bg-teal-50/50 border border-teal-100 hover:border-teal-300 rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-default">
                                                    <span className="font-semibold text-teal-900">{emp?.initials || emp?.name.substring(0, 2).toUpperCase()}</span>
                                                    <span className="text-teal-500">•</span>
                                                    <span className="text-teal-700">Vacaciones</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setIsAvailabilityModalOpen(true);
                                                        }}
                                                        className="ml-1 p-0.5 hover:bg-teal-200 rounded text-teal-500 hover:text-teal-700 transition-colors"
                                                    >
                                                        <Search size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Availability Card (Filtered) */}
                        {weekTimeOffRequests.some(r => r.type !== 'vacation' && r.type !== 'sick_leave' && r.type !== 'maternity_paternity') && (
                            <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4 relative overflow-hidden group hover:border-blue-200 transition-colors">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Calendar size={64} className="text-blue-500" />
                                </div>
                                <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2 relative z-10">
                                    <div className="p-1 bg-blue-100 rounded text-blue-600"><Calendar size={14} /></div>
                                    Solicitudes de Disponibilidad
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                        {weekTimeOffRequests.filter(r => r.type !== 'vacation' && r.type !== 'sick_leave' && r.type !== 'maternity_paternity').length}
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 relative z-10">
                                    {weekTimeOffRequests
                                        .filter(req => req.type !== 'vacation' && req.type !== 'sick_leave' && req.type !== 'maternity_paternity')
                                        .map(req => {
                                            const emp = storeEmployees.find(e => e.id === req.employeeId);
                                            const typeLabels: Record<string, string> = {
                                                morning_off: 'Mañana Off',
                                                afternoon_off: 'Tarde Off',
                                                day_off: 'Descanso',
                                                early_morning_shift: 'Entrada 9:00'
                                            };
                                            return (
                                                <div key={req.id} className="bg-blue-50/50 border border-blue-100 hover:border-blue-300 rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-default group">
                                                    <span className="font-semibold text-blue-900">{emp?.initials || emp?.name.substring(0, 2).toUpperCase()}</span>
                                                    <span className="text-blue-500">•</span>
                                                    <span className="text-blue-700">{typeLabels[req.type] || 'Solicitud'}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setIsAvailabilityModalOpen(true);
                                                        }}
                                                        className="ml-1 p-0.5 hover:bg-blue-200 rounded text-blue-500 hover:text-blue-700 transition-colors"
                                                    >
                                                        <Search size={12} />
                                                    </button>
                                                    {!isLocked && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRequestToDelete(req.id);
                                                                setIsConfirmDeleteRequestOpen(true);
                                                            }}
                                                            className="ml-0.5 p-0.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Temporary Hours Card (Ampliaciones) */}
                        {storeEmployees.some(emp => emp.tempHours?.some(t => currentWeekStart >= t.start && currentWeekStart <= t.end)) && (
                            <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <TrendingUp size={64} className="text-indigo-500" />
                                </div>
                                <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2 relative z-10">
                                    <div className="p-1 bg-indigo-100 rounded text-indigo-600"><TrendingUp size={14} /></div>
                                    Ampliaciones
                                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                                        {storeEmployees.filter(emp => emp.tempHours?.some(t => currentWeekStart >= t.start && currentWeekStart <= t.end)).length}
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 relative z-10">
                                    {storeEmployees
                                        .filter(emp => emp.tempHours?.some(t => currentWeekStart >= t.start && currentWeekStart <= t.end))
                                        .map(emp => {
                                            const activeAdj = emp.tempHours!.find(t => currentWeekStart >= t.start && currentWeekStart <= t.end)!;
                                            return (
                                                <div key={emp.id} className="bg-indigo-50/50 border border-indigo-100 hover:border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-default">
                                                    <span className="font-semibold text-indigo-900">{emp.initials || emp.name.substring(0, 2).toUpperCase()}</span>
                                                    <span className="text-indigo-500">•</span>
                                                    <span className="text-indigo-700">+{activeAdj.hours}h</span>
                                                    <button
                                                        onClick={() => setShowingExpDetails({
                                                            name: emp.name,
                                                            hours: activeAdj.hours,
                                                            start: activeAdj.start,
                                                            end: activeAdj.end
                                                        })}
                                                        className="ml-1 p-0.5 hover:bg-indigo-200 rounded text-indigo-500 hover:text-indigo-800 transition-colors"
                                                    >
                                                        <Search size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Expansion Details Modal */}
            <ConfirmDialog
                isOpen={!!showingExpDetails}
                title="Detalles de Ampliación"
                message={showingExpDetails ?
                    `Empleado: ${showingExpDetails.name}\nHoras Extra: +${showingExpDetails.hours}h/semanales\n\nPeriodo:\nDesde: ${new Date(showingExpDetails.start).toLocaleDateString()}\nHasta: ${new Date(showingExpDetails.end).toLocaleDateString()}`
                    : ''
                }
                confirmText="Cerrar"
                onConfirm={() => setShowingExpDetails(null)}
                onCancel={() => setShowingExpDetails(null)}
                cancelText=""
            />


            {/* Schedule Grid */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="grid grid-cols-[1.5fr_0.8fr_repeat(7,1fr)] border-b">
                    <div className="p-4 font-semibold text-gray-500 bg-gray-50 border-r">Empleado</div>
                    <div className="p-4 font-semibold text-center text-gray-500 bg-gray-50 border-r">Objetivo</div>
                    {weekDates.map(date => (
                        <div key={date} className={clsx("p-4 font-semibold text-center border-r last:border-r-0",
                            getSettings(user.establishmentId).holidays.some((h: any) => (typeof h === 'string' ? h : h.date) === date) ? 'bg-red-50 text-red-600' : 'text-gray-700'
                        )}>
                            {formatDate(date)}
                        </div>
                    ))}
                </div>

                {/* Daily Summary Bar */}
                {currentSchedule && (
                    <div className="grid grid-cols-[1.5fr_0.8fr_repeat(7,1fr)] border-b bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
                        <div className="p-3 text-[11px] font-extrabold text-indigo-900 border-r border-slate-200 flex items-center justify-end uppercase tracking-widest shadow-sm">
                            Resumen Horas
                        </div>
                        <div className="border-r border-slate-200 bg-slate-100/50"></div>
                        {weekDates.map(date => {
                            const shifts = currentSchedule.shifts.filter(s => s.date === date);
                            const getVal = (s: Shift, period: 'morning' | 'afternoon') => {
                                if (s.type === 'morning' && period === 'morning') {
                                    if (s.startTime && s.endTime) {
                                        return (parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60) - (parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60);
                                    }
                                    return 4;
                                }
                                if (s.type === 'afternoon' && period === 'afternoon') {
                                    if (s.startTime && s.endTime) {
                                        return (parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60) - (parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60);
                                    }
                                    return 4;
                                }
                                if (s.type === 'split') {
                                    if (s.startTime && s.endTime && s.morningEndTime && s.afternoonStartTime) {
                                        if (period === 'morning') return (parseInt(s.morningEndTime.split(':')[0]) + parseInt(s.morningEndTime.split(':')[1]) / 60) - (parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60);
                                        return (parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60) - (parseInt(s.afternoonStartTime.split(':')[0]) + parseInt(s.afternoonStartTime.split(':')[1]) / 60);
                                    }
                                    return 4;
                                }
                                return 0;
                            };

                            const morningHours = shifts.reduce((acc, s) => acc + getVal(s, 'morning'), 0);
                            const afternoonHours = shifts.reduce((acc, s) => acc + getVal(s, 'afternoon'), 0);
                            const total = Math.round((morningHours + afternoonHours) * 10) / 10;

                            return (
                                <div key={date} className="p-2 border-r border-slate-200 last:border-r-0 text-center flex flex-col items-center justify-center gap-1.5 relative group hover:bg-white transition-colors">
                                    <div className="font-bold text-slate-800 text-sm">{total}h</div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex flex-col items-center">
                                            <span
                                                title="Horas Mañana"
                                                className="bg-indigo-100/80 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-indigo-200 min-w-[24px]"
                                            >
                                                {Math.round(morningHours * 10) / 10}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span
                                                title="Horas Tarde"
                                                className="bg-orange-100/80 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-orange-200 min-w-[24px]"
                                            >
                                                {Math.round(afternoonHours * 10) / 10}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {storeEmployees.length > 0 ? (
                    storeEmployees.map(emp => (
                        <div key={emp.id} className="grid grid-cols-[1.5fr_0.8fr_repeat(7,1fr)] border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
                            <div className="p-4 border-r bg-white font-medium text-gray-900">
                                <div>{emp.name}</div>
                                <div className="text-xs text-gray-500">{emp.category}</div>
                                <div className="text-[10px] text-gray-400 mt-1">
                                    {emp.contractType === 'indefinido' ? 'Indefinido' :
                                        emp.contractEndDate ? `Fin: ${new Date(emp.contractEndDate).toLocaleDateString()}` : 'Temporal'}
                                </div>
                                <div className="text-[10px] text-indigo-600 font-bold mt-0.5">
                                    {(() => {
                                        const baseHours = emp.weeklyHours;
                                        const activeAdj = emp.tempHours?.find((t: any) => currentWeekStart >= t.start && currentWeekStart <= t.end);

                                        if (activeAdj && activeAdj.hours > 0) {
                                            return `${baseHours}h + ${activeAdj.hours}h Ampl.`;
                                        }
                                        return `${baseHours}h Contratadas`;
                                    })()}
                                </div>
                            </div>
                            {(() => {
                                const employeeShifts = currentSchedule?.shifts.filter(s => s.employeeId === emp.id) || [];
                                const workedHours = employeeShifts.reduce((acc, s) => {
                                    if (s.type === 'morning' || s.type === 'afternoon') {
                                        if (s.startTime && s.endTime) {
                                            const start = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                                            const end = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                                            return acc + (end - start);
                                        }
                                        return acc + 4;
                                    }
                                    if (s.type === 'split') {
                                        if (s.startTime && s.endTime && s.morningEndTime && s.afternoonStartTime) {
                                            const mStart = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                                            const mEnd = parseInt(s.morningEndTime.split(':')[0]) + parseInt(s.morningEndTime.split(':')[1]) / 60;
                                            const aStart = parseInt(s.afternoonStartTime.split(':')[0]) + parseInt(s.afternoonStartTime.split(':')[1]) / 60;
                                            const aEnd = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                                            return acc + (mEnd - mStart) + (aEnd - aStart);
                                        }
                                        return acc + 8;
                                    }
                                    return acc;
                                }, 0);

                                let targetHours = emp.weeklyHours;
                                if (emp.tempHours && emp.tempHours.length > 0) {
                                    const activeTemp = emp.tempHours.find((t: any) => {
                                        return currentWeekStart >= t.start && currentWeekStart <= t.end;
                                    });
                                    if (activeTemp) {
                                        targetHours = activeTemp.hours;
                                    }
                                }

                                const currentHolidays = getSettings(user.establishmentId).holidays;
                                const contractHours = targetHours;

                                let numDaysToReduce = 0;
                                weekDates.forEach(d => {
                                    const h = currentHolidays.find((holiday: any) => (typeof holiday === 'string' ? holiday : holiday.date) === d);
                                    const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');
                                    const isPartialHoliday = h && typeof h !== 'string' && (h.type === 'afternoon' || h.type === 'closed_afternoon');

                                    const isAbsence = timeOffRequests.some(r =>
                                        r.employeeId === emp.id &&
                                        (r.type === 'vacation' || r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                                        (r.dates.includes(d) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
                                    );

                                    if (isFullHoliday || isAbsence) {
                                        numDaysToReduce++;
                                    } else if (isPartialHoliday && contractHours === 40) {
                                        // EXCEPTION: 40h employees get 0.5 reduction for partial holidays
                                        numDaysToReduce += 0.5;
                                    }
                                });

                                const rReduction = Math.round(numDaysToReduce * 10) / 10;

                                const reductionTable: Record<number, number[]> = {
                                    40: [36, 32, 28, 24, 16],
                                    36: [33, 30, 27, 23, 18],
                                    32: [30, 27, 24, 21, 16],
                                    28: [25, 23, 21, 19, 14],
                                    24: [22, 20, 18, 16, 12],
                                    20: [18, 17, 15, 13, 10],
                                    16: [14, 13, 12, 10, 8]
                                };

                                const baseHours = targetHours;
                                if (rReduction > 0) {
                                    const tableRow = reductionTable[baseHours];
                                    if (tableRow) {
                                        if (rReduction === 0.5) targetHours = tableRow[0];
                                        else if (rReduction === 1) targetHours = tableRow[1];
                                        else if (rReduction === 1.5) targetHours = tableRow[2];
                                        else if (rReduction === 2) targetHours = tableRow[3];
                                        else if (rReduction === 3) targetHours = tableRow[4];
                                        else if (rReduction >= 5) {
                                            targetHours = 0;
                                        }
                                        else if (rReduction > 3) {
                                            targetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                                        }
                                    } else {
                                        targetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                                    }
                                }

                                const nonOffShifts = employeeShifts.filter(s => s.type !== 'off' && s.type !== 'holiday');
                                const isFullAbsence = nonOffShifts.length > 0 && nonOffShifts.every(s => s.type === 'vacation' || s.type === 'sick_leave' || s.type === 'maternity_paternity');
                                const rWorked = Math.round(workedHours * 10) / 10;
                                const rTarget = Math.round(targetHours * 10) / 10;
                                const color = isFullAbsence ? 'text-green-600' : rWorked < rTarget ? 'text-orange-600' : rWorked > rTarget ? 'text-blue-600' : 'text-green-600';

                                return (
                                    <div className="border-r border-slate-200 bg-slate-50/30 p-4 flex flex-col items-center justify-center gap-1">
                                        <div className="text-xs text-slate-500 font-medium">Semanal</div>
                                        <div className="text-lg font-bold text-slate-800">{targetHours}h</div>
                                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border ${color.replace('text-', 'bg-').replace('-600', '-100')} ${color} border-${color.split('-')[1]}-200 whitespace-nowrap`}>
                                            {isFullAbsence ? (nonOffShifts.some(s => s.type === 'sick_leave') ? 'Baja' : nonOffShifts.some(s => s.type === 'maternity_paternity') ? 'Paternidad' : 'Vacaciones') : `${workedHours.toFixed(1)}h / ${targetHours}h`}
                                        </div>
                                    </div>
                                );
                            })()}
                            {weekDates.map(date => {
                                // Find shift for this employee and date
                                const shift = currentSchedule?.shifts.find(s => s.employeeId === emp.id && s.date === date);


                                // Render Shift Cell
                                return (
                                    <div key={date} className="border-r last:border-r-0 p-1 h-32 relative group">
                                        {shift ? (
                                            <div className={clsx(
                                                "h-full w-full rounded border-l-4 shadow-sm transition-all flex flex-col overflow-hidden",
                                                !isLocked && "hover:shadow-md",
                                                shift.type === 'morning' ? "bg-blue-50 border-blue-500 text-blue-900" :
                                                    shift.type === 'afternoon' ? "bg-orange-50 border-orange-500 text-orange-900" :
                                                        shift.type === 'split' ? "bg-purple-50 border-purple-500 text-purple-900" :
                                                            shift.type === 'off' ? "bg-slate-100 border-slate-300 text-slate-500" :
                                                                shift.type === 'vacation' ? "bg-emerald-50 border-emerald-500 text-emerald-700" :
                                                                    shift.type === 'sick_leave' ? "bg-red-50 border-red-500 text-red-700" :
                                                                        shift.type === 'maternity_paternity' ? "bg-pink-50 border-pink-500 text-pink-700" :
                                                                            "bg-amber-50 border-amber-300 text-amber-700"
                                            )}>
                                                {/* Header: Type & Role */}
                                                <div className="flex justify-between items-start p-1.5 pb-0 min-h-[1.5rem] bg-black/5">
                                                    {/* Shift Type Selector */}
                                                    {/* Shift Type Selector - Hidden for Vacation/Holiday/Sick */}
                                                    {(!['vacation', 'holiday', 'sick_leave', 'maternity_paternity'].includes(shift.type)) && (
                                                        <div className="relative z-10">
                                                            <select
                                                                className={clsx(
                                                                    "appearance-none bg-transparent font-bold text-[10px] uppercase tracking-wide outline-none cursor-pointer pr-3",
                                                                    isLocked && "cursor-not-allowed pointer-events-none"
                                                                )}
                                                                value={shift.type}
                                                                onChange={(e) => {
                                                                    if (currentSchedule && !isLocked) {
                                                                        const newType = e.target.value as ShiftType;
                                                                        const settings = getSettings(user.establishmentId);
                                                                        let updates: any = { type: newType, role: undefined };

                                                                        // Reset hours based on type
                                                                        if (newType === 'morning') {
                                                                            updates.startTime = settings.openingHours.morningStart;
                                                                            updates.endTime = settings.openingHours.morningEnd;
                                                                            updates.morningEndTime = undefined;
                                                                            updates.afternoonStartTime = undefined;
                                                                        } else if (newType === 'afternoon') {
                                                                            updates.startTime = settings.openingHours.afternoonStart;
                                                                            updates.endTime = settings.openingHours.afternoonEnd;
                                                                            updates.morningEndTime = undefined;
                                                                            updates.afternoonStartTime = undefined;
                                                                        } else if (newType === 'split') {
                                                                            updates.startTime = settings.openingHours.morningStart;
                                                                            updates.morningEndTime = settings.openingHours.morningEnd;
                                                                            updates.afternoonStartTime = settings.openingHours.afternoonStart;
                                                                            updates.endTime = settings.openingHours.afternoonEnd;
                                                                        } else {
                                                                            updates.startTime = undefined;
                                                                            updates.endTime = undefined;
                                                                            updates.morningEndTime = undefined;
                                                                            updates.afternoonStartTime = undefined;
                                                                        }

                                                                        updateShift(currentSchedule.id, shift.id, updates);
                                                                    }
                                                                }}
                                                                disabled={isLocked}
                                                            >
                                                                <option value="morning">MAÑANA</option>
                                                                <option value="afternoon">TARDE</option>
                                                                <option value="split">PARTIDO</option>
                                                                <option value="off">DESCANSO</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* Role Selector (Working Shifts Only) */}
                                                    {(shift.type === 'morning' || shift.type === 'afternoon' || shift.type === 'split') && (
                                                        <div className="relative z-10 w-20">
                                                            <select
                                                                className={clsx(
                                                                    "appearance-none bg-transparent font-bold text-[9px] text-right outline-none cursor-pointer w-full hover:text-blue-600",
                                                                    !shift.role ? "text-slate-400 opacity-50" : "text-blue-600",
                                                                    isLocked && "cursor-not-allowed pointer-events-none"
                                                                )}
                                                                value={shift.role || ''}
                                                                onChange={(e) => {
                                                                    if (currentSchedule && !isLocked) {
                                                                        const newRole = e.target.value as WorkRole || undefined;
                                                                        const settings = getSettings(user.establishmentId);

                                                                        // Use type assertion if access fails or ensure types are correct. WorkRole matches keys.
                                                                        const roleConfig = newRole ? settings.roleSchedules?.[newRole] : undefined;
                                                                        let updates: any = { role: newRole };

                                                                        if (roleConfig) {
                                                                            if (shift.type === 'morning') {
                                                                                updates.startTime = roleConfig.startTime || settings.openingHours.morningStart;
                                                                                updates.endTime = (roleConfig.type === 'split' ? roleConfig.morningEndTime : roleConfig.endTime) || settings.openingHours.morningEnd;
                                                                            } else if (shift.type === 'afternoon') {
                                                                                updates.startTime = (roleConfig.type === 'split' ? roleConfig.afternoonStartTime : roleConfig.startTime) || settings.openingHours.afternoonStart;
                                                                                updates.endTime = roleConfig.endTime || settings.openingHours.afternoonEnd;
                                                                            } else if (shift.type === 'split') {
                                                                                if (roleConfig.type === 'morning' || roleConfig.type === 'split') {
                                                                                    updates.startTime = roleConfig.startTime || settings.openingHours.morningStart;
                                                                                    updates.morningEndTime = (roleConfig.type === 'split' ? roleConfig.morningEndTime : roleConfig.endTime) || settings.openingHours.morningEnd;
                                                                                }
                                                                                if (roleConfig.type === 'afternoon' || roleConfig.type === 'split') {
                                                                                    updates.afternoonStartTime = (roleConfig.type === 'split' ? roleConfig.afternoonStartTime : roleConfig.startTime) || settings.openingHours.afternoonStart;
                                                                                    updates.endTime = roleConfig.endTime || settings.openingHours.afternoonEnd;
                                                                                }
                                                                            }
                                                                        }

                                                                        updateShift(currentSchedule.id, shift.id, updates);
                                                                    }
                                                                }}
                                                                disabled={isLocked}
                                                            >
                                                                <option value="">+ Puesto</option>
                                                                <option value="sales_register">Caja Ventas</option>
                                                                <option value="purchase_register">Caja Compras</option>
                                                                <option value="shuttle">Lanzadera</option>
                                                                <option value="cleaning">Limpieza</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* RI Button */}
                                                    {(shift.type === 'morning' || shift.type === 'afternoon' || shift.type === 'split') && (
                                                        <button
                                                            onClick={() => {
                                                                if (!isLocked && currentSchedule) {
                                                                    const newIsRI = !shift.isIndividualMeeting;
                                                                    const settingTime = getSettings(user.establishmentId).individualMeetingStartTime;
                                                                    const updates: any = { isIndividualMeeting: newIsRI };

                                                                    if (newIsRI && settingTime) {
                                                                        updates.startTime = settingTime;
                                                                    } else if (newIsRI && !settingTime) {
                                                                        alert("Por favor configure la hora de Reunión Individual (RI) en la configuración de la tienda primero.");
                                                                        return;
                                                                    }

                                                                    updateShift(currentSchedule.id, shift.id, updates);
                                                                }
                                                            }}
                                                            className={clsx(
                                                                "h-4 px-1 rounded text-[8px] font-black tracking-tighter uppercase transition-colors ml-1 flex items-center justify-center border",
                                                                shift.isIndividualMeeting
                                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                                    : "bg-white/40 text-indigo-400 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                                                            )}
                                                            title={getSettings(user.establishmentId).individualMeetingStartTime ? `Reunión Individual (Entrada: ${getSettings(user.establishmentId).individualMeetingStartTime})` : "Configure hora RI en Ajustes"}
                                                            disabled={isLocked}
                                                        >
                                                            RI
                                                        </button>
                                                    )}






                                                </div>
                                                {/* Shift Content Visualization */}
                                                {(shift.type === 'morning' || shift.type === 'afternoon' || shift.type === 'split') ? (
                                                    <div className="flex flex-col flex-grow justify-center mt-auto pb-1">
                                                        <div className="text-center mb-1">
                                                            <span className="text-[10px] font-medium opacity-90 border border-current px-1.5 py-0.5 rounded shadow-sm bg-white/40 inline-block scale-90 origin-center">
                                                                {calculateShiftDuration(shift, settings)}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col gap-1 items-center">
                                                            {shift.type === 'split' ? (
                                                                <>
                                                                    <div className="flex items-center gap-0.5">
                                                                        <input type="time" value={shift.startTime || '10:00'} disabled={isLocked} onChange={(e) => !isLocked && updateShift(currentSchedule?.id!, shift.id, { startTime: e.target.value })} className="w-[4rem] text-[9px] p-0.5 rounded border border-purple-200 bg-white/70 text-center leading-3 outline-none focus:ring-1 focus:ring-purple-500" />
                                                                        <span className="text-[8px] text-purple-400">-</span>
                                                                        <input type="time" value={shift.morningEndTime || getSettings(user.establishmentId).openingHours.morningEnd} disabled={isLocked} onChange={(e) => !isLocked && updateShift(currentSchedule?.id!, shift.id, { morningEndTime: e.target.value })} className="w-[4rem] text-[9px] p-0.5 rounded border border-purple-200 bg-white/70 text-center leading-3 outline-none focus:ring-1 focus:ring-purple-500" />
                                                                    </div>
                                                                    <div className="flex items-center gap-0.5">
                                                                        <input type="time" value={shift.afternoonStartTime || getSettings(user.establishmentId).openingHours.afternoonStart} disabled={isLocked} onChange={(e) => !isLocked && updateShift(currentSchedule?.id!, shift.id, { afternoonStartTime: e.target.value })} className="w-[4rem] text-[9px] p-0.5 rounded border border-purple-200 bg-white/70 text-center leading-3 outline-none focus:ring-1 focus:ring-purple-500" />
                                                                        <span className="text-[8px] text-purple-400">-</span>
                                                                        <input type="time" value={shift.endTime || '20:30'} disabled={isLocked} onChange={(e) => !isLocked && updateShift(currentSchedule?.id!, shift.id, { endTime: e.target.value })} className="w-[4rem] text-[9px] p-0.5 rounded border border-purple-200 bg-white/70 text-center leading-3 outline-none focus:ring-1 focus:ring-purple-500" />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center gap-0.5">
                                                                    <input type="time" value={shift.startTime || (shift.type === 'morning' ? '10:00' : '16:30')} disabled={isLocked} onChange={(e) => !isLocked && updateShift(currentSchedule?.id!, shift.id, { startTime: e.target.value })} className={clsx("w-[4rem] text-[9px] p-0.5 rounded border bg-white/70 text-center leading-3 outline-none focus:ring-1", shift.type === 'morning' ? "border-blue-200 focus:ring-blue-500" : "border-orange-200 focus:ring-orange-500")} />
                                                                    <span className="text-[8px] opacity-50">-</span>
                                                                    <input type="time" value={shift.endTime || (shift.type === 'morning' ? '14:00' : '20:30')} disabled={isLocked} onChange={(e) => !isLocked && updateShift(currentSchedule?.id!, shift.id, { endTime: e.target.value })} className={clsx("w-[4rem] text-[9px] p-0.5 rounded border bg-white/70 text-center leading-3 outline-none focus:ring-1", shift.type === 'morning' ? "border-blue-200 focus:ring-blue-500" : "border-orange-200 focus:ring-orange-500")} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full opacity-60">
                                                        <span className="font-bold uppercase text-[10px] tracking-wider text-center px-1">
                                                            {shift.type === 'off' ? 'Descanso' : shift.type === 'vacation' ? 'Vacaciones' : shift.type === 'holiday' ? 'Festivo' : shift.type === 'maternity_paternity' ? 'Paternidad' : 'Baja'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-gray-300 text-xs">-</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        No hay empleados. Añade empleados en la sección "Empleados" o espera a que se generen datos de prueba.
                    </div>
                )}
            </div >

            {/* Availability Modal */}
            {/* Availability Modal */}
            {
                isAvailabilityModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Calendar size={24} />
                                        <span>Solicitudes y Restricciones</span>
                                    </h2>
                                    <p className="text-blue-100 text-sm mt-1">
                                        Resumen de la semana {weekDates[0].split('-').reverse().slice(0, 2).join('/')} - {weekDates[6].split('-').reverse().slice(0, 2).join('/')}
                                    </p>
                                </div>
                                <button onClick={() => setIsAvailabilityModalOpen(false)} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-0 overflow-y-auto flex-1 bg-slate-50">
                                <div className="p-6 space-y-8">
                                    {/* Section 1: Absences & Requests */}
                                    {/* Section 1: Absences & Requests */}
                                    <section>
                                        <h3 className="flex items-center gap-2 text-sm font-bold text-teal-600 uppercase tracking-wider mb-4 border-b border-teal-100 pb-2">
                                            <Plane size={16} /> Vacaciones
                                        </h3>
                                        <div className="space-y-2">
                                            {(() => {
                                                const relevantRequests = timeOffRequests
                                                    .filter(r => storeEmployees.some(e => e.id === r.employeeId))
                                                    .filter(r => r.type === 'vacation')
                                                    .filter(r => {
                                                        // Check direct dates
                                                        if (r.dates && r.dates.some(d => weekDates.includes(d))) return true;
                                                        // Check ranges (for long sick leaves)
                                                        if (r.startDate && r.endDate) {
                                                            const start = new Date(r.startDate);
                                                            const end = new Date(r.endDate);
                                                            const weekStart = new Date(weekDates[0]);
                                                            const weekEnd = new Date(weekDates[6]);
                                                            // Check overlap
                                                            return start <= weekEnd && end >= weekStart;
                                                        }
                                                        return false;
                                                    })
                                                    .sort((a, b) => (a.dates?.[0] || a.startDate || '').localeCompare(b.dates?.[0] || b.startDate || ''));

                                                if (relevantRequests.length === 0) {
                                                    return <div className="text-sm text-slate-400 italic text-center py-4 bg-white rounded-xl border border-dashed border-slate-200">No hay vacaciones programadas para esta semana.</div>;
                                                }

                                                return relevantRequests.map(req => {
                                                    const emp = employees.find(e => e.id === req.employeeId);
                                                    const typeLabels: Record<string, { label: string, color: string, icon: any }> = {
                                                        'sick_leave': { label: 'Baja Médica', color: 'bg-red-50 text-red-700 border-red-100', icon: Activity },
                                                        'vacation': { label: 'Vacaciones', color: 'bg-teal-50 text-teal-700 border-teal-100', icon: Plane },
                                                        'day_off': { label: 'Día Libre', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Calendar },
                                                        'morning_off': { label: 'Mañana Libre', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: Sun },
                                                        'afternoon_off': { label: 'Tarde Libre', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: Moon },
                                                        'early_morning_shift': { label: 'Entrada 9:00', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
                                                    };
                                                    const config = typeLabels[req.type] || typeLabels['day_off'];
                                                    const Icon = config.icon || Calendar;

                                                    // Determine text to show
                                                    let dateText = '';
                                                    if (req.startDate && req.endDate) {
                                                        // It's a range/long term
                                                        // Check if it covers the whole week
                                                        const start = new Date(req.startDate);
                                                        const end = new Date(req.endDate);
                                                        const weekStart = new Date(weekDates[0]);
                                                        const weekEnd = new Date(weekDates[6]);

                                                        if (start <= weekStart && end >= weekEnd) {
                                                            dateText = 'Semana Completa';
                                                        } else {
                                                            // Partial overlap, show dates
                                                            const visibleDates = weekDates.filter(d => {
                                                                const current = new Date(d);
                                                                return current >= start && current <= end;
                                                            });
                                                            dateText = visibleDates.map(d => {
                                                                const [, m, day] = d.split('-');
                                                                return `${day}/${m}`;
                                                            }).join(', ');
                                                        }
                                                    } else {
                                                        // List of dates
                                                        const matchingDates = req.dates.filter(d => weekDates.includes(d));
                                                        if (matchingDates.length === 7) {
                                                            dateText = 'Semana Completa';
                                                        } else {
                                                            dateText = matchingDates.map(d => {
                                                                const [, m, day] = d.split('-');
                                                                return `${day}/${m}`;
                                                            }).join(', ');
                                                        }
                                                    }

                                                    return (
                                                        <div key={req.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                                                                    <Icon size={18} />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-800 text-sm">{emp?.name}</div>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.color.replace('border-', 'border ')}`}>
                                                                        {config.label}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs text-slate-500 font-medium max-w-[150px] truncate text-right">
                                                                    {dateText}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </section>

                                    {/* Section 2: Bajas Médicas & Maternidad */}
                                    <section>
                                        <h3 className="flex items-center gap-2 text-sm font-bold text-red-600 uppercase tracking-wider mb-4 border-b border-red-100 pb-2">
                                            <Activity size={16} /> Bajas y Maternidad
                                        </h3>
                                        <div className="space-y-2">
                                            {(() => {
                                                const sickLeaves = timeOffRequests
                                                    .filter(r => storeEmployees.some(e => e.id === r.employeeId))
                                                    .filter(r => r.type === 'sick_leave' || r.type === 'maternity_paternity')
                                                    .filter(r => {
                                                        if (r.dates && r.dates.some(d => weekDates.includes(d))) return true;
                                                        if (r.startDate && r.endDate) {
                                                            return r.startDate <= weekDates[6] && r.endDate >= weekDates[0];
                                                        }
                                                        return false;
                                                    })
                                                    .sort((a, b) => (a.dates?.[0] || a.startDate || '').localeCompare(b.dates?.[0] || b.startDate || ''));

                                                if (sickLeaves.length === 0) {
                                                    return <div className="text-xs text-slate-400 italic py-2">No hay bajas ni permisos de maternidad activos.</div>;
                                                }

                                                return sickLeaves.map(req => {
                                                    const emp = employees.find(e => e.id === req.employeeId);
                                                    const isMater = req.type === 'maternity_paternity';

                                                    let dateText = '';
                                                    if (req.startDate && req.endDate) {
                                                        const start = new Date(req.startDate);
                                                        const end = new Date(req.endDate);
                                                        const weekStart = new Date(weekDates[0]);
                                                        const weekEnd = new Date(weekDates[6]);

                                                        if (start <= weekStart && end >= weekEnd) {
                                                            dateText = 'Semana Completa';
                                                        } else {
                                                            const visibleDates = weekDates.filter(d => {
                                                                const current = new Date(d);
                                                                return current >= start && current <= end;
                                                            });
                                                            dateText = visibleDates.map(d => {
                                                                const [, m, day] = d.split('-');
                                                                return `${day}/${m}`;
                                                            }).join(', ');
                                                        }
                                                    } else {
                                                        const matchingDates = req.dates.filter(d => weekDates.includes(d));
                                                        if (matchingDates.length === 7) {
                                                            dateText = 'Semana Completa';
                                                        } else {
                                                            dateText = matchingDates.map(d => {
                                                                const [, m, day] = d.split('-');
                                                                return `${day}/${m}`;
                                                            }).join(', ');
                                                        }
                                                    }

                                                    return (
                                                        <div key={req.id} className={`${isMater ? 'bg-pink-50/50 border-pink-100' : 'bg-red-50/50 border-red-100'} p-3 rounded-xl border shadow-sm flex items-center justify-between`}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isMater ? 'bg-pink-100 text-pink-700' : 'bg-red-100 text-red-700'}`}>
                                                                    <Activity size={14} />
                                                                </div>
                                                                <div className="font-bold text-slate-800 text-sm">{emp?.name}</div>
                                                                {isMater && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">Maternidad</span>}
                                                            </div>
                                                            <div className={`text-right text-xs ${isMater ? 'text-pink-700' : 'text-red-700'} font-medium`}>
                                                                {dateText}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </section>

                                    {/* Section 3: Solicitudes de Disponibilidad (Days Off) */}
                                    <section>
                                        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                                            <Calendar size={16} /> Solicitudes de Disponibilidad
                                        </h3>

                                        {!isLocked && (
                                            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Añadir Nueva Solicitud</h4>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-700 mb-1">Empleado</label>
                                                        <select
                                                            value={selectedEmployeeForRequest}
                                                            onChange={(e) => setSelectedEmployeeForRequest(e.target.value)}
                                                            className="w-full text-sm rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                                                        >
                                                            <option value="">Seleccionar empleado...</option>
                                                            {storeEmployees.map(emp => (
                                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de Solicitud</label>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setRequestType('day_off')}
                                                                className={clsx("flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                                                                    requestType === 'day_off'
                                                                        ? "bg-slate-800 text-white border-slate-800"
                                                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                                                )}
                                                            >
                                                                Descanso Completo
                                                            </button>
                                                            <button
                                                                onClick={() => setRequestType('morning_off')}
                                                                className={clsx("flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                                                                    requestType === 'morning_off'
                                                                        ? "bg-orange-600 text-white border-orange-600"
                                                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                                                )}
                                                            >
                                                                Mañana Libre
                                                            </button>
                                                            <button
                                                                onClick={() => setRequestType('afternoon_off')}
                                                                className={clsx("flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                                                                    requestType === 'afternoon_off'
                                                                        ? "bg-purple-600 text-white border-purple-600"
                                                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                                                )}
                                                            >
                                                                Tarde Libre
                                                            </button>
                                                            <button
                                                                onClick={() => setRequestType('early_morning_shift')}
                                                                className={clsx("flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                                                                    requestType === 'early_morning_shift'
                                                                        ? "bg-amber-600 text-white border-amber-600"
                                                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                                                )}
                                                            >
                                                                9:00 - 14:00
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-700 mb-1">Días</label>
                                                        <div className="flex gap-1">
                                                            {weekDates.map(date => {
                                                                const dayName = new Date(date).toLocaleDateString('es-ES', { weekday: 'narrow' });
                                                                const dayNum = date.split('-')[2];
                                                                const isSelected = selectedDatesForRequest.includes(date);
                                                                return (
                                                                    <button
                                                                        key={date}
                                                                        onClick={() => toggleRequestDate(date)}
                                                                        className={clsx("flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                                                                            isSelected
                                                                                ? "bg-indigo-600 text-white shadow-sm"
                                                                                : "bg-white border border-slate-200 text-slate-500 hover:border-indigo-300"
                                                                        )}
                                                                    >
                                                                        <div className="opacity-70 text-[9px] uppercase">{dayName}</div>
                                                                        <div>{dayNum}</div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={handleSaveRequest}
                                                        disabled={!selectedEmployeeForRequest || selectedDatesForRequest.length === 0}
                                                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                    >
                                                        Añadir Solicitud
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            {(() => {
                                                const requests = timeOffRequests
                                                    .filter(r => storeEmployees.some(e => e.id === r.employeeId))
                                                    .filter(r => ['day_off', 'morning_off', 'afternoon_off'].includes(r.type))
                                                    .filter(r => {
                                                        if (r.dates && r.dates.some(d => weekDates.includes(d))) return true;
                                                        return false;
                                                    })
                                                    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));

                                                if (requests.length === 0) {
                                                    return <div className="text-xs text-slate-400 italic py-2">No hay otras solicitudes de disponibilidad.</div>;
                                                }

                                                return requests.map(req => {
                                                    const emp = employees.find(e => e.id === req.employeeId);
                                                    const typeLabels: Record<string, { label: string, color: string, icon: any }> = {
                                                        'day_off': { label: 'Día Libre', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Calendar },
                                                        'morning_off': { label: 'Mañana Libre', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: Sun },
                                                        'afternoon_off': { label: 'Tarde Libre', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: Moon },
                                                        'early_morning_shift': { label: 'Entrada 9:00', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
                                                    };
                                                    const config = typeLabels[req.type];
                                                    const Icon = config.icon;

                                                    const matchingDates = req.dates.filter(d => weekDates.includes(d));

                                                    let dateText = '';
                                                    if (matchingDates.length === 7) {
                                                        dateText = 'Semana Completa';
                                                    } else {
                                                        dateText = matchingDates.map(d => {
                                                            const [, m, day] = d.split('-');
                                                            return `${day}/${m}`;
                                                        }).join(', ');
                                                    }

                                                    return (
                                                        <div key={req.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${config.color.split(' ')[0]} ${config.color.split(' ')[1]}`}>
                                                                    <Icon size={14} />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-800 text-sm">{emp?.name}</div>
                                                                    <div className="text-[10px] opacity-70 font-semibold uppercase">{config.label}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-right text-xs text-slate-500 font-medium max-w-[120px] text-right">
                                                                    {dateText}
                                                                </div>
                                                                {!isLocked && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setRequestToDelete(req.id);
                                                                            setIsConfirmDeleteRequestOpen(true);
                                                                        }}
                                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                        title="Eliminar solicitud"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </section>

                                    {/* Section 2: Permanent Restrictions */}
                                    <section>
                                        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                                            <ShieldAlert size={16} /> Restricciones Permanentes
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {(() => {
                                                const activePerms = permanentRequests.filter(r => storeEmployees.some(e => e.id === r.employeeId));

                                                if (activePerms.length === 0) {
                                                    return <div className="col-span-full text-sm text-slate-400 italic text-center py-4 bg-white rounded-xl border border-dashed border-slate-200">No hay restricciones permanentes activas.</div>;
                                                }

                                                return activePerms.map(perm => {
                                                    const emp = employees.find(e => e.id === perm.employeeId);
                                                    const getLabel = () => {
                                                        switch (perm.type) {
                                                            case 'morning_only': return 'Solo Mañanas';
                                                            case 'afternoon_only': return 'Solo Tardes';
                                                            case 'force_full_days': return 'Descanso en Días Completos';
                                                            case 'early_morning_shift': return 'Entrada 9:00 (9-14h)';
                                                            case 'specific_days_off':
                                                                const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                                                                return `Libres: ${perm.days?.map(d => days[d]).join(', ')}`;
                                                            case 'max_afternoons_per_week': return `Máx. ${perm.value} Tardes/Semana`;
                                                            case 'rotating_days_off': return 'Días Rotativos (Ciclos)';
                                                            default: return perm.type;
                                                        }
                                                    };

                                                    return (
                                                        <div key={perm.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                                            <div>
                                                                <div className="font-bold text-slate-800 text-sm">{emp?.name}</div>
                                                                <div className="text-xs text-indigo-600 font-medium mt-0.5">{getLabel()}</div>
                                                            </div>
                                                            {perm.exceptions && perm.exceptions.includes(currentWeekStart) && (
                                                                <div className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded font-bold">
                                                                    Desactivada esta semana
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </section>
                                </div>
                            </div>

                            <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setIsAvailabilityModalOpen(false)}
                                    className="px-6 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div >
                )
            }

            {/* Shift Edit Modal */}
            {
                isShiftModalOpen && editingShift && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Editar Turno</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Turno</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-2"
                                        value={editShiftType}
                                        onChange={(e) => setEditShiftType(e.target.value as ShiftType)}
                                    >
                                        <option value="morning">Mañana</option>
                                        <option value="afternoon">Tarde</option>
                                        <option value="split">Partido</option>
                                        <option value="off">Libre / Descanso</option>


                                        <option value="holiday">Festivo</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Entrada</label>
                                        <input
                                            type="time"
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                            value={editStartTime}
                                            onChange={(e) => setEditStartTime(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Salida</label>
                                        <input
                                            type="time"
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                            value={editEndTime}
                                            onChange={(e) => setEditEndTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            {editShiftType === 'split' && (
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Fin Mañana</label>
                                        <input
                                            type="time"
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                            value={editMorningEnd}
                                            onChange={(e) => setEditMorningEnd(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Inicio Tarde</label>
                                        <input
                                            type="time"
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                            value={editAfternoonStart}
                                            onChange={(e) => setEditAfternoonStart(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsShiftModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        if (currentSchedule && editingShift) {
                                            updateShift(currentSchedule.id, editingShift.id, {
                                                type: editShiftType,
                                                startTime: editStartTime,
                                                endTime: editEndTime,
                                                morningEndTime: editShiftType === 'split' ? editMorningEnd : undefined,
                                                afternoonStartTime: editShiftType === 'split' ? editAfternoonStart : undefined
                                            });
                                            setIsShiftModalOpen(false);
                                        }
                                    }}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Loading Overlay */}
            {
                isGenerating && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
                        <div className="bg-white rounded-2xl p-8 flex flex-col items-center shadow-2xl animate-in fade-in zoom-in duration-300">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                                <Loader2 size={48} className="text-indigo-600 animate-spin relative z-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-2">
                                {currentSchedule ? 'Analizando Horario' : 'Generando Horario Óptimo'}
                            </h3>
                            <p className="text-gray-500 text-center max-w-[250px] leading-relaxed">
                                {currentSchedule
                                    ? 'Verificando restricciones y calculando deuda horaria...'
                                    : 'Analizando disponibilidad, rotaciones y preferencias...'}
                            </p>
                        </div>
                    </div>
                )
            }

            <StoreConfigModal
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                establishmentId="1"
                onSave={(newSettings) => {
                    updateSettings(newSettings);
                }}
            />

            <ConfirmDialog
                isOpen={isConfirmRegenerateOpen}
                title="Regenerar Horario"
                message="¿Estás seguro de que quieres regenerar el horario? Se perderán todos los cambios manuales que hayas realizado en esta semana."
                confirmText="Sí, regenerar"
                cancelText="Cancelar"
                onConfirm={handleConfirmRegenerate}
                onCancel={() => setIsConfirmRegenerateOpen(false)}
                isDestructive={true}
            />

            <ConfirmDialog
                isOpen={isConfirmDeletePermOpen}
                title="Confirmación de Gerente Requerida"
                message="¿Estás seguro de eliminar esta restricción permanentemente? Esta acción requiere autorización del gerente."
                confirmText="Eliminar Permanentemente"
                cancelText="Cancelar"
                onConfirm={() => {
                    if (editingPermanentRequest) {
                        removePermanentRequest(editingPermanentRequest.id);
                        setEditingPermanentRequest(null);
                        showToast('Restricción eliminada permanentemente', 'success');
                    }
                    setIsConfirmDeletePermOpen(false);
                }}
                onCancel={() => setIsConfirmDeletePermOpen(false)}
                isDestructive={true}
            />

            {/* Custom Publish Warning Dialog */}
            {
                showLowHoursDialog && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[85vh]">
                            {/* Header */}
                            <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                                    {dialogMode === 'publish'
                                        ? <ShieldAlert className="text-orange-500" size={24} />
                                        : <AlertTriangle className="text-amber-500" size={24} />
                                    }
                                    <span className="tracking-tight">Informe de Validación del Horario</span>
                                </h3>
                                <button
                                    onClick={() => setShowLowHoursDialog(false)}
                                    className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">

                                {/* Summary Text */}
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {dialogMode === 'publish'
                                        ? "Hemos analizado el horario antes de publicar. Por favor, revisa los siguientes puntos críticos:"
                                        : "El horario generado presenta las siguientes alertas que requieren tu atención:"}
                                </p>

                                {/* Section: Strict Violations */}
                                {pendingStrictWarnings.some(w => !w.startsWith('Baja Cobertura')) && (
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-sm">
                                        <h4 className="flex items-center gap-2 text-red-800 font-bold text-sm mb-3 uppercase tracking-wide">
                                            <ShieldAlert size={16} /> Violaciones de Restricciones
                                        </h4>
                                        <ul className="space-y-2.5">
                                            {pendingStrictWarnings.filter(w => !w.startsWith('Baja Cobertura')).map((w, idx) => (
                                                <li key={idx} className="flex gap-3 text-red-700 text-sm bg-white/60 p-2.5 rounded-lg border border-red-100/50">
                                                    <div className="min-w-[4px] w-1 bg-red-400 rounded-full mt-1 h-auto self-stretch"></div>
                                                    <span className="leading-relaxed">{w.replace('Restricción Violada:', '')}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Section: Coverage Warnings */}
                                {pendingStrictWarnings.some(w => w.startsWith('Baja Cobertura')) && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 shadow-sm">
                                        <h4 className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-3 uppercase tracking-wide">
                                            <TrendingDown size={16} /> Alertas de Baja Cobertura
                                        </h4>
                                        <ul className="space-y-2">
                                            {pendingStrictWarnings.filter(w => w.startsWith('Baja Cobertura')).map((w, idx) => (
                                                <li key={idx} className="flex gap-2.5 text-amber-800 text-sm items-start">
                                                    <AlertTriangle size={14} className="mt-0.5 shrink-0 opacity-70" />
                                                    <span>{w.replace('Baja Cobertura:', '')}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Section: Debt Adjustments (Collapsible-ish feel but always open for now) */}
                                {pendingDebtAdjustments.length > 0 && (
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl overflow-hidden shadow-sm">
                                        <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                            <h4 className="flex items-center gap-2 text-blue-900 font-bold text-sm uppercase tracking-wide">
                                                <Clock size={16} /> Ajustes de Deuda Horaria
                                            </h4>
                                            <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                                                {pendingDebtAdjustments.length} Empleados
                                            </span>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-white text-slate-500 font-medium text-xs sticky top-0 shadow-sm z-10">
                                                    <tr>
                                                        <th className="px-4 py-2.5 font-semibold">Empleado</th>
                                                        <th className="px-4 py-2.5 text-center">Objetivo</th>
                                                        <th className="px-4 py-2.5 text-center">Real</th>
                                                        <th className="px-4 py-2.5 text-right">Diferencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-blue-100/50 bg-white/50">
                                                    {pendingDebtAdjustments.map((adj) => (
                                                        <tr key={adj.empId} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="px-4 py-2 font-medium text-slate-700">{adj.name}</td>
                                                            <td className="px-4 py-2 text-center text-slate-500 text-xs">{adj.contract}h</td>
                                                            <td className="px-4 py-2 text-center text-slate-500 text-xs">{adj.worked}h</td>
                                                            <td className="px-4 py-2 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span className={clsx("text-xs font-bold", adj.amount > 0 ? "text-green-600" : "text-red-600")}>
                                                                        {adj.amount > 0 ? "+" : ""}
                                                                    </span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.1"
                                                                        className={clsx(
                                                                            "w-20 text-right px-2 py-1 bg-white border rounded-lg text-xs font-bold focus:ring-2 outline-none transition-all shadow-sm",
                                                                            adj.amount > 0
                                                                                ? "border-green-200 focus:ring-green-500 text-green-700"
                                                                                : adj.amount < 0
                                                                                    ? "border-red-200 focus:ring-red-500 text-red-700"
                                                                                    : "border-gray-200 focus:ring-gray-400 text-gray-600"
                                                                        )}
                                                                        value={adj.amount}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value);
                                                                            setPendingDebtAdjustments(prev => prev.map(a => a.empId === adj.empId ? { ...a, amount: isNaN(val) ? 0 : val } : a));
                                                                        }}
                                                                    />
                                                                    <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">h</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="p-3 bg-blue-50/30 text-xs text-blue-600/80 italic text-center border-t border-blue-100">
                                            * Estas diferencias se registrarán automáticamente en el saldo de deuda de cada empleado.
                                        </div>
                                    </div>
                                )}

                                {/* Empty State / Success */}
                                {pendingStrictWarnings.length === 0 && pendingDebtAdjustments.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                                            <CheckCircle size={32} className="text-green-600" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-800">¡Todo parece correcto!</h4>
                                        <p className="text-slate-500 max-w-xs mx-auto">El horario cumple con todas las restricciones y no hay ajustes de horas pendientes.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                                {dialogMode === 'publish' ? (
                                    <>
                                        <button
                                            onClick={() => setShowLowHoursDialog(false)}
                                            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all border border-transparent hover:border-slate-300 flex items-center gap-2"
                                        >
                                            Revisar y Modificar
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (dialogMode === 'publish') {
                                                    confirmPublish();
                                                } else {
                                                    setShowLowHoursDialog(false);
                                                }
                                            }}
                                            className={clsx(
                                                "px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg shadow-indigo-200 transition-all transform active:scale-95 flex items-center gap-2",
                                                pendingStrictWarnings.length > 0
                                                    ? "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-200"
                                                    : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                                            )}
                                        >
                                            <span>Enviar a Supervisor</span>
                                            <ArrowRight size={16} className="opacity-80" />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setShowLowHoursDialog(false)}
                                        className="px-6 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-900 transition-colors"
                                    >
                                        Entendido, volver al editor
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Sick Leave Modal */}
            {
                isSickLeaveModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800">Registrar Baja Médica</h3>
                                <button onClick={() => setIsSickLeaveModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
                                    <select
                                        value={selectedEmployeeForSickLeave}
                                        onChange={(e) => setSelectedEmployeeForSickLeave(e.target.value)}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-yellow-500 focus:border-yellow-500 border p-2"
                                    >
                                        <option value="">Selecciona un empleado</option>
                                        {storeEmployees.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Días de Baja</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {weekDates.map(date => (
                                            <button
                                                key={date}
                                                onClick={() => toggleSickDate(date)}
                                                className={clsx(
                                                    "p-2 text-xs rounded border transition-colors",
                                                    selectedSickLeaveDates.includes(date)
                                                        ? "bg-yellow-500 text-white border-yellow-600"
                                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                                )}
                                            >
                                                {formatDate(date)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                                    <p>Nota: Al guardar, se actualizará el horario actual marcando estos días como "Baja" para el empleado seleccionado.</p>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsSickLeaveModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveSickLeave}
                                    disabled={!selectedEmployeeForSickLeave || selectedSickLeaveDates.length === 0}
                                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Confirmar Baja
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Permanent Request Edit Modal */}
            {
                editingPermanentRequest && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="bg-purple-600 p-4 flex justify-between items-center text-white">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <Settings size={20} />
                                    {isLocked ? 'Ver Restricción (Bloqueado)' : 'Gestionar Restricción'}
                                </h3>
                                <button
                                    onClick={() => setEditingPermanentRequest(null)}
                                    className="text-white/80 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {isLocked && (
                                    <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-200 flex items-center gap-2">
                                        <Loader2 size={16} className="text-amber-600" />
                                        El horario está publicado. No se pueden modificar restricciones.
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
                                    <div className="p-2 bg-gray-50 rounded border text-gray-700 font-medium">
                                        {storeEmployees.find(e => e.id === editingPermanentRequest.employeeId)?.name || 'Desconocido'}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Restricción</label>
                                    <select
                                        value={editingPermanentRequest.type}
                                        onChange={(e) => setEditingPermanentRequest({ ...editingPermanentRequest, type: e.target.value as any })}
                                        className="w-full border border-gray-300 rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                                        disabled={isLocked}
                                    >
                                        <option value="morning_only">Solo Mañanas</option>
                                        <option value="afternoon_only">Solo Tardes</option>
                                        <option value="specific_days_off">Días Libres Fijos</option>
                                        <option value="max_afternoons_per_week">Máx. Tardes / Semana</option>
                                        <option value="force_full_days">Descanso en Días Completos</option>
                                        <option value="early_morning_shift">Entrada 9:00 (Bloque 9-14h)</option>
                                    </select>
                                </div>

                                {editingPermanentRequest.type === 'early_morning_shift' && (
                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <Clock className="text-amber-600 shrink-0 mt-0.5" size={16} />
                                        <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                            El empleado entrará a las 9:00 y trabajará hasta las 14:00 los días seleccionados.
                                        </p>
                                    </div>
                                )}

                                {editingPermanentRequest.type === 'force_full_days' && (
                                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <ShieldAlert className="text-indigo-600 shrink-0 mt-0.5" size={16} />
                                        <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                                            Se priorizarán jornadas completas (Jornada Partida) para concentrar las horas y maximizar los días libres.
                                        </p>
                                    </div>
                                )}

                                {editingPermanentRequest.type === 'max_afternoons_per_week' ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Número Máximo</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="7"
                                            value={editingPermanentRequest.value || 0}
                                            onChange={(e) => setEditingPermanentRequest({ ...editingPermanentRequest, value: parseInt(e.target.value) })}
                                            className="w-full border border-gray-300 rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                                            disabled={isLocked}
                                        />
                                    </div>
                                ) : (editingPermanentRequest.type !== 'early_morning_shift' && editingPermanentRequest.type !== 'force_full_days') && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {editingPermanentRequest.type === 'specific_days_off' ? 'Seleccionar Días Libres' : 'Seleccionar Días Aplicables'}
                                        </label>
                                        <div className="flex flex-wrap gap-2 text-center">
                                            {[
                                                { l: 'Lun', i: 1 },
                                                { l: 'Mar', i: 2 },
                                                { l: 'Mié', i: 3 },
                                                { l: 'Jue', i: 4 },
                                                { l: 'Vie', i: 5 },
                                                { l: 'Sáb', i: 6 },
                                                { l: 'Dom', i: 0 }
                                            ].map((dayObj) => (
                                                <button
                                                    key={dayObj.i}
                                                    disabled={isLocked}
                                                    onClick={() => {
                                                        const currentDays = editingPermanentRequest.days || [];
                                                        const newDays = currentDays.includes(dayObj.i)
                                                            ? currentDays.filter(d => d !== dayObj.i)
                                                            : [...currentDays, dayObj.i].sort();
                                                        setEditingPermanentRequest({ ...editingPermanentRequest, days: newDays });
                                                    }}
                                                    className={clsx(
                                                        "flex-1 min-w-[45px] py-2 rounded-lg text-[11px] font-bold border transition-all transform active:scale-95",
                                                        (editingPermanentRequest.days?.includes(dayObj.i))
                                                            ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-100"
                                                            : "bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50",
                                                        isLocked && "opacity-50 cursor-not-allowed hover:bg-white"
                                                    )}
                                                >
                                                    {dayObj.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t mt-4 space-y-4">
                                    {!isLocked ? (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => {
                                                        const currentExceptions = editingPermanentRequest.exceptions || [];
                                                        if (!currentExceptions.includes(currentWeekStart)) {
                                                            updatePermanentRequest(editingPermanentRequest.id, {
                                                                exceptions: [...currentExceptions, currentWeekStart]
                                                            });
                                                        }
                                                        setEditingPermanentRequest(null);
                                                        showToast('Restricción desactivada para esta semana', 'success');
                                                    }}
                                                    className="px-4 py-2 text-sm font-bold text-orange-600 bg-white hover:bg-orange-50 rounded-xl border border-orange-200 transition-colors"
                                                >
                                                    Eliminar esta semana
                                                </button>
                                                <button
                                                    onClick={() => setIsConfirmDeletePermOpen(true)}
                                                    className="px-4 py-2 text-sm font-bold text-red-600 bg-white hover:bg-red-50 rounded-xl border border-red-200 transition-colors"
                                                >
                                                    Eliminar siempre
                                                </button>
                                            </div>

                                            <div className="flex justify-end items-center gap-3 pt-2">
                                                <button
                                                    onClick={() => setEditingPermanentRequest(null)}
                                                    className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        updatePermanentRequest(editingPermanentRequest.id, {
                                                            type: editingPermanentRequest.type,
                                                            days: editingPermanentRequest.days,
                                                            value: editingPermanentRequest.value
                                                        });
                                                        setEditingPermanentRequest(null);
                                                        showToast('Cambios guardados correctamente', 'success');
                                                    }}
                                                    className="px-8 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-md shadow-purple-200 transform active:scale-95 transition-all"
                                                >
                                                    Guardar
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => setEditingPermanentRequest(null)}
                                                className="px-8 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 shadow-lg shadow-slate-200"
                                            >
                                                Cerrar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Sick Leave Edit Modal */}
            {
                editingSickInfo && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
                            <div className="bg-amber-500 p-4 flex justify-between items-center text-white rounded-t-xl">
                                <h3 className="font-bold text-lg">Modificar Baja</h3>
                                <button onClick={() => setEditingSickInfo(null)} className="text-white/80 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <DatePicker
                                        label="Fecha Fin de Baja"
                                        value={editingSickInfo.endDate || ''}
                                        onChange={(date) => setEditingSickInfo({ ...editingSickInfo, endDate: date })}
                                        disabled={isLocked}
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={() => setEditingSickInfo(null)}
                                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                    >
                                        {isLocked ? 'Cerrar' : 'Cancelar'}
                                    </button>
                                    {!isLocked && (
                                        <button
                                            onClick={handleUpdateSickLeaveEndDate}
                                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                                        >
                                            Guardar Cambios
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modification Request Modal */}
            {isModificationModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white rounded-t-xl">
                            <h3 className="font-bold text-lg">Solicitar Modificación de Horario</h3>
                            <button onClick={() => setIsModificationModalOpen(false)} className="text-white/80 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100">
                                <p className="flex items-start gap-2">
                                    <Info size={16} className="shrink-0 mt-0.5" />
                                    El supervisor revisará su solicitud y decidirá si desbloquear el horario para modificaciones.
                                </p>
                            </div>

                            {currentSchedule?.approvalStatus === 'rejected' && (
                                <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm border border-red-100">
                                    <p className="font-bold mb-1">Nota de rechazo anterior:</p>
                                    <p>"{currentSchedule.supervisorNotes || 'Sin nota'}"</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Motivo de la solicitud *
                                </label>
                                <textarea
                                    value={modificationReason}
                                    onChange={(e) => setModificationReason(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 min-h-[100px] p-3 text-sm"
                                    placeholder="Explique por qué necesita modificar el horario aprobado..."
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setIsModificationModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleRequestModification}
                                    disabled={!modificationReason.trim()}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Send size={16} />
                                    Enviar Solicitud
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Schedule;
