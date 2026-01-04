import { ChevronDown, CheckCircle } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

interface FilterSelectProps {
    options: { value: string | number; label: string }[];
    value: string | number | 'all';
    onChange: (value: any) => void;
    placeholder: string;
    icon: any;
    theme?: 'light' | 'dark';
}

export const FilterSelect: React.FC<FilterSelectProps> = ({ options, value, onChange, placeholder, icon: Icon, theme = 'light' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const selectedOption = options.find(opt => opt.value === value);
    const isDark = theme === 'dark';

    const handleSelect = (val: any) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all duration-300 group shadow-sm outline-none",
                    isOpen
                        ? (isDark
                            ? "bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/20"
                            : "bg-white border-indigo-500 shadow-lg shadow-indigo-100")
                        : (isDark
                            ? "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                            : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50")
                )}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={clsx(
                        "p-2 rounded-lg transition-all duration-300",
                        isOpen
                            ? "bg-indigo-500 text-white scale-110"
                            : (isDark ? "bg-slate-800 text-slate-400" : "bg-indigo-50 text-indigo-500")
                    )}>
                        <Icon size={16} />
                    </div>
                    <div className="flex flex-col items-start truncate leading-tight">
                        <span className={clsx("text-[9px] uppercase font-black tracking-[0.15em] mb-0.5 transition-colors",
                            isOpen ? "text-indigo-400" : "text-slate-400"
                        )}>
                            {placeholder}
                        </span>
                        <span className={clsx("text-xs font-black truncate transition-colors",
                            isOpen
                                ? (isDark ? "text-white" : "text-indigo-900")
                                : (isDark ? "text-slate-200" : "text-slate-700")
                        )}>
                            {selectedOption ? selectedOption.label : "Seleccionar..."}
                        </span>
                    </div>
                </div>
                <ChevronDown size={14} className={clsx("transition-transform duration-500",
                    isOpen ? "rotate-180 text-indigo-500" : "text-slate-400"
                )} />
            </button>

            {isOpen && (
                <div className={clsx(
                    "absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border",
                    isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-100"
                )}>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={clsx(
                                    "w-full text-left px-3 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-between group",
                                    value === option.value
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                                        : (isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600")
                                )}
                            >
                                <span className="truncate">{option.label}</span>
                                {value === option.value && (
                                    <div className="h-5 w-5 bg-white/20 rounded-full flex items-center justify-center">
                                        <CheckCircle size={12} />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
