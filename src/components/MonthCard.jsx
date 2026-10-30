import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { money, monthLabel, shiftMonth } from '../shared/format.js';
import { balanceChange, hasMonth, monthSummary, usualSaved } from '../shared/insights.js';
import { Bar, Card, MonthSwitch } from './ui.jsx';

// The chosen month in one card: what was saved (with the savings rate as a
// ring), income against expenses, the comparison with last month and with
// the six months before, and the biggest expense categories.
export default function MonthCard({ transactions, month, onMonth, onAll }) {
    const summary = monthSummary(transactions, month);
    const prevKey = shiftMonth(month, -1);
    const prev = hasMonth(transactions, prevKey) ? monthSummary(transactions, prevKey).net : null;
    const usual = usualSaved(transactions, month);
    // Depot value changes move the wealth without being saved money.
    const valueChange = balanceChange(transactions, month) - summary.net;
    const top = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const scale = Math.max(summary.in, summary.out, 1);

    return (
        <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold">Monat</h2>
                <MonthSwitch month={month} onChange={onMonth} />
            </div>

            {/* Headline: saved this month */}
            <div className="flex items-center gap-4 rounded-[22px] bg-ink/[0.04] p-4">
                <Ring rate={summary.rate} negative={summary.net < 0} />
                <div className="min-w-0">
                    <p className="text-xs text-muted">Gespart</p>
                    <p className={`tabular truncate text-[26px] leading-tight font-semibold tracking-tight ${summary.net < 0 ? 'text-expense' : ''}`}>
                        {summary.net >= 0 ? '+' : ''}{money(summary.net)}
                    </p>
                    {Math.abs(valueChange) > 0.005 && (
                        <p className="tabular truncate text-xs text-muted">
                            Depot {valueChange >= 0 ? '+' : ''}{money(valueChange)} → Vermögen {summary.net + valueChange >= 0 ? '+' : ''}{money(summary.net + valueChange)}
                        </p>
                    )}
                </div>
            </div>

            {/* Income against expenses */}
            <div className="mt-4 space-y-2.5">
                <Flow label="Einnahmen" value={summary.in} share={summary.in / scale} tone="bg-income" />
                <Flow label="Ausgaben" value={summary.out} share={summary.out / scale} tone="bg-expense" />
            </div>

            {/* Compared with last month and the usual month */}
            {(prev != null || usual != null) && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {prev != null && <Compare label={`Vormonat · ${monthLabel(prevKey, { month: 'short' })}`} base={prev} value={summary.net} />}
                    {usual != null && <Compare label="Ø 6 Monate" base={usual} value={summary.net} />}
                </div>
            )}

            {top.length > 0 && (
                <div className="mt-5">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-medium text-muted">Top-Ausgaben</p>
                        <button onClick={onAll} className="-mr-2 rounded-full px-2 py-0.5 text-xs text-muted active:bg-ink/5">Alle</button>
                    </div>
                    <ul className="space-y-3">
                        {top.map(([cat, sum]) => (
                            <li key={cat} className="flex items-center gap-3">
                                <CategoryIcon category={cat} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex justify-between gap-2 text-sm">
                                        <span className="truncate">{cat}</span>
                                        <span className="tabular font-medium">{money(sum)}</span>
                                    </div>
                                    <Bar value={summary.out ? sum / summary.out : 0} tone="bg-expense" />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Card>
    );
}

// Savings rate as a ring; empty when nothing was saved.
function Ring({ rate, negative }) {
    const r = 30;
    const c = 2 * Math.PI * r;
    const share = rate == null || negative ? 0 : Math.min(1, Math.max(0, rate));
    return (
        <div className="relative size-[76px] shrink-0">
            <svg viewBox="0 0 76 76" className="size-full -rotate-90">
                <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" className="stroke-ink/10" />
                <circle
                    cx="38" cy="38" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
                    className={negative ? 'stroke-expense' : 'stroke-income'}
                    strokeDasharray={`${share * c} ${c}`}
                />
            </svg>
            <span className="tabular absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-sm font-semibold">{rate == null ? '–' : `${Math.round(rate * 100)} %`}</span>
                <span className="mt-0.5 text-[9px] text-muted">Quote</span>
            </span>
        </div>
    );
}

function Flow({ label, value, share, tone }) {
    return (
        <div>
            <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="tabular font-semibold">{money(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-ink/[0.07]">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(value > 0 ? 2 : 0, share * 100)}%` }} />
            </div>
        </div>
    );
}

// How much more or less was saved than in `base`.
function Compare({ label, base, value }) {
    const diff = value - base;
    const up = diff >= 0;
    return (
        <div className={`rounded-2xl px-3 py-2.5 ${up ? 'bg-income/10' : 'bg-expense/10'}`}>
            <p className="truncate text-[11px] text-muted">{label}</p>
            <p className={`tabular flex items-center gap-1 truncate text-sm font-semibold ${up ? 'text-income' : 'text-expense'}`}>
                {up ? <ArrowUpRight size={14} className="shrink-0" /> : <ArrowDownRight size={14} className="shrink-0" />}
                {up ? '+' : '−'}{money(Math.abs(diff))}
            </p>
            <p className="tabular truncate text-[11px] text-muted">gespart {money(base)}</p>
        </div>
    );
}
