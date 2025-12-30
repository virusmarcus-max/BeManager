import React from 'react';
import { Hourglass } from 'lucide-react';

export const Logo: React.FC<{ className?: string; textClassName?: string; showText?: boolean }> = ({
    className = "h-8 w-8",
    textClassName = "text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600",
    showText = true
}) => {
    return (
        <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-xl shadow-lg shadow-violet-200 ${className}`}>
                <Hourglass size={18} className="animate-spin-slow" style={{ animationDuration: '10s' }} />
            </div>
            {showText && <span className={textClassName}>Be Manager</span>}
        </div>
    );
};
