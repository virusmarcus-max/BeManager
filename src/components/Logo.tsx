import React from 'react';


export const Logo: React.FC<{ className?: string; textClassName?: string; showText?: boolean }> = ({
    className = "h-8 w-8",
    textClassName = "text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600",
    showText = true
}) => {
    return (
        <div className="flex items-center gap-2">
            <svg viewBox="0 0 128 128" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* House */}
                <path d="M64 10 L118 50 V110 H10 V50 L64 10 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="6" strokeLinejoin="round" />
                {/* Person */}
                <g fill="#7c3aed">
                    <circle cx="64" cy="45" r="16" />
                    <path d="M42 68 
                        Q29 55 19 45 
                        L30 34 
                        Q44 50 52 68 
                        L52 90 
                        L76 90 
                        L76 68 
                        Q84 50 98 34 
                        L109 45 
                        Q99 55 86 68
                        L86 110 
                        L42 110 Z" />
                </g>
            </svg>
            {showText && <span className={textClassName}>BeManager</span>}
        </div>
    );
};
