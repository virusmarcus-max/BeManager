import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
    value: string;
    onChange: (date: string) => void;
    label?: string;
    className?: string;
    min?: string;
    max?: string;
    required?: boolean;
    disabled?: boolean;
    variant?: 'light' | 'dark';
}

function clsx(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    label,
    className = "",
    min,
    max,
    required = false,
    disabled = false,
    variant = 'dark'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, openUp: false });
    const isLight = variant === 'light';

    // Parse the current value or default to today for the calendar view
    const dateValue = value ? new Date(value) : new Date();
    // Safety check for invalid dates
    const safeDate = isNaN(dateValue.getTime()) ? new Date() : dateValue;

    const [viewDate, setViewDate] = useState(safeDate);

    // Sync viewDate when value changes externally
    useEffect(() => {
        if (value) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                setViewDate(d);
            }
        }
    }, [value]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside the container (input) or the portal (dropdown)
            // Since portal is in body, we need a way to reference it? 
            // Actually, we can rely on the fact that stopPropagation is on the dropdown content.
            // But if we click outside both, we close.

            // To make this robust with Portal, check if target is inside containerRef.
            // If it IS inside containerRef, we toggle (which is handled by button onClick).
            // If it is NOT inside containerRef, we close.
            // BUT, clicking inside the Portal (dropdown) must NOT close.
            // The dropdown content has `onClick={(e) => e.stopPropagation()}` ? 
            // Wait, document listener catches all. 
            // We need a ref for the dropdown content too if we want to check `contains`.

            // Simpler approach: 
            // The dropdown div stops bubbling to document? No, Portal bubbling is weird in React (it bubbles to React tree parent, but DOM event bubbles to body).
            // React events bubble through Portal. Native events bubble up DOM.
            // So `handleClickOutside` attached to `document` will fire for clicks in Portal.

            // We need to exclude clicks on the dropdown.
            const dropdown = document.getElementById('datepicker-dropdown');
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                (!dropdown || !dropdown.contains(event.target as Node))
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Close on scroll to prevent detached floating
            window.addEventListener('scroll', () => setIsOpen(false), { capture: true });
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', () => setIsOpen(false), { capture: true });
        };
    }, [isOpen]);

    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 400; // If less than 400px below, open up

            setCoords({
                top: openUp ? rect.top - 8 : rect.bottom + 8,
                left: rect.left,
                openUp
            });
        }
    };

    const toggleOpen = () => {
        if (!isOpen) {
            updatePosition();
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1;
    };

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1));
    };

    const handleDayClick = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        const dateString = `${year}-${month}-${d}`;

        onChange(dateString);
        setIsOpen(false);
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - 80 + i);

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);

        const minDate = min ? new Date(min) : null;
        if (minDate) minDate.setHours(0, 0, 0, 0);

        const maxDate = max ? new Date(max) : null;
        if (maxDate) maxDate.setHours(0, 0, 0, 0);

        const blanks = Array.from({ length: startDay }, (_, i) => <div key={`blank-${i}`} className="h-8 w-8" />);
        const days = Array.from({ length: totalDays }, (_, i) => {
            const day = i + 1;
            const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const currentDate = new Date(year, month, day);

            const isSelected = value === currentDateStr;
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

            let isDisabledDay = false;
            if (minDate && currentDate < minDate) isDisabledDay = true;
            if (maxDate && currentDate > maxDate) isDisabledDay = true;

            return (
                <button
                    key={day}
                    type="button"
                    disabled={isDisabledDay}
                    onClick={(e) => { e.stopPropagation(); handleDayClick(day); }}
                    className={clsx(
                        "h-8 w-8 rounded-full flex items-center justify-center text-sm transition-colors",
                        isSelected ? 'bg-indigo-600 text-white font-bold' : '',
                        !isSelected && !isDisabledDay ? (isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-200') : '',
                        isDisabledDay ? (isLight ? 'text-slate-200 cursor-not-allowed' : 'text-slate-700 cursor-not-allowed') : '',
                        isToday && !isSelected && !isDisabledDay ? 'border border-indigo-200 text-indigo-600 font-semibold' : ''
                    )}
                >
                    {day}
                </button>
            );
        });

        return [...blanks, ...days];
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className={clsx(
                    "block text-[10px] font-black uppercase tracking-widest mb-2 ml-1",
                    isLight ? "text-slate-400" : "text-indigo-400/80"
                )}>
                    {label}
                </label>
            )}
            <button
                type="button"
                disabled={disabled}
                onClick={toggleOpen}
                aria-required={required}
                className={clsx(
                    "w-full px-5 py-3.5 border rounded-2xl outline-none text-left flex items-center gap-3 transition-all group shadow-sm",
                    isLight ? "bg-white border-slate-200" : "bg-slate-950 border-slate-800",
                    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/30'
                )}
            >
                <CalendarIcon size={20} className={clsx("transition-colors", disabled ? 'text-slate-400' : 'text-indigo-600 group-hover:scale-110')} />
                <span className={clsx(
                    "block flex-1 font-bold text-sm",
                    !value ? (isLight ? 'text-slate-300' : 'text-slate-700') : (disabled ? 'text-slate-400' : (isLight ? 'text-slate-900' : 'text-white'))
                )}>
                    {value ? new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Seleccionar fecha...'}
                </span>
            </button>

            {isOpen && createPortal(
                <div
                    id="datepicker-dropdown"
                    style={{
                        position: 'fixed',
                        top: coords.openUp ? 'auto' : coords.top,
                        bottom: coords.openUp ? (window.innerHeight - coords.top - 8) : 'auto', // Use calculated top as anchor
                        left: coords.left,
                        zIndex: 99999, // Super high Z-Index
                    }}
                    className={clsx(
                        "p-6 rounded-[2.5rem] shadow-2xl border w-[320px] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl",
                        isLight ? "bg-white/95 border-slate-200 shadow-slate-200/50" : "bg-slate-900 border-slate-800"
                    )}
                >
                    <div className="flex justify-between items-center mb-6">
                        <button type="button" onClick={handlePrevMonth} className={clsx("p-2 rounded-xl transition-colors", isLight ? "hover:bg-slate-50 text-slate-400" : "hover:bg-slate-800 text-slate-400")}>
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex flex-col items-center">
                            <span className={clsx("text-sm font-black uppercase tracking-widest", isLight ? "text-slate-900" : "text-white")}>{monthNames[viewDate.getMonth()]}</span>
                            <select
                                value={viewDate.getFullYear()}
                                onChange={handleYearChange}
                                className={clsx("bg-transparent text-xs font-black cursor-pointer outline-none hover:text-indigo-300 appearance-none text-center", isLight ? "text-indigo-600" : "text-indigo-400")}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {years.map(y => <option key={y} value={y} className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>{y}</option>)}
                            </select>
                        </div>
                        <button type="button" onClick={handleNextMonth} className={clsx("p-2 rounded-xl transition-colors", isLight ? "hover:bg-slate-50 text-slate-400" : "hover:bg-slate-800 text-slate-400")}>
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className={clsx("grid grid-cols-7 gap-1 mb-4 text-center text-[10px] font-black uppercase tracking-tighter", isLight ? "text-slate-300" : "text-slate-600")}>
                        {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(d => <div key={d}>{d}</div>)}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                        {renderCalendar().map((item, idx) => {
                            if (React.isValidElement(item) && item.key?.toString().startsWith('blank')) {
                                return <div key={idx} className="h-9 w-9" />;
                            }

                            // Just render the item as is, it's a button
                            return item;
                        })}
                    </div>

                    <div className={clsx("mt-6 flex justify-between pt-5 border-t", isLight ? "border-slate-100" : "border-slate-800/50")}>
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className={clsx("text-[10px] font-black uppercase tracking-widest transition-colors", isLight ? "text-slate-300 hover:text-red-500" : "text-slate-600 hover:text-red-400")}
                        >
                            Borrar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                onChange(dateString);
                                setIsOpen(false);
                            }}
                            className={clsx("text-[10px] font-black uppercase tracking-widest transition-colors", isLight ? "text-indigo-600 hover:text-indigo-700" : "text-indigo-400 hover:text-indigo-300")}
                        >
                            Ir a Hoy
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
