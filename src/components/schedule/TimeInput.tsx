import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';

interface TimeInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
}

export const TimeInput = ({ value, onChange, className, disabled }: TimeInputProps) => {
    const [localValue, setLocalValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync local value with prop value when not focused
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(value);
        }
    }, [value, isFocused]);

    const handleBlur = () => {
        setIsFocused(false);
        if (localValue !== value) {
            onChange(localValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
    };

    return (
        <input
            ref={inputRef}
            type="time"
            value={localValue || ''}
            disabled={disabled}
            onChange={(e) => setLocalValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={clsx(
                "outline-none bg-transparent text-center font-black text-inherit p-0 w-full h-full",
                // "appearance-none", // Remove default browser styling if needed, though usually type="time" needs it or custom UI
                className
            )}
            onClick={(e) => e.stopPropagation()} // Prevent card click
        />
    );
};
