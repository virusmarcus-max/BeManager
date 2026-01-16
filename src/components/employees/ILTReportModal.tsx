
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { X, Printer, FileText, History as LucideHistory, Calendar, Download, FileSpreadsheet } from 'lucide-react';
import type { ILTReport, ILTReportItem } from '../../types';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext';

interface ILTReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'current' | 'history';
}

const ILTReportModal: React.FC<ILTReportModalProps> = ({ isOpen, onClose, initialTab = 'current' }) => {
    const { employees, timeOffRequests, iltReports, addILTReport, getSettings } = useStore();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'current' | 'history'>(initialTab);
    const [selectedHistoryReport, setSelectedHistoryReport] = useState<ILTReport | null>(null);
    const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync activeTab with initialTab when opening
    React.useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Current Month Helpers
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayOfMonth = now.getDate();
    const isReportPeriod = dayOfMonth >= 22;

    const generateReportData = (): ILTReport => {
        if (!user) throw new Error("No user");

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Filter employees who worked/were active during this month
        const relevantEmployees = employees.filter(e => {
            if (e.establishmentId !== user.establishmentId) return false;

            // Check if employment overlaps with this month
            // If active: Start Date <= End Of Month
            // If inactive: End Date >= Start Of Month

            // Simplified: If currently active, yes.
            if (e.active) return true;

            // If terminated, check history
            // If terminated, check history
            // Find the LATEST termination to check if it's relevant to this month
            const terminations = e.history?.filter(h => h.type === 'terminated').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const latestTermination = terminations?.[0];

            if (latestTermination) {
                // If termination date is within this month or after?
                // If termination date >= startOfMonth, they worked at least some part of the month (or previous months)
                // Actually we need to check if they were active AT ALL during the month.
                // If termination date is BEFORE startOfMonth, then NO.
                const termDate = new Date(latestTermination.date);
                if (termDate < startOfMonth) return false;
                return true;
            }

            return false;
        });

        const items: ILTReportItem[] = relevantEmployees.map(emp => {
            // Find termination date from history if not present on employee (robustness)
            const terminations = emp.history?.filter(h => h.type === 'terminated').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const latestTermination = terminations?.[0];

            let effectiveContractEndDate = emp.contractEndDate;
            if (!effectiveContractEndDate && !emp.active) {
                effectiveContractEndDate = latestTermination?.contractEndDate;
            }
            // Calculate ILT (Sick Leave) days in this month
            const sickRequests = timeOffRequests.filter(r => r.employeeId === emp.id && r.type === 'sick_leave');
            const itDateSet = new Set<string>();
            const itRanges: { start: string, end: string }[] = [];

            sickRequests.forEach(req => {
                const datesToProcess = new Set<string>();

                // Prefer startDate/endDate if available
                if (req.startDate && req.endDate) {
                    const rStart = new Date(req.startDate);
                    const rEnd = new Date(req.endDate);
                    for (let d = new Date(rStart); d <= rEnd; d.setDate(d.getDate() + 1)) {
                        datesToProcess.add(d.toISOString().split('T')[0]);
                    }

                    // Keep track of ranges for the report
                    const overlapStart = rStart < startOfMonth ? startOfMonth : rStart;
                    const overlapEnd = rEnd > endOfMonth ? endOfMonth : rEnd;
                    if (overlapStart <= overlapEnd) {
                        itRanges.push({
                            start: overlapStart.toISOString().split('T')[0],
                            end: overlapEnd.toISOString().split('T')[0]
                        });
                    }
                } else if (req.dates && req.dates.length > 0) {
                    req.dates.forEach(d => datesToProcess.add(d));

                    // For specific dates, we might want to represent them as ranges too if they are contiguous
                    // but for simplicity and following previous logic:
                    const sorted = [...req.dates].sort();
                    const inMonth = sorted.filter(d => {
                        const dateObj = new Date(d);
                        return dateObj >= startOfMonth && dateObj <= endOfMonth;
                    });
                    if (inMonth.length > 0) {
                        itRanges.push({
                            start: inMonth[0],
                            end: inMonth[inMonth.length - 1]
                        });
                    }
                }

                // Add to total month set
                datesToProcess.forEach(dStr => {
                    const dateObj = new Date(dStr);
                    if (dateObj >= startOfMonth && dateObj <= endOfMonth) {
                        itDateSet.add(dStr);
                    }
                });
            });
            const itDays = itDateSet.size;

            // Calculate Mat/Pat
            const matPatRequests = timeOffRequests.filter(r => r.employeeId === emp.id && r.type === 'maternity_paternity');
            const matPatDateSet = new Set<string>();
            const matPatRanges: { start: string, end: string }[] = [];

            matPatRequests.forEach(req => {
                const datesToProcess = new Set<string>();
                if (req.startDate && req.endDate) {
                    const rStart = new Date(req.startDate);
                    const rEnd = new Date(req.endDate);
                    for (let d = new Date(rStart); d <= rEnd; d.setDate(d.getDate() + 1)) {
                        datesToProcess.add(d.toISOString().split('T')[0]);
                    }

                    const overlapStart = rStart < startOfMonth ? startOfMonth : rStart;
                    const overlapEnd = rEnd > endOfMonth ? endOfMonth : rEnd;
                    if (overlapStart <= overlapEnd) {
                        matPatRanges.push({
                            start: overlapStart.toISOString().split('T')[0],
                            end: overlapEnd.toISOString().split('T')[0]
                        });
                    }
                } else if (req.dates && req.dates.length > 0) {
                    req.dates.forEach(d => datesToProcess.add(d));
                }

                datesToProcess.forEach(dStr => {
                    const dateObj = new Date(dStr);
                    if (dateObj >= startOfMonth && dateObj <= endOfMonth) {
                        matPatDateSet.add(dStr);
                    }
                });
            });
            const matPatDays = matPatDateSet.size;

            // Calculate Vacations
            const vacRequests = timeOffRequests.filter(r => r.employeeId === emp.id && r.type === 'vacation');
            const vacationDateSet = new Set<string>();
            const vacationRanges: { start: string, end: string }[] = [];

            vacRequests.forEach(req => {
                const datesToProcess = new Set<string>();
                if (req.dates && req.dates.length > 0) {
                    req.dates.forEach(d => datesToProcess.add(d));
                } else if (req.startDate && req.endDate) {
                    const rStart = new Date(req.startDate);
                    const rEnd = new Date(req.endDate);
                    for (let d = new Date(rStart); d <= rEnd; d.setDate(d.getDate() + 1)) {
                        datesToProcess.add(d.toISOString().split('T')[0]);
                    }
                }

                if (req.startDate && req.endDate) {
                    const overlapStart = new Date(req.startDate) < startOfMonth ? startOfMonth : new Date(req.startDate);
                    const overlapEnd = new Date(req.endDate) > endOfMonth ? endOfMonth : new Date(req.endDate);
                    if (overlapStart <= overlapEnd) {
                        vacationRanges.push({
                            start: overlapStart.toISOString().split('T')[0],
                            end: overlapEnd.toISOString().split('T')[0]
                        });
                    }
                }

                datesToProcess.forEach(dStr => {
                    const dateObj = new Date(dStr);
                    if (dateObj >= startOfMonth && dateObj <= endOfMonth) {
                        vacationDateSet.add(dStr);
                    }
                });
            });
            const vacationDays = vacationDateSet.size;

            // Fix double counting if logic mixed
            // Assuming vacationDays is correct via dates count usually.

            return {
                id: emp.id,
                employeeId: emp.id,
                employeeName: emp.name,
                hireDate: emp.contractStartDate || emp.seniorityDate,
                contractEndDate: effectiveContractEndDate,
                contractHours: emp.weeklyHours,
                itDays,
                itRanges,
                matPatDays,
                matPatRanges,
                vacationDays,
                vacationRanges
            };
        });

        return {
            id: `ilt-${user.establishmentId}-${currentMonthStr}`,
            establishmentId: user.establishmentId,
            month: currentMonthStr,
            generatedAt: new Date().toISOString(),
            items
        };
    };

    const currentReport = useMemo(() => {
        if (!isOpen || activeTab !== 'current') return null;
        return generateReportData();
    }, [isOpen, activeTab, employees, timeOffRequests]);

    const handleSaveReport = async () => {
        if (!currentReport || isSaving) return;

        setIsSaving(true);
        try {
            await addILTReport(currentReport);
            showToast('Informe guardado correctamente', 'success');
            setIsConfirmSaveOpen(false);
            onClose();
        } catch (error) {
            console.error("Error saving report:", error);
            showToast('Error al guardar el informe', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        const reportToPrint = selectedHistoryReport || currentReport;
        if (!reportToPrint) return;

        const printContent = document.getElementById('ilt-print-area');
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Informe ILT - ${reportToPrint.month}</title>
                    <style>
                        @page { 
                            size: A4 portrait; 
                            margin: 15mm; 
                        }
                        body { 
                            font-family: system-ui, -apple-system, sans-serif; 
                            padding: 0; 
                            margin: 0;
                            color: #1e293b;
                        }
                        .print-container {
                            width: 100%;
                            max-width: 210mm;
                            margin: 0 auto;
                        }
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-top: 20px; 
                            font-size: 10pt; 
                        }
                        th, td { 
                            border: 1px solid #e2e8f0; 
                            padding: 8px 6px; 
                            text-align: left; 
                        }
                        th { 
                            background-color: #f8fafc !important; 
                            -webkit-print-color-adjust: exact;
                            font-weight: bold;
                            text-transform: uppercase;
                            font-size: 8pt;
                            color: #64748b;
                        }
                        h1 { font-size: 18pt; margin-bottom: 4pt; color: #0f172a; }
                        .text-indigo-600 { color: #4f46e5 !important; -webkit-print-color-adjust: exact; }
                        .header { border-bottom: 2px solid #f1f5f9; margin-bottom: 20px; padding-bottom: 20px; }
                        .footer { margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; display: flex; justify-content: justify-content: space-between; align-items: flex-end; }
                        .signature-box { border-bottom: 1px solid #94a3b8; width: 200px; margin-bottom: 8px; height: 60px; }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        ${printContent.innerHTML}
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };

    const handleExportExcel = () => {
        const report = selectedHistoryReport || currentReport;
        if (!report) return;

        // CSV Header
        const headers = ['Empleado', 'Horas Contrato', 'Fecha de Contratación', 'Fin Contrato', 'Días Baja IT', 'Periodos IT', 'Días Mat/Pat', 'Periodos Mat/Pat', 'Días Vacaciones', 'Periodos Vacaciones'];

        // CSV Rows
        const rows = report.items.map(item => [
            item.employeeName,
            item.contractHours || 0,
            item.hireDate ? new Date(item.hireDate).toLocaleDateString('es-ES') : '',
            item.contractEndDate ? new Date(item.contractEndDate).toLocaleDateString('es-ES') : '',
            item.itDays,
            item.itRanges.map(r => `${new Date(r.start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}-${new Date(r.end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`).join(' / '),
            item.matPatDays,
            item.matPatRanges.map(r => `${new Date(r.start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}-${new Date(r.end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`).join(' / '),
            item.vacationDays,
            item.vacationRanges.map(r => `${new Date(r.start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}-${new Date(r.end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`).join(' / ')
        ]);

        // Combine into CSV Content
        const csvContent = [
            headers.join(';'),
            ...rows.map(r => r.join(';'))
        ].join('\n');

        // Create Blob and Download
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Informe_ILT_${report.month}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    const reportsList = iltReports
        .filter(r => r.establishmentId === user?.establishmentId)
        .sort((a, b) => b.month.localeCompare(a.month));

    const activeReport = activeTab === 'current' ? currentReport : selectedHistoryReport;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800">Informe Mensual (ILT/Vacaciones)</h3>
                            <p className="text-slate-500 text-sm font-medium">Resumen para RRHH del mes en curso</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-6 gap-6 justify-between items-center">
                    <div className="flex gap-6">
                        <button
                            onClick={() => { setActiveTab('current'); setSelectedHistoryReport(null); }}
                            className={clsx("py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2", activeTab === 'current' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600")}
                        >
                            <Calendar size={16} /> Mes Actual ({new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={clsx("py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2", activeTab === 'history' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600")}
                        >
                            <LucideHistory size={16} /> Historial
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden flex">

                    {/* Left Sidebar for History (only if History tab) */}
                    {activeTab === 'history' && (
                        <div className="w-64 border-r border-slate-100 overflow-y-auto p-4 bg-slate-50/50">
                            <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-wider">Informes Guardados</h4>
                            <div className="space-y-2">
                                {reportsList.length === 0 ? (
                                    <div className="text-sm text-slate-400 italic">No hay informes guardados.</div>
                                ) : (
                                    reportsList.map(report => (
                                        <button
                                            key={report.id}
                                            onClick={() => setSelectedHistoryReport(report)}
                                            className={clsx(
                                                "w-full text-left p-3 rounded-xl border text-sm font-medium transition-all",
                                                selectedHistoryReport?.id === report.id
                                                    ? "bg-white border-indigo-200 text-indigo-700 shadow-sm ring-1 ring-indigo-100"
                                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                            )}
                                        >
                                            {report.month}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Main Preview Area */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-100/50">
                        {activeTab === 'history' && !selectedHistoryReport ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <LucideHistory size={48} className="mb-4 opacity-20" />
                                <p>Selecciona un informe del historial</p>
                            </div>
                        ) : (
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 min-h-[600px] w-full max-w-[210mm] mx-auto" id="ilt-print-area">
                                {/* Print Layout */}
                                {activeReport && (
                                    <>
                                        <div className="flex justify-between items-start mb-8 pb-8 border-b border-slate-100">
                                            <div>
                                                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Resumen Mensual de Personal</h1>
                                                <p className="text-slate-500 font-medium">ILT / Vacaciones / Altas y Bajas</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-3xl font-black text-indigo-600">{activeReport?.month}</div>
                                                <div className="text-xs text-slate-400 font-medium mt-1">Generado: {activeReport ? new Date(activeReport.generatedAt).toLocaleDateString() : ''}</div>
                                                <div className="text-sm font-bold text-slate-700 mt-2">{getSettings(user?.establishmentId || '').storeName}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b-2 border-slate-100">
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider">Empleado</th>
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Horas C.</th>
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Fecha de Contratación</th>
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Fin Cont.</th>
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Baja IT</th>
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Mat/Pat</th>
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Vacaciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {activeReport.items.map((item) => (
                                                        <tr key={item.id} className="text-sm">
                                                            <td className="py-3 px-2 font-bold text-slate-700">
                                                                {item.employeeName}
                                                            </td>
                                                            <td className="py-3 px-2 text-center text-slate-600 font-bold">
                                                                {item.contractHours || '-'}h
                                                            </td>
                                                            <td className="py-3 px-2 text-slate-500 text-center">
                                                                {item.hireDate ? new Date(item.hireDate).toLocaleDateString() : '-'}
                                                            </td>
                                                            <td className="py-3 px-2 text-slate-500 text-center">
                                                                {item.contractEndDate ? new Date(item.contractEndDate).toLocaleDateString() : '-'}
                                                            </td>
                                                            <td className="py-3 px-2 text-center">
                                                                {item.itDays > 0 ? (
                                                                    <div>
                                                                        <div className="font-bold text-rose-600">{item.itDays} días</div>
                                                                        <div className="text-[10px] text-slate-400">
                                                                            {item.itRanges.map(r => `${new Date(r.start).getDate()}-${new Date(r.end).getDate()}`).join(', ')}
                                                                        </div>
                                                                    </div>
                                                                ) : <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="py-3 px-2 text-center">
                                                                {item.matPatDays > 0 ? (
                                                                    <div>
                                                                        <div className="font-bold text-purple-600">{item.matPatDays} días</div>
                                                                        <div className="text-[10px] text-slate-400">
                                                                            {item.matPatRanges.map(r => `${new Date(r.start).getDate()}-${new Date(r.end).getDate()}`).join(', ')}
                                                                        </div>
                                                                    </div>
                                                                ) : <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="py-3 px-2 text-center">
                                                                {item.vacationDays > 0 ? (
                                                                    <div>
                                                                        <div className="font-bold text-teal-600">{item.vacationDays} días</div>
                                                                        <div className="text-[10px] text-slate-400">
                                                                            {item.vacationRanges.map(r => `${new Date(r.start).getDate()}-${new Date(r.end).getDate()}`).join(', ')}
                                                                        </div>
                                                                    </div>
                                                                ) : <span className="text-slate-300">-</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-end">
                                                <div className="text-xs text-slate-400 w-64">
                                                    <div className="h-16 border-b border-slate-200 mb-2"></div>
                                                    <p>Firma del Gerente</p>
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    Informe generado automáticamente por el sistema de gestión.
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-4">
                    {activeTab === 'current' && isReportPeriod && (
                        <button
                            onClick={() => setIsConfirmSaveOpen(true)}
                            className="px-6 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-black rounded-xl transition-all flex items-center gap-2 border border-indigo-200 shadow-sm"
                        >
                            <Download size={18} /> Guardar Informe
                        </button>
                    )}

                    {(activeReport || (activeTab === 'current' && isReportPeriod)) && (
                        <>
                            <button
                                onClick={handleExportExcel}
                                className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
                            >
                                <FileSpreadsheet size={18} /> Exportar Excel
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                            >
                                <Printer size={18} /> Imprimir / PDF
                            </button>
                        </>
                    )}
                </div>
            </div >

            {/* Custom Confirmation Modal */}
            {isConfirmSaveOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 transform animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center">
                            <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-6">
                                <LucideHistory size={32} />
                            </div>
                            <h4 className="text-xl font-black text-slate-800 mb-2">¿Guardar Informe Mensual?</h4>
                            <p className="text-slate-500 font-medium text-sm mb-8">
                                Una vez guardado en el historial, el acceso directo desaparecerá del Dashboard para evitar duplicados.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setIsConfirmSaveOpen(false)}
                                    disabled={isSaving}
                                    className="flex-1 px-6 py-3 bg-slate-50 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveReport}
                                    disabled={isSaving}
                                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default ILTReportModal;
