import { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { CheckCircle, XCircle, FileText, Printer, ChevronRight, Store, Settings2, DollarSign, Edit2, Trash2, Save, Lock, LockOpen, Send, FileSpreadsheet, ChevronDown, Filter, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import type { IncentiveItem } from '../types';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';

const getStoreName = (id: string, settings: any[]) => {
    const setting = settings.find(s => s.establishmentId === id);
    return setting?.storeName || DEFAULT_STORE_NAMES[id] || `Tienda ${id}`;
};

const formatMonth = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    // Capitalize first letter
    const str = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// Custom Dropdown Component
const FilterSelect = ({
    options,
    value,
    onChange,
    placeholder,
    icon: Icon
}: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    icon?: any;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div className="relative flex-1" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition-all duration-200",
                    isOpen
                        ? "bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                )}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {Icon && <Icon size={16} className={isOpen ? "text-indigo-400" : "text-slate-500"} />}
                    <span className="truncate text-sm font-medium">{selectedLabel}</span>
                </div>
                <ChevronDown size={14} className={clsx("transition-transform duration-200 text-slate-500", isOpen && "rotate-180 text-indigo-400")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[300px]">
                    <div className="overflow-y-auto custom-scrollbar p-1">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={clsx(
                                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between group",
                                    value === opt.value
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                )}
                            >
                                <span className="truncate">{opt.label}</span>
                                {value === opt.value && <CheckCircle size={14} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const IncentivesSupervisor = () => {
    const { incentiveReports, updateIncentiveReport, settings, employees } = useStore();
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    // Filters for Approved History
    const [approvedFilterStore, setApprovedFilterStore] = useState<string>('all');
    const [approvedFilterYear, setApprovedFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [approvedFilterMonth, setApprovedFilterMonth] = useState<string>('all');

    // Reset month filter when year changes
    useEffect(() => {
        setApprovedFilterMonth('all');
    }, [approvedFilterYear]);

    const selectedReport = incentiveReports.find(r => r.id === selectedReportId);

    // Local state for inputs
    const [localConfig, setLocalConfig] = useState({
        captacion: '',
        mecanizacion: '',
        bonus: ''
    });

    // Modal States
    const [actionModal, setActionModal] = useState<{ isOpen: boolean; type: 'approve' | 'reject' | null }>({
        isOpen: false,
        type: null
    });
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [rejectNote, setRejectNote] = useState('');

    const [editingItem, setEditingItem] = useState<{ itemId: string, item: IncentiveItem } | null>(null);

    // Sync local state when selected report changes
    useEffect(() => {
        if (selectedReport) {
            setLocalConfig({
                captacion: selectedReport.value_per_captacion?.toString() || '',
                mecanizacion: selectedReport.value_per_mecanizacion?.toString() || '',
                bonus: selectedReport.value_responsibility_bonus?.toString() || ''
            });
        }
    }, [selectedReportId]);

    // Grouping reports
    const pendingReports = incentiveReports.filter(r => r.status === 'pending_approval');

    // Filter Approved Reports
    const approvedReports = useMemo(() => {
        return incentiveReports.filter(r => {
            if (r.status !== 'approved') return false;

            // Year Filter
            if (!r.month.startsWith(approvedFilterYear)) return false;

            // Store Filter
            if (approvedFilterStore !== 'all' && r.establishmentId !== approvedFilterStore) return false;

            // Month Filter
            if (approvedFilterMonth !== 'all' && r.month !== approvedFilterMonth) return false;

            return true;
        });
    }, [incentiveReports, approvedFilterStore, approvedFilterMonth, approvedFilterYear]);

    // Unique months and stores for filters (Only past months for History)
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        incentiveReports.filter(r => r.status === 'approved').forEach(r => {
            years.add(r.month.split('-')[0]);
        });
        // Ensure current year
        years.add(new Date().getFullYear().toString());
        return Array.from(years).sort().reverse();
    }, [incentiveReports]);

    const availableMonths = useMemo(() => {
        const today = new Date();
        const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        return Array.from(new Set(incentiveReports.filter(r => r.status === 'approved').map(r => r.month)))
            .filter(m => m < currentMonthStr) // Only strictly past months
            .filter(m => m.startsWith(approvedFilterYear)) // Filter by selected year
            .sort().reverse();
    }, [incentiveReports, approvedFilterYear]);

    const availableStores = useMemo(() => Array.from(new Set(incentiveReports.filter(r => r.status === 'approved').map(r => r.establishmentId))), [incentiveReports]);


    // Helper Calculation Logic
    const calculateItemTotal = (item: IncentiveItem, captacionVal: number, mecanizacionVal: number, bonusVal: number) => {
        const fullEmployee = employees.find(e => e.id === item.employeeId);
        const isResponsible = fullEmployee
            ? ['Responsable', 'Gerente', 'Subgerente'].includes(fullEmployee.category)
            : false;

        // Prorated Responsibility Bonus
        // Rule: Bonus is for 40 hours. Prorate if less.
        const weeklyHours = fullEmployee?.weeklyHours || 40;
        const adjustedBonusVal = (bonusVal * weeklyHours) / 40;

        const base = item.baseAmount || 0;
        const plus = item.pluses.reduce((a, b) => a + b.amount, 0);
        const deduc = item.deductions.reduce((a, b) => a + b.amount, 0);

        const micros = (item.micros_aptacion_qty || 0) * captacionVal +
            (item.micros_mecanizacion_qty || 0) * mecanizacionVal;

        const respBonus = isResponsible ? adjustedBonusVal : 0;

        return {
            ...item,
            responsibility_bonus_amount: respBonus,
            total: base + plus - deduc + micros + respBonus
        };
    };

    const handleApproveClick = () => setActionModal({ isOpen: true, type: 'approve' });
    const handleRejectClick = () => {
        setRejectNote('');
        setActionModal({ isOpen: true, type: 'reject' });
    };

    const handleUnlockOption = (option: 'self' | 'manager') => {
        if (!selectedReport) return;

        if (option === 'self') {
            // Revert directly to pending so supervisor can edit
            updateIncentiveReport({
                ...selectedReport,
                status: 'pending_approval'
            });
            setUnlockModalOpen(false);
        } else {
            // Open the existing reject modal to enter reason
            setUnlockModalOpen(false);
            handleRejectClick(); // This sets actionModal type 'reject'
        }
    };

    const confirmAction = () => {
        if (!selectedReport) return;

        if (actionModal.type === 'approve') {
            updateIncentiveReport({
                ...selectedReport,
                status: 'approved',
                approvedAt: new Date().toISOString()
            });
        } else if (actionModal.type === 'reject') {
            updateIncentiveReport({
                ...selectedReport,
                status: 'changes_requested',
                supervisorNotes: rejectNote
            });
            // If we are rejecting (sending back to manager), deselect the report as it goes out of supervisor view conceptually
            // adjust this if needed
            if (actionModal.type === 'reject') {
                setSelectedReportId(null);
            }
        }
        setActionModal({ isOpen: false, type: null });
    };

    // Debounced update to global store when local config changes
    useEffect(() => {
        if (!selectedReport) return;

        const timer = setTimeout(() => {
            const valCaptacion = parseFloat(localConfig.captacion) || 0;
            const valMecanizacion = parseFloat(localConfig.mecanizacion) || 0;
            const valBonus = parseFloat(localConfig.bonus) || 0;

            if (
                valCaptacion === selectedReport.value_per_captacion &&
                valMecanizacion === selectedReport.value_per_mecanizacion &&
                valBonus === selectedReport.value_responsibility_bonus
            ) {
                return;
            }

            const updatedReport = {
                ...selectedReport,
                value_per_captacion: valCaptacion,
                value_per_mecanizacion: valMecanizacion,
                value_responsibility_bonus: valBonus
            };

            const recalculatedItems = updatedReport.items.map(item =>
                calculateItemTotal(item, valCaptacion, valMecanizacion, valBonus)
            );

            updateIncentiveReport({ ...updatedReport, items: recalculatedItems });

        }, 500);

        return () => clearTimeout(timer);
    }, [localConfig, selectedReportId, employees]);

    const handleLocalChange = (field: keyof typeof localConfig, val: string) => {
        setLocalConfig(prev => ({ ...prev, [field]: val }));
    };

    const handleExportExcel = () => {
        if (!selectedReport) return;

        const storeName = getStoreName(selectedReport.establishmentId, settings);
        const month = selectedReport.month;

        // Headers - Simplified for pure data
        const headers = [
            'Empleado',
            'Incentivo Base',
            'Total Bonificaciones',
            'Total Deducciones',
            'Valor Micros',
            'Plus Responsabilidad',
            'Total a Percibir'
        ];

        // Rows
        const rows = selectedReport.items.map(item => {
            const valCaptacion = parseFloat(localConfig.captacion) || 0;
            const valMecanizacion = parseFloat(localConfig.mecanizacion) || 0;

            const microsVal = ((item.micros_aptacion_qty || 0) * valCaptacion + (item.micros_mecanizacion_qty || 0) * valMecanizacion);

            // Clean strings for CSV (remove newlines, semicolons)
            const clean = (str: string) => str.replace(/;/g, ',').replace(/\n/g, ' ');

            const totalBonuses = item.pluses.reduce((sum, p) => sum + p.amount, 0);
            const totalDeductions = item.deductions.reduce((sum, d) => sum + d.amount, 0);

            return [
                clean(item.employeeName),
                item.baseAmount.toFixed(2).replace('.', ','),
                totalBonuses.toFixed(2).replace('.', ','),
                totalDeductions.toFixed(2).replace('.', ','),
                microsVal.toFixed(2).replace('.', ','),
                (item.responsibility_bonus_amount?.toFixed(2) || '0,00').replace('.', ','),
                item.total.toFixed(2).replace('.', ',')
            ].join(';');
        });

        const csvContent = "\ufeff" + [headers.join(';'), ...rows].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Incentivos_${storeName.replace(/\s+/g, '_')}_${month}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    // Adjustments Management
    const openEditModal = (item: IncentiveItem) => {
        setEditingItem({ itemId: item.employeeId, item: { ...item } });
    };

    const saveAdjustments = () => {
        if (!selectedReport || !editingItem) return;

        const valCaptacion = parseFloat(localConfig.captacion) || 0;
        const valMecanizacion = parseFloat(localConfig.mecanizacion) || 0;
        const valBonus = parseFloat(localConfig.bonus) || 0;

        // Recalculate this specific item
        const recalculatedItem = calculateItemTotal(editingItem.item, valCaptacion, valMecanizacion, valBonus);

        const updatedItems = selectedReport.items.map(i =>
            i.employeeId === editingItem.itemId ? recalculatedItem : i
        );

        updateIncentiveReport({
            ...selectedReport,
            items: updatedItems
        });
        setEditingItem(null);
    };

    const addAdjustmentInEdit = (type: 'pluses' | 'deductions') => {
        if (!editingItem) return;
        setEditingItem(prev => {
            if (!prev) return null;
            const newAdj = {
                id: crypto.randomUUID(),
                description: '',
                amount: 0
            };
            const list = [...prev.item[type], newAdj];
            return { ...prev, item: { ...prev.item, [type]: list } };
        });
    };

    const updateAdjustmentInEdit = (type: 'pluses' | 'deductions', id: string, field: 'description' | 'amount', value: any) => {
        if (!editingItem) return;
        setEditingItem(prev => {
            if (!prev) return null;
            const list = prev.item[type].map(adj => adj.id === id ? { ...adj, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : adj);
            return { ...prev, item: { ...prev.item, [type]: list } };
        });
    };

    const removeAdjustmentInEdit = (type: 'pluses' | 'deductions', id: string) => {
        if (!editingItem) return;
        setEditingItem(prev => {
            if (!prev) return null;
            const list = prev.item[type].filter(adj => adj.id !== id);
            return { ...prev, item: { ...prev.item, [type]: list } };
        });
    };

    // Totals
    const reportTotal = selectedReport ? selectedReport.items.reduce((sum, item) => sum + item.total, 0) : 0;

    return (
        <div className="p-8 pb-24 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-full">

                {/* Header - Command Center Style */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-8 print:hidden">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 opacity-70">Hola, Supervisor 👋</p>
                        <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                            <DollarSign size={18} /> Incentives Command Center
                        </h2>
                        <h1 className="text-6xl font-black text-white tracking-tight leading-tight">
                            Supervisión de <span className="text-slate-500 italic font-medium">Incentivos</span>
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Column: Sidebar List */}
                    <div className="lg:col-span-4 space-y-8 print:hidden">

                        {/* Pending Section */}
                        <div className="bg-slate-900/40 border border-slate-800/50 rounded-[3rem] p-6 backdrop-blur-sm">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 px-2">
                                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><FileText size={20} /></div>
                                Pendientes de Validar
                            </h3>
                            <div className="space-y-3">
                                {pendingReports.length === 0 && <p className="text-slate-500 px-4">No hay solicitudes pendientes.</p>}
                                {pendingReports.map(report => (
                                    <button
                                        key={report.id}
                                        onClick={() => setSelectedReportId(report.id)}
                                        className={clsx("w-full text-left p-4 rounded-3xl border transition-all group relative overflow-hidden",
                                            selectedReportId === report.id
                                                ? "bg-indigo-600 border-transparent shadow-lg shadow-indigo-900/20"
                                                : "bg-slate-950/50 border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900"
                                        )}
                                    >
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={clsx("text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg",
                                                    selectedReportId === report.id ? "bg-indigo-500 text-indigo-100" : "bg-slate-800 text-slate-400 group-hover:bg-slate-800/80"
                                                )}>
                                                    {getStoreName(report.establishmentId, settings)}
                                                </span>
                                                <span className={clsx("font-mono text-sm", selectedReportId === report.id ? "text-indigo-200" : "text-slate-500")}>
                                                    {formatMonth(report.month)}
                                                </span>
                                            </div>
                                            <p className={clsx("font-bold text-lg", selectedReportId === report.id ? "text-white" : "text-slate-200")}>
                                                {report.items.length} Empleados
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Approved Section */}
                        <div className="bg-slate-900/40 border border-slate-800/50 rounded-[3rem] p-6 backdrop-blur-sm">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 px-2">
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500"><CheckCircle size={20} /></div>
                                Historial Aprobados
                            </h3>

                            {/* Filters */}
                            <div className="flex flex-col gap-2 mb-4 px-2">
                                <FilterSelect
                                    value={approvedFilterStore}
                                    onChange={setApprovedFilterStore}
                                    placeholder="Todas las Tiendas"
                                    icon={Store}
                                    options={[
                                        { value: 'all', label: 'Todas las Tiendas' },
                                        ...availableStores.map(id => ({ value: id, label: getStoreName(id, settings) }))
                                    ]}
                                />
                                <FilterSelect
                                    value={approvedFilterYear}
                                    onChange={setApprovedFilterYear}
                                    placeholder="Año"
                                    icon={Calendar}
                                    options={availableYears.map(y => ({ value: y, label: y }))}
                                />
                                <FilterSelect
                                    value={approvedFilterMonth}
                                    onChange={setApprovedFilterMonth}
                                    placeholder="Todos los Meses"
                                    icon={Filter}
                                    options={[
                                        { value: 'all', label: 'Todos los Meses' },
                                        ...availableMonths.map(m => ({ value: m, label: formatMonth(m) }))
                                    ]}
                                />
                            </div>

                            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {approvedReports.length === 0 && <p className="text-slate-500 px-4 text-sm mt-4">No se encontraron reportes aprobados.</p>}
                                {approvedReports.map(report => (
                                    <button
                                        key={report.id}
                                        onClick={() => setSelectedReportId(report.id)}
                                        className={clsx("w-full text-left p-4 rounded-3xl border transition-all group flex items-center justify-between",
                                            selectedReportId === report.id
                                                ? "bg-slate-800 border-emerald-500/50"
                                                : "bg-slate-950/30 border-transparent hover:bg-slate-900"
                                        )}
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-slate-300 group-hover:text-emerald-400 transition-colors">{getStoreName(report.establishmentId, settings)}</p>
                                            <p className="text-xs text-slate-500">{formatMonth(report.month)}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-600" />
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Detail View */}
                    <div className="lg:col-span-8">
                        {selectedReport ? (
                            <div className="bg-slate-900/40 border border-slate-800/50 rounded-[3rem] p-8 backdrop-blur-sm relative isolate print:bg-white print:text-black print:border-none print:shadow-none print:rounded-none">

                                {/* Report Header */}
                                <div className="flex justify-between items-start mb-8 pb-8 border-b border-slate-800/50 print:border-black">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider print:border-black print:text-black print:bg-transparent">
                                                {formatMonth(selectedReport.month)}
                                            </span>
                                            {selectedReport.status === 'approved' && (
                                                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 print:hidden">
                                                    <Lock size={12} /> Cerrado
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-4xl font-black text-white print:text-black">{getStoreName(selectedReport.establishmentId, settings)}</h2>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-1 print:text-black">Total Incentivos</p>
                                        <p className="text-5xl font-black text-emerald-400 print:text-black">{reportTotal.toFixed(2)}€</p>
                                    </div>
                                </div>

                                {/* Actions Toolbar (Moved to Top) */}
                                <div className="mb-8 flex justify-end gap-4 print:hidden relative z-50">
                                    <button
                                        onClick={handleExportExcel}
                                        className="px-6 py-3 rounded-2xl border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                                    >
                                        <FileSpreadsheet size={20} /> Excel
                                    </button>
                                    <button
                                        onClick={() => { console.log('Print clicked'); handlePrint(); }}
                                        className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
                                    >
                                        <Printer size={20} /> Imprimir / PDF
                                    </button>

                                    {selectedReport.status !== 'approved' ? (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    console.log('Solicitar Cambios click', e);
                                                    e.stopPropagation();
                                                    handleRejectClick();
                                                }}
                                                className="px-6 py-3 rounded-2xl border border-red-500/30 text-red-400 font-bold hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer relative z-50"
                                            >
                                                <XCircle size={20} /> Solicitar Cambios
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    console.log('Aprobar click', e);
                                                    e.stopPropagation();
                                                    handleApproveClick();
                                                }}
                                                className="px-8 py-3 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer relative z-50"
                                            >
                                                <CheckCircle size={20} /> Aprobar y Cerrar
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setUnlockModalOpen(true)}
                                            className="px-6 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 font-bold hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 cursor-pointer relative z-50"
                                        >
                                            <Lock size={20} /> Reporte Cerrado (Desbloquear)
                                        </button>
                                    )}
                                </div>

                                {/* Configuration Banner (Supervisor Only) */}
                                {selectedReport.status !== 'approved' && (
                                    <div className="mb-8 p-6 bg-slate-950/50 border border-slate-800 rounded-3xl print:hidden relative z-10">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Settings2 className="text-indigo-400" size={20} />
                                            <h3 className="text-white font-bold">Configuración de Valores (Mes Actual)</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative group focus-within:border-indigo-500 transition-colors">
                                                <label className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-2">Valor Captación</label>
                                                <div className="flex items-center gap-2">
                                                    <DollarSign size={16} className="text-indigo-500" />
                                                    <input
                                                        type="number"
                                                        value={localConfig.captacion}
                                                        onChange={e => handleLocalChange('captacion', e.target.value)}
                                                        placeholder="0.00"
                                                        className="bg-transparent text-white font-mono text-lg outline-none w-full"
                                                    />
                                                </div>
                                            </div>
                                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative group focus-within:border-indigo-500 transition-colors">
                                                <label className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-2">Valor Mecanización</label>
                                                <div className="flex items-center gap-2">
                                                    <DollarSign size={16} className="text-indigo-500" />
                                                    <input
                                                        type="number"
                                                        value={localConfig.mecanizacion}
                                                        onChange={e => handleLocalChange('mecanizacion', e.target.value)}
                                                        placeholder="0.00"
                                                        className="bg-transparent text-white font-mono text-lg outline-none w-full"
                                                    />
                                                </div>
                                            </div>
                                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative group focus-within:border-emerald-500 transition-colors">
                                                <label className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block mb-2">Plus Resp. (40h Base)</label>
                                                <div className="flex items-center gap-2">
                                                    <DollarSign size={16} className="text-emerald-500" />
                                                    <input
                                                        type="number"
                                                        value={localConfig.bonus}
                                                        onChange={e => handleLocalChange('bonus', e.target.value)}
                                                        placeholder="0.00"
                                                        className="bg-transparent text-white font-mono text-lg outline-none w-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Employee Table */}
                                <div className="overflow-x-auto relative z-0">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider print:text-black print:border-black">
                                                <th className="p-4 font-bold">Empleado</th>
                                                <th className="p-4 font-bold text-center">Incentivo<br />Base</th>
                                                <th className="p-4 font-bold text-center">Ajustes<br />Extra</th>
                                                <th className="p-4 font-bold text-center bg-slate-800/30 rounded-t-xl">Microprestamos<br /><span className="text-[9px] opacity-70">(Cap / Meca)</span></th>
                                                <th className="p-4 font-bold text-center">Plus<br />Resp.</th>
                                                <th className="p-4 font-bold text-right text-emerald-400">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50 print:divide-gray-300">
                                            {selectedReport.items.map(item => {
                                                const valCaptacion = parseFloat(localConfig.captacion) || 0;
                                                const valMecanizacion = parseFloat(localConfig.mecanizacion) || 0;
                                                const microsTotal = ((item.micros_aptacion_qty || 0) * valCaptacion) +
                                                    ((item.micros_mecanizacion_qty || 0) * valMecanizacion);

                                                return (
                                                    <tr key={item.employeeId} className="group hover:bg-slate-800/30 transition-colors print:hover:bg-transparent text-sm">
                                                        <td className="p-4">
                                                            <p className="font-bold text-white print:text-black">{item.employeeName}</p>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="font-mono text-slate-300 print:text-black">{item.baseAmount.toFixed(2)}€</span>
                                                        </td>
                                                        <td className="p-4 text-center relative group/edit">
                                                            <div className="space-y-0.5">
                                                                {item.pluses.map(adj => (
                                                                    <div key={adj.id} className="text-[10px] text-emerald-400 print:text-black">+ {adj.amount}€</div>
                                                                ))}
                                                                {item.deductions.map(adj => (
                                                                    <div key={adj.id} className="text-[10px] text-red-400 print:text-black">- {adj.amount}€</div>
                                                                ))}
                                                                {item.pluses.length === 0 && item.deductions.length === 0 && <span className="text-slate-600 text-[10px]">-</span>}
                                                            </div>
                                                            {selectedReport.status !== 'approved' && (
                                                                <button
                                                                    onClick={() => openEditModal(item)}
                                                                    className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover/edit:opacity-100 p-1 bg-slate-700 hover:bg-indigo-600 rounded-md transition-all text-white print:hidden"
                                                                    title="Gestionar Ajustes"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-center bg-slate-900/20 print:bg-transparent">
                                                            <div className="flex flex-col items-center">
                                                                <div className="text-xs font-mono text-indigo-300 mb-1">
                                                                    {item.micros_aptacion_qty || 0} / {item.micros_mecanizacion_qty || 0}
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-500">
                                                                    {microsTotal > 0 ? `${microsTotal.toFixed(2)}€` : '-'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {item.responsibility_bonus_amount ? (
                                                                <span className="text-emerald-400 font-mono text-xs">{item.responsibility_bonus_amount.toFixed(2)}€</span>
                                                            ) : <span className="text-slate-600">-</span>}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <span className="text-lg font-black text-white tabular-nums print:text-black">
                                                                {item.total.toFixed(2)}€
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>



                            </div>
                        ) : (
                            <div className="bg-slate-900/40 border border-slate-800/50 rounded-[3rem] p-12 text-center h-full flex flex-col items-center justify-center text-slate-500 backdrop-blur-sm min-h-[500px]">
                                <Store size={64} className="mb-6 opacity-20" />
                                <h3 className="text-2xl font-black text-slate-400 mb-2">Panel de Supervisión</h3>
                                <p>Selecciona un reporte de la lista para ver los detalles.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Modal (Approve/Reject) */}
            {actionModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm print:hidden">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className={clsx("w-16 h-16 rounded-full flex items-center justify-center mb-6",
                                actionModal.type === 'approve' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                            )}>
                                {actionModal.type === 'approve' ? <CheckCircle size={32} /> : <XCircle size={32} />}
                            </div>

                            <h3 className="text-2xl font-black text-white mb-2">
                                {actionModal.type === 'approve' ? '¿Aprobar Incentivos?' : 'Solicitar Cambios'}
                            </h3>

                            <p className="text-slate-400 mb-6">
                                {actionModal.type === 'approve'
                                    ? 'Esta acción aprobará el reporte y lo marcará como listo para contabilidad.'
                                    : 'Indica los motivos por los que se solicitan cambios en este reporte.'}
                            </p>

                            {actionModal.type === 'reject' && (
                                <textarea
                                    value={rejectNote}
                                    onChange={(e) => setRejectNote(e.target.value)}
                                    placeholder="Describe los cambios necesarios..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 mb-6 focus:ring-2 focus:ring-red-500 outline-none h-32 resize-none"
                                />
                            )}

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setActionModal({ isOpen: false, type: null })}
                                    className="flex-1 py-3 text-slate-400 hover:text-white font-bold bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmAction}
                                    className={clsx("flex-1 py-3 font-bold rounded-xl shadow-lg transition-colors text-white",
                                        actionModal.type === 'approve'
                                            ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                                            : "bg-red-600 hover:bg-red-500 shadow-red-500/20"
                                    )}
                                >
                                    {actionModal.type === 'approve' ? 'Aprobar' : 'Solicitar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unlock Modal */}
            {unlockModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm print:hidden">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-amber-500/10 text-amber-500">
                                <LockOpen size={32} />
                            </div>

                            <h3 className="text-2xl font-black text-white mb-2">
                                Desbloquear Reporte
                            </h3>

                            <p className="text-slate-400 mb-8">
                                Este reporte está aprobado y enviado a contabilidad. ¿Qué acción deseas realizar?
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={() => handleUnlockOption('self')}
                                    className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Edit2 size={18} />
                                    Modificar yo mismo
                                    <span className="text-indigo-200 text-xs font-normal">(Reabrir edición)</span>
                                </button>

                                <button
                                    onClick={() => handleUnlockOption('manager')}
                                    className="w-full py-4 px-6 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Send size={18} />
                                    Devolver a Gerente
                                    <span className="text-red-300/50 text-xs font-normal">(Solicitar cambios)</span>
                                </button>

                                <button
                                    onClick={() => setUnlockModalOpen(false)}
                                    className="mt-4 text-slate-500 hover:text-white text-sm font-medium"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Adjustments Modal */}
            {editingItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm print:hidden">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Gestionar Ajustes</h3>
                            <button onClick={() => setEditingItem(null)} className="text-slate-500 hover:text-white"><XCircle size={24} /></button>
                        </div>
                        <p className="text-slate-400 text-sm mb-4">Empleado: <span className="text-indigo-400 font-bold">{editingItem.item.employeeName}</span></p>

                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {/* Pluses */}
                            <div>
                                <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
                                    Bonificaciones Extra
                                    <button
                                        onClick={() => addAdjustmentInEdit('pluses')}
                                        className="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        + Añadir
                                    </button>
                                </h4>
                                {editingItem.item.pluses.length === 0 && <p className="text-slate-600 text-sm italic">Sin bonificaciones.</p>}
                                <div className="space-y-2">
                                    {editingItem.item.pluses.map((adj) => (
                                        <div key={adj.id} className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                                            <input
                                                value={adj.description}
                                                onChange={(e) => updateAdjustmentInEdit('pluses', adj.id, 'description', e.target.value)}
                                                className="bg-transparent text-sm text-slate-300 w-full outline-none"
                                                placeholder="Concepto"
                                            />
                                            <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                                                <span className="text-emerald-500 text-xs">+</span>
                                                <input
                                                    type="number"
                                                    value={adj.amount}
                                                    onChange={(e) => updateAdjustmentInEdit('pluses', adj.id, 'amount', e.target.value)}
                                                    className="bg-transparent text-emerald-400 font-mono text-sm w-20 text-right outline-none"
                                                />
                                                <span className="text-slate-500 text-xs">€</span>
                                            </div>
                                            <button onClick={() => removeAdjustmentInEdit('pluses', adj.id)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Deductions */}
                            <div>
                                <h4 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
                                    Deducciones
                                    <button
                                        onClick={() => addAdjustmentInEdit('deductions')}
                                        className="text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        + Añadir
                                    </button>
                                </h4>
                                {editingItem.item.deductions.length === 0 && <p className="text-slate-600 text-sm italic">Sin deducciones.</p>}
                                <div className="space-y-2">
                                    {editingItem.item.deductions.map((adj) => (
                                        <div key={adj.id} className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                                            <input
                                                value={adj.description}
                                                onChange={(e) => updateAdjustmentInEdit('deductions', adj.id, 'description', e.target.value)}
                                                className="bg-transparent text-sm text-slate-300 w-full outline-none"
                                                placeholder="Concepto"
                                            />
                                            <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                                                <span className="text-red-500 text-xs">-</span>
                                                <input
                                                    type="number"
                                                    value={adj.amount}
                                                    onChange={(e) => updateAdjustmentInEdit('deductions', adj.id, 'amount', e.target.value)}
                                                    className="bg-transparent text-red-400 font-mono text-sm w-20 text-right outline-none"
                                                />
                                                <span className="text-slate-500 text-xs">€</span>
                                            </div>
                                            <button onClick={() => removeAdjustmentInEdit('deductions', adj.id)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
                            <button
                                onClick={saveAdjustments}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2"
                            >
                                <Save size={18} /> Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncentivesSupervisor;
