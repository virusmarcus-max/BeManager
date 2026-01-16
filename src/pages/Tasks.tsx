import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import type { Task, TaskPriority, TaskType, TaskStatus } from '../types';
import {
    CheckCircle2, Clock, Calendar, Plus, Edit2, PlayCircle, Store,
    CheckSquare, X, RotateCcw, Trash2, AlertTriangle, Archive, ChevronDown, Minus
} from 'lucide-react';
import { clsx } from 'clsx';
import { useRef, useEffect } from 'react';
import { DatePicker } from '../components/DatePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import { DEFAULT_STORE_NAMES } from '../services/storeConfig';

const getDaysRemainingLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const dateFormatted = new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

    if (diffDays < 0) return `Vencida (${Math.abs(diffDays)}d) - ${dateFormatted}`;
    if (diffDays === 0) return `Hoy (${dateFormatted})`;
    if (diffDays === 1) return `Mañana (${dateFormatted})`;
    return `${diffDays} días restantes (${dateFormatted})`;
};

const getStatusColor = (status: TaskStatus) => {
    switch (status) {
        case 'pending': return 'bg-slate-100 text-slate-600 border-slate-200';
        case 'in_progress': return 'bg-blue-50 text-blue-600 border-blue-200';
        case 'completed': return 'bg-green-50 text-green-600 border-green-200';
        default: return 'bg-slate-100 text-slate-600';
    }
};

const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
        case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/30';
        case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
        case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
        case 'low': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
        default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
};

const getPriorityLabel = (p: TaskPriority) => {
    const map = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' };
    return map[p] || p;
};

interface TaskFormData {
    title: string;
    description: string;
    priority: TaskPriority;
    type: TaskType;
    date: string;       // For specific_date
    targetStores: string[];
    isAllStores: boolean;
    // New Cyclical Fields
    cycleUnit: 'weeks' | 'months';
    cycleFrequency: number;
    cyclicalDayOfWeek: number;
    cyclicalDayOfMonth: number;
    durationDays: number;
}



