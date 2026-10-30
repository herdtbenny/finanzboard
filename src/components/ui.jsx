import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel, shiftMonth } from '../shared/format.js';
import { currentMonth } from '../shared/insights.js';

export function Card({ className = '', children }) {
    return <section className={`rounded-[28px] border border-line bg-card p-5 ${className}`}>{children}</section>;
}

export function CardHeader({ title, action, onAction }) {
    return (
        <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {action && (
                <button onClick={onAction} className="-mr-2 rounded-full px-3 py-1 text-sm text-muted active:bg-ink/5">
                    {action}
                </button>
            )}
        </div>
    );
}

export function PageTitle({ children, right }) {
    return (
        <div className="flex items-end justify-between gap-3 pt-2">
            <h1 className="text-[28px] font-semibold tracking-tight">{children}</h1>
            {right}
        </div>
    );
}

export function MonthSwitch({ month, onChange }) {
    const btn = 'flex size-9 items-center justify-center rounded-full active:bg-ink/5 disabled:opacity-25';
    return (
        <div className="inline-flex items-center gap-1 rounded-full border border-line bg-card p-0.5">
            <button onClick={() => onChange(shiftMonth(month, -1))} aria-label="Vorheriger Monat" className={btn}>
                <ChevronLeft size={17} />
            </button>
            <span className="min-w-[7.5rem] text-center text-sm font-medium">{monthLabel(month)}</span>
            <button onClick={() => onChange(shiftMonth(month, 1))} disabled={month >= currentMonth()} aria-label="Nächster Monat" className={btn}>
                <ChevronRight size={17} />
            </button>
        </div>
    );
}

// A thin progress bar; `marker` (0–1) draws a tick, e.g. the average.
export function Bar({ value, marker, tone = 'bg-ink' }) {
    return (
        <div className="relative h-1.5 rounded-full bg-ink/[0.07]">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(value > 0 ? 2 : 0, value * 100))}%` }} />
            {marker != null && marker <= 1 && (
                <span className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink/40" style={{ left: `calc(${marker * 100}% - 1px)` }} />
            )}
        </div>
    );
}
