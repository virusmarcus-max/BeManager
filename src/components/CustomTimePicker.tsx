import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface TimePickerProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string; // Additional classes for the trigger button
}

export const CustomTimePicker = ({ value, onChange, disabled, className }: TimePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedHour, setSelectedHour] = useState<string>('09');
    const [selectedMinute, setSelectedMinute] = useState<string>('00');

    // Sync internal state with external value
    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':');
            if (h && m) {
                setSelectedHour(h);
                setSelectedMinute(m);
            }
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    const handleTimeSelect = (h: string, m: string) => {
        setSelectedHour(h);
        setSelectedMinute(m);
        onChange(`${h}:${m}`);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold shadow-sm hover:shadow-md",
                    isOpen ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-white" : "border-slate-200 bg-white hover:border-indigo-300",
                    disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer",
                    className
                )}
            >
                {/* <Clock size={14} className={isOpen ? "text-indigo-500" : "text-slate-400"} /> */}
                <span className={clsx("font-mono text-sm tracking-wide", !value ? "text-slate-400" : "text-slate-700")}>
                    {value || '--:--'}
                </span>
                {/* <ChevronDown size={12} className={clsx("text-slate-400 transition-transform", isOpen && "rotate-180")} /> */}
            </button>

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none">
                    {/* Hours Column */}
                    <div className="flex flex-col h-48 w-14 overflow-y-auto custom-scrollbar border-r border-slate-100">
                        <div className="sticky top-0 bg-slate-50 text-[10px] font-bold text-center py-1 text-slate-400 border-b border-slate-100 uppercase">Hora</div>
                        {hours.map(hour => (
                            <button
                                key={hour}
                                onClick={() => handleTimeSelect(hour, selectedMinute)}
                                className={clsx(
                                    "py-1.5 text-center text-xs font-medium hover:bg-slate-50 transition-colors",
                                    hour === selectedHour ? "bg-indigo-50 text-indigo-600 font-bold" : "text-slate-600"
                                )}
                            >
                                {hour}
                            </button>
                        ))}
                    </div>

                    {/* Minutes Column */}
                    <div className="flex flex-col h-48 w-14 overflow-y-auto custom-scrollbar">
                        <div className="sticky top-0 bg-slate-50 text-[10px] font-bold text-center py-1 text-slate-400 border-b border-slate-100 uppercase">Min</div>
                        {minutes.map(minute => (
                            <button
                                key={minute}
                                onClick={() => handleTimeSelect(selectedHour, minute)}
                                className={clsx(
                                    "py-1.5 text-center text-xs font-medium hover:bg-slate-50 transition-colors",
                                    minute === selectedMinute ? "bg-indigo-50 text-indigo-600 font-bold" : "text-slate-600"
                                )}
                            >
                                {minute}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
