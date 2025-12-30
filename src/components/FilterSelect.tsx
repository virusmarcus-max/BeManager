import { ChevronDown, CheckCircle, Search, X } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

interface FilterSelectProps {
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    icon: any;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({ options, value, onChange, placeholder, icon: Icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');

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
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 group",
                    isOpen
                        ? "bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                )}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={clsx(
                        "p-2 rounded-lg transition-colors",
                        isOpen ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-400 group-hover:text-slate-300"
                    )}>
                        <Icon size={18} />
                    </div>
                    <div className="flex flex-col items-start truncate">
                        <span className={clsx("text-[10px] uppercase font-bold tracking-wider mb-0.5 transition-colors", isOpen ? "text-indigo-400" : "text-slate-500")}>
                            {placeholder}
                        </span>
                        <span className={clsx("text-sm font-bold truncate transition-colors", isOpen ? "text-white" : "text-slate-300 group-hover:text-white")}>
                            {selectedOption ? selectedOption.label : "Todos"}
                        </span>
                    </div>
                </div>
                <ChevronDown size={16} className={clsx("text-slate-500 transition-transform duration-300", isOpen && "rotate-180 text-indigo-400")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-800">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-600"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        <button
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className={clsx(
                                "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group",
                                value === '' ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <span>Todos</span>
                            {value === '' && <CheckCircle size={14} />}
                        </button>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => { onChange(option.value); setIsOpen(false); }}
                                    className={clsx(
                                        "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group",
                                        value === option.value ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {value === option.value && <CheckCircle size={14} />}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-500 italic">
                                No se encontraron resultados
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