const FormSelect = ({ value, onChange, options, label, icon: Icon }: { value: any, onChange: (val: any) => void, options: { value: any, label: string }[], label: string, icon?: any }) => {
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

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || '';

    return (
        <div className="relative" ref={containerRef}>
            <label className="premium-label">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-bold text-sm outline-none transition-all cursor-pointer flex items-center justify-between w-full text-left",
                    isOpen ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10" : "hover:border-slate-700"
                )}
            >
                <div className="flex items-center gap-2 truncate">
                    {Icon && <Icon size={16} className="text-indigo-400 shrink-0" />}
                    <span className="truncate">{selectedLabel || 'Seleccionar...'}</span>
                </div>
                <ChevronDown size={18} className={clsx("text-indigo-400 transition-transform duration-300", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {options.map((opt) => (
                            <button
                                key={String(opt.value)}
                                type="button"
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={clsx(
                                    "w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group",
                                    String(value) === String(opt.value)
                                        ? "bg-indigo-600 text-white"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                )}
                            >
                                <span>{opt.label}</span>
                                {String(value) === String(opt.value) && <CheckCircle2 size={16} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const PremiumNumberInput = ({ value, onChange, label, min = 1, max = 100, placeholder }: { value: number, onChange: (val: number) => void, label: string, min?: number, max?: number, placeholder?: string }) => {
    return (
        <div>
            <label className="premium-label">{label}</label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all group">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, value - 1))}
                    className="px-4 py-3.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-900 transition-colors border-r border-slate-800"
                >
                    <Minus size={14} />
                </button>
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={value || ''}
                    onChange={e => onChange(Number(e.target.value))}
                    className="bg-transparent border-none w-full text-center text-white font-bold text-sm outline-none px-2"
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, value + 1))}
                    className="px-4 py-3.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-900 transition-colors border-l border-slate-800"
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
};

const Tasks = () => {
    const { user } = useAuth();
    const { tasks, addTask, updateTask, updateTaskStatus, triggerCyclicalTask, deleteTask, settings, employees } = useStore();
    const { showToast } = useToast();

    // Supervisor State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [filterStore, setFilterStore] = useState('all');
    const [showHistory, setShowHistory] = useState(false);

    // Completion State (Managers)
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [completionTaskId, setCompletionTaskId] = useState<string | null>(null);
    const [completionInitials, setCompletionInitials] = useState('');

    // Deletion State
    const [taskToDelete, setTaskToDelete] = useState<{ id: string, type: 'cyclical' | 'scheduled' | 'standard' } | null>(null);

    // Create/Edit Form State
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [formData, setFormData] = useState<TaskFormData>({
        title: '',
        description: '',
        priority: 'medium',
        type: 'specific_date',
        date: '',
        targetStores: [],
        isAllStores: false,
        cycleUnit: 'weeks',
        cycleFrequency: 1,
        cyclicalDayOfWeek: 1,
        cyclicalDayOfMonth: 1,
        durationDays: 1
    });


    const resetForm = () => {
        setFormData({
            title: '', description: '', priority: 'medium', type: 'specific_date',
            date: '', targetStores: [], isAllStores: true,
            cycleUnit: 'weeks',
            cycleFrequency: 1,
            cyclicalDayOfWeek: 1,
            cyclicalDayOfMonth: 1,
            durationDays: 1
        });
        setEditingTask(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsCreateModalOpen(true);
    };

    const handleOpenEdit = (task: Task) => {
        setEditingTask(task);
        setFormData({
            title: task.title,
            description: task.description,
            priority: task.priority,
            type: task.type,
            date: task.date || '',
            targetStores: task.targetStores === 'all' ? [] : task.targetStores,
            isAllStores: task.targetStores === 'all',
            cycleUnit: task.cycleUnit || 'weeks',
            cycleFrequency: task.cycleFrequency || 1,
            cyclicalDayOfWeek: task.cyclicalDayOfWeek || 1,
            cyclicalDayOfMonth: task.cyclicalDayOfMonth || 1,
            durationDays: task.durationDays || 1
        });
        setIsCreateModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // VALIDATION
        if (formData.type === 'specific_date' && !formData.date) {
            showToast('Debes seleccionar una fecha de inicio', 'error');
            return;
        }

        if (!formData.isAllStores && formData.targetStores.length === 0) {
            showToast('Debes asignar la tarea a al menos una tienda', 'error');
            return;
        }

        const taskData: any = {
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            type: formData.type,
            createdBy: user?.id || 'unknown',
            targetStores: formData.isAllStores ? 'all' : formData.targetStores,
            status: editingTask ? editingTask.status : {}, // Keep existing status if editing
            // Cyclical Flags
            isCyclical: formData.type === 'cyclical',
            cycleUnit: formData.type === 'cyclical' ? formData.cycleUnit : undefined,
            cycleFrequency: formData.type === 'cyclical' ? (formData.cycleFrequency || 1) : undefined,
            cyclicalDayOfWeek: formData.type === 'cyclical' ? formData.cyclicalDayOfWeek : undefined,
            cyclicalDayOfMonth: formData.type === 'cyclical' ? formData.cyclicalDayOfMonth : undefined,
            durationDays: formData.durationDays || 1, // Always required
        };

        if (formData.type === 'specific_date') {
            taskData.date = formData.date;
            taskData.durationDays = formData.durationDays || 1;
        }

        try {
            if (editingTask) {
                updateTask(editingTask.id, taskData);
                showToast('Tarea actualizada correctamente', 'success');
            } else {
                addTask(taskData);
                showToast('Tarea creada correctamente', 'success');
            }
            setIsCreateModalOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error launching task:", error);
            showToast('Error al guardar la tarea. Inténtalo de nuevo.', 'error');
        }
    };



    // Manager Actions
    const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
        if (!user?.establishmentId) return;

        if (newStatus === 'completed') {
            setCompletionTaskId(taskId);
            setCompletionInitials('');
            setIsCompletionModalOpen(true);
            return;
        }

        updateTaskStatus(taskId, user.establishmentId, newStatus, user.id);

        const msg = newStatus === 'in_progress' ? 'Tarea iniciada' : 'Tarea completada';
        showToast(msg, 'success');
    };

    const confirmCompletion = () => {
        if (!completionTaskId || !user?.establishmentId || !completionInitials.trim()) {
            showToast('Debes indicar las iniciales del empleado', 'error');
            return;
        }

        updateTaskStatus(completionTaskId, user.establishmentId, 'completed', user.id, completionInitials.toUpperCase());
        showToast('Tarea finalizada correctamente', 'success');
        setIsCompletionModalOpen(false);
        setCompletionTaskId(null);
    };

    const getMyStatus = (task: Task) => {
        if (!user?.establishmentId) return 'pending';
        return task.status[user.establishmentId]?.status || 'pending';
    };

    // Filters & Derived State
    const filteredTasks = useMemo(() => {
        if (user?.role !== 'admin') return [];
        return tasks.filter(t => {
            if (showHistory) {
                if (!t.isArchived) return false;
            } else {
                if (t.isArchived) return false;
            }
            if (filterStore !== 'all' && t.targetStores !== 'all' && !t.targetStores.includes(filterStore)) return false;

            // NEW: Hide future tasks matching Manager logic
            if (t.type === 'specific_date' && t.date) {
                const taskDate = new Date(t.date);
                taskDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (taskDate > today) return false;
            }

            // NEW: Filter Cyclical Tasks
            if (t.isCyclical) {
                const today = new Date();

                if (t.cycleUnit === 'months') {
                    const currentDay = today.getDate();
                    const startDay = t.cyclicalDayOfMonth || 1;
                    const duration = t.durationDays || 1;
                    if (currentDay < startDay || currentDay >= startDay + duration) return false;
                }

                if (t.cycleUnit === 'weeks') {
                    const currentDayOfWeek = today.getDay();
                    const startDayOfWeek = t.cyclicalDayOfWeek || 0;
                    const duration = t.durationDays || 1;
                    const diff = (currentDayOfWeek - startDayOfWeek + 7) % 7;
                    if (diff >= duration) return false;
                }
            }

            return true;
        });
    }, [tasks, filterStore, user?.role, showHistory]);

    // Manager: My Tasks Sorted
    const sortedTasks = useMemo(() => {
        if (!user?.establishmentId) return [];

        const myTasks = tasks.filter(t => t.targetStores === 'all' || (user.establishmentId && t.targetStores.includes(user.establishmentId!)));

        const getStatusWeight = (s: string) => {
            if (s === 'in_progress') return 3;
            if (s === 'pending') return 2;
            return 1; // completed
        };
        const getPriorityWeight = (p: string) => {
            if (p === 'critical') return 4;
            if (p === 'high') return 3;
            if (p === 'medium') return 2;
            return 1;
        };

        return [...myTasks]
            .filter(task => {
                if (task.isArchived) return false;

                // NEW: Hide future tasks (Specific Date)
                if (task.type === 'specific_date' && task.date) {
                    const taskDate = new Date(task.date);
                    taskDate.setHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (taskDate > today) return false;
                }

                // NEW: Filter Cyclical Tasks
                if (task.isCyclical) {
                    const today = new Date();

                    if (task.cycleUnit === 'months') {
                        const currentDay = today.getDate();
                        const startDay = task.cyclicalDayOfMonth || 1;
                        const duration = task.durationDays || 1;
                        // Show only if within the active window [startDay, startDay + duration)
                        // This effectively hides it before the 20th and resets it after the duration passes
                        if (currentDay < startDay || currentDay >= startDay + duration) return false;
                    }

                    if (task.cycleUnit === 'weeks') {
                        const currentDayOfWeek = today.getDay(); // 0-6
                        const startDayOfWeek = task.cyclicalDayOfWeek || 0; // 0-6
                        const duration = task.durationDays || 1;

                        // Calculate days passed since start of cycle (handling week wrap)
                        const diff = (currentDayOfWeek - startDayOfWeek + 7) % 7;

                        // Show only if we are within 'duration' days from the start day
                        if (diff >= duration) return false;

                        // Additional check: If duration is notably long (e.g. 7 days), it's always shown.
                        // But typically duration is small (e.g. 1-3 days).
                        // If user sets Start Friday (5), Duration 3 -> Active Fri(0), Sat(1), Sun(2). Mon(3) is hidden. Correct.
                    }
                }

                const status = getMyStatus(task);
                if (showHistory) return status === 'completed';
                return status !== 'completed';
            })
            .sort((a, b) => {
                const statusA = getMyStatus(a);
                const statusB = getMyStatus(b);

                // 1. Sort by Status (In Progress > Pending > Completed)
                const weightA = getStatusWeight(statusA);
                const weightB = getStatusWeight(statusB);
                if (weightA !== weightB) return weightB - weightA;

                // 2. Sort by Priority
                const pA = getPriorityWeight(a.priority);
                const pB = getPriorityWeight(b.priority);
                return pB - pA;
            });
    }, [tasks, user?.establishmentId, showHistory]);


    // SUPERVISOR VIEW (Dark Theme Redesign)
    if (user?.role === 'admin') {
        const allStoreIds = Array.from(new Set([
            ...settings.map(s => s.establishmentId),
            ...employees.map(e => e.establishmentId)
        ])).filter(id => id !== 'super').sort();

        const allStores = allStoreIds.length > 0 ? allStoreIds.map(id => ({
            id,
            name: settings.find(s => s.establishmentId === id)?.storeName || DEFAULT_STORE_NAMES[id] || `Tienda ${id}`
        })) : [{ id: '1', name: 'Sevilla 1' }, { id: '2', name: 'Sevilla 2' }]; // Fallback to avoid 0 division if data not loaded

        return (
            <div className="px-4 py-8 pb-24 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 opacity-70">Hola, Supervisor 👋</p>
                        <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                            <CheckSquare size={18} /> Task Command Center
                        </h2>
                        <h1 className="text-6xl font-black text-white tracking-tight leading-tight">
                            {showHistory ? 'Historial de ' : 'Gestión de '}
                            <span className="text-slate-500 italic font-medium">Tareas</span>
                        </h1>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={clsx(
                                "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border flex items-center gap-2",
                                showHistory
                                    ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20"
                                    : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700 shadow-xl"
                            )}
                        >
                            <Clock size={16} /> {showHistory ? 'Volver a Activas' : 'Consultar Historial'}
                        </button>
                        {!showHistory && (
                            <button
                                onClick={handleOpenCreate}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest"
                            >
                                <Plus size={16} /> Nueva Tarea Distribuida
                            </button>
                        )}
                    </div>
                </div>

                {/* Split View for Cyclical & Future Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    {/* Column 1: Cyclical Templates */}
                    <div className="bg-slate-900/20 border border-slate-800/50 rounded-[2rem] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-black flex items-center gap-2 text-sm uppercase tracking-wider">
                                <RotateCcw size={16} className="text-pink-400" />
                                Plantillas Cíclicas
                            </h3>
                            <span className="text-[9px] font-black text-slate-500 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                                {tasks.filter(t => t.isCyclical && !t.isArchived).length} ACTIVAS
                            </span>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {tasks.filter(t => t.isCyclical && !t.isArchived).length === 0 ? (
                                <div className="text-center py-8 text-slate-600 text-xs italic">No hay plantillas cíclicas activas</div>
                            ) : (
                                tasks.filter(t => t.isCyclical && !t.isArchived).map(task => (
                                    <div key={task.id} className="group flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition-all">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                                                <RotateCcw size={14} className="text-pink-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-white font-bold text-xs truncate">{task.title}</h4>
                                                <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase tracking-wide">
                                                    <span>{task.cycleUnit === 'weeks' ? 'Semanal' : 'Mensual'}</span>
                                                    <span>•</span>
                                                    <span className="text-indigo-300">
                                                        {task.cycleUnit === 'weeks'
                                                            ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][task.cyclicalDayOfWeek || 0]
                                                            : `Día ${task.cyclicalDayOfMonth}`}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="text-emerald-400 font-bold truncate max-w-[100px]" title={task.targetStores === 'all' ? 'Todas' : task.targetStores.map(id => allStores.find(s => s.id === id)?.name).join(', ')}>
                                                        {task.targetStores === 'all' ? 'Todas' : task.targetStores.map(id => allStores.find(s => s.id === id)?.name || id).join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEdit(task);
                                                }}
                                                className="p-2 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded-lg"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTaskToDelete({ id: task.id, type: 'cyclical' });
                                                }}
                                                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Column 2: Scheduled Future Tasks */}
                    <div className="bg-slate-900/20 border border-slate-800/50 rounded-[2rem] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-black flex items-center gap-2 text-sm uppercase tracking-wider">
                                <Calendar size={16} className="text-blue-400" />
                                Actuaciones Programadas
                            </h3>
                            <span className="text-[9px] font-black text-slate-500 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                                FUTURAS
                            </span>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {tasks.filter(t => {
                                if (t.isArchived || t.isCyclical || !t.date) return false;
                                const taskDate = new Date(t.date);
                                taskDate.setHours(0, 0, 0, 0);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                return taskDate > today;
                            }).length === 0 ? (
                                <div className="text-center py-8 text-slate-600 text-xs italic">No hay actuaciones programadas</div>
                            ) : (
                                tasks.filter(t => {
                                    if (t.isArchived || t.isCyclical || !t.date) return false;
                                    const taskDate = new Date(t.date);
                                    taskDate.setHours(0, 0, 0, 0);
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return taskDate > today;
                                }).map(task => (
                                    <div key={task.id} className="group flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition-all">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                <Calendar size={14} className="text-blue-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-white font-bold text-xs truncate">{task.title}</h4>
                                                <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase tracking-wide">
                                                    <span className="text-blue-300">{new Date(task.date!).toLocaleDateString('es-ES')}</span>
                                                    <span>•</span>
                                                    <span>
                                                        {(() => {
                                                            const today = new Date();
                                                            today.setHours(0, 0, 0, 0);
                                                            const tDate = new Date(task.date!);
                                                            tDate.setHours(0, 0, 0, 0);
                                                            const diffTime = tDate.getTime() - today.getTime();
                                                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                            return `Faltan ${diffDays}d`;
                                                        })()}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="text-emerald-400 font-bold truncate max-w-[100px]" title={task.targetStores === 'all' ? 'Todas' : task.targetStores.map(id => allStores.find(s => s.id === id)?.name).join(', ')}>
                                                        {task.targetStores === 'all' ? 'Todas' : task.targetStores.map(id => allStores.find(s => s.id === id)?.name || id).join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenEdit(task)}
                                                className="p-2 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded-lg"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTaskToDelete({ id: task.id, type: 'scheduled' });
                                                }}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
                    <button
                        onClick={() => setFilterStore('all')}
                        className={clsx("px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 border shadow-2xl",
                            filterStore === 'all'
                                ? "bg-indigo-600 text-white border-indigo-500"
                                : "bg-slate-900/50 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700")}
                    >
                        <Store size={14} /> Global / Todas
                    </button>
                    <div className="w-px h-6 bg-slate-800 mx-2"></div>
                    {allStores.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setFilterStore(s.id)}
                            className={clsx("px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border shadow-2xl",
                                filterStore === s.id
                                    ? "bg-indigo-600 text-white border-indigo-500"
                                    : "bg-slate-900/50 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700")}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>

                {/* Tasks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredTasks.length === 0 ? (
                        <div className="col-span-full py-32 text-center bg-slate-900/40 border border-slate-800 rounded-[3rem]">
                            <div className="bg-slate-800/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700">
                                <CheckSquare size={40} className="text-slate-500" />
                            </div>
                            <h3 className="text-white font-black text-2xl mb-2">Sin Tareas Activas</h3>
                            <p className="text-slate-500 font-medium">No hay tareas pendientes en este momento.</p>
                        </div>
                    ) : filteredTasks.map(task => {
                        // Calculate stats
                        const targetStoreIds = task.targetStores === 'all'
                            ? allStores.map(s => s.id)
                            : task.targetStores;

                        const completedCount = targetStoreIds.filter(sid => task.status[sid]?.status === 'completed').length;
                        const inProgressCount = targetStoreIds.filter(sid => task.status[sid]?.status === 'in_progress').length;
                        const total = targetStoreIds.length;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const diffDays = task.date ? Math.round((new Date(task.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                        const progress = total > 0 ? (completedCount / total) * 100 : 0;

                        return (
                            <div key={task.id} className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 transition-all group relative overflow-hidden backdrop-blur-xl">
                                {/* Ambient Background Effect */}
                                <div className={clsx(
                                    "absolute -top-24 -right-24 w-64 h-64 blur-[100px] transition-opacity duration-700 opacity-20 group-hover:opacity-40",
                                    progress === 100 ? "bg-emerald-500" : "bg-indigo-500"
                                )}></div>

                                <div className="relative z-10">
                                    {/* Header: Priority & Actions */}
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex gap-2 items-center">
                                            <span className={clsx("text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] border shadow-sm", getPriorityColor(task.priority))}>
                                                {getPriorityLabel(task.priority)}
                                            </span>
                                            {task.isCyclical && (
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/10 text-pink-400 rounded-full border border-pink-500/20 text-[10px] font-black uppercase tracking-widest">
                                                    <RotateCcw size={12} /> Recurrente
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {!showHistory ? (
                                                <>
                                                    {progress === 100 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateTask(task.id, { isArchived: true }); showToast('Tarea archivada', 'success'); }}
                                                            className="p-3 bg-slate-800/80 text-amber-500 hover:bg-amber-500 hover:text-white rounded-2xl transition-all border border-white/5 shadow-xl"
                                                            title="Archivar"
                                                        >
                                                            <Archive size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenEdit(task)}
                                                        className="p-3 bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 rounded-2xl transition-all border border-white/5 shadow-xl"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setTaskToDelete({ id: task.id, type: 'standard' }); }}
                                                        className="p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all border border-rose-500/20 shadow-xl relative z-50 pointer-events-auto"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); updateTask(task.id, { isArchived: false }); showToast('Reactivada', 'success'); }}
                                                        className="p-3 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-2xl transition-all border border-indigo-500/20 shadow-xl relative z-30"
                                                    >
                                                        <RotateCcw size={18} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setTaskToDelete({ id: task.id, type: 'standard' }); }}
                                                        className="p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all border border-rose-500/20 shadow-xl relative z-50 pointer-events-auto"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Body: Title & Info */}
                                    <div className="grid lg:grid-cols-[1fr,240px] gap-8 mb-8">
                                        <div>
                                            <h3 className="text-3xl font-black text-white mb-3 tracking-tight group-hover:text-indigo-400 transition-colors">{task.title}</h3>
                                            <p className="text-slate-400 text-base leading-relaxed font-medium line-clamp-2 max-w-2xl">{task.description}</p>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {task.date && (
                                                <div className={clsx(
                                                    "flex items-center gap-3 px-4 py-3 rounded-2xl border font-black text-[10px] uppercase tracking-[0.1em]",
                                                    diffDays !== null && diffDays <= 1
                                                        ? "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse"
                                                        : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                                                )}>
                                                    <Clock size={14} />
                                                    {diffDays === null ? '' : diffDays < 0 ? `Vencida (${Math.abs(diffDays)}d)` : diffDays === 0 ? 'Termina hoy' : diffDays === 1 ? 'Último día' : `${diffDays} Días restantes`}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.1em]">
                                                <Calendar size={14} className="text-indigo-400" />
                                                {task.date ? new Date(task.date).toLocaleDateString('es-ES') : `Ciclo: ${task.durationDays || 1} días`}
                                            </div>
                                            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.1em]">
                                                <Store size={14} className="text-emerald-400" />
                                                {task.targetStores === 'all' ? 'Carga Global' : `${task.targetStores.length} Tiendas`}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Global Progress Section */}
                                    <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 mb-8">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Tracking de Ejecución Global</span>
                                                {task.date && diffDays !== null && (
                                                    <div className={clsx(
                                                        "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                                                        diffDays <= 1 ? "text-rose-500" : "text-indigo-400"
                                                    )}>
                                                        <div className={clsx("w-1 h-1 rounded-full", diffDays <= 1 ? "bg-rose-500 animate-pulse" : "bg-indigo-500")}></div>
                                                        {diffDays < 0 ? 'Plazo Vencido' : diffDays === 0 ? 'Cierre Hoy' : `Finaliza en ${diffDays} días`}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-white">{Math.round(progress)}</span>
                                                <span className="text-sm font-bold text-slate-500">%</span>
                                            </div>
                                        </div>
                                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                                            <div
                                                className={clsx(
                                                    "h-full rounded-full transition-all duration-1000 ease-out",
                                                    progress === 100 ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]" : "bg-gradient-to-r from-indigo-600 to-violet-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                                                )}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Store Status Grid */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-4 px-1">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Estado Individual por Centro</h4>
                                            <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent"></div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {targetStoreIds.map(sid => {
                                                const sName = settings.find(s => s.establishmentId === sid)?.storeName || DEFAULT_STORE_NAMES[sid] || sid;
                                                const sStatus = task.status[sid];
                                                const status = sStatus?.status || 'pending';

                                                return (
                                                    <div key={sid} className={clsx(
                                                        "relative p-4 rounded-[1.5rem] border transition-all group/store",
                                                        status === 'completed' ? "bg-emerald-500/5 border-emerald-500/20" :
                                                            status === 'in_progress' ? "bg-blue-500/5 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.05)]" :
                                                                "bg-white/5 border-white/5 opacity-60 hover:opacity-100"
                                                    )}>
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex justify-between items-start">
                                                                <div className="text-[10px] font-black uppercase tracking-tight text-white/80 group-hover/store:text-white truncate pr-2">{sName}</div>
                                                                <div className={clsx(
                                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                                    status === 'completed' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" :
                                                                        status === 'in_progress' ? "bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "bg-slate-700"
                                                                )} />
                                                            </div>
                                                            <div className="flex justify-between items-end">
                                                                <span className={clsx(
                                                                    "text-[8px] font-black uppercase tracking-widest",
                                                                    status === 'completed' ? "text-emerald-500" :
                                                                        status === 'in_progress' ? "text-blue-500" : "text-slate-600"
                                                                )}>
                                                                    {status === 'pending' ? 'Idle' : status === 'in_progress' ? 'Active' : 'Done'}
                                                                </span>
                                                                {status === 'completed' && sStatus?.completedByInitials && (
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-[7px] font-bold text-slate-500 uppercase leading-none mb-0.5">By</span>
                                                                        <span className="text-[11px] font-black text-indigo-400 leading-none">{sStatus.completedByInitials}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Footer Summary & Actions */}
                                    <div className="flex flex-wrap items-center justify-between gap-6 mt-8 pt-8 border-t border-white/5">
                                        <div className="flex gap-6 text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">
                                            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>{completedCount} Finalizadas</span>
                                            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></span>{inProgressCount} En curso</span>
                                        </div>

                                        {task.type === 'cyclical' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); triggerCyclicalTask(task.id); showToast('Nuevo ciclo activado', 'success'); }}
                                                className="flex items-center gap-2.5 px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                                            >
                                                <PlayCircle size={16} /> Activar Nuevo Ciclo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Create/Edit Modal (Dark Theme redesign) */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto custom-scrollbar pt-20 pb-20">
                        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative overflow-visible">
                            <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center rounded-t-[2.5rem]">
                                <h2 className="text-xl font-black text-white tracking-tight">{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
                                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left Column: Basic Info & Description */}
                                    <div className="space-y-6">
                                        <div>
                                            <label className="premium-label">Título de la Tarea</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                className="premium-input w-full"
                                                placeholder="Ej: Revisar inventario de bebidas"
                                            />
                                        </div>

                                        <div>
                                            <label className="premium-label">Descripción / Instrucciones (Opcional)</label>
                                            <textarea
                                                rows={5}
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                className="premium-input w-full resize-none font-medium h-40"
                                                placeholder="Detalla qué deben hacer los gerentes..."
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="premium-label">Tipo de Ejecución</label>
                                            <div className="flex gap-3">
                                                {[
                                                    { id: 'specific_date', label: 'Específica', icon: Calendar },
                                                    { id: 'cyclical', label: 'Recurrente', icon: RotateCcw }
                                                ].map((t) => (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, type: t.id as TaskType })}
                                                        className={clsx(
                                                            "flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 font-bold text-sm transition-all duration-200",
                                                            formData.type === t.id
                                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                                                : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                                                        )}
                                                    >
                                                        <t.icon size={18} />
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Settings */}
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <label className="premium-label">Prioridad</label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {(['low', 'medium', 'high', 'critical'] as TaskPriority[]).map((p) => (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, priority: p })}
                                                        className={clsx(
                                                            "flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all duration-200",
                                                            formData.priority === p
                                                                ? (p === 'critical' ? 'bg-red-500/10 border-red-500 text-red-500' :
                                                                    p === 'high' ? 'bg-orange-500/10 border-orange-500 text-orange-500' :
                                                                        p === 'medium' ? 'bg-amber-500/10 border-amber-500 text-amber-500' :
                                                                            'bg-indigo-500/10 border-indigo-500 text-indigo-500')
                                                                : "bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700"
                                                        )}
                                                    >
                                                        <AlertTriangle size={20} className={clsx(formData.priority === p ? "animate-pulse" : "opacity-40")} />
                                                        <span className="text-[10px] font-black uppercase">{getPriorityLabel(p)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Dynamic Settings Area */}
                                        <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 space-y-6">
                                            {formData.type === 'specific_date' && (
                                                <div>
                                                    <label className="premium-label">Fecha de Inicio</label>
                                                    <DatePicker
                                                        value={formData.date}
                                                        onChange={val => setFormData({ ...formData, date: val })}
                                                        required
                                                        variant="dark"
                                                        className="w-full"
                                                    />
                                                </div>
                                            )}

                                            {formData.type === 'cyclical' && (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <FormSelect
                                                            label="Unidad"
                                                            value={formData.cycleUnit}
                                                            onChange={val => setFormData({ ...formData, cycleUnit: val })}
                                                            options={[
                                                                { value: 'weeks', label: 'Semanas' },
                                                                { value: 'months', label: 'Meses' }
                                                            ]}
                                                        />
                                                        <PremiumNumberInput
                                                            label="Freq."
                                                            value={formData.cycleFrequency}
                                                            onChange={val => setFormData({ ...formData, cycleFrequency: val })}
                                                            placeholder="X"
                                                        />
                                                    </div>

                                                    {formData.cycleUnit === 'weeks' && (
                                                        <FormSelect
                                                            label="Día de la semana"
                                                            value={formData.cyclicalDayOfWeek || 1}
                                                            onChange={val => setFormData({ ...formData, cyclicalDayOfWeek: Number(val) })}
                                                            options={[
                                                                { value: 1, label: 'Lunes' },
                                                                { value: 2, label: 'Martes' },
                                                                { value: 3, label: 'Miércoles' },
                                                                { value: 4, label: 'Jueves' },
                                                                { value: 5, label: 'Viernes' },
                                                                { value: 6, label: 'Sábado' },
                                                                { value: 0, label: 'Domingo' }
                                                            ]}
                                                        />
                                                    )}

                                                    {formData.cycleUnit === 'months' && (
                                                        <FormSelect
                                                            label="Día del mes"
                                                            value={formData.cyclicalDayOfMonth || 1}
                                                            onChange={val => setFormData({ ...formData, cyclicalDayOfMonth: Number(val) })}
                                                            options={Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `Día ${i + 1}` }))}
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            <div>
                                                <div className="flex justify-between items-baseline mb-2">
                                                    <label className="premium-label !mb-0">Plazo ejecución (Días)</label>
                                                    <span className="text-2xl font-black text-white">{formData.durationDays}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={1}
                                                    max={30}
                                                    value={formData.durationDays}
                                                    onChange={e => setFormData({ ...formData, durationDays: Number(e.target.value) })}
                                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                                {formData.type === 'specific_date' && formData.date && (
                                                    <div className="text-[10px] font-bold text-slate-500 text-right mt-2">
                                                        Vence el: <span className="text-indigo-400">{new Date(new Date(formData.date).getTime() + ((formData.durationDays || 1) * 24 * 60 * 60 * 1000)).toLocaleDateString('es-ES')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="premium-label">Asignación</label>
                                            <button
                                                type="button"
                                                onClick={() => setFormData((prev) => ({ ...prev, isAllStores: !prev.isAllStores, targetStores: [] }))}
                                                className={clsx(
                                                    "w-full flex items-center gap-4 px-6 py-4 rounded-2xl border-2 transition-all group",
                                                    formData.isAllStores
                                                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                                                        : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors",
                                                    formData.isAllStores
                                                        ? "bg-emerald-500 border-emerald-500 text-slate-950"
                                                        : "border-slate-600 group-hover:border-slate-500"
                                                )}>
                                                    {formData.isAllStores && <CheckSquare size={14} strokeWidth={4} />}
                                                </div>
                                                <span className="font-bold text-sm">Asignar a todas las tiendas (Global)</span>
                                            </button>

                                            {!formData.isAllStores && (
                                                <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-2 gap-3 max-h-40 overflow-y-auto custom-scrollbar">
                                                    {settings.map(s => {
                                                        const isSelected = formData.targetStores.includes(s.establishmentId);
                                                        return (
                                                            <button
                                                                key={s.establishmentId}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        targetStores: isSelected
                                                                            ? prev.targetStores.filter(id => id !== s.establishmentId)
                                                                            : [...prev.targetStores, s.establishmentId]
                                                                    }));
                                                                }}
                                                                className={clsx(
                                                                    "px-3 py-2 rounded-xl text-xs font-bold transition-all border text-left truncate",
                                                                    isSelected
                                                                        ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                                                                        : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                                                                )}
                                                            >
                                                                {s.storeName || `Tienda ${s.establishmentId}`}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <PlayCircle size={18} />
                                        {editingTask ? 'Guardar Cambios' : 'Lanzar Tarea'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={!!taskToDelete}
                    title="¿Eliminar tarea?"
                    message="¿Estás seguro de que deseas eliminar esta tarea permanentemente? Esta acción no se puede deshacer y se borrará de todas las tiendas."
                    confirmText="Eliminar Tarea"
                    cancelText="Cancelar"
                    isDestructive={true}
                    onConfirm={() => {
                        if (taskToDelete) {
                            deleteTask(taskToDelete.id);
                            showToast('Tarea eliminada correctamente', 'success');
                            setTaskToDelete(null);
                        }
                    }}
                    onCancel={() => setTaskToDelete(null)}
                />
            </div>
        );
    }

    // MANAGER VIEW - Using sortedTasks calculated above

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">{showHistory ? 'Historial de Tareas' : 'Mis Tareas'}</h1>
                    <p className="text-slate-500 mt-1">{showHistory ? 'Consulta las tareas finalizadas anteriormente.' : 'Lista de tareas asignadas a tu tienda.'}</p>
                </div>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
                >
                    <Clock size={16} />
                    {showHistory ? 'Ver Pendientes' : 'Ver Historial'}
                </button>
            </div>

            <div className="space-y-4">
                {sortedTasks.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                        <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">¡Todo al día!</h3>
                        <p className="text-slate-500">No tienes tareas pendientes por el momento.</p>
                    </div>
                ) : sortedTasks.map(task => {
                    const status = getMyStatus(task);
                    const isCompleted = status === 'completed';
                    const isInProgress = status === 'in_progress';
                    const isPending = status === 'pending';

                    return (
                        <div key={task.id} className={clsx("bg-white p-6 rounded-2xl border shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row gap-6", isCompleted ? "border-slate-200 opacity-75 grayscale-[0.5]" : "border-slate-200")}>
                            {/* Left: Indicator */}
                            <div className={clsx("w-2 h-full rounded-full hidden md:block shrink-0",
                                task.priority === 'critical' ? 'bg-red-500' :
                                    task.priority === 'high' ? 'bg-orange-500' :
                                        task.priority === 'medium' ? 'bg-amber-400' : 'bg-blue-400'
                            )}></div>

                            {/* Content */}
                            <div className="flex-1">
                                <div className="flex flex-wrap gap-2 mb-2">
                                    <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-md border", getPriorityColor(task.priority))}>
                                        {getPriorityLabel(task.priority)}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                        {task.type === 'specific_date' ? <Calendar size={12} /> : <RotateCcw size={12} />}
                                        {task.type === 'specific_date' ? 'Puntual' : 'Recurrente'}
                                    </span>
                                    {task.date ? (
                                        <span className={clsx(
                                            "flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border shadow-sm",
                                            new Date(task.date) < new Date(new Date().setHours(0, 0, 0, 0))
                                                ? "bg-red-50 text-red-600 border-red-100 animate-pulse"
                                                : "bg-indigo-50 text-indigo-700 border-indigo-100 font-bold"
                                        )}>
                                            <Clock size={12} />
                                            {getDaysRemainingLabel(task.date)}
                                        </span>
                                    ) : task.isCyclical && (
                                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                            <Clock size={12} className="text-indigo-500" /> Duración: {task.durationDays || 1} días
                                        </span>
                                    )}
                                </div>
                                <h3 className={clsx("text-xl font-bold mb-2", isCompleted ? "text-slate-500 line-through" : "text-slate-800")}>{task.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{task.description}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col items-end justify-center min-w-[180px] gap-3 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
                                <div className={clsx("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border", getStatusColor(status))}>
                                    {status === 'pending' ? 'Pendiente' : status === 'in_progress' ? 'En Curso' : 'Completada'}
                                </div>

                                <div className="flex flex-col gap-2 w-full">
                                    {isPending && (
                                        <button
                                            onClick={() => handleStatusChange(task.id, 'in_progress')}
                                            className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 hover:scale-[1.02]"
                                        >
                                            <PlayCircle size={16} /> Iniciar
                                        </button>
                                    )}
                                    {isInProgress && (
                                        <button
                                            onClick={() => handleStatusChange(task.id, 'completed')}
                                            className="flex items-center justify-center gap-2 w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-green-200 hover:scale-[1.02]"
                                        >
                                            <CheckCircle2 size={16} /> Finalizar
                                        </button>
                                    )}
                                    {isCompleted && (
                                        <div className="flex flex-col items-center justify-center gap-1 text-[10px] text-slate-400 font-medium w-full py-2 italic">
                                            <div className="flex items-center gap-1">
                                                <CheckCircle2 size={12} className="text-emerald-500" />
                                                Finalizada por {task.status[user?.establishmentId || '']?.completedByInitials || 'Gerente'}
                                            </div>
                                            <div className="text-[9px] opacity-70">
                                                {task.status[user?.establishmentId || '']?.lastUpdated && new Date(task.status[user?.establishmentId || '']?.lastUpdated!).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Initials Completion Modal */}
            {isCompletionModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-8 text-center">
                            <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-600 border border-indigo-100">
                                <CheckSquare size={32} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-2">Finalizar Tarea</h2>
                            <p className="text-slate-500 text-sm mb-6 font-medium">Indica las iniciales del empleado que ha realizado la tarea de forma física.</p>

                            <input
                                type="text"
                                maxLength={4}
                                autoFocus
                                value={completionInitials}
                                onChange={e => setCompletionInitials(e.target.value.toUpperCase())}
                                placeholder="Ejem: AR"
                                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-2xl font-black text-slate-900 focus:border-indigo-500/30 transition-all mb-6 outline-none shadow-sm"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setIsCompletionModalOpen(false);
                                        setCompletionTaskId(null);
                                    }}
                                    className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmCompletion}
                                    className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Deletion Confirmation Dialog */}
            <ConfirmDialog
                isOpen={!!taskToDelete}
                title={taskToDelete?.type === 'cyclical' ? '¿Eliminar plantilla cíclica?' : '¿Eliminar tarea?'}
                message={taskToDelete?.type === 'cyclical'
                    ? "Esta acción eliminará permanentemente la configuración cíclica. Esta acción no se puede deshacer."
                    : "Esta acción eliminará la tarea seleccionada permanentemente. ¿Estás seguro?"}
                confirmText="Eliminar"
                cancelText="Cancelar"
                isDestructive={true}
                onConfirm={() => {
                    if (taskToDelete) {
                        deleteTask(taskToDelete.id);
                        showToast(taskToDelete.type === 'cyclical' ? 'Plantilla eliminada' : 'Tarea eliminada', 'success');
                        setTaskToDelete(null);
                    }
                }}
                onCancel={() => setTaskToDelete(null)}
            />
        </div>

    );
};

export default Tasks;
