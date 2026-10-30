import { useState } from 'react';
import { money, monthLabel } from '../shared/format.js';

// Round step for about `count` gridlines: 1, 2, 2.5 or 5 × 10^n.
function niceTicks(min, max, count = 3) {
    const raw = (max - min || Math.abs(max) || 1) / count;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step || step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    return ticks;
}

const axisLabel = (v) => (Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k`
    : v.toLocaleString('de-DE', { maximumFractionDigits: 0 }));

// Total balance at each month end, drawn inside the dark hero card with a
// value scale on the right and month labels below. Touch or hover moves a
// readout along the line; without it, the readout shows the latest value.
export default function BalanceChart({ series, onActive }) {
    const [active, setActive] = useState(null);
    const values = series.map((p) => p.value);
    const ticks = niceTicks(Math.min(...values), Math.max(...values));
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const x = (i) => (i / (series.length - 1)) * 100;
    const y = (v) => 100 - ((v - lo) / (hi - lo)) * 100;
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
        <div className="grid grid-cols-[1fr_auto] gap-x-3">
            <div
                className="relative h-20 touch-none select-none"
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
                    {ticks.map((t) => (
                        <line
                            key={t}
                            x1="0" x2="100" y1={y(t)} y2={y(t)}
                            stroke="currentColor"
                            strokeOpacity={t === lo ? 0.25 : 0.12}
                            strokeDasharray={t === lo ? undefined : '3 4'}
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                    <path d={`${line} L100,100 L0,100 Z`} fill="url(#balance-fill)" />
                    <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    {active != null && (
                        <line x1={x(active)} x2={x(active)} y1="0" y2="100" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    )}
                </svg>
                <span
                    className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-4 ring-ink"
                    style={{ left: `${x(shown)}%`, top: `${y(series[shown].value)}%` }}
                />
            </div>

            {/* Value scale */}
            <div className="relative h-20 w-9 text-[10px] opacity-50">
                {ticks.map((t) => (
                    <span key={t} className="tabular absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>{axisLabel(t)}</span>
                ))}
            </div>

            {/* Month labels: every second month, the latest always */}
            <div className="relative mt-1.5 h-4 text-[10px] opacity-50">
                {series.map((p, i) => {
                    const last = i === series.length - 1;
                    if (!last && (series.length - 1 - i) % 2) return null;
                    return (
                        <span
                            key={p.key}
                            className={`absolute ${i === 0 ? '' : last ? '-translate-x-full' : '-translate-x-1/2'} ${i === shown ? 'font-semibold opacity-100' : ''}`}
                            style={{ left: `${x(i)}%` }}
                        >
                            {monthLabel(p.key, { month: 'short' }).replace('.', '')}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
