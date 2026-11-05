import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, X } from 'lucide-react';

// Bottom sheet on phones, centred card on wide screens. Rendered into <body>
// so an animated (transformed) page around it can't trap it under the tab bar.
export default function Sheet({ title, action, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Freeze the page behind: iOS ignores overflow: hidden on the body for
    // touch scrolling, so the body is pinned in place and the scroll position
    // restored on close.
    useEffect(() => {
        const y = window.scrollY;
        const { style } = document.body;
        Object.assign(style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', overflow: 'hidden' });
        return () => {
            Object.assign(style, { position: '', top: '', left: '', right: '', overflow: '' });
            window.scrollTo(0, y);
        };
    }, []);

    return createPortal(
        <div className="fade-in fixed inset-0 z-30 flex overscroll-none items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className={`sheet-in pb-safe w-full max-h-[92dvh] max-w-lg overflow-y-auto overscroll-contain rounded-t-[28px] bg-paper px-4 pt-3 sm:rounded-[28px]`}
            >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
                <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-paper px-4 py-1">
                    <h2 className="min-w-0 truncate text-lg font-semibold">{title}</h2>
                    <div className="flex shrink-0 items-center gap-2">
                        {action}
                        <button onClick={onClose} aria-label="Schließen" className="flex size-9 items-center justify-center rounded-full border border-line bg-card">
                            <X size={16} />
                        </button>
                    </div>
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

// The sheets' top bar buttons. Save submits the form with id `form` from
// outside it; delete asks once (`confirm` shows `confirmText`) before it acts.
export function SaveButton({ form, disabled, busy, done }) {
    return (
        <button type="submit" form={form} disabled={disabled || busy} className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40">
            {done ? <><Check size={16} /> Gespeichert</> : busy ? 'Speichern …' : 'Speichern'}
        </button>
    );
}

export function DeleteButton({ onClick, confirm, confirmText = 'Wirklich?', disabled, label = 'Löschen' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-full border text-sm font-medium ${confirm ? 'border-expense bg-expense px-3 text-white' : 'w-9 border-line bg-card text-expense'}`}
        >
            <Trash2 size={16} />{confirm ? confirmText : ''}
        </button>
    );
}
