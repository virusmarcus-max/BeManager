import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

interface Option {
    value: string | number;
    label: string;
}

interface CustomSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: any) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    icon?: React.ElementType;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Seleccionar...',
    className,
    disabled = false,
    icon: Icon
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

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (val: string | number) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={clsx("relative", className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={clsx(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 outline-none select-none",
                    isOpen
                        ? "bg-white border-indigo-500 ring-4 ring-indigo-500/10 shadow-lg shadow-indigo-500/10"
                        : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50",
                    disabled && "opacity-50 cursor-not-allowed bg-slate-100"
                )}
                disabled={disabled}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {Icon && (
                        <div className={clsx(
                            "p-1.5 rounded-lg transition-colors",
                            isOpen ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-500"
                        )}>
                            <Icon size={18} strokeWidth={2.5} />
                        </div>
                    )}
                    <span className={clsx(
                        "text-sm font-bold truncate",
                        selectedOption ? "text-slate-700" : "text-slate-400"
                    )}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown size={18} strokeWidth={2.5} className={clsx(
                    "transition-transform duration-300 text-slate-400",
                    isOpen && "rotate-180 text-indigo-500"
                )} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={clsx(
                                    "w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between group uppercase tracking-wide",
                                    value === option.value
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                        : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                                )}
                            >
                                <span className="truncate">{option.label}</span>
                                {value === option.value && <Check size={14} strokeWidth={3} />}
                            </button>
                        ))}
                        {options.length === 0 && (
                            <div className="px-3 py-4 text-center text-xs text-slate-400 italic font-medium">
                                No hay opciones disponibles
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
