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

// `compact` shortens the month ("Okt. 2026") where the row is shared. `max`
// is the last month to go to (one with vorgemerkte bookings may lie ahead).
export function MonthSwitch({ month, onChange, compact, max = currentMonth() }) {
    const btn = 'flex size-9 items-center justify-center rounded-full active:bg-ink/5 disabled:opacity-25';
    return (
        <div className="inline-flex items-center gap-1 rounded-full border border-line bg-card p-0.5">
            <button onClick={() => onChange(shiftMonth(month, -1))} aria-label="Vorheriger Monat" className={btn}>
                <ChevronLeft size={17} />
            </button>
            <span className={`text-center text-sm font-medium ${compact ? 'min-w-[4.5rem]' : 'min-w-[7.5rem]'}`}>
                {compact ? monthLabel(month, { month: 'short', year: 'numeric' }) : monthLabel(month)}
            </span>
            <button onClick={() => onChange(shiftMonth(month, 1))} disabled={month >= max} aria-label="Nächster Monat" className={btn}>
                <ChevronRight size={17} />
            </button>
        </div>
    );
}

// A thin progress bar; `marker` (0–1) draws a tick, e.g. the average.
export function Bar({ value, marker, tone = 'bg-ink', thin }) {
    return (
        <div className={`relative rounded-full bg-ink/[0.07] ${thin ? 'h-1' : 'h-1.5'}`}>
            <div className={`grow h-full rounded-full transition-[width] duration-500 ease-out ${tone}`} style={{ width: `${Math.min(100, Math.max(value > 0 ? 2 : 0, value * 100))}%` }} />
            {marker != null && marker <= 1 && (
                <span className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink/40" style={{ left: `calc(${marker * 100}% - 1px)` }} />
            )}
        </div>
    );
}

// A short tick on phones that support it (Android; iOS Safari has no API).
export function haptic(ms = 8) {
    try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

// An on/off switch as a full-width row with a label and a hint.
export function Toggle({ on, onChange, label, hint }) {
    return (
        <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{label}</p>
                {hint && <p className="text-xs text-muted">{hint}</p>}
            </div>
            <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-ink' : 'bg-ink/15'}`}>
                <span className={`size-6 rounded-full bg-paper shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
            </span>
        </button>
    );
}
