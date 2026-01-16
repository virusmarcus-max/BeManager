
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { X, Printer, FileText, History, Calendar, Download, RefreshCw, FileSpreadsheet } from 'lucide-react';
import type { ILTReport, ILTReportItem } from '../../types';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext';

interface ILTReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ILTReportModal: React.FC<ILTReportModalProps> = ({ isOpen, onClose }) => {
    const { employees, timeOffRequests, iltReports, addILTReport, getSettings } = useStore();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
    const [selectedHistoryReport, setSelectedHistoryReport] = useState<ILTReport | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Current Month Helpers
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayOfMonth = now.getDate();
    const isReportPeriod = dayOfMonth >= 20 && dayOfMonth <= 30;

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
            let itDays = 0;
            const itRanges: { start: string, end: string }[] = [];

            sickRequests.forEach(req => {
                // If specific dates
                if (req.dates && req.dates.length > 0) {
                    req.dates.forEach(d => {
                        const dateObj = new Date(d);
                        if (dateObj >= startOfMonth && dateObj <= endOfMonth) itDays++;
                    });
                    // Approximate ranges for specific dates is hard, but usually sick leave is range-based in this system or "dates" array.
                    // If complex list of dates, we just list the count for report usually, but prompt asked for ranges.
                    // We'll treat contiguous dates as ranges or just use the whole block if strictly provided.
                    // Actually, the new sick leave modal uses startDate/endDate.
                }

                if (req.startDate && req.endDate) {
                    const rStart = new Date(req.startDate);
                    const rEnd = new Date(req.endDate);

                    // Overlap
                    const start = rStart < startOfMonth ? startOfMonth : rStart;
                    const end = rEnd > endOfMonth ? endOfMonth : rEnd;

                    if (start <= end) {
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        itDays += diffDays;
                        itRanges.push({
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                        });
                    }
                }
            });

            // Calculate Mat/Pat
            const matPatRequests = timeOffRequests.filter(r => r.employeeId === emp.id && r.type === 'maternity_paternity');
            let matPatDays = 0;
            const matPatRanges: { start: string, end: string }[] = [];

            matPatRequests.forEach(req => {
                if (req.startDate && req.endDate) {
                    const rStart = new Date(req.startDate);
                    const rEnd = new Date(req.endDate);
                    const start = rStart < startOfMonth ? startOfMonth : rStart;
                    const end = rEnd > endOfMonth ? endOfMonth : rEnd;

                    if (start <= end) {
                        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        matPatDays += diffDays;
                        matPatRanges.push({
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                        });
                    }
                }
            });

            // Calculate Vacations
            const vacRequests = timeOffRequests.filter(r => r.employeeId === emp.id && r.type === 'vacation');
            let vacationDays = 0;
            const vacationRanges: { start: string, end: string }[] = [];

            vacRequests.forEach(req => {
                // Check dates array
                if (req.dates) {
                    req.dates.forEach(d => {
                        const dateObj = new Date(d);
                        if (dateObj >= startOfMonth && dateObj <= endOfMonth) vacationDays++;
                    });
                }
                // Check ranges if they exist (vacation might be mixed)
                if (req.startDate && req.endDate) {
                    const rStart = new Date(req.startDate);
                    const rEnd = new Date(req.endDate);
                    const start = rStart < startOfMonth ? startOfMonth : rStart;
                    const end = rEnd > endOfMonth ? endOfMonth : rEnd;

                    if (start <= end) {
                        // Recalculate days based on overlap if dates array wasn't used/authoritative
                        // But usually 'dates' is source of truth for vacation count.
                        // If dates is empty but start/end exists (legacy?), use range.
                        if (!req.dates || req.dates.length === 0) {
                            const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            vacationDays += diffDays;
                        }
                        vacationRanges.push({
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                        });
                    }
                } else if (req.dates && req.dates.length > 0) {
                    // Try to form ranges from discrete dates
                    const sorted = [...req.dates].sort();
                    // Simplified: just list min and max of the cluster intersecting this month?
                    const inMonth = sorted.filter(d => d >= startOfMonth.toISOString().split('T')[0] && d <= endOfMonth.toISOString().split('T')[0]);
                    if (inMonth.length > 0) {
                        vacationRanges.push({
                            start: inMonth[0],
                            end: inMonth[inMonth.length - 1]
                        });
                    }
                }
            });

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
    }, [isOpen, activeTab, employees, timeOffRequests, refreshTrigger]);

    const handleSaveReport = () => {
        if (!currentReport) return;
        addILTReport(currentReport);
        showToast('Informe guardado en el historial', 'success');
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
                        body { font-family: system-ui, sans-serif; padding: 40px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; }
                        h1 { font-size: 24px; margin-bottom: 10px; }
                        .header { margin-bottom: 30px; }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleExportExcel = () => {
        const report = selectedHistoryReport || currentReport;
        if (!report) return;

        // CSV Header
        const headers = ['Empleado', 'Horas Contrato', 'Incorporación', 'Fin Contrato', 'Días Baja IT', 'Días Mat/Pat', 'Días Vacaciones'];

        // CSV Rows
        const rows = report.items.map(item => [
            item.employeeName,
            item.contractHours || 0,
            item.hireDate ? new Date(item.hireDate).toLocaleDateString('es-ES') : '',
            item.contractEndDate ? new Date(item.contractEndDate).toLocaleDateString('es-ES') : '',
            item.itDays,
            item.matPatDays,
            item.vacationDays
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
                            <History size={16} /> Historial
                        </button>
                    </div>

                    {activeTab === 'current' && (
                        <button
                            onClick={() => {
                                setRefreshTrigger(prev => prev + 1);
                                showToast('Informe regenerado con datos actuales', 'success');
                            }}
                            className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <RefreshCw size={14} /> Regenerar Datos
                        </button>
                    )}
                </div>

                {/* Content */}
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
                                <History size={48} className="mb-4 opacity-20" />
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
                                                <div className="text-3xl font-black text-indigo-600">{activeReport.month}</div>
                                                <div className="text-xs text-slate-400 font-medium mt-1">Generado: {new Date(activeReport.generatedAt).toLocaleDateString()}</div>
                                                <div className="text-sm font-bold text-slate-700 mt-2">{getSettings(user?.establishmentId || '').storeName}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b-2 border-slate-100">
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider">Empleado</th>
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Horas C.</th>
                                                        <th className="py-3 px-2 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Incorporación</th>
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
                            onClick={handleSaveReport}
                            className="px-6 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold rounded-xl transition-colors flex items-center gap-2"
                        >
                            <Download size={18} /> Guardar Copia
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
            </div>

        </div>
    );
};

export default ILTReportModal;
