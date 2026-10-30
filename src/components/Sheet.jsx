import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Bottom sheet on phones, centred card on wide screens. Rendered into <body>
// so an animated (transformed) page around it can't trap it under the tab bar.
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

    return createPortal(
        <div className="fade-in fixed inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="sheet-in pb-safe max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-paper px-4 pt-3 sm:rounded-[28px]"
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
        </div>,
        document.body,
    );
}

// A labelled form field. `group` for fields made of buttons (pickers,
// toggles): a <label> would forward every click inside it — even into the
// gaps — to its first button.
export function Field({ label, group, children }) {
    const Tag = group ? 'div' : 'label';
    return (
        <Tag className="block" {...(group ? { role: 'group', 'aria-label': label } : {})}>
            <span className="mb-1 block px-1 text-xs font-medium text-muted">{label}</span>
            {children}
        </Tag>
    );
}

export const inputClass = 'w-full rounded-2xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-ink';
