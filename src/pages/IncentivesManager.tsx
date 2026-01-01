import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
    Coins, Plus, Minus, Send, FileText, AlertCircle, Save,
    Store, ChevronDown, ChevronLeft, ChevronRight, X,
    TrendingUp, Wallet, ArrowUpRight, Sparkles, Trophy, Award
} from 'lucide-react';
import { clsx } from 'clsx';
import type { IncentiveReport, IncentiveAdjustment, IncentiveItem } from '../types';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';

const IncentivesManager = () => {
    const { user } = useAuth();
    const { incentiveReports, updateIncentiveReport, employees, updateHoursDebt } = useStore();
    const { showToast } = useToast();

    // Month Navigation
    const [currentDate, setCurrentDate] = useState(new Date());

    // Derived Month String (YYYY-MM)
    const currentMonthStr = useMemo(() => {
        return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    }, [currentDate]);

    const isFutureOrCurrentMonth = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11

        const viewYear = currentDate.getFullYear();
        const viewMonth = currentDate.getMonth(); // 0-11

        if (viewYear > currentYear) return true;
        if (viewYear === currentYear && viewMonth >= currentMonth) return true;
        return false;
    }, [currentDate]);

    // Format for display
    const formatCurrentMonth = () => {
        const str = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    // Find Report
    const globalReport = useMemo(() => {
        if (!user?.establishmentId) return null;
        return incentiveReports.find(r => r.establishmentId === user.establishmentId && r.month === currentMonthStr);
    }, [incentiveReports, user?.establishmentId, currentMonthStr]);

    // Local state for the report (to allow editing before saving if needed, or just direct sync)
    // We'll trust global store for simplicity unless specific "Draft mode" logic is needed. 
    // Usually for managers, we might want direct edits to store for responsiveness, or local state + debounce.
    // Given the previous code used `handleSave`, it likely implies local state or manual save.
    // However, for consistency with `handlePayIncentives` (which updates store directly), 
    // let's stick to reading from store but using a local "working copy" if we want a Save button.
    // Actually, the previous view showed `handleSave` which implies explicit save.
    // Let's use local state initialized from globalReport.

    const [report, setReport] = useState<IncentiveReport | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Initialize/Sync Report
    useEffect(() => {
        if (globalReport) {
            setReport(JSON.parse(JSON.stringify(globalReport))); // Deep copy
            setIsDirty(false);
        } else {
            // Create Placeholder/Empty Report if it's current or past month?
            // Usually we create one if it doesn't exist for the *current* month.
            // But let's just default to null and handle "No Report" state or auto-create.
            // For now, let's auto-create in memory if it's the current month.
            if (user?.establishmentId) {
                const now = new Date();
                const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                if (currentMonthStr === nowStr) {
                    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

                    const storeEmployees = employees.filter(e => {
                        if (e.establishmentId !== user.establishmentId) return false;
                        if (e.active) return true;

                        // Check history for termination
                        const termination = e.history?.find(h => h.type === 'terminated');
                        if (termination) {
                            const termDate = new Date(termination.date);
                            // Include if termination is after start of month
                            return termDate >= startOfMonth;
                        }
                        return false;
                    });

                    const newReport: IncentiveReport = {
                        id: crypto.randomUUID(),
                        establishmentId: user.establishmentId,
                        month: currentMonthStr,
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
                            total: 0,
                            responsibility_bonus_amount: 0
                        })),
                        updatedAt: new Date().toISOString()
                    };
                    setReport(newReport);
                    setIsDirty(true); // Technically new
                } else {
                    setReport(null);
                }
            }
        }
    }, [globalReport, currentMonthStr, user?.establishmentId, employees]); // Depend on globalReport reference

    // Helpers
    const isLocked = report ? (report.status !== 'draft' && report.status !== 'changes_requested') : true;

    // Recalculate Item Total
    const calculateItemTotal = (item: IncentiveItem, reportVal: IncentiveReport) => {
        const base = item.baseAmount || 0;
        const plus = item.pluses.reduce((a, b) => a + b.amount, 0);
        const deduc = item.deductions.reduce((a, b) => a + b.amount, 0);

        // Use report values or defaults
        const vCapt = reportVal.value_per_captacion || 0;
        const vMeca = reportVal.value_per_mecanizacion || 0;
        const vHour = reportVal.value_per_extra_hour || 0;

        const micros = (item.micros_aptacion_qty || 0) * vCapt +
            (item.micros_mecanizacion_qty || 0) * vMeca;

        const hours = (item.hours_payment_qty || 0) * vHour;
        const resp = item.responsibility_bonus_amount || 0;

        return base + plus - deduc + micros + resp + hours;
    };

    // Handlers
    const handleBaseChange = (empId: string, val: string) => {
        if (!report || isLocked) return;
        const amount = parseFloat(val) || 0;

        const updatedItems = report.items.map(item => {
            if (item.employeeId === empId) {
                const newItem = { ...item, baseAmount: amount };
                newItem.total = calculateItemTotal(newItem, report);
                return newItem;
            }
            return item;
        });
        setReport({ ...report, items: updatedItems });
        setIsDirty(true);
    };

    const handleMicroChange = (empId: string, field: 'micros_aptacion_qty' | 'micros_mecanizacion_qty', val: string) => {
        if (!report || isLocked) return;
        const qty = parseFloat(val) || 0;

        const updatedItems = report.items.map(item => {
            if (item.employeeId === empId) {
                const newItem = { ...item, [field]: qty };
                newItem.total = calculateItemTotal(newItem, report);
                return newItem;
            }
            return item;
        });
        setReport({ ...report, items: updatedItems });
        setIsDirty(true);
    };

    // Adjustment Modal State
    const [adjustmentModal, setAdjustmentModal] = useState<{
        isOpen: boolean;
        type: 'plus' | 'deduction';
        employeeId: string;
    }>({ isOpen: false, type: 'plus', employeeId: '' });

    const [adjDescription, setAdjDescription] = useState('');
    const [adjAmount, setAdjAmount] = useState('');

    const handleAddAdjustment = () => {
        if (!report || !adjustmentModal.employeeId || !adjDescription || !adjAmount) return;

        const amount = parseFloat(adjAmount);
        if (amount <= 0) return;

        const newAdj: IncentiveAdjustment = {
            id: crypto.randomUUID(),
            description: adjDescription,
            amount: amount
        };

        const updatedItems = report.items.map(item => {
            if (item.employeeId === adjustmentModal.employeeId) {
                const newItem = {
                    ...item,
                    pluses: adjustmentModal.type === 'plus' ? [...item.pluses, newAdj] : item.pluses,
                    deductions: adjustmentModal.type === 'deduction' ? [...item.deductions, newAdj] : item.deductions
                };
                newItem.total = calculateItemTotal(newItem, report);
                return newItem;
            }
            return item;
        });

        setReport({ ...report, items: updatedItems });
        setIsDirty(true);
        setAdjustmentModal({ ...adjustmentModal, isOpen: false });
        setAdjDescription('');
        setAdjAmount('');
    };

    const removeAdjustment = (empId: string, adjId: string, type: 'plus' | 'deduction') => {
        if (!report || isLocked) return;

        const updatedItems = report.items.map(item => {
            if (item.employeeId === empId) {
                const newItem = {
                    ...item,
                    pluses: type === 'plus' ? item.pluses.filter(a => a.id !== adjId) : item.pluses,
                    deductions: type === 'deduction' ? item.deductions.filter(a => a.id !== adjId) : item.deductions
                };
                newItem.total = calculateItemTotal(newItem, report);
                return newItem;
            }
            return item;
        });
        setReport({ ...report, items: updatedItems });
        setIsDirty(true);
    };

    // Return Hours Modal
    const [returnHoursModal, setReturnHoursModal] = useState<{ isOpen: boolean, employeeId: string, maxQty: number }>({ isOpen: false, employeeId: '', maxQty: 0 });
    const [returnAmount, setReturnAmount] = useState('');

    const handleReturnHours = () => {
        if (!report || !returnHoursModal.employeeId) return;
        const qty = parseFloat(returnAmount);
        if (!qty || qty <= 0 || qty > returnHoursModal.maxQty) {
            showToast('Cantidad inválida', 'error');
            return;
        }

        // 1. Add back to hours bank
        updateHoursDebt(returnHoursModal.employeeId, qty, 'Devolución desde incentivos');

        // 2. Update local report
        const updatedItems = report.items.map(item => {
            if (item.employeeId === returnHoursModal.employeeId) {
                const newItem = { ...item, hours_payment_qty: (item.hours_payment_qty || 0) - qty };
                newItem.total = calculateItemTotal(newItem, report);
                return newItem;
            }
            return item;
        });

        // Save immediately to avoid Sync issues (as per previous task)
        const newReport = { ...report, items: updatedItems, updatedAt: new Date().toISOString() };
        setReport(newReport);
        updateIncentiveReport(newReport);
        setIsDirty(false); // Saved

        setReturnHoursModal({ isOpen: false, employeeId: '', maxQty: 0 });
        setReturnAmount('');
        showToast('Horas devueltas correctamente', 'success');
    };

    const handleSave = () => {
        if (report) {
            updateIncentiveReport(report);
            setIsDirty(false);
            showToast('Cambios guardados', 'success');
        }
    };

    // Confirm Submission
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const confirmSubmit = () => {
        if (report) {
            const finalReport = {
                ...report,
                status: 'pending_approval' as const,
                updatedAt: new Date().toISOString()
            };
            updateIncentiveReport(finalReport);
            setReport(finalReport);
            setIsDirty(false);
            setConfirmModalOpen(false);
            showToast('Reporte enviado a supervisión', 'success');
        }
    };

    // Stats
    const totalDistributed = report ? report.items.reduce((acc, item) => acc + item.total, 0) : 0;
    const topEarner = report ? report.items.reduce((prev, current) => (prev.total > current.total) ? prev : current, report.items[0]) : null;



    if (!user || !user.establishmentId) return null;

    if (!report) {
        return (
            <div className="flex flex-col h-full bg-slate-50/50">
                {/* Header Nav - Simplified for No Report */}
                <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-40">
                    <div className="max-w-[1920px] mx-auto px-6 h-20 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-full pr-5">
                                <div className="p-2 bg-white rounded-full shadow-sm text-indigo-600"><Store size={20} /></div>
                                <span className="font-bold text-slate-700 text-sm hidden md:block">
                                    {DEFAULT_STORE_NAMES[user.establishmentId] || 'Mi Tienda'}
                                </span>
                            </div>
                            <div className="h-8 w-px bg-slate-200"></div>
                            <div className="flex items-center gap-4 select-none">
                                <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors">
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="px-4 font-black text-sm uppercase text-slate-700 w-32 text-center">{formatCurrentMonth()}</span>
                                <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <FileText size={64} className="opacity-20 mb-4" />
                    <p>No hay reporte de incentivos para este mes.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-40 transition-all duration-300">
                <div className="max-w-[1920px] mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        {/* Store Badge */}
                        <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-full pr-5">
                            <div className="p-2 bg-white rounded-full shadow-sm text-indigo-600 group-hover:scale-110 transition-transform">
                                <Store size={20} />
                            </div>
                            <span className="font-bold text-slate-700 text-sm hidden md:block truncate max-w-[200px]">
                                {DEFAULT_STORE_NAMES[user.establishmentId] || 'Mi Tienda'}
                            </span>
                        </div>

                        <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                        {/* Month Nav */}
                        <div className="flex items-center gap-4 select-none">
                            <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-4 font-black text-sm uppercase text-slate-700 w-32 text-center">{formatCurrentMonth()}</span>
                            <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center gap-4">
                        <div className="hidden lg:flex items-center gap-3 px-5 py-2 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 rounded-2xl border border-emerald-500/10">
                            <div className="p-1.5 bg-emerald-500 text-white rounded-lg shadow-sm">
                                <Wallet size={16} />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest">Total Repartido</p>
                                <p className="text-lg font-black text-slate-800 leading-none">{totalDistributed.toFixed(2)}€</p>
                            </div>
                        </div>

                        <div className={clsx("px-4 py-2 rounded-2xl border flex items-center gap-3 shadow-sm transition-all",
                            report.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                report.status === 'pending_approval' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-white/50 text-slate-600 border-slate-200/50 backdrop-blur-sm"
                        )}>
                            <div className={clsx("w-2 h-2 rounded-full animate-pulse",
                                report.status === 'approved' ? "bg-emerald-500" :
                                    report.status === 'pending_approval' ? "bg-amber-500" :
                                        "bg-slate-400"
                            )} />
                            <span className="text-xs font-black uppercase tracking-wide">
                                {report.status === 'draft' ? 'Borrador' :
                                    report.status === 'pending_approval' ? 'Pendiente' :
                                        report.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                            </span>
                        </div>

                        {!isLocked && (
                            <>
                                <button onClick={handleSave} className="p-3 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-md transition-all group" title="Guardar">
                                    <Save size={20} className="group-hover:scale-110 transition-transform" />
                                </button>
                                <button
                                    onClick={() => setConfirmModalOpen(true)}
                                    disabled={isFutureOrCurrentMonth}
                                    title={isFutureOrCurrentMonth ? "Solo se pueden enviar incentivos de meses pasados" : "Enviar a Supervisión"}
                                    className={`px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest text-white shadow-lg transition-all flex items-center gap-2 ${isFutureOrCurrentMonth ? 'bg-slate-300 cursor-not-allowed opacity-70' : 'bg-slate-900 shadow-indigo-500/20 hover:bg-indigo-600 hover:scale-105 active:scale-95'}`}
                                >
                                    Enviar <Send size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1920px] mx-auto p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

                {/* Feedback Area */}
                {report.status === 'changes_requested' && (
                    <div className="bg-white/80 backdrop-blur-xl border border-red-100 p-6 rounded-[2rem] shadow-xl shadow-red-500/5 flex gap-4 items-center mb-8">
                        <div className="p-3 bg-red-50 text-red-500 rounded-2xl shrink-0"><AlertCircle /></div>
                        <div>
                            <h3 className="text-lg font-black text-red-900">Corrección Requerida</h3>
                            <p className="text-red-600/80 font-medium">{report.supervisorNotes}</p>
                        </div>
                    </div>
                )}

                {/* Dynamic Grid Header */}
                <div className="grid grid-cols-12 gap-4 px-8 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest select-none">
                    <div className="col-span-3">Empleado / Categoría</div>
                    <div className="col-span-1 text-center">Incentivo Base</div>
                    <div className="col-span-2 text-center">Objetutos / Horas</div>
                    <div className="col-span-4">Ajustes & Extras</div>
                    <div className="col-span-2 text-right">Total Percibido</div>
                </div>

                {/* Employee Cards List */}
                <div className="space-y-3">
                    {report.items.map((item, idx) => {
                        const emp = employees.find(e => e.id === item.employeeId);
                        const isTopEarner = topEarner && topEarner.employeeId === item.employeeId && item.total > 0;

                        return (
                            <div
                                key={item.employeeId}
                                className={`group relative bg-white border border-slate-100 rounded-[2rem] p-4 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300 ${isTopEarner ? 'ring-2 ring-amber-400/30' : ''}`}
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                {isTopEarner && (
                                    <div className="absolute -top-3 -right-3 bg-gradient-to-br from-amber-300 to-amber-500 text-white p-2 rounded-xl shadow-lg shadow-amber-500/30 z-10 animate-bounce">
                                        <Trophy size={16} fill="currentColor" />
                                    </div>
                                )}

                                <div className="grid grid-cols-12 gap-6 items-center">
                                    {/* INFO COL */}
                                    <div className="col-span-3 flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center font-black text-lg shadow-inner group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors duration-300">
                                                {emp?.initials || item.employeeName.charAt(0)}
                                            </div>
                                            <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${emp?.active ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm leading-tight mb-1">{item.employeeName}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider">{emp?.category || 'General'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BASE INPUT */}
                                    <div className="col-span-1 px-1">
                                        <div className="relative group/input transition-all duration-300 hover:scale-105">
                                            <div className="absolute inset-0 bg-slate-100 rounded-2xl transform transition-transform group-focus-within/input:scale-x-105 group-focus-within/input:scale-y-110 group-focus-within/input:bg-white group-focus-within/input:shadow-lg group-focus-within/input:shadow-indigo-500/10 group-focus-within/input:ring-2 group-focus-within/input:ring-indigo-500/20"></div>
                                            <Coins size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 z-10 group-focus-within/input:text-indigo-500 transition-colors" />
                                            <input
                                                type="number"
                                                value={item.baseAmount || ''}
                                                onChange={(e) => handleBaseChange(item.employeeId, e.target.value)}
                                                disabled={isLocked}
                                                className="relative w-full bg-transparent border-none py-4 text-center font-black text-slate-700 focus:ring-0 z-10 p-0 text-sm placeholder:text-slate-300"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    {/* MICROS & HOURS INPUTS */}
                                    <div className="col-span-2">
                                        <div className="flex gap-1 bg-slate-50/50 p-1 rounded-2xl border border-slate-100">
                                            <div className="flex-1 relative group/micro">
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-1.5 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest shadow-sm">Capt</div>
                                                <input
                                                    type="number"
                                                    value={item.micros_aptacion_qty || ''}
                                                    onChange={(e) => handleMicroChange(item.employeeId, 'micros_aptacion_qty', e.target.value)}
                                                    disabled={isLocked}
                                                    className="w-full bg-transparent text-center font-bold text-slate-600 py-2.5 focus:outline-none focus:text-indigo-600 transition-colors text-xs"
                                                    placeholder="-"
                                                />
                                            </div>
                                            <div className="w-px bg-slate-200 my-2"></div>
                                            <div className="flex-1 relative group/micro">
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-1.5 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest shadow-sm">Meca</div>
                                                <input
                                                    type="number"
                                                    value={item.micros_mecanizacion_qty || ''}
                                                    onChange={(e) => handleMicroChange(item.employeeId, 'micros_mecanizacion_qty', e.target.value)}
                                                    disabled={isLocked}
                                                    className="w-full bg-transparent text-center font-bold text-slate-600 py-2.5 focus:outline-none focus:text-indigo-600 transition-colors text-xs"
                                                    placeholder="-"
                                                />
                                            </div>
                                            <div className="w-px bg-slate-200 my-2"></div>
                                            <div className="flex-1 relative group/micro">
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-50 px-1.5 rounded text-[8px] font-black text-indigo-400 uppercase tracking-widest shadow-sm">Horas</div>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={item.hours_payment_qty || ''}
                                                        readOnly
                                                        title="Gestionar desde Bolsa de Horas"
                                                        className="w-full bg-transparent text-center font-bold text-indigo-600 py-2.5 focus:outline-none cursor-default text-xs"
                                                        placeholder="-"
                                                    />
                                                    {!isLocked && (item.hours_payment_qty || 0) > 0 && (
                                                        <button
                                                            onClick={() => setReturnHoursModal({ isOpen: true, employeeId: item.employeeId, maxQty: item.hours_payment_qty || 0 })}
                                                            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors"
                                                            title="Devolver a bolsa"
                                                        >
                                                            <ArrowUpRight size={10} className="rotate-180" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ADJUSTMENTS */}
                                    <div className="col-span-4">
                                        <div className="flex flex-wrap gap-2">
                                            {/* Responsibility Bonus (Visible ONLY when Approved) */}
                                            {report.status === 'approved' && (item.responsibility_bonus_amount || 0) > 0 && (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 text-violet-700 text-xs font-bold border border-violet-200 shadow-sm cursor-default" title="Plus de Responsabilidad">
                                                    <Award size={12} strokeWidth={3} /> {item.responsibility_bonus_amount}€
                                                </div>
                                            )}

                                            {item.pluses.map(adj => (
                                                <div key={adj.id} title={adj.description} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-400/10 text-emerald-700 text-xs font-bold border border-emerald-400/20 shadow-sm cursor-default group/adj hover:bg-emerald-500 hover:text-white transition-all">
                                                    <ArrowUpRight size={12} strokeWidth={3} /> {adj.amount}€
                                                    {!isLocked && <button onClick={() => removeAdjustment(item.employeeId, adj.id, 'plus')} className="ml-1 opacity-0 group-hover/adj:opacity-100 hover:bg-white/20 rounded p-0.5 transition-all"><X size={10} /></button>}
                                                </div>
                                            ))}
                                            {item.deductions.map(adj => (
                                                <div key={adj.id} title={adj.description} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-400/10 text-rose-700 text-xs font-bold border border-rose-400/20 shadow-sm cursor-default group/adj hover:bg-rose-500 hover:text-white transition-all">
                                                    <ArrowUpRight size={12} strokeWidth={3} className="rotate-90" /> {adj.amount}€
                                                    {!isLocked && <button onClick={() => removeAdjustment(item.employeeId, adj.id, 'deduction')} className="ml-1 opacity-0 group-hover/adj:opacity-100 hover:bg-white/20 rounded p-0.5 transition-all"><X size={10} /></button>}
                                                </div>
                                            ))}

                                            {!isLocked && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => setAdjustmentModal({ isOpen: true, type: 'plus', employeeId: item.employeeId })} className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 border border-slate-200 hover:border-emerald-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm">
                                                        <Plus size={14} strokeWidth={3} />
                                                    </button>
                                                    <button onClick={() => setAdjustmentModal({ isOpen: true, type: 'deduction', employeeId: item.employeeId })} className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-200 hover:border-rose-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm">
                                                        <Minus size={14} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* TOTAL */}
                                    <div className="col-span-2 text-right">
                                        <div className="inline-flex flex-col items-end">
                                            <span className="text-3xl font-black text-slate-800 tracking-tighter tabular-nums drop-shadow-sm">{item.total.toFixed(2)}€</span>
                                            {report.value_responsibility_bonus && (
                                                <span className="flex items-center gap-1 text-[9px] font-black text-indigo-400 uppercase tracking-wide">
                                                    <Sparkles size={10} /> + Variables
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* NEW ADJUSTMENT MODAL */}
            {adjustmentModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100%] opacity-20 ${adjustmentModal.type === 'plus' ? 'bg-emerald-400' : 'bg-rose-400'}`} />

                        <div className="relative z-10">
                            <h3 className="text-2xl font-black text-slate-900 mb-2 flex items-center gap-3">
                                {adjustmentModal.type === 'plus' ?
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Plus size={24} /></div> :
                                    <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><Minus size={24} /></div>
                                }
                                {adjustmentModal.type === 'plus' ? 'Añadir Extra' : 'Aplicar Deducción'}
                            </h3>
                            <p className="text-slate-500 font-medium ml-1">Especifica el motivo y la cantidad del ajuste.</p>

                            <div className="space-y-6 mt-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Motivo</label>
                                    <input
                                        autoFocus
                                        value={adjDescription}
                                        onChange={e => setAdjDescription(e.target.value)}
                                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-5 font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-slate-900/5 transition-all focus:bg-white shadow-inner"
                                        placeholder="Ej: Objetivo Ventas, Retrasos..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Importe (€)</label>
                                    <input
                                        type="number"
                                        value={adjAmount}
                                        onChange={e => setAdjAmount(e.target.value)}
                                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-5 font-black text-2xl text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-slate-900/5 transition-all focus:bg-white shadow-inner"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setAdjustmentModal({ ...adjustmentModal, isOpen: false })} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancelar</button>
                                    <button
                                        onClick={handleAddAdjustment}
                                        className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-lg transform active:scale-95 transition-all ${adjustmentModal.type === 'plus' ? 'bg-slate-900 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-slate-900 hover:bg-rose-600 shadow-rose-500/20'}`}
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {confirmModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200 border-4 border-slate-50 text-center">
                        <div className="w-20 h-20 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center mb-6 mx-auto shadow-inner">
                            <Send size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">¿Enviar Reporte?</h3>
                        <p className="text-slate-500 mb-8 font-medium">El reporte pasará a estado de revisión y no podrás editarlo hasta que sea verificado.</p>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setConfirmModalOpen(false)}
                                className="flex-1 py-4 text-slate-400 hover:text-slate-800 font-black text-xs uppercase tracking-widest bg-transparent hover:bg-slate-50 rounded-2xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmSubmit}
                                className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-slate-900 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                            >
                                Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RETURN HOURS MODAL */}
            {returnHoursModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ArrowUpRight size={32} className="rotate-180" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900">Devolver Horas</h3>
                            <p className="text-slate-500 font-medium">Reintegrar horas a la bolsa del empleado</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cantidad (Max: {returnHoursModal.maxQty})</label>
                                <input
                                    type="number"
                                    autoFocus
                                    value={returnAmount}
                                    onChange={e => setReturnAmount(e.target.value)}
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-5 font-black text-3xl text-center text-slate-800 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                                    placeholder="0"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setReturnHoursModal({ isOpen: false, employeeId: '', maxQty: 0 })}
                                    className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleReturnHours}
                                    className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncentivesManager;
