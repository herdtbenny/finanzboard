import { useState } from 'react';
import { money, monthLabel } from '../shared/format.js';

// Total balance at each month end, drawn inside the dark hero card. Touch or
// hover moves a readout along the line; without it, the readout shows the
// latest value.
export default function BalanceChart({ series, onActive }) {
    const [active, setActive] = useState(null);
    const values = series.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const x = (i) => (i / (series.length - 1)) * 100;
    const y = (v) => 92 - ((v - min) / span) * 80;
    const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');

    function pick(e) {
        const r = e.currentTarget.getBoundingClientRect();
        const i = Math.round(((e.clientX - r.left) / r.width) * (series.length - 1));
        const idx = Math.max(0, Math.min(series.length - 1, i));
        setActive(idx);
        onActive?.(series[idx]);
    }
    function leave() {
        setActive(null);
        onActive?.(null);
    }

    const shown = active ?? series.length - 1;
    return (
        <div>
            <div
                className="relative h-28 touch-none select-none"
                onPointerDown={pick}
                onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e)}
                onPointerUp={(e) => e.pointerType !== 'mouse' && leave()}
                onPointerLeave={leave}
                role="img"
                aria-label={`Vermögensverlauf: ${series.map((p) => `${monthLabel(p.key)} ${money(p.value)}`).join(', ')}`}
            >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                    <defs>
                        <linearGradient id="balance-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
                            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={`${line} L100,100 L0,100 Z`} fill="url(#balance-fill)" />
                    <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    {active != null && (
                        <line x1={x(active)} x2={x(active)} y1="0" y2="100" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    )}
                </svg>
                <span
                    className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-4 ring-ink"
                    style={{ left: `${x(shown)}%`, top: `${y(series[shown].value)}%` }}
                />
            </div>
            <div className="mt-2 flex justify-between text-[11px] opacity-50">
                <span>{monthLabel(series[0].key, { month: 'short', year: '2-digit' })}</span>
                <span>Heute</span>
            </div>
        </div>
    );
}
