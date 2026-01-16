import { clsx } from 'clsx';
import { Clock } from 'lucide-react';

interface TimePickerProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
}

export const CustomTimePicker = ({ value, onChange, disabled, className }: TimePickerProps) => {
    return (
        <div className={clsx("relative group", className)}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <Clock size={14} />
            </div>
            <input
                type="time"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={clsx(
                    "w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm outline-none transition-all",
                    "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 hover:border-indigo-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                )}
            />
        </div>
    );
};
