import { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Coins, Plus, Minus, Send, FileText, AlertCircle, Save, Trash2, History, Store, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { IncentiveReport, IncentiveAdjustment } from '../types';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';

// Generate stores list dynamically from config
const ALL_STORES = Object.entries(DEFAULT_STORE_NAMES).map(([id, name]) => ({
    id,
    name
}));

const IncentivesManager = () => {
    const { employees, incentiveReports, updateIncentiveReport } = useStore();
    const { user } = useAuth();

    // Determine available stores based on user role
    const availableStores = user?.role === 'admin'
        ? ALL_STORES
        : ALL_STORES.filter(s => s.id === user?.establishmentId);

    const [selectedStoreId, setSelectedStoreId] = useState<string>(availableStores[0]?.id || '1');
    const [isStoreOpen, setIsStoreOpen] = useState(false);

    useEffect(() => {
        if (availableStores.length > 0 && !availableStores.find(s => s.id === selectedStoreId)) {
            setSelectedStoreId(availableStores[0].id);
        }
    }, [availableStores, selectedStoreId]);

    const [currentMonth, setCurrentMonth] = useState<string>('');
    const [report, setReport] = useState<IncentiveReport | null>(null);

    // Modals
    const [adjustmentModal, setAdjustmentModal] = useState<{
        isOpen: boolean;
        type: 'plus' | 'deduction';
        employeeId: string;
    }>({ isOpen: false, type: 'plus', employeeId: '' });

    const [adjDescription, setAdjDescription] = useState('');
    const [adjAmount, setAdjAmount] = useState('');

    useEffect(() => {
        // Default to "Previous Month" on load
        const now = new Date();
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const yyyy = prevMonthDate.getFullYear();
        const mm = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
        const monthStr = `${yyyy}-${mm}`;
        setCurrentMonth(monthStr);
    }, []);

    const changeMonth = (delta: number) => {
        if (!currentMonth) return;
        const [y, m] = currentMonth.split('-').map(Number);
        const newDate = new Date(y, m - 1 + delta, 1);
        const yyyy = newDate.getFullYear();
        const mm = String(newDate.getMonth() + 1).padStart(2, '0');
        setCurrentMonth(`${yyyy}-${mm}`);
    };

    const formatCurrentMonth = () => {
        if (!currentMonth) return '';
        const [y, m] = currentMonth.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    useEffect(() => {
        if (selectedStoreId && currentMonth) {
            const existing = incentiveReports.find(r => r.establishmentId === selectedStoreId && r.month === currentMonth);
            if (existing) {
                setReport(existing);
            } else {
                // Initialize draft based on employees ACTIVE in that month
                const storeEmployees = employees.filter(e => e.establishmentId === selectedStoreId && e.active);

                const newReport: IncentiveReport = {
                    id: crypto.randomUUID(),
                    establishmentId: selectedStoreId,
                    month: currentMonth,
                    status: 'draft',
                    items: storeEmployees.map(e => ({
                        employeeId: e.id,
                        employeeName: e.name,
                        baseAmount: 0,
                        pluses: [],
                        deductions: [],
                        micros_aptacion_qty: 0,
                        micros_mecanizacion_qty: 0,
                        total: 0
                    })),
                    updatedAt: new Date().toISOString()
                };
                setReport(newReport);
            }
        }
    }, [selectedStoreId, currentMonth, incentiveReports, employees]);

    const handleBaseChange = (empId: string, val: string) => {
        if (!report) return;
        const amount = parseFloat(val) || 0;
        const updatedItems = report.items.map(item => {
            if (item.employeeId === empId) {
                // For Manager view, let's keep total as Base + Pluses - Deductions. 
                // The "Micros" and "Responsibility" values are strictly Supervisor domain for VALUATION.
                // ACTUALLY requirement says: "Supervisor indicara el valor... en su pantalla".
                // So manager just enters Quantity. Manager total might NOT include micros if they don't know the price?
                // Or maybe they do. Let's assume Manager just sees/enters Quantities and Base/Extras. 
                // Let's recalculate total focusing on Base/Extras only for now, OR include micros if prices happen to be there.

                const plus = item.pluses.reduce((a, b) => a + b.amount, 0);
                const deduc = item.deductions.reduce((a, b) => a + b.amount, 0);

                // If report has values, use them.
                const microsVal = (item.micros_aptacion_qty || 0) * (report.value_per_captacion || 0) +
                    (item.micros_mecanizacion_qty || 0) * (report.value_per_mecanizacion || 0);

                const respVal = item.responsibility_bonus_amount || 0;

                const newTotal = amount + plus - deduc + microsVal + respVal;

                return { ...item, baseAmount: amount, total: newTotal };
            }
            return item;
        });
        setReport({ ...report, items: updatedItems, updatedAt: new Date().toISOString() });
    };

    const handleMicroChange = (empId: string, field: 'micros_aptacion_qty' | 'micros_mecanizacion_qty', val: string) => {
        if (!report) return;
        const qty = parseInt(val) || 0;
        const updatedItems = report.items.map(item => {
            if (item.employeeId === empId) {
                const newItem = { ...item, [field]: qty };

                // Recalc Total
                const plus = newItem.pluses.reduce((a, b) => a + b.amount, 0);
                const deduc = newItem.deductions.reduce((a, b) => a + b.amount, 0);
                const microsVal = (newItem.micros_aptacion_qty || 0) * (report.value_per_captacion || 0) +
                    (newItem.micros_mecanizacion_qty || 0) * (report.value_per_mecanizacion || 0);
                const respVal = newItem.responsibility_bonus_amount || 0;

                newItem.total = newItem.baseAmount + plus - deduc + microsVal + respVal;
                return newItem;
            }
            return item;
        });
        setReport({ ...report, items: updatedItems, updatedAt: new Date().toISOString() });
    };

    const handleAddAdjustment = () => {
        if (!report || !adjustmentModal.employeeId) return;
        const amount = parseFloat(adjAmount);
        if (!amount || !adjDescription) return;

        const newAdj: IncentiveAdjustment = {
            id: crypto.randomUUID(),
            description: adjDescription,
            amount: Math.abs(amount)
        };

        const updatedItems = report.items.map(item => {
            if (item.employeeId === adjustmentModal.employeeId) {
                const newPluses = adjustmentModal.type === 'plus' ? [...item.pluses, newAdj] : item.pluses;
                const newDeductions = adjustmentModal.type === 'deduction' ? [...item.deductions, newAdj] : item.deductions;

                // Recalc Total
                const microsVal = (item.micros_aptacion_qty || 0) * (report.value_per_captacion || 0) +
                    (item.micros_mecanizacion_qty || 0) * (report.value_per_mecanizacion || 0);
                const respVal = item.responsibility_bonus_amount || 0;

                const newTotal = item.baseAmount + newPluses.reduce((a, b) => a + b.amount, 0) - newDeductions.reduce((a, b) => a + b.amount, 0) + microsVal + respVal;

                return { ...item, pluses: newPluses, deductions: newDeductions, total: newTotal };
            }
            return item;
        });

        setReport({ ...report, items: updatedItems, updatedAt: new Date().toISOString() });
        setAdjustmentModal({ ...adjustmentModal, isOpen: false });
        setAdjDescription('');
        setAdjAmount('');
    };

    const removeAdjustment = (empId: string, adjId: string, type: 'plus' | 'deduction') => {
        if (!report) return;
        const updatedItems = report.items.map(item => {
            if (item.employeeId === empId) {
                const newPluses = type === 'plus' ? item.pluses.filter(a => a.id !== adjId) : item.pluses;
                const newDeductions = type === 'deduction' ? item.deductions.filter(a => a.id !== adjId) : item.deductions;

                // Recalc Total
                const microsVal = (item.micros_aptacion_qty || 0) * (report.value_per_captacion || 0) +
                    (item.micros_mecanizacion_qty || 0) * (report.value_per_mecanizacion || 0);
                const respVal = item.responsibility_bonus_amount || 0;

                const newTotal = item.baseAmount + newPluses.reduce((a, b) => a + b.amount, 0) - newDeductions.reduce((a, b) => a + b.amount, 0) + microsVal + respVal;
                return { ...item, pluses: newPluses, deductions: newDeductions, total: newTotal };
            }
            return item;
        });
        setReport({ ...report, items: updatedItems, updatedAt: new Date().toISOString() });
    };

    const { showToast } = useToast();
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

    const handleSave = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (report) {
            updateIncentiveReport(report);
            showToast('Borrador guardado correctamente', 'success');
        }
    };

    const handleSubmitClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmModalOpen(true);
    };

    const confirmSubmit = () => {
        if (!report) return;

        const updatedReport: IncentiveReport = {
            ...report,
            status: 'pending_approval' as const,
            submittedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        updateIncentiveReport(updatedReport);
        setReport(updatedReport);
        setConfirmModalOpen(false);
        showToast('Reporte enviado a supervisión', 'success');
    };

    if (!report) return <div className="p-8 text-slate-600">Cargando...</div>;

    const isLocked = report.status !== 'draft' && report.status !== 'changes_requested';
    const activeStoreName = availableStores.find(s => s.id === selectedStoreId)?.name || 'Tienda Seleccionada';

    // Helper to check if month is finished
    const isMonthFinished = (monthStr: string) => {
        const [y, m] = monthStr.split('-').map(Number);
        const now = new Date();
        const currentY = now.getFullYear();
        const currentM = now.getMonth() + 1;

        if (y < currentY) return true;
        if (y === currentY && m < currentM) return true;
        return false;
    };

    const isFutureOrCurrentMonth = !isMonthFinished(currentMonth);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Sin fecha';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES');
    };

    return (
        <div className="min-h-screen bg-[#F1F5F9] text-slate-900 font-sans pb-20 p-8">
            <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
                    <div>
                        <div className="relative inline-block mb-2">
                            {/* Only show dropdown if multiple stores available (Admin) */}
                            {availableStores.length > 1 ? (
                                <>
                                    <button
                                        onClick={() => setIsStoreOpen(!isStoreOpen)}
                                        className="flex items-center gap-2 text-2xl font-black text-slate-800 hover:text-indigo-600 transition-colors"
                                    >
                                        <Store size={28} className="text-indigo-600" />
                                        {activeStoreName}
                                        <ChevronDown size={20} className={clsx("transition-transform", isStoreOpen && "rotate-180")} />
                                    </button>
                                    {isStoreOpen && (
                                        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                            {availableStores.map(store => (
                                                <button
                                                    key={store.id}
                                                    onClick={() => {
                                                        setSelectedStoreId(store.id);
                                                        setIsStoreOpen(false);
                                                    }}
                                                    className={clsx("w-full text-left px-4 py-3 rounded-xl font-bold transition-all",
                                                        selectedStoreId === store.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"
                                                    )}
                                                >
                                                    {store.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center gap-2 text-2xl font-black text-slate-800">
                                    <Store size={28} className="text-indigo-600" />
                                    {activeStoreName}
                                </div>
                            )}
                        </div>
                        <p className="text-slate-500 text-lg font-medium">Gestión de Incentivos</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center h-12 gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                            <button
                                onClick={() => changeMonth(-1)}
                                className="h-10 w-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="px-3 text-center min-w-[140px]">
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5 line-clamp-1">Periodo</p>
                                <p className="text-sm font-black text-slate-800 capitalize leading-none whitespace-nowrap">
                                    {formatCurrentMonth()}
                                </p>
                            </div>
                            <button
                                onClick={() => changeMonth(1)}
                                className="h-10 w-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className={clsx("px-6 py-3 h-12 rounded-2xl border flex items-center gap-3 shadow-sm",
                            report.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                report.status === 'pending_approval' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-white text-slate-600 border-slate-200"
                        )}>
                            <FileText size={20} />
                            <div>
                                <p className="text-xs opacity-70 uppercase font-bold tracking-wider">Estado</p>
                                <p className="text-lg font-black capitalize">
                                    {report.status === 'draft' ? 'Borrador' :
                                        report.status === 'pending_approval' ? 'Pendiente' :
                                            report.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white border border-slate-200 rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden">

                    {report.status === 'changes_requested' && (
                        <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-3xl flex items-start gap-4">
                            <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />
                            <div>
                                <h3 className="text-lg font-bold text-red-600 mb-1">Corrección Solicitada</h3>
                                <p className="text-red-700 text-sm leading-relaxed">{report.supervisorNotes}</p>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-sm uppercase tracking-wider">
                                    <th className="p-4 font-bold">Empleado</th>
                                    <th className="p-4 font-bold text-center w-48">Incentivo Base</th>
                                    <th className="p-4 font-bold text-center">Microprestamos<br /><span className="text-[10px] opacity-70">(Captación / Mecanización)</span></th>
                                    <th className="p-4 font-bold w-1/3">Ajustes (Pluses / Deducciones)</th>
                                    <th className="p-4 font-bold text-right w-40">Total Estimado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {report.items.map(item => {
                                    const emp = employees.find(e => e.id === item.employeeId);
                                    return (
                                        <tr key={item.employeeId} className="group hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <p className="font-bold text-slate-800 text-lg">{item.employeeName}</p>
                                                <div className="flex flex-col text-xs text-slate-500 mt-1 space-y-0.5">
                                                    <span className="font-medium text-indigo-500/80">{emp?.category || 'Empleado'}</span>
                                                    <span className="text-slate-400">Antigüedad: {formatDate(emp?.seniorityDate)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="relative">
                                                    <Coins size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="number"
                                                        value={item.baseAmount || ''}
                                                        onChange={(e) => handleBaseChange(item.employeeId, e.target.value)}
                                                        disabled={isLocked}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed text-center transition-all focus:bg-white"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="flex flex-col items-center">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Capt.</label>
                                                        <input
                                                            type="number"
                                                            value={item.micros_aptacion_qty || ''}
                                                            onChange={(e) => handleMicroChange(item.employeeId, 'micros_aptacion_qty', e.target.value)}
                                                            disabled={isLocked}
                                                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-center text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div className="h-8 w-px bg-slate-200"></div>
                                                    <div className="flex flex-col items-center">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Meca.</label>
                                                        <input
                                                            type="number"
                                                            value={item.micros_mecanizacion_qty || ''}
                                                            onChange={(e) => handleMicroChange(item.employeeId, 'micros_mecanizacion_qty', e.target.value)}
                                                            disabled={isLocked}
                                                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-center text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-2">
                                                    {/* List Adjustments */}
                                                    <div className="space-y-1">
                                                        {item.pluses.map(adj => (
                                                            <div key={adj.id} className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100">
                                                                <span>+ {adj.amount}€ {adj.description}</span>
                                                                {!isLocked && (
                                                                    <button onClick={() => removeAdjustment(item.employeeId, adj.id, 'plus')} className="text-emerald-400 hover:text-emerald-700"><Trash2 size={12} /></button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {item.deductions.map(adj => (
                                                            <div key={adj.id} className="flex items-center justify-between text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg border border-red-100">
                                                                <span>- {adj.amount}€ {adj.description}</span>
                                                                {!isLocked && (
                                                                    <button onClick={() => removeAdjustment(item.employeeId, adj.id, 'deduction')} className="text-red-400 hover:text-red-700"><Trash2 size={12} /></button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Add Buttons */}
                                                    {!isLocked && (
                                                        <div className="flex gap-2 mt-1">
                                                            <button
                                                                onClick={() => setAdjustmentModal({ isOpen: true, type: 'plus', employeeId: item.employeeId })}
                                                                className="flex-1 bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 text-xs py-1.5 rounded-lg border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm"
                                                            >
                                                                <Plus size={12} /> Añadir Plus
                                                            </button>
                                                            <button
                                                                onClick={() => setAdjustmentModal({ isOpen: true, type: 'deduction', employeeId: item.employeeId })}
                                                                className="flex-1 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 hover:border-red-200 text-xs py-1.5 rounded-lg border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm"
                                                            >
                                                                <Minus size={12} /> Restar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="text-2xl font-black text-slate-800 tabular-nums tracking-tight">
                                                    {item.total.toFixed(2)}€
                                                </span>
                                                {report.value_responsibility_bonus && (
                                                    <p className="text-[10px] text-slate-500 mt-1">*Incluye valores variables</p>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Actions */}
                    {!isLocked && (
                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-4">
                            <button
                                onClick={handleSave}
                                className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <Save size={20} /> Guardar Borrador
                            </button>
                            <button
                                onClick={handleSubmitClick}
                                disabled={isFutureOrCurrentMonth}
                                title={isFutureOrCurrentMonth ? "Solo se pueden enviar reportes de meses finalizados" : ""}
                                className={clsx("px-8 py-3 rounded-2xl font-bold transition-colors shadow-lg flex items-center gap-2",
                                    isFutureOrCurrentMonth
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
                                )}
                            >
                                <Send size={20} /> Enviar a Supervisión
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal for Submit */}
            {confirmModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                                <Send size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">¿Enviar a Supervisión?</h3>
                            <p className="text-slate-500 mb-8">Esta acción bloqueará el reporte y no podrás realizar más cambios hasta que sea revisado.</p>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setConfirmModalOpen(false)}
                                    className="flex-1 py-3 text-slate-500 hover:text-slate-800 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmSubmit}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-colors"
                                >
                                    Enviar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Adjustments */}
            {adjustmentModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            {adjustmentModal.type === 'plus' ? <Plus className="text-emerald-500" /> : <Minus className="text-red-500" />}
                            {adjustmentModal.type === 'plus' ? 'Añadir Plus / Bonificación' : 'Añadir Deducción / Penalización'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto</label>
                                <input
                                    type="text"
                                    value={adjDescription}
                                    onChange={(e) => setAdjDescription(e.target.value)}
                                    placeholder="Ej: Ventas objetivo superadas"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Importe (€)</label>
                                <input
                                    type="number"
                                    value={adjAmount}
                                    onChange={(e) => setAdjAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-mono transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setAdjustmentModal({ ...adjustmentModal, isOpen: false })}
                                className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddAdjustment}
                                className={clsx("px-6 py-2 rounded-xl font-bold text-white transition-colors shadow-md",
                                    adjustmentModal.type === 'plus' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                                )}
                            >
                                Añadir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncentivesManager;
