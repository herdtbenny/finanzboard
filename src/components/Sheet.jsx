import { useEffect } from 'react';
import { X } from 'lucide-react';

// Bottom sheet on phones, centred card on wide screens.
export default function Sheet({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="pb-safe max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper px-4 pt-3 sm:rounded-3xl"
            >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} aria-label="Schließen" className="flex size-9 items-center justify-center rounded-full border border-line bg-card">
                        <X size={16} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function Field({ label, children }) {
    return (
        <label className="block">
            <span className="mb-1 block px-1 text-xs font-medium text-muted">{label}</span>
            {children}
        </label>
    );
}

export const inputClass = 'w-full rounded-2xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-ink';
