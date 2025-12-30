import React from 'react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string; // Changed from children to message for simpler usage, or can keep children
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    children?: React.ReactNode;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    children,
    onConfirm,
    onCancel,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDestructive = false,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
                role="dialog"
                aria-modal="true"
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {title}
                    </h3>
                    {message && (
                        <p className="text-gray-600 mb-4 whitespace-pre-wrap">
                            {message}
                        </p>
                    )}
                    {children}

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${isDestructive
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
