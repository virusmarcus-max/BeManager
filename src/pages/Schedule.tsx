import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Calendar, ChevronLeft, ChevronRight, X, CheckCircle, Settings, Loader2, Printer, AlertTriangle, Clock, ArrowRight, ShieldAlert, Activity, Plane, Trash2, TrendingUp, Send, RotateCw, Wand2, Users, BadgeAlert, Radio, Lock, Pencil, Quote, Plus, MessageSquarePlus } from 'lucide-react';
import clsx from 'clsx';
import type { ShiftType, TimeOffType, PermanentRequest, WorkRole } from '../types';
import StoreConfigModal from '../components/StoreConfigModal';
import PermanentRequestsModal from '../components/employees/PermanentRequestsModal';
import TempHoursModal from '../components/employees/TempHoursModal';
import VacationModal from '../components/employees/VacationModal';
import { CustomSelect } from '../components/CustomSelect';

import ConfirmDialog from '../components/ConfirmDialog';
import { validatePermanentRestrictions, validateRegisterCoverage } from '../services/scheduler';
import { TimeInput } from '../components/schedule/TimeInput';



const Schedule = () => {
    const { user } = useAuth();
    const { employees, schedules, createSchedule, updateShift, publishSchedule, getSettings, updateSettings, addTimeOff, removeTimeOff, timeOffRequests, permanentRequests, removePermanentRequest, addPermanentRequest, requestScheduleModification, settings } = useStore();
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

    // Vacation Modal State
    const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
    const [vacEmpId, setVacEmpId] = useState<string>('');

    // Temp Hours Modal State
    const [isTempHoursModalOpen, setIsTempHoursModalOpen] = useState(false);
    const [tempEmpId, setTempEmpId] = useState<string>('');
    const [editingTempHoursId, setEditingTempHoursId] = useState<{ empId: string, adjId: string } | null>(null);



    // Shift Edit State




    // Sick Leave Modal State
    const [isSickLeaveModalOpen, setIsSickLeaveModalOpen] = useState(false);
    const [selectedEmployeeForSickLeave, setSelectedEmployeeForSickLeave] = useState<string>('');
    const [selectedSickLeaveDates, setSelectedSickLeaveDates] = useState<string[]>([]);
    const [pendingDebtAdjustments, setPendingDebtAdjustments] = useState<{ empId: string, name: string, amount: number, worked: number, contract: number }[]>([]);
    const [pendingStrictWarnings, setPendingStrictWarnings] = useState<string[]>([]);
    const [showLowHoursDialog, setShowLowHoursDialog] = useState(false);
    const [dialogMode, setDialogMode] = useState<'warning' | 'publish'>('warning');

    // Custom Employee Selector State
    const [isEmployeeSelectorOpen, setIsEmployeeSelectorOpen] = useState(false);

    const employeeSelectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (employeeSelectorRef.current && !employeeSelectorRef.current.contains(event.target as Node)) {
                setIsEmployeeSelectorOpen(false);
            }
        };
        if (isEmployeeSelectorOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isEmployeeSelectorOpen]);

    // Custom Restriction Selector State
    const [isRestrictionTypeSelectorOpen, setIsRestrictionTypeSelectorOpen] = useState(false);
    const restrictionSelectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (restrictionSelectorRef.current && !restrictionSelectorRef.current.contains(event.target as Node)) {
                setIsRestrictionTypeSelectorOpen(false);
            }
        };
        if (isRestrictionTypeSelectorOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isRestrictionTypeSelectorOpen]);

    // Availability Request State
    const [selectedEmployeeForRequest, setSelectedEmployeeForRequest] = useState<string>('');
    const [selectedDatesForRequest, setSelectedDatesForRequest] = useState<string[]>([]);
    const [requestType, setRequestType] = useState<TimeOffType | 'vacation'>('day_off');
    const [isRequestTypeSelectorOpen, setIsRequestTypeSelectorOpen] = useState(false);

    // ... (keep unused state vars or logic above if needed)

    const handleSaveRequest = () => {
        if (!selectedEmployeeForRequest || selectedDatesForRequest.length === 0) return;

        addTimeOff({
            employeeId: selectedEmployeeForRequest,
            dates: selectedDatesForRequest,
            type: requestType as TimeOffType
        });

        showToast('Solicitud añadida correctamente', 'success');
        setSelectedDatesForRequest([]);
        setSelectedEmployeeForRequest('');
    };

    const toggleRequestDate = (date: string) => {
        setSelectedDatesForRequest(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
    };

    // Availability / Request State

    const [isConfirmDeleteRequestOpen, setIsConfirmDeleteRequestOpen] = useState(false);
    const [requestToDelete, setRequestToDelete] = useState<string | null>(null);

    const [editingPermanentRequest, setEditingPermanentRequest] = useState<PermanentRequest | null>(null);


    // Lock state for published schedules
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<{ id: string, field: 'type' | 'role' } | null>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('button')) return; // Simple check, might need refinement if dropdown contains buttons
            setActiveDropdown(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

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

    const currentSchedule = schedules.find(s => s.establishmentId === user.establishmentId && s.weekStartDate === currentWeekStart);
    // Locked: Only if pending OR (approved AND not in modification mode)
    // Actually, if modificationStatus is approved, we treat it as unlocked.
    const isLocked = currentSchedule?.approvalStatus === 'pending' || (currentSchedule?.approvalStatus === 'approved' && currentSchedule?.modificationStatus !== 'approved');

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

    const coverageData = useMemo(() => {
        let totalTarget = 0;
        let totalScheduled = 0;

        const getShiftHours = (s: any) => {
            if (s.type === 'morning' || s.type === 'afternoon') {
                if (s.startTime && s.endTime) {
                    const start = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                    const end = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                    return end - start;
                }
                return 4;
            }
            if (s.type === 'split') {
                if (s.startTime && s.endTime && s.morningEndTime && s.afternoonStartTime) {
                    const mStart = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                    const mEnd = parseInt(s.morningEndTime.split(':')[0]) + parseInt(s.morningEndTime.split(':')[1]) / 60;
                    const aStart = parseInt(s.afternoonStartTime.split(':')[0]) + parseInt(s.afternoonStartTime.split(':')[1]) / 60;
                    const aEnd = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                    return (mEnd - mStart) + (aEnd - aStart);
                }
                return 8;
            }
            return 0;
        };

        const dayData = weekDates.map(date => {
            const dayShifts = currentSchedule?.shifts.filter(s => s.date === date) || [];
            let morning = 0;
            let afternoon = 0;

            dayShifts.forEach(s => {
                const hrs = getShiftHours(s);
                if (s.type === 'morning') morning += hrs;
                else if (s.type === 'afternoon') afternoon += hrs;
                else if (s.type === 'split') {
                    if (s.startTime && s.morningEndTime && s.afternoonStartTime && s.endTime) {
                        const mStart = parseInt(s.startTime.split(':')[0]) + parseInt(s.startTime.split(':')[1]) / 60;
                        const mEnd = parseInt(s.morningEndTime.split(':')[0]) + parseInt(s.morningEndTime.split(':')[1]) / 60;
                        const aStart = parseInt(s.afternoonStartTime.split(':')[0]) + parseInt(s.afternoonStartTime.split(':')[1]) / 60;
                        const aEnd = parseInt(s.endTime.split(':')[0]) + parseInt(s.endTime.split(':')[1]) / 60;
                        morning += (mEnd - mStart);
                        afternoon += (aEnd - aStart);
                    } else {
                        morning += 4;
                        afternoon += 4;
                    }
                }
            });

            totalScheduled += (morning + afternoon);
            return { morning, afternoon, total: morning + afternoon };
        });

        storeEmployees.forEach(emp => {
            let effectiveWeekly = emp.weeklyHours;
            if (emp.tempHours) {
                const activeTemp = emp.tempHours.find(t => currentWeekStart >= t.start && currentWeekStart <= t.end);
                if (activeTemp) effectiveWeekly = activeTemp.hours;
            }
            totalTarget += effectiveWeekly;
        });

        const coveragePercent = totalTarget > 0 ? Math.round((totalScheduled / totalTarget) * 100) : 0;

        return { dayData, coveragePercent, totalScheduled, totalTarget };
    }, [currentSchedule, storeEmployees, timeOffRequests, currentWeekStart, user.establishmentId, getSettings, settings]);

    const handleRequestModification = async () => {
        if (!currentSchedule || !modificationReason.trim()) return;
        try {
            await requestScheduleModification(currentSchedule.id, modificationReason);
            showToast('Solicitud de modificación enviada', 'success');
            setIsModificationModalOpen(false);
            setModificationReason('');
        } catch (error) {
            console.error(error);
            showToast('Error al enviar la solicitud', 'error');
        }
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
            // Debt adjustments will be applied when Supervisor APPROVES the schedule.
            publishSchedule(currentSchedule.id);
            showToast('Horario publicado. Las horas se ajustarán tras aprobación.', 'success');
        }
        setShowLowHoursDialog(false);
    };

    const validateAndShowWarnings = (schedule: any, mode: 'warning' | 'publish' = 'warning') => {
        const debtWarnings: string[] = [];
        const debtAdjustments: { empId: string, name: string, amount: number, worked: number, contract: number }[] = [];
        let calculatedStrictWarnings: string[] = [];
        const settings = getSettings(user.establishmentId);

        // 1. Permanent Restrictions Validation (Always Check)
        calculatedStrictWarnings = validatePermanentRestrictions(schedule, permanentRequests, storeEmployees, false);

        // 2. Availability Request Validation (Always Check)
        weekTimeOffRequests.forEach(req => {
            const empShifts = schedule.shifts.filter((s: any) => s.employeeId === req.employeeId);

            // Check specific dates
            if (req.dates && req.dates.length > 0) {
                req.dates.forEach(date => {
                    const shift = empShifts.find((s: any) => s.date === date);
                    if (shift && shift.type !== 'off' && shift.type !== 'holiday' && shift.type !== 'vacation' && shift.type !== 'sick_leave') {
                        if (req.type === 'day_off') {
                            calculatedStrictWarnings.push(`Petición Violada: ${storeEmployees.find(e => e.id === req.employeeId)?.name} solicitó DÍA LIBRE el ${new Date(date).getDate()} pero tiene turno.`);
                        } else if (req.type === 'morning_off' && (shift.type === 'morning' || shift.type === 'split')) {
                            calculatedStrictWarnings.push(`Petición Violada: ${storeEmployees.find(e => e.id === req.employeeId)?.name} solicitó MAÑANA LIBRE el ${new Date(date).getDate()} pero tiene turno.`);
                        } else if (req.type === 'afternoon_off' && (shift.type === 'afternoon' || shift.type === 'split')) {
                            calculatedStrictWarnings.push(`Petición Violada: ${storeEmployees.find(e => e.id === req.employeeId)?.name} solicitó TARDE LIBRE el ${new Date(date).getDate()} pero tiene turno.`);
                        }
                    }
                });
            }
        });


        // 3. Register Coverage Validation (Strict for Publish, otherwise skipped or soft?)
        // User requested: "Cuando se envie el horario a supervisor... 1. debe haber un cajero de compras y un cajero de ventas"
        if (mode === 'publish') {
            const registerWarnings = validateRegisterCoverage(schedule, settings);
            calculatedStrictWarnings = [...calculatedStrictWarnings, ...registerWarnings];
        }

        // Calculate Employee Hours & Debt
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

                // Customize warning text based on mode (Publish vs Generate) if needed, 
                // but requirement is "aviso sobre deuda... se añaden/restan horas"
                const actionText = diff > 0 ? "se añaden a deuda" : "se restan de deuda";

                if (diff > 0) {
                    debtWarnings.push(`${emp.name}: Tiene ${diff.toFixed(1)}h extra (${actionText}).`);
                } else {
                    debtWarnings.push(`${emp.name}: Le faltan ${Math.abs(diff).toFixed(1)}h (${actionText}).`);
                }
            }
        });

        // 4. Daily Coverage & Open/Close Validation
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

            // Check Low Coverage (Applies in Generate & Publish)
            if (totalHours < threshold) {
                calculatedStrictWarnings.push(`Baja Cobertura: El ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()} solo tiene ${totalHours}h planificadas (Mínimo recomendado: ${threshold}h).`);
            }

            // Check Open/Close & Responsible (Strict Check for Publish)
            // User requested: "2. debe haber siempre un responsable asignado en horario para cada dia de la semana con cierre y apertura"
            if (mode === 'publish' && !isFullHoliday) {
                const shiftOpening = shiftsOnDate.find((s: any) => s.isOpening);
                const shiftClosing = shiftsOnDate.find((s: any) => s.isClosing);

                if (!shiftOpening) {
                    calculatedStrictWarnings.push(`Falta APERTURA (A) el ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()}`);
                } else {
                    const empOpener = storeEmployees.find(e => e.id === shiftOpening.employeeId);
                    if (empOpener && !['Gerente', 'Subgerente', 'Responsable'].includes(empOpener.category)) {
                        calculatedStrictWarnings.push(`Apertura sin Responsable: El ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()} la apertura la hace ${empOpener.name} (${empOpener.category}).`);
                    }
                }

                if (!shiftClosing) {
                    calculatedStrictWarnings.push(`Falta CIERRE (C) el ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()}`);
                } else {
                    const empCloser = storeEmployees.find(e => e.id === shiftClosing.employeeId);
                    if (empCloser && !['Gerente', 'Subgerente', 'Responsable'].includes(empCloser.category)) {
                        calculatedStrictWarnings.push(`Cierre sin Responsable: El ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long' })} ${new Date(date).getDate()} el cierre lo hace ${empCloser.name} (${empCloser.category}).`);
                    }
                }
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



    const handleSaveSickLeave = async () => {
        if (!selectedEmployeeForSickLeave || selectedSickLeaveDates.length === 0) return;

        // Validation: Check for overlapping sick leaves
        const hasOverlap = timeOffRequests.some(req => {
            if (req.employeeId !== selectedEmployeeForSickLeave || req.type !== 'sick_leave') return false;

            // Check against explicit dates list
            if (req.dates && req.dates.length > 0) {
                const datesOverlap = req.dates.some(date => selectedSickLeaveDates.includes(date));
                if (datesOverlap) return true;
            }

            // Check against date range (startDate - endDate)
            if (req.startDate && req.endDate) {
                const rangeOverlap = selectedSickLeaveDates.some(date =>
                    date >= req.startDate! && date <= req.endDate!
                );
                if (rangeOverlap) return true;
            }

            return false;
        });

        if (hasOverlap) {
            showToast('El empleado ya tiene una baja registrada en alguna de las fechas seleccionadas.', 'error');
            return;
        }

        // Calculate start and end dates for "Long Term" structure consistency
        const sortedDates = [...selectedSickLeaveDates].sort();
        const startDate = sortedDates[0];
        const endDate = sortedDates[sortedDates.length - 1];

        await addTimeOff({
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

        // Calculate Optimal Zoom and Padding based on employee count
        const empCount = storeEmployees.length;
        let zoomLevel = 0.75;
        let cellPadding = "4px 5px";
        let fontSize = "11px";

        if (empCount > 25) {
            zoomLevel = 0.55;
            cellPadding = "2px 3px";
            fontSize = "10px";
        } else if (empCount > 15) {
            zoomLevel = 0.65;
            cellPadding = "3px 4px";
            fontSize = "10px";
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    /* Use minimal margins to maximize space */
                    @page { size: A4 landscape; margin: 5mm 12mm; }
                    
                    /* Dynamic Zoom */
                    body { font-family: system-ui, -apple-system, sans-serif; padding: 0; margin: 0; color: #1f2937; zoom: ${zoomLevel}; }
                    
                    h1 { text-align: center; margin-bottom: 10px; color: #111827; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; break-after: avoid; }
                    
                    /* Main Table Container - ensure it follows header */
                    .schedule-container {
                        width: 100%;
                        display: block;
                        page-break-inside: avoid;
                    }

                    /* Allow table to break inside IF absolutely necessary, but prefer avoid */
                    table { width: 100%; border-collapse: collapse; font-size: ${fontSize}; table-layout: fixed; page-break-inside: avoid; }
                    th, td { border: 1px solid #000000; padding: ${cellPadding}; text-align: center; vertical-align: middle; }
                    th { background-color: #f3f4f6; font-weight: 800; color: #111827; padding: 6px 5px; uppercase; font-size: 10px; letter-spacing: 0.05em; border-bottom: 2px solid #000000; }
                    
                    .employee-cell { text-align: left; font-weight: 700; width: 130px; padding-left: 8px; color: #111827; border-right: 2px solid #000000; }
                    .employee-meta { font-size: 9px; color: #4b5563; font-weight: 500; display: block; margin-top: 1px; }

                    /* Shift Colors */
                    .shift-morning { background-color: #eff6ff; }
                    .shift-afternoon { background-color: #fff7ed; } 
                    .shift-split { background-color: #f0fdf4; }
                    .shift-vacation { background-color: #fef2f2; }
                    .shift-off { background-color: #f9fafb; color: #9ca3af; }
                    .shift-holiday { background-color: #fee2e2; color: #991b1b; }
                    .shift-sick { background-color: #fef9c3; color: #854d0e; }
                    
                    /* DEBT PAGE STYLES */
                    .debt-section { page-break-before: always; break-before: page; margin-top: 0; padding-top: 20px; }
                    .debt-heading { font-size: 16px; font-weight: 800; margin-bottom: 15px; border-bottom: 2px solid #000000; padding-bottom: 10px; color: #374151; }
                    .debt-table { max-width: 600px; margin-left: 0; font-size: 12px; }
                    .debt-positive { color: #059669; font-weight: 700; }
                    .debt-negative { color: #dc2626; font-weight: 700; }
                    .print-footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #000000; padding-top: 10px; }
                    
                    .role-pill { display: inline-block; font-weight: 700; font-size: 9px; padding: 1px 4px; border-radius: 4px; margin-bottom: 2px; text-transform: uppercase; border: 1px solid rgba(0,0,0,0.1); }
                    .ind-indicator { display: inline-flex; justify-content: center; align-items: center; width: 14px; height: 14px; border-radius: 4px; font-size: 9px; font-weight: 900; color: white; margin-right: 2px; margin-bottom: 2px; }
                </style>
            </head>
            <body>
                <div style="position: absolute; top: 10px; right: 20px; display: flex; flex-direction: column; align-items: flex-end;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 10px; color: #64748b; font-weight: 600;">Creado con</span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                             <svg width="18" height="18" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M64 10 L118 50 V110 H10 V50 L64 10 Z" fill="#e2e8f0" stroke="#64748b" stroke-width="6" stroke-linejoin="round" />
                                <g fill="#7c3aed">
                                    <circle cx="64" cy="45" r="16" />
                                    <path d="M42 68 Q29 55 19 45 L30 34 Q44 50 52 68 L52 90 L76 90 L76 68 Q84 50 98 34 L109 45 Q99 55 86 68 L86 110 L42 110 Z" />
                                </g>
                            </svg>
                            <span style="font-size: 14px; font-weight: 800; color: #7c3aed;">BeManager</span>
                        </div>
                    </div>
                </div>

                <h1>Horario Semanal: ${new Date(weekDates[0]).toLocaleDateString('es-ES')} - ${new Date(weekDates[6]).toLocaleDateString('es-ES')}</h1>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 140px; font-size: 13px;">Empleado</th>
                            ${weekDates.map(date => {
            const d = new Date(date);
            const dayName = d.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase();
            const dayNumber = d.getDate();
            return `<th style="font-size: 13px;">${dayName} ${dayNumber}</th>`;
        }).join('')}
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
                const roleHtml = roleName ? `<div style="font-weight:700; font-size:9px; margin-bottom:1px; text-transform:uppercase">${roleName}</div>` : '';
                // Changed RI to REUNIÓN
                const riHtml = shift.isIndividualMeeting ? `<div style="display:block; background-color:#4f46e5; color:white; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:800; margin-bottom:2px; margin-top:1px; text-transform:uppercase;">REUNIÓN</div>` : '';

                // Updated Labels: Full text for Opening/Closing
                const openHtml = shift.isOpening ? `<div style="display:block; background-color:#10b981; color:white; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:800; margin-bottom:2px; margin-top:1px; text-transform:uppercase;">APERTURA</div>` : '';
                const closeHtml = shift.isClosing ? `<div style="display:block; background-color:#f59e0b; color:white; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:800; margin-bottom:2px; margin-top:1px; text-transform:uppercase;">CIERRE</div>` : '';

                const prefixHtml = `<div style="display:flex; justify-content:center; align-items:center; flex-direction:column; width:100%;">${openHtml}${closeHtml}${riHtml}${roleHtml}</div>`;

                // Common style for bold hours
                const timeStyle = "font-weight: 800; font-size: 1.05em; display: inline-block; margin-top: 1px;";

                switch (shift.type) {
                    case 'morning':
                        className = 'shift-morning';
                        content = `${prefixHtml}<span style="${timeStyle}">${shift.startTime || '10:00'} - ${shift.endTime || '14:00'}</span>`;
                        break;
                    case 'afternoon':
                        className = 'shift-afternoon';
                        content = `${prefixHtml}<span style="${timeStyle}">${shift.startTime || '16:30'} - ${shift.endTime || '20:30'}</span>`;
                        break;
                    case 'split':
                        className = 'shift-split';
                        content = `${prefixHtml}<span style="${timeStyle}">${shift.startTime || '10:00'}-${shift.morningEndTime || settings.openingHours.morningEnd}<br>${shift.afternoonStartTime || settings.openingHours.afternoonStart}-${shift.endTime || '20:30'}</span>`;
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

            return `<tr><td class="employee-cell">${emp.name}<br><span style="font-size: 10px; color: #6b7280; font-weight: 400">${emp.weeklyHours}h</span></td>${cells}</tr>`;
        }).join('')}
                    </tbody>
                </table>

                ${debtSummary.length > 0 ? `
                    <div class="debt-section">
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
                    Documento generado por BeManager - ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}
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
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* --- TOP HEADER & CONTROLS --- */}
            <header className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-6">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-6 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
                        <button
                            onClick={() => changeWeek(-1)}
                            className="p-3 bg-white rounded-xl text-slate-500 hover:text-indigo-600 hover:shadow-md transition-all active:scale-95 border border-slate-100"
                        >
                            <ChevronLeft size={20} className="stroke-[2.5]" />
                        </button>

                        <div className="flex flex-col items-center min-w-[220px]">
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-0.5">SEMANA ACTUAL</span>
                            <div className="flex items-baseline gap-2 text-slate-800">
                                <span className="text-2xl font-black tracking-tight capitalize">
                                    {new Date(weekDates[0]).toLocaleDateString('es-ES', { month: 'long' })}
                                </span>
                                <span className="text-xl font-medium text-slate-400">
                                    {new Date(weekDates[0]).getFullYear()}
                                </span>
                            </div>
                            <div className="text-xs font-bold text-indigo-500 bg-indigo-50 px-4 py-1 rounded-full mt-1 border border-indigo-100 uppercase tracking-wide">
                                {new Date(weekDates[0]).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })} - {new Date(weekDates[6]).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                            </div>
                        </div>

                        <button
                            onClick={() => changeWeek(1)}
                            className="p-3 bg-white rounded-xl text-slate-500 hover:text-indigo-600 hover:shadow-md transition-all active:scale-95 border border-slate-100"
                        >
                            <ChevronRight size={20} className="stroke-[2.5]" />
                        </button>
                    </div>

                    {/* Quick Stats / Info */}
                    <div className="hidden xl:flex items-center gap-8">
                        <div className="flex flex-col items-end">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Estado del Horario</span>
                            <div className="flex items-center gap-2">
                                {currentSchedule?.modificationStatus === 'requested' ? (
                                    <span className="flex items-center gap-2 px-5 py-2 rounded-full bg-orange-50 text-orange-600 text-sm font-black border border-orange-200 shadow-sm animate-pulse">
                                        <Clock size={18} className="fill-orange-500 text-orange-100" /> SOLICITUD ENVIADA
                                    </span>
                                ) : currentSchedule?.modificationStatus === 'approved' ? (
                                    <span className="flex items-center gap-2 px-5 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-black border border-blue-200 shadow-sm">
                                        <CheckCircle size={18} className="fill-blue-500 text-blue-100" /> DESBLOQUEADO
                                    </span>
                                ) : currentSchedule?.approvalStatus === 'approved' ? (
                                    <span className="flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-50 text-emerald-600 text-sm font-black border border-emerald-200 shadow-sm">
                                        <CheckCircle size={18} className="fill-emerald-500 text-emerald-100" /> APROBADO
                                    </span>
                                ) : currentSchedule?.approvalStatus === 'pending' ? (
                                    <span className="flex items-center gap-2 px-5 py-2 rounded-full bg-amber-50 text-amber-600 text-sm font-black border border-amber-200 shadow-sm animate-pulse">
                                        <Clock size={18} className="fill-amber-500 text-amber-100" /> EN SUPERVISIÓN
                                    </span>
                                ) : currentSchedule?.approvalStatus === 'rejected' ? (
                                    <span className="flex items-center gap-2 px-5 py-2 rounded-full bg-red-50 text-red-600 text-sm font-black border border-red-200 shadow-sm">
                                        <X size={18} className="fill-red-500 text-red-100" /> RECHAZADO
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 px-5 py-2 rounded-full bg-slate-100/80 text-slate-500 text-sm font-black border border-slate-200 shadow-sm">
                                        <Radio size={18} /> BORRADOR
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>


                    {/* Primary Actions */}
                    <div className="flex items-center gap-3">
                        {!isLocked ? (
                            <>
                                {!currentSchedule && (
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="group relative px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                        <span className="relative flex items-center gap-2">
                                            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                                            Generar horario
                                        </span>
                                    </button>
                                )}
                                {currentSchedule && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRegenerateClick}
                                            disabled={isGenerating}
                                            className="px-4 py-3 rounded-2xl bg-white text-slate-600 font-bold border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 shadow-sm"
                                            title="Regenerar horario desde cero"
                                        >
                                            <RotateCw size={18} className={isGenerating ? "animate-spin" : ""} />
                                        </button>
                                        <button
                                            onClick={handlePublish}
                                            disabled={isGenerating || currentSchedule.approvalStatus === 'pending'}
                                            className={clsx(
                                                "px-6 py-3 rounded-2xl font-bold shadow-lg flex items-center gap-2 transition-all hover:-translate-y-0.5",
                                                currentSchedule.approvalStatus === 'pending'
                                                    ? "bg-amber-100 text-amber-700 shadow-none cursor-default"
                                                    : "bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700"
                                            )}
                                        >
                                            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                            {currentSchedule.approvalStatus === 'pending' ? 'Enviado' : 'Publicar'}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold",
                                currentSchedule?.modificationStatus === 'requested' ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500"
                            )}>
                                {currentSchedule?.modificationStatus === 'requested' ? (
                                    <>
                                        <Clock size={16} className="animate-pulse" />
                                        Solicitud de Cambio Pendiente...
                                    </>
                                ) : (
                                    <>
                                        <Lock size={16} />
                                        {currentSchedule?.approvalStatus === 'approved' ? 'Horario Aprobado (Bloqueado)' : 'Esperando Aprobación'}
                                    </>
                                )}

                                {currentSchedule?.approvalStatus === 'approved' && currentSchedule?.modificationStatus !== 'requested' && user.role !== 'admin' && (
                                    <button
                                        onClick={() => setIsModificationModalOpen(true)}
                                        className="ml-4 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <MessageSquarePlus size={16} />
                                        Solicitar Cambio
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="w-px h-8 bg-slate-200 mx-1"></div>

                        <div className="flex gap-2">
                            <button
                                onClick={handlePrint}
                                disabled={!currentSchedule || currentSchedule.approvalStatus !== 'approved'}
                                className={clsx(
                                    "p-3 rounded-xl border border-transparent transition-all",
                                    (!currentSchedule || currentSchedule.approvalStatus !== 'approved')
                                        ? "text-slate-300 cursor-not-allowed opacity-50"
                                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-200"
                                )}
                                title={(!currentSchedule || currentSchedule.approvalStatus !== 'approved') ? "El horario debe estar aprobado para imprimir" : "Imprimir"}
                            >
                                <Printer size={20} />
                            </button>
                            <button
                                onClick={() => setIsConfigOpen(true)}
                                className="p-3 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all"
                                title="Configuración"
                            >
                                <Settings size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Supervisor Notes Feedback */}
                {currentSchedule?.approvalStatus === 'rejected' && currentSchedule.supervisorNotes && (
                    <div className="mt-6 bg-red-50/50 border border-red-100 rounded-2xl p-4 flex items-start gap-4 animate-in slide-in-from-top-2">
                        <div className="p-2 bg-red-100 rounded-xl text-red-600 shrink-0">
                            <Quote size={20} />
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-red-800 mb-1">Nota del Supervisor</h4>
                            <p className="text-sm text-red-700 leading-relaxed">"{currentSchedule.supervisorNotes}"</p>
                        </div>
                    </div>
                )}
            </header>

            {/* --- QUICK VIEW / ACTIVE ITEMS PANEL --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

                {/* 1. Bajas Activas (Sick Leave) */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 text-rose-600">
                        <Activity size={18} />
                        <h3 className="font-bold text-sm uppercase">Bajas Activas</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[150px] space-y-2">
                        {weekTimeOffRequests.filter(r => r.type === 'sick_leave' || r.type === 'maternity_paternity').map(req => {
                            const emp = employees.find(e => e.id === req.employeeId);
                            // Determine dates for this week or just use the whole request?
                            // The modal expects specific dates to toggle. If it's a long range, we might just open the modal with the employee selected.
                            // But usually, updating a long range involves deleting and recreating or using a different modal. 
                            // For now, let's keep it simple: Select employee. 
                            // If we want to show dates, we should filter req.dates (if explicit) or range intersection.
                            return (
                                <div key={req.id} className="flex justify-between items-center bg-rose-50 p-2 rounded-lg text-xs">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-rose-900 uppercase">{emp?.initials || emp?.name?.substring(0, 2)}</span>
                                        <span className="text-[10px] text-rose-600 font-medium leading-none mt-0.5">
                                            {req.startDate ? (
                                                <>
                                                    {new Date(req.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                                    {' - '}
                                                    {req.endDate ? new Date(req.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '...'}
                                                </>
                                            ) : (
                                                req.dates && req.dates.length > 0 ? (
                                                    <>
                                                        {new Date(req.dates[0]).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                                        {req.dates.length > 1 && ` - ${new Date(req.dates[req.dates.length - 1]).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`}
                                                    </>
                                                ) : null
                                            )}
                                        </span>
                                    </div>
                                    {!isLocked && (
                                        <button onClick={() => {
                                            // Pre-select employee for a new entry or editing?
                                            // The previous logic was extracting a single shift date. 
                                            // If we want to EDIT the existing request, we need a way to pass that.
                                            // But the SickLeaveModal seems to just "Registrar" (Add/Overwrite).
                                            setSelectedEmployeeForSickLeave(req.employeeId);
                                            // If it has explicit dates, use them. If it's a range, maybe expand it? 
                                            // For safety, let's just select the employee so the user can modify things.
                                            // Or better, populate with relevant dates from this week.

                                            // Logic to find relevant dates for this week from the request:
                                            let datesToSelect: string[] = [];
                                            if (req.dates && req.dates.length > 0) {
                                                datesToSelect = req.dates.filter(d => weekDates.includes(d));
                                            } else if (req.startDate && req.endDate) {
                                                datesToSelect = weekDates.filter(d => d >= req.startDate! && d <= req.endDate!);
                                            }
                                            setSelectedSickLeaveDates(datesToSelect);
                                            setIsSickLeaveModalOpen(true);
                                        }} className="text-rose-400 hover:text-rose-600"><Settings size={14} /></button>
                                    )}
                                </div>
                            );
                        })}
                        {weekTimeOffRequests.filter(r => r.type === 'sick_leave' || r.type === 'maternity_paternity').length === 0 && (
                            <div className="text-xs text-slate-400 italic text-center py-2">- Ninguna -</div>
                        )}
                    </div>
                    <button onClick={() => setIsSickLeaveModalOpen(true)} className="mt-3 text-xs w-full py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold transition-colors">
                        + Registrar Baja
                    </button>
                </div>

                {/* 2. Vacaciones (Vacations) */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 text-teal-600">
                        <Plane size={18} />
                        <h3 className="font-bold text-sm uppercase">Vacaciones</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[150px] space-y-2">
                        {weekTimeOffRequests.filter(r => r.type === 'vacation').map(req => {
                            const emp = employees.find(e => e.id === req.employeeId);
                            return (
                                <div key={req.id} className="flex justify-between items-center bg-teal-50 p-2 rounded-lg text-xs">
                                    <span className="font-bold text-teal-900 uppercase">{emp?.initials || emp?.name?.substring(0, 2)}</span>
                                    {!isLocked && (
                                        <button onClick={() => {
                                            setVacEmpId(req.employeeId);
                                            setIsVacationModalOpen(true);
                                        }} className="text-teal-400 hover:text-teal-600"><Pencil size={14} /></button>
                                    )}
                                </div>
                            );
                        })}
                        {weekTimeOffRequests.filter(r => r.type === 'vacation').length === 0 && (
                            <div className="text-xs text-slate-400 italic text-center py-2">- Ninguna -</div>
                        )}
                    </div>
                    {(!isLocked) && (
                        <button onClick={() => {
                            setVacEmpId('');
                            setIsVacationModalOpen(true);
                        }} className="mt-3 text-xs w-full py-1.5 rounded-lg border border-teal-200 text-teal-600 hover:bg-teal-50 font-bold transition-colors">
                            + Vacaciones
                        </button>
                    )}

                </div>

                {/* 3. Solicitudes (Requests) */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 text-blue-600">
                        <Calendar size={18} />
                        <h3 className="font-bold text-sm uppercase">Peticiones</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[150px] space-y-2">
                        {weekTimeOffRequests.filter(r => r.type !== 'vacation' && r.type !== 'sick_leave' && r.type !== 'maternity_paternity').map(req => {
                            const emp = employees.find(e => e.id === req.employeeId);
                            return (
                                <div key={req.id} className="flex justify-between items-center bg-blue-50 p-2 rounded-lg text-xs">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-blue-900 uppercase">{emp?.initials || emp?.name?.substring(0, 2)}</span>
                                        <span className="text-[10px] text-blue-500 capitalize">
                                            {req.type === 'morning_off' ? 'Mañana Libre' :
                                                req.type === 'afternoon_off' ? 'Tarde Libre' :
                                                    req.type === 'day_off' ? 'Día Libre' :
                                                        req.type === 'early_morning_shift' ? 'Turno Temprano' :
                                                            req.type === 'maternity_paternity' ? 'Maternidad/Paternidad' :
                                                                req.type.replace('_', ' ')}
                                        </span>
                                    </div>
                                    {!isLocked && (
                                        <button onClick={() => {
                                            setRequestToDelete(req.id);
                                            setIsConfirmDeleteRequestOpen(true);
                                        }} className="text-blue-400 hover:text-blue-600"><Trash2 size={14} /></button>
                                    )}
                                </div>
                            );
                        })}
                        {weekTimeOffRequests.filter(r => r.type !== 'vacation' && r.type !== 'sick_leave' && r.type !== 'maternity_paternity').length === 0 && (
                            <div className="text-xs text-slate-400 italic text-center py-2">- Ninguna -</div>
                        )}
                    </div>
                    {(!isLocked) && (
                        <button onClick={() => setIsAvailabilityModalOpen(true)} className="mt-3 text-xs w-full py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold transition-colors">
                            + Solicitud
                        </button>
                    )}
                </div>

                {/* 4. Disponibilidad (Permanent Requests) */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 text-purple-600">
                        <Lock size={18} />
                        <h3 className="font-bold text-sm uppercase">Restric. Fijas</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[150px] space-y-2">
                        {storeEmployees.filter(e => permanentRequests.some(p => p.employeeId === e.id)).map(emp => {
                            const perm = permanentRequests.find(p => p.employeeId === emp.id);
                            return (
                                <div key={emp.id} className="flex justify-between items-center bg-purple-50 p-2 rounded-lg text-xs">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-purple-900 uppercase">{emp.initials || emp.name.substring(0, 2)}</span>
                                        <span className="text-[10px] text-purple-500 truncate w-20">
                                            {perm?.type === 'morning_only' ? 'Solo Mañanas' :
                                                perm?.type === 'afternoon_only' ? 'Solo Tardes' :
                                                    perm?.type === 'no_split' ? 'Sin Partido' :
                                                        perm?.type === 'rotating_days_off' ? 'Rotativo' :
                                                            perm?.type === 'custom_days_off' ? 'Días Fijos' :
                                                                perm?.type === 'force_full_days' ? 'Días Completos' :
                                                                    perm?.type === 'max_afternoons_per_week' ? `Máx ${perm.value} Tardes` :
                                                                        perm?.type === 'early_morning_shift' ? 'Entrada 9:00' :
                                                                            perm?.type === 'fixed_rotating_shift' ? 'Rotativo Fijo' :
                                                                                perm?.type}
                                        </span>
                                    </div>
                                    {!isLocked && (
                                        <button onClick={() => {
                                            setEditingPermanentRequest(perm || null);
                                        }} className="text-purple-400 hover:text-purple-600"><Pencil size={14} /></button>
                                    )}
                                </div>
                            );
                        })}
                        {storeEmployees.filter(e => permanentRequests.some(p => p.employeeId === e.id)).length === 0 && (
                            <div className="text-xs text-slate-400 italic text-center py-2">- Ninguna -</div>
                        )}
                    </div>
                </div>

                {/* 5. Ampliaciones (Extensions) */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 text-emerald-600">
                        <TrendingUp size={18} />
                        <h3 className="font-bold text-sm uppercase">Ampliaciones</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[150px] space-y-2">
                        {storeEmployees.filter(e => e.tempHours && e.tempHours.some(t => currentWeekStart >= t.start && currentWeekStart <= t.end)).map(emp => {
                            const activeTemp = emp.tempHours?.find(t => currentWeekStart >= t.start && currentWeekStart <= t.end);
                            return (
                                <div key={emp.id} className="flex justify-between items-center bg-emerald-50 p-2 rounded-lg text-xs">
                                    <span className="font-bold text-emerald-900 uppercase">{emp.initials || emp.name.substring(0, 2)}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-emerald-600">{activeTemp?.hours}h</span>
                                        {!isLocked && (
                                            <button onClick={() => {
                                                if (activeTemp) {
                                                    setTempEmpId(emp.id);
                                                    setEditingTempHoursId({ empId: emp.id, adjId: activeTemp.id });
                                                    setIsTempHoursModalOpen(true);
                                                }
                                            }} className="text-emerald-400 hover:text-emerald-600 transition-colors">
                                                <Pencil size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {storeEmployees.filter(e => e.tempHours && e.tempHours.some(t => currentWeekStart >= t.start && currentWeekStart <= t.end)).length === 0 && (
                            <div className="text-xs text-slate-400 italic text-center py-2">- Ninguna -</div>
                        )}
                    </div>
                    {(!isLocked) && (
                        <button onClick={() => {
                            setTempEmpId('');
                            setEditingTempHoursId(null);
                            setIsTempHoursModalOpen(true);
                        }} className="mt-3 text-xs w-full py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold transition-colors">
                            + Ampliación
                        </button>
                    )}
                </div>

            </div >

            {/* --- MAIN SCHEDULE GRID --- */}
            < div className="bg-white rounded-3xl shadow-xl border border-slate-200/60 overflow-hidden flex flex-col" >

                {/* GRID HEADER */}
                <div className="grid grid-cols-[150px_repeat(7,1fr)] bg-slate-50/50 border-b border-slate-200">
                    <div className="p-4 flex items-center gap-2 text-xs font-black uppercase text-slate-400 tracking-widest pl-6">
                        <Users size={14} /> Empleados
                    </div>
                    {
                        weekDates.map((date) => {
                            const isToday = new Date().toDateString() === new Date(date).toDateString();
                            const isHoliday = getSettings(user.establishmentId).holidays.some((h: any) => (typeof h === 'string' ? h : h.date) === date);

                            return (
                                <div key={date} className={clsx(
                                    "p-3 text-center border-l border-slate-200/50 flex flex-col items-center justify-center relative group transition-colors",
                                    isToday ? "bg-indigo-50/40 shadow-inner" : "hover:bg-slate-50"
                                )}>
                                    {isToday && <div className="absolute top-0 inset-x-0 h-1 bg-indigo-500 rounded-b-sm shadow-sm shadow-indigo-200"></div>}

                                    {/* Day Name Badge */}
                                    <div className={clsx(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mb-1 shadow-sm border",
                                        isToday ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                                            isHoliday ? "bg-red-100 text-red-700 border-red-200" :
                                                "bg-white text-slate-500 border-slate-200"
                                    )}>
                                        {['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][new Date(date).getDay()]}
                                    </div>

                                    {/* Date Number */}
                                    <span className={clsx(
                                        "text-2xl font-black leading-none filter drop-shadow-sm",
                                        isToday ? "text-indigo-900" : isHoliday ? "text-red-900" : "text-slate-700"
                                    )}>
                                        {new Date(date).getDate()}
                                    </span>
                                    {isHoliday && <BadgeAlert size={14} className="text-red-500 absolute top-2 right-2 animate-pulse" />}
                                </div>
                            );
                        })
                    }
                </div >

                {/* DAILY HOURS SUMMARY */}
                {
                    currentSchedule && (
                        <div className="grid grid-cols-[150px_repeat(7,1fr)] bg-indigo-900 text-white border-b border-indigo-800">
                            <div className="p-3 pl-6 flex flex-col justify-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-0.5">Cobertura Semanal</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-black">{coverageData.coveragePercent}%</span>
                                    <div className="h-1.5 flex-1 bg-indigo-950/50 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{
                                            width: `${Math.min(100, coverageData.coveragePercent)}%`
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                            {weekDates.map((date, idx) => {
                                const data = coverageData.dayData[idx];
                                const morning = Math.round(data.morning * 10) / 10;
                                const afternoon = Math.round(data.afternoon * 10) / 10;
                                const total = Math.round(data.total * 10) / 10;

                                return (
                                    <div key={date} className="py-3 px-2 text-center border-l border-indigo-800/50 flex flex-col justify-center gap-1.5 relative group">
                                        <div className="flex justify-between items-end px-2">
                                            <div className="flex flex-col items-start">
                                                <span className="text-[10px] uppercase font-bold text-amber-300 opacity-90">Mañana</span>
                                                <span className="text-sm font-black text-amber-100">{morning}h</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] uppercase font-bold text-violet-300 opacity-90">Tarde</span>
                                                <span className="text-sm font-black text-violet-100">{afternoon}h</span>
                                            </div>
                                        </div>

                                        <div className="h-2 flex gap-0.5 w-full bg-indigo-950/40 rounded-full overflow-hidden my-1">
                                            <div className="h-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" style={{ width: `${(morning / (total || 1)) * 100}%` }}></div>
                                            <div className="h-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.5)]" style={{ width: `${(afternoon / (total || 1)) * 100}%` }}></div>
                                        </div>

                                        <div className="flex items-baseline justify-center gap-1.5 mt-1">
                                            <span className="text-2xl font-black text-white tracking-tight">{total}h</span>
                                            <span className="text-[10px] uppercase font-bold text-indigo-300 mb-1">Total</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                }

                {/* EMPLOYEES ROWS */}
                <div className="divide-y divide-slate-100 bg-white">
                    {storeEmployees.map((emp, index) => {
                        // Calc Weekly Stats
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
                        if (emp.tempHours) {
                            const activeTemp = emp.tempHours.find((t: any) => currentWeekStart >= t.start && currentWeekStart <= t.end);
                            if (activeTemp) targetHours = activeTemp.hours;
                        }


                        // --- CALCULATE REDUCED TARGET HOURS ---
                        // Re-implementing logic from validateAndShowWarnings for visual consistency
                        const currentStoreSettings = getSettings(user.establishmentId) || { holidays: [] };
                        const currentHolidays = currentStoreSettings.holidays || [];
                        const contractHours = targetHours; // Base contract (or temp adjusted)

                        let numDaysToReduce = 0;
                        weekDates.forEach(d => {
                            const h = currentHolidays.find((holiday: any) => (typeof holiday === 'string' ? holiday : holiday.date) === d);
                            const isFullHoliday = h && (typeof h === 'string' || h.type === 'full');
                            const isPartialHoliday = h && typeof h !== 'string' && (h.type === 'afternoon' || h.type === 'closed_afternoon');

                            // Check if store is closed on this day (if not explicitly a holiday in the list, but maybe implicit? - usually holidays list covers it)
                            // We will rely on holidays list as per original logic.

                            const isAbsence = timeOffRequests.some(r =>
                                r.employeeId === emp.id &&
                                (r.type === 'vacation' || r.type === 'sick_leave' || r.type === 'maternity_paternity') &&
                                ((r.dates && r.dates.includes(d)) || (r.startDate && r.endDate && d >= r.startDate && d <= r.endDate))
                            );

                            if (isFullHoliday || isAbsence) {
                                numDaysToReduce++;
                            } else if (isPartialHoliday && contractHours === 40) {
                                numDaysToReduce += 0.5;
                            }
                        });

                        const rReduction = Math.round(numDaysToReduce * 10) / 10;
                        const baseHours = targetHours;
                        const reductionTable: Record<number, number[]> = {
                            40: [36, 32, 28, 24, 16],
                            36: [33, 30, 27, 23, 18],
                            32: [30, 27, 24, 21, 16],
                            28: [25, 23, 21, 19, 14],
                            24: [22, 20, 18, 16, 12],
                            20: [18, 17, 15, 13, 10],
                            16: [14, 13, 12, 10, 8]
                        };

                        let effectiveTargetHours = targetHours;
                        if (rReduction > 0) {
                            const tableRow = reductionTable[baseHours];
                            if (tableRow) {
                                if (rReduction === 0.5) effectiveTargetHours = tableRow[0];
                                else if (rReduction === 1) effectiveTargetHours = tableRow[1];
                                else if (rReduction === 1.5) effectiveTargetHours = tableRow[2];
                                else if (rReduction === 2) effectiveTargetHours = tableRow[3];
                                else if (rReduction === 3) effectiveTargetHours = tableRow[4];
                                else if (rReduction >= 5) effectiveTargetHours = 0;
                                else if (rReduction > 3) effectiveTargetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                            } else {
                                effectiveTargetHours = Math.max(0, baseHours - Math.round((baseHours / 5) * rReduction));
                            }
                        }

                        // Use effectiveTargetHours for diff calculation comparison
                        const diff = workedHours - effectiveTargetHours;

                        return (
                            <div key={emp.id} className="grid grid-cols-[150px_repeat(7,1fr)] hover:bg-slate-50/50 transition-colors group">
                                {/* Employee Info Cell (Compacted) */}
                                <div className="p-2 border-r border-slate-100 flex flex-col justify-center relative min-h-[140px] bg-slate-50/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="relative group/avatar shrink-0">
                                            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md shadow-indigo-500/10">
                                                {emp.initials}
                                            </div>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="font-black text-slate-800 text-sm leading-tight truncate">{emp.name.split(' ')[0]}</div>
                                            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider truncate">{emp.category}</div>
                                        </div>
                                    </div>

                                    <div className="w-full flex flex-col gap-1">
                                        <div className="flex justify-between items-end w-full px-0.5">
                                            <span className={clsx(
                                                "text-[10px] font-black tracking-tight",
                                                Math.abs(diff) < 0.5 ? "text-emerald-600" : diff < 0 ? "text-amber-600" : "text-indigo-600"
                                            )}>
                                                {Math.round(workedHours * 10) / 10}h
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-300">/ {effectiveTargetHours}h</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden flex">
                                            <div
                                                className={clsx(
                                                    "h-full rounded-full",
                                                    Math.abs(diff) < 0.5 ? "bg-emerald-500" :
                                                        diff < 0 ? "bg-amber-400" : "bg-indigo-500"
                                                )}
                                                style={{ width: `${Math.min(100, (workedHours / (effectiveTargetHours || 1)) * 100)}%` }}
                                            />
                                        </div>

                                        {/* DESFASE BADGE (Compact) */}
                                        <div className={clsx(
                                            "mt-1 px-2 py-0.5 rounded-md text-[9px] font-black text-center w-full border",
                                            Math.abs(diff) < 0.5 ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                diff > 0 ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                    "bg-orange-50 text-orange-700 border-orange-100"
                                        )}>
                                            {diff === 0 ? 'OK' : `${diff > 0 ? '+' : ''}${Math.round(diff * 10) / 10}h`}
                                        </div>
                                    </div>
                                </div>

                                {/* Shift Cells (Restored Card Style) */}
                                {weekDates.map(date => {
                                    let shift = currentSchedule?.shifts.find(s => s.employeeId === emp.id && s.date === date);

                                    // LIVE HOLIDAY CHECK: Override shift if it's a holiday in settings
                                    // LIVE HOLIDAY CHECK: Override shift if it's a holiday in settings
                                    const currentSettings = settings.find(s => s.establishmentId === user.establishmentId) || getSettings(user.establishmentId);
                                    const holiday = currentSettings.holidays.find(h => (typeof h === 'string' ? h === date : h.date === date));

                                    if (!isLocked && holiday && (typeof holiday === 'string' || holiday.type === 'full')) {
                                        // If it's a full holiday, we force a specific visual representation
                                        // effectively forcing a "holiday shift" existence for the UI
                                        shift = {
                                            id: `holiday-${date}`, // Dummy ID
                                            employeeId: emp.id,
                                            date: date,
                                            type: 'holiday',
                                            role: 'sales_register', // Dummy role, won't be shown
                                        } as any;
                                    }

                                    // Shift Styling - Darker borders for better visibility
                                    let cellStyle = "bg-slate-50 border-2 border-slate-200";
                                    if (shift) {
                                        switch (shift.type) {
                                            case 'morning': cellStyle = "bg-indigo-50 border-2 border-indigo-300"; break;
                                            case 'afternoon': cellStyle = "bg-orange-50 border-2 border-orange-300"; break;
                                            case 'split': cellStyle = "bg-purple-50 border-2 border-purple-300"; break;
                                            case 'vacation': cellStyle = "bg-teal-50 border-2 border-teal-300 opacity-90 striped-bg"; break;
                                            case 'sick_leave': cellStyle = "bg-rose-50 border-2 border-rose-300"; break;
                                            case 'maternity_paternity': cellStyle = "bg-rose-50 border-2 border-rose-300"; break;
                                            case 'off': cellStyle = "bg-slate-100/50 border-2 border-slate-300"; break;
                                            case 'holiday': cellStyle = "bg-red-50/50 border-2 border-red-300"; break;
                                            default: cellStyle = "bg-gray-50 border-2 border-gray-300";
                                        }
                                    }

                                    const isEditable = !isLocked && currentSchedule && shift && !['vacation', 'sick_leave', 'holiday', 'maternity_paternity'].includes(shift.type);
                                    const isAnyDropdownOpen = activeDropdown?.id === shift?.id;
                                    const isTypeDropdownOpen = isAnyDropdownOpen && activeDropdown?.field === 'type';
                                    const isRoleDropdownOpen = isAnyDropdownOpen && activeDropdown?.field === 'role';

                                    return (
                                        <div key={date} className={clsx("border-l border-slate-100 p-1 relative h-36 min-h-[140px]", isAnyDropdownOpen ? "z-50" : "z-auto")}>
                                            {shift ? (
                                                <div className={clsx("w-full h-full rounded-2xl p-1.5 transition-all relative flex flex-col gap-1 shadow-sm", cellStyle)}>

                                                    {/* HEADER: Type | Hours | Role */}
                                                    <div className="flex gap-1 h-8 shrink-0 relative z-20">
                                                        {/* Type Icon */}
                                                        <div className="relative">
                                                            <button
                                                                disabled={!isEditable}
                                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(current => current?.id === shift.id && current?.field === 'type' ? null : { id: shift.id, field: 'type' }); }}
                                                                className={clsx(
                                                                    "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-sm transition-all border disabled:opacity-50 disabled:cursor-not-allowed",
                                                                    shift.type === 'morning' ? "bg-indigo-500 text-white border-indigo-400" :
                                                                        shift.type === 'afternoon' ? "bg-orange-500 text-white border-orange-400" :
                                                                            shift.type === 'split' ? "bg-purple-500 text-white border-purple-400" :
                                                                                shift.type === 'off' ? "bg-slate-200 text-slate-500 border-slate-300" :
                                                                                    (shift.type === 'sick_leave' || shift.type === 'maternity_paternity') ? "bg-rose-500 text-white border-rose-400" :
                                                                                        "bg-white text-slate-400 border-slate-200"
                                                                )}
                                                            >
                                                                {shift.type === 'morning' ? 'M' :
                                                                    shift.type === 'afternoon' ? 'T' :
                                                                        shift.type === 'split' ? 'P' :
                                                                            (shift.type === 'sick_leave' || shift.type === 'maternity_paternity') ? 'B' : 'L'}
                                                                <ChevronRight size={8} className="rotate-90 opacity-50" />
                                                            </button>
                                                            {isTypeDropdownOpen && (
                                                                <div className={clsx(
                                                                    "absolute left-0 w-28 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-100",
                                                                    index >= storeEmployees.length - 2 ? "bottom-full mb-1 origin-bottom-left" : "top-full mt-1 origin-top-left"
                                                                )}>
                                                                    {['morning', 'afternoon', 'split', 'off'].map(t => (
                                                                        <button key={t} onClick={() => {
                                                                            const currentSettings = settings.find(s => s.establishmentId === user.establishmentId) || getSettings(user.establishmentId);
                                                                            const updates: any = { type: t as ShiftType };

                                                                            if (t === 'morning') {
                                                                                updates.startTime = currentSettings.openingHours.morningStart;
                                                                                updates.endTime = currentSettings.openingHours.morningEnd;
                                                                                // Reset split times if previously set
                                                                                updates.morningEndTime = undefined;
                                                                                updates.afternoonStartTime = undefined;
                                                                            } else if (t === 'afternoon') {
                                                                                updates.startTime = currentSettings.openingHours.afternoonStart;
                                                                                updates.endTime = currentSettings.openingHours.afternoonEnd;
                                                                                // Reset split times if previously set
                                                                                updates.morningEndTime = undefined;
                                                                                updates.afternoonStartTime = undefined;
                                                                            } else if (t === 'split') {
                                                                                updates.startTime = currentSettings.openingHours.morningStart;
                                                                                updates.morningEndTime = currentSettings.openingHours.morningEnd;
                                                                                updates.afternoonStartTime = currentSettings.openingHours.afternoonStart;
                                                                                updates.endTime = currentSettings.openingHours.afternoonEnd;
                                                                            } else if (t === 'off') {
                                                                                updates.startTime = undefined;
                                                                                updates.endTime = undefined;
                                                                                updates.morningEndTime = undefined;
                                                                                updates.afternoonStartTime = undefined;
                                                                            }

                                                                            updateShift(currentSchedule!.id, shift.id, updates);
                                                                            setActiveDropdown(null);
                                                                        }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-50 flex items-center gap-2">
                                                                            <div className={clsx("w-2 h-2 rounded-full", t === 'morning' ? "bg-indigo-500" : t === 'afternoon' ? "bg-orange-500" : t === 'split' ? "bg-purple-500" : "bg-slate-400")} />
                                                                            {t === 'morning' ? 'Mañana' : t === 'afternoon' ? 'Tarde' : t === 'split' ? 'Partido' : 'Libre'}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Hours Badge */}
                                                        {shift.type !== 'off' && (
                                                            <div className="flex items-center justify-center bg-white/80 backdrop-blur-sm px-1.5 rounded-lg border border-slate-200 shadow-sm min-w-[32px] h-8">
                                                                <span className="text-[10px] font-black text-slate-600">
                                                                    {(() => {
                                                                        let duration = 0;
                                                                        if (shift.type === 'morning' || shift.type === 'afternoon') {
                                                                            if (shift.startTime && shift.endTime) {
                                                                                const start = parseInt(shift.startTime.split(':')[0]) + parseInt(shift.startTime.split(':')[1]) / 60;
                                                                                const end = parseInt(shift.endTime.split(':')[0]) + parseInt(shift.endTime.split(':')[1]) / 60;
                                                                                duration = end - start;
                                                                            }
                                                                        } else if (shift.type === 'split') {
                                                                            if (shift.startTime && shift.endTime && shift.morningEndTime && shift.afternoonStartTime) {
                                                                                const mStart = parseInt(shift.startTime.split(':')[0]) + parseInt(shift.startTime.split(':')[1]) / 60;
                                                                                const mEnd = parseInt(shift.morningEndTime.split(':')[0]) + parseInt(shift.morningEndTime.split(':')[1]) / 60;
                                                                                const aStart = parseInt(shift.afternoonStartTime.split(':')[0]) + parseInt(shift.afternoonStartTime.split(':')[1]) / 60;
                                                                                const aEnd = parseInt(shift.endTime.split(':')[0]) + parseInt(shift.endTime.split(':')[1]) / 60;
                                                                                duration = (mEnd - mStart) + (aEnd - aStart);
                                                                            }
                                                                        }
                                                                        if (duration <= 0) return '--';
                                                                        const hours = Math.floor(duration);
                                                                        const minutes = Math.round((duration - hours) * 60);
                                                                        return minutes > 0 ? `${hours}h${minutes}` : `${hours}h`;
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Role Selector */}
                                                        {shift.type !== 'off' && (
                                                            <div className="relative flex-1 h-8">
                                                                <button disabled={!isEditable} onClick={(e) => { e.stopPropagation(); setActiveDropdown(current => current?.id === shift.id && current?.field === 'role' ? null : { id: shift.id, field: 'role' }); }} className="w-full h-full bg-white rounded-xl border border-slate-200 px-2 flex items-center justify-between text-[10px] font-black text-slate-700 shadow-sm hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                                    <span className="truncate">{shift.role === 'sales_register' ? 'Caja V.' : shift.role === 'purchase_register' ? 'Caja C.' : shift.role === 'shuttle' ? 'Lanz.' : shift.role === 'cleaning' ? 'Limp.' : 'Rol'}</span>
                                                                    <ChevronRight size={10} className="rotate-90 opacity-40 shrink-0" />
                                                                </button>
                                                                {isRoleDropdownOpen && (
                                                                    <div className={clsx(
                                                                        "absolute right-0 w-32 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-100",
                                                                        index >= storeEmployees.length - 2 ? "bottom-full mb-1 origin-bottom-right" : "top-full mt-1 origin-top-right"
                                                                    )}>
                                                                        <button onClick={() => { updateShift(currentSchedule!.id, shift.id, { role: undefined }); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-slate-50 text-slate-400 border-b border-slate-50">-- Sin Asignar --</button>
                                                                        {[
                                                                            { v: 'sales_register', l: 'Caja Ventas' },
                                                                            { v: 'purchase_register', l: 'Caja Compras' },
                                                                            { v: 'shuttle', l: 'Lanzadera' },
                                                                            { v: 'cleaning', l: 'Limpieza' }
                                                                        ].map(opt => (
                                                                            <button key={opt.v} onClick={() => {
                                                                                // LOGIC: Update hours based on Role Config
                                                                                const currentSettings = settings.find(s => s.establishmentId === user.establishmentId) || getSettings(user.establishmentId);
                                                                                const roleConfig = currentSettings.roleSchedules?.[opt.v as WorkRole];
                                                                                const updates: any = { role: opt.v as WorkRole };

                                                                                if (roleConfig) {
                                                                                    if (shift.type === 'morning') {
                                                                                        if (roleConfig.type === 'morning') {
                                                                                            if (roleConfig.startTime) updates.startTime = roleConfig.startTime;
                                                                                            if (roleConfig.endTime) updates.endTime = roleConfig.endTime;
                                                                                        } else if (roleConfig.type === 'split') {
                                                                                            if (roleConfig.startTime) updates.startTime = roleConfig.startTime;
                                                                                            if (roleConfig.morningEndTime) updates.endTime = roleConfig.morningEndTime;
                                                                                        }
                                                                                    } else if (shift.type === 'afternoon') {
                                                                                        if (roleConfig.type === 'afternoon') {
                                                                                            if (roleConfig.startTime) updates.startTime = roleConfig.startTime;
                                                                                            if (roleConfig.endTime) updates.endTime = roleConfig.endTime;
                                                                                        } else if (roleConfig.type === 'split') {
                                                                                            if (roleConfig.afternoonStartTime) updates.startTime = roleConfig.afternoonStartTime;
                                                                                            if (roleConfig.endTime) updates.endTime = roleConfig.endTime;
                                                                                        }
                                                                                    } else if (shift.type === 'split' && roleConfig.type === 'split') {
                                                                                        if (roleConfig.startTime) updates.startTime = roleConfig.startTime;
                                                                                        if (roleConfig.morningEndTime) updates.morningEndTime = roleConfig.morningEndTime;
                                                                                        if (roleConfig.afternoonStartTime) updates.afternoonStartTime = roleConfig.afternoonStartTime;
                                                                                        if (roleConfig.endTime) updates.endTime = roleConfig.endTime;
                                                                                    }
                                                                                }

                                                                                updateShift(currentSchedule!.id, shift.id, updates);
                                                                                setActiveDropdown(null);
                                                                            }} className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-slate-50 text-slate-600">{opt.l}</button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* BODY: Inputs (Visual Cards) */}
                                                    {isEditable ? (
                                                        <div className="flex-1 flex flex-col justify-center gap-2">
                                                            {shift.type === 'split' ? (
                                                                <div className="grid grid-cols-2 gap-1.5">
                                                                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-1 overflow-hidden focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 transition-all">
                                                                        <TimeInput value={shift.startTime || ''} onChange={(val) => updateShift(currentSchedule!.id, shift.id, { startTime: val })} className="w-full text-xs font-black text-center text-slate-700" />
                                                                    </div>
                                                                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-1 overflow-hidden focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 transition-all">
                                                                        <TimeInput value={shift.morningEndTime || ''} onChange={(val) => updateShift(currentSchedule!.id, shift.id, { morningEndTime: val })} className="w-full text-xs font-black text-center text-slate-700" />
                                                                    </div>
                                                                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-1 overflow-hidden focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 transition-all">
                                                                        <TimeInput value={shift.afternoonStartTime || ''} onChange={(val) => updateShift(currentSchedule!.id, shift.id, { afternoonStartTime: val })} className="w-full text-xs font-black text-center text-slate-700" />
                                                                    </div>
                                                                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-1 overflow-hidden focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 transition-all">
                                                                        <TimeInput value={shift.endTime || ''} onChange={(val) => updateShift(currentSchedule!.id, shift.id, { endTime: val })} className="w-full text-xs font-black text-center text-slate-700" />
                                                                    </div>
                                                                </div>
                                                            ) : shift.type !== 'off' && (
                                                                <div className={clsx(
                                                                    "flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 focus-within:ring-2 focus-within:ring-offset-1 transition-all",
                                                                    shift.type === 'morning' ? "focus-within:ring-indigo-200 focus-within:border-indigo-300" :
                                                                        shift.type === 'afternoon' ? "focus-within:ring-orange-200 focus-within:border-orange-300" :
                                                                            "focus-within:ring-slate-200"
                                                                )}>
                                                                    <TimeInput
                                                                        value={shift.startTime || ''}
                                                                        onChange={(val) => updateShift(currentSchedule!.id, shift.id, { startTime: val })}
                                                                        className="flex-1 text-sm font-black text-center text-slate-700"
                                                                    />
                                                                    <span className="text-slate-300 font-bold">-</span>
                                                                    <TimeInput
                                                                        value={shift.endTime || ''}
                                                                        onChange={(val) => updateShift(currentSchedule!.id, shift.id, { endTime: val })}
                                                                        className="flex-1 text-sm font-black text-center text-slate-700"
                                                                    />
                                                                </div>
                                                            )}
                                                            {shift.type === 'off' && (
                                                                <div className="flex-1 flex items-center justify-center opacity-30">
                                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Libre</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        /* Read Only - Card Style */
                                                        <div className="flex-1 flex flex-col justify-center items-center">
                                                            {/* Times */}
                                                            {shift.type !== 'off' && shift.type !== 'vacation' && shift.type !== 'sick_leave' && (
                                                                <div className="bg-white/60 rounded-xl px-3 py-2 border border-white/50 shadow-sm mb-1 w-full text-center">
                                                                    {shift.type === 'split' ? (
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="font-mono text-[10px] font-black">{shift.startTime} - {shift.morningEndTime}</span>
                                                                            <span className="font-mono text-[10px] font-black">{shift.afternoonStartTime} - {shift.endTime}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="font-mono text-xs font-black">{shift.startTime} - {shift.endTime}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {/* Off Display */}
                                                            {shift.type === 'off' && (
                                                                <div className="opacity-20 flex flex-col items-center">
                                                                    <Lock size={16} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* FOOTER: Actions */}
                                                    {shift.type !== 'off' && (
                                                        <div className="flex gap-1 h-7 pt-1 border-t border-slate-100/50">
                                                            {['Gerente', 'Subgerente', 'Responsable'].includes(emp.category) && (
                                                                <>
                                                                    <button disabled={!isEditable} onClick={() => updateShift(currentSchedule!.id, shift.id, { isOpening: !shift.isOpening })} className={clsx("flex-1 rounded-lg text-[9px] font-black border flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed", shift.isOpening ? "bg-emerald-100 border-emerald-300 text-emerald-700 shadow-sm" : "bg-white border-slate-200 text-slate-300 hover:text-slate-400 hover:border-slate-300")}>A</button>
                                                                    <button disabled={!isEditable} onClick={() => updateShift(currentSchedule!.id, shift.id, { isClosing: !shift.isClosing })} className={clsx("flex-1 rounded-lg text-[9px] font-black border flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed", shift.isClosing ? "bg-amber-100 border-amber-300 text-amber-700 shadow-sm" : "bg-white border-slate-200 text-slate-300 hover:text-slate-400 hover:border-slate-300")}>C</button>
                                                                </>
                                                            )}
                                                            <button disabled={!isEditable} onClick={() => {
                                                                const shouldActivate = !shift.isIndividualMeeting;
                                                                const updates: any = { isIndividualMeeting: shouldActivate };
                                                                if (shouldActivate) {
                                                                    const currentSettings = settings.find(s => s.establishmentId === user.establishmentId) || getSettings(user.establishmentId);
                                                                    if (currentSettings.individualMeetingStartTime) {
                                                                        updates.startTime = currentSettings.individualMeetingStartTime;
                                                                    }
                                                                }
                                                                updateShift(currentSchedule!.id, shift.id, updates);
                                                            }} className={clsx("flex-1 rounded-lg text-[9px] font-black border flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed", shift.isIndividualMeeting ? "bg-indigo-100 border-indigo-300 text-indigo-700 shadow-sm" : "bg-white border-slate-200 text-slate-300 hover:text-slate-400 hover:border-slate-300")}>RI</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                                                        <Plus size={16} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div >
            </div >

            {/* --- MODALS --- */}


            {/* Other Modals (Preserved Structure) */}
            <StoreConfigModal
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                establishmentId="1"
                onSave={updateSettings}
            />

            <ConfirmDialog
                isOpen={isConfirmRegenerateOpen}
                title="¿Regenerar desde cero?"
                message="Esta acción eliminará cualquier ajuste manual que hayas realizado y generará un nuevo horario base. ¿Continuar?"
                confirmText="Sí, Regenerar"
                cancelText="Cancelar"
                onConfirm={handleConfirmRegenerate}
                onCancel={() => setIsConfirmRegenerateOpen(false)}
                isDestructive={true}
            />

            {/* Loading Overlay */}
            {
                isGenerating && (
                    <div className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-[200]">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse rounded-full"></div>
                            <Loader2 size={64} className="text-indigo-600 animate-spin relative z-10" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mt-8 mb-2">Optimizando Horarios</h3>
                        <p className="text-slate-500 font-medium">Nuestra IA está encontrando la mejor combinación...</p>
                    </div>
                )
            }

            {/* Custom Publish Warning Dialog */}
            {
                showLowHoursDialog && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[85vh]">
                            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                    {dialogMode === 'publish'
                                        ? <ShieldAlert className="text-orange-500" size={24} />
                                        : <AlertTriangle className="text-amber-500" size={24} />
                                    }
                                    <span className="tracking-tight">Validación del Horario</span>
                                </h3>
                                <button
                                    onClick={() => setShowLowHoursDialog(false)}
                                    className="p-2 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    {dialogMode === 'publish'
                                        ? "Antes de enviar a supervisión, hemos detectado algunos puntos que requieren tu atención:"
                                        : "El horario generado tiene las siguientes alertas:"}
                                </p>

                                {pendingStrictWarnings.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Alertas Críticas</h4>
                                        {pendingStrictWarnings.map((w, idx) => (
                                            <div key={idx} className="flex gap-3 bg-red-50 p-3 rounded-xl border border-red-100 text-red-700 text-sm font-medium">
                                                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                                <span>{w}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {pendingDebtAdjustments.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Ajustes de Horas</h4>
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-slate-500 font-bold block md:table-header-group">
                                                    <tr className="border-b border-slate-200">
                                                        <th className="px-4 py-3 text-left">Empleado</th>
                                                        <th className="px-4 py-3 text-center">Objetivo</th>
                                                        <th className="px-4 py-3 text-center">Real</th>
                                                        <th className="px-4 py-3 text-right">Diferencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {pendingDebtAdjustments.map((adj) => (
                                                        <tr key={adj.empId} className="hover:bg-slate-50">
                                                            <td className="px-4 py-3 font-bold text-slate-700">{adj.name}</td>
                                                            <td className="px-4 py-3 text-center text-slate-500">{adj.contract}h</td>
                                                            <td className="px-4 py-3 text-center text-slate-500">{adj.worked}h</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span className={clsx("font-bold", adj.amount > 0 ? "text-emerald-600" : "text-rose-600")}>
                                                                        {adj.amount > 0 ? "+" : ""}{adj.amount}h
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                                <button
                                    onClick={() => setShowLowHoursDialog(false)}
                                    className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all"
                                >
                                    Revisar y Corregir
                                </button>
                                {dialogMode === 'publish' && (
                                    <button
                                        onClick={confirmPublish}
                                        className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                                    >
                                        <span>Confirmar Envío</span>
                                        <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Availability Modal (Used for both Vacations & Availability) */}
            {
                isAvailabilityModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">Centro de Disponibilidad</h3>
                                    <p className="text-slate-500 text-sm font-medium">Gestiona vacaciones, días libres y preferencias</p>
                                </div>
                                <button onClick={() => setIsAvailabilityModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                                {/* Add New Request Form */}
                                <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                                    <h4 className="text-sm font-black uppercase text-indigo-900 tracking-wider mb-4 flex items-center gap-2">
                                        <Plus size={16} /> Nueva Solicitud
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* 1. Employee */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Empleado</label>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsEmployeeSelectorOpen(!isEmployeeSelectorOpen)}
                                                    className="w-full bg-white p-3 rounded-xl border border-slate-200 text-left flex items-center justify-between shadow-sm hover:border-indigo-300 transition-colors"
                                                >
                                                    <span className={selectedEmployeeForRequest ? "text-slate-800 font-bold" : "text-slate-400 font-medium"}>
                                                        {selectedEmployeeForRequest
                                                            ? storeEmployees.find(e => e.id === selectedEmployeeForRequest)?.name
                                                            : "Seleccionar..."}
                                                    </span>
                                                    <ChevronRight size={16} className="rotate-90 text-slate-400" />
                                                </button>
                                                {isEmployeeSelectorOpen && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-60 overflow-y-auto p-2">
                                                        {storeEmployees.map(emp => (
                                                            <button
                                                                key={emp.id}
                                                                onClick={() => { setSelectedEmployeeForRequest(emp.id); setIsEmployeeSelectorOpen(false); }}
                                                                className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700"
                                                            >
                                                                {emp.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Type */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsRequestTypeSelectorOpen(!isRequestTypeSelectorOpen)}
                                                    className="w-full bg-white p-3 rounded-xl border border-slate-200 text-left flex items-center justify-between shadow-sm hover:border-indigo-300 transition-colors"
                                                >
                                                    <span className="text-slate-800 font-bold">
                                                        {requestType === 'day_off' ? 'Día Libre Completo' :
                                                            requestType === 'morning_off' ? 'Mañana Libre' :
                                                                requestType === 'afternoon_off' ? 'Tarde Libre' : 'Otro'}
                                                    </span>
                                                    <ChevronRight size={16} className="rotate-90 text-slate-400" />
                                                </button>
                                                {isRequestTypeSelectorOpen && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                                                        <button
                                                            onClick={() => { setRequestType('day_off'); setIsRequestTypeSelectorOpen(false); }}
                                                            className="w-full text-left p-3 hover:bg-slate-50 text-sm font-medium text-slate-700 border-b border-slate-50 hover:text-indigo-600"
                                                        >
                                                            Día Libre Completo
                                                        </button>
                                                        <button
                                                            onClick={() => { setRequestType('morning_off'); setIsRequestTypeSelectorOpen(false); }}
                                                            className="w-full text-left p-3 hover:bg-slate-50 text-sm font-medium text-slate-700 border-b border-slate-50 hover:text-indigo-600"
                                                        >
                                                            Mañana Libre
                                                        </button>
                                                        <button
                                                            onClick={() => { setRequestType('afternoon_off'); setIsRequestTypeSelectorOpen(false); }}
                                                            className="w-full text-left p-3 hover:bg-slate-50 text-sm font-medium text-slate-700 hover:text-indigo-600"
                                                        >
                                                            Tarde Libre
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3. Button */}
                                        <div className="flex items-end">
                                            <button
                                                onClick={handleSaveRequest}
                                                disabled={!selectedEmployeeForRequest || selectedDatesForRequest.length === 0}
                                                className="w-full bg-indigo-600 text-white font-bold p-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
                                            >
                                                Añadir Solicitud
                                            </button>
                                        </div>
                                    </div>

                                    {/* Days Selection */}
                                    <div className="mt-6">
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Seleccionar Días</label>
                                            <button
                                                onClick={() => setSelectedDatesForRequest(weekDates)}
                                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                                            >
                                                Seleccionar Semana
                                            </button>
                                        </div>
                                        <div className="flex gap-2 bg-white p-2 rounded-xl border border-slate-200 w-fit">
                                            {weekDates.map(date => {
                                                const isSelected = selectedDatesForRequest.includes(date);
                                                return (
                                                    <button
                                                        key={date}
                                                        onClick={() => toggleRequestDate(date)}
                                                        className={clsx(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all",
                                                            isSelected ? "bg-indigo-600 text-white shadow-md transform scale-105" : "text-slate-500 hover:bg-slate-100"
                                                        )}
                                                    >
                                                        {new Date(date).getDate()}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Existing Requests List */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black uppercase text-slate-400 tracking-wider">Solicitudes Activas</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {timeOffRequests
                                            .filter(r => storeEmployees.some(e => e.id === r.employeeId) && r.dates.some(d => weekDates.includes(d)))
                                            .map(req => (
                                                <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={clsx("h-10 w-10 rounded-full flex items-center justify-center text-white", req.type === 'vacation' ? 'bg-teal-500' : 'bg-blue-500')}>
                                                            {req.type === 'vacation' ? <Plane size={18} /> : <Calendar size={18} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800">{storeEmployees.find(e => e.id === req.employeeId)?.name}</div>
                                                            <div className="text-xs text-slate-500 font-medium capitalize">
                                                                {req.type === 'day_off' ? 'Día Libre' :
                                                                    req.type === 'morning_off' ? 'Mañana Libre' :
                                                                        req.type === 'afternoon_off' ? 'Tarde Libre' :
                                                                            req.type === 'vacation' ? 'Vacaciones' :
                                                                                req.type === 'sick_leave' ? 'Baja Médica' :
                                                                                    req.type === 'maternity_paternity' ? 'Baja Mat/Pat' :
                                                                                        req.type.replace('_', ' ')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!isLocked && (
                                                        <button
                                                            onClick={() => { setRequestToDelete(req.id); setIsConfirmDeleteRequestOpen(true); }}
                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        {timeOffRequests.filter(r => storeEmployees.some(e => e.id === r.employeeId) && r.dates.some(d => weekDates.includes(d))).length === 0 && (
                                            <div className="col-span-2 text-center py-8 text-slate-400 font-medium italic">
                                                No hay solicitudes activas para esta semana
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Request Deletion Confirm Dialog */}
            <ConfirmDialog
                isOpen={isConfirmDeleteRequestOpen}
                title="Eliminar Solicitud"
                message="¿Estás seguro de que quieres eliminar esta solicitud?"
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

            {/* Permanent Request Edit Modal */}
            <PermanentRequestsModal
                isOpen={!!editingPermanentRequest}
                onClose={() => setEditingPermanentRequest(null)}
                employees={storeEmployees}
                requests={permanentRequests}
                onAdd={(req) => {
                    addPermanentRequest(req);
                    showToast('Petición añadida correctamente', 'success');
                }}
                onRemove={(id) => {
                    removePermanentRequest(id);
                    showToast('Petición eliminada', 'success');
                }}
                initialEmployeeId={editingPermanentRequest?.employeeId}
            />

            {/* SICK LEAVE MODAL */}
            {
                isSickLeaveModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
                            <h3 className="text-xl font-bold text-slate-800 mb-6">Registrar Baja Médica</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Empleado</label>
                                    <CustomSelect
                                        options={storeEmployees.map(e => ({ value: e.id, label: e.name }))}
                                        value={selectedEmployeeForSickLeave}
                                        onChange={(val) => setSelectedEmployeeForSickLeave(val as string)}
                                        placeholder="Selecciona un empleado..."
                                        icon={Users}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Días de Baja</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {weekDates.map(date => (
                                            <button
                                                key={date}
                                                onClick={() => toggleSickDate(date)}
                                                className={clsx(
                                                    "p-2 rounded-lg text-sm font-bold transition-all",
                                                    selectedSickLeaveDates.includes(date)
                                                        ? "bg-orange-500 text-white shadow-md"
                                                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                                )}
                                            >
                                                {new Date(date).getDate()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Active Sick Leaves List */}
                            {selectedEmployeeForSickLeave && (
                                <div className="mt-6 border-t border-slate-100 pt-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Bajas Activas</h4>
                                    <div className="space-y-2">
                                        {timeOffRequests
                                            .filter(req => req.employeeId === selectedEmployeeForSickLeave && req.type === 'sick_leave')
                                            .map(req => (
                                                <div key={req.id} className="flex justify-between items-center bg-rose-50 p-3 rounded-xl border border-rose-100">
                                                    <div>
                                                        <div className="text-xs font-bold text-rose-800 uppercase tracking-wider">Baja Médica</div>
                                                        <div className="text-xs font-medium text-rose-600 mt-0.5">
                                                            {req.startDate && req.endDate
                                                                ? `${new Date(req.startDate).toLocaleDateString()} - ${new Date(req.endDate).toLocaleDateString()}`
                                                                : req.dates.map(d => new Date(d).getDate()).join(', ')}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeTimeOff(req.id)}
                                                        className="p-2 text-rose-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-colors"
                                                        title="Eliminar baja"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        {timeOffRequests.filter(req => req.employeeId === selectedEmployeeForSickLeave && req.type === 'sick_leave').length === 0 && (
                                            <div className="text-center py-4 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                                                No hay bajas activas registradas
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="mt-8 flex justify-end gap-3">
                                <button onClick={() => setIsSickLeaveModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                                <button
                                    onClick={handleSaveSickLeave}
                                    disabled={!selectedEmployeeForSickLeave || selectedSickLeaveDates.length === 0}
                                    className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 disabled:opacity-50 disabled:shadow-none"
                                >
                                    Confirmar Baja
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modification Modal */}
            {
                isModificationModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95">
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Solicitar Modificación</h3>
                            <p className="text-slate-500 text-sm mb-6">Explica la razón por la que necesitas modificar este horario aprobado.</p>

                            <textarea
                                value={modificationReason}
                                onChange={(e) => setModificationReason(e.target.value)}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-700"
                                placeholder="Ej: Necesidad de cubrir baja imprevista..."
                                autoFocus
                            />

                            <div className="mt-6 flex justify-end gap-3">
                                <button onClick={() => setIsModificationModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                                <button
                                    onClick={handleRequestModification}
                                    disabled={!modificationReason.trim()}
                                    className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                                >
                                    Enviar Solicitud
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <VacationModal
                isOpen={isVacationModalOpen}
                onClose={() => setIsVacationModalOpen(false)}
                selectedEmployeeId={vacEmpId}
                onEmployeeSelect={setVacEmpId}
            />

            <TempHoursModal
                isOpen={isTempHoursModalOpen}
                onClose={() => {
                    setIsTempHoursModalOpen(false);
                    setEditingTempHoursId(null);
                    setTempEmpId('');
                }}
                preSelectedEmployeeId={tempEmpId}
                editData={editingTempHoursId}
            />

        </div >
    );
};

export default Schedule;
