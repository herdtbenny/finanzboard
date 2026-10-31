import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { money, monthLabel, shiftMonth } from '../shared/format.js';
import { balanceChange, hasMonth, monthSummary, usualSaved } from '../shared/insights.js';
import { isNeutral, isRefund } from '../shared/categories.js';
import { monthKey } from '../shared/format.js';
import { Bar, Card, MonthSwitch } from './ui.jsx';

// The chosen month in one card: income against expenses, the biggest
// expense categories, and below them what was saved (with the savings rate)
// compared with last month and with the six months before.
export default function MonthCard({ transactions, month, onMonth, onAll }) {
    const summary = monthSummary(transactions, month);
    const prevKey = shiftMonth(month, -1);
    const prev = hasMonth(transactions, prevKey) ? monthSummary(transactions, prevKey).net : null;
    const usual = usualSaved(transactions, month);
    // Depot value changes move the wealth without being saved money.
    const valueChange = balanceChange(transactions, month) - summary.net;
    const top = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const scale = Math.max(summary.in, summary.out, 1);

    // How many bookings stand behind income and expenses.
    let nIn = 0;
    let nOut = 0;
    for (const t of transactions) {
        if (monthKey(t.booking_date) !== month || isNeutral(t)) continue;
        if (t.amount > 0 && !isRefund(t)) nIn++;
        else nOut++;
    }
    const prevName = monthLabel(prevKey, { month: 'long' });
    const avgFrom = monthLabel(shiftMonth(month, -6), { month: 'short' }).replace('.', '');
    const avgTo = monthLabel(prevKey, { month: 'short' }).replace('.', '');

    return (
        <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold">Monat</h2>
                <MonthSwitch month={month} onChange={onMonth} compact />
            </div>

            {/* Income − expenses = saved */}
            <div className="space-y-3">
                <Flow label="Einnahmen" count={nIn} value={summary.in} share={summary.in / scale} tone="bg-income" />
                <Flow label="Ausgaben" count={nOut} value={summary.out} share={summary.out / scale} tone="bg-expense" />
            </div>

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
                                        <span className="tabular shrink-0 font-medium">
                                            <span className="mr-1.5 text-xs font-normal text-muted">{Math.round((sum / summary.out) * 100)} %</span>
                                            {money(sum)}
                                        </span>
                                    </div>
                                    <Bar value={summary.out ? sum / summary.out : 0} tone="bg-expense" />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Saved, with how it compares — one box */}
            <div className="mt-5 rounded-2xl bg-ink/[0.04] px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs text-muted">Gespart</p>
                        {summary.rate != null && summary.net >= 0 && <p className="text-[11px] text-muted">{Math.round(summary.rate * 100)} % der Einnahmen</p>}
                    </div>
                    <span className={`tabular text-lg font-semibold tracking-tight ${summary.net < 0 ? 'text-expense' : 'text-income'}`}>
                        {summary.net >= 0 ? '+' : ''}{money(summary.net)}
                    </span>
                </div>
                {(prev != null || usual != null || Math.abs(valueChange) > 0.005) && (
                    <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                        {prev != null && <Compare label={`als im ${prevName}`} base={prev} value={summary.net} />}
                        {usual != null && <Compare label={`als im Schnitt ${avgFrom}\u2011${avgTo}`} base={usual} value={summary.net} />}
                        {Math.abs(valueChange) > 0.005 && (
                            <p className="tabular text-xs text-muted">
                                Depot {valueChange >= 0 ? '+' : ''}{money(valueChange)} → Vermögen {summary.net + valueChange >= 0 ? '+' : ''}{money(summary.net + valueChange)}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}

function Flow({ label, count, value, share, tone }) {
    return (
        <div>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-muted">{label} <span className="text-xs">· {count} {count === 1 ? 'Buchung' : 'Buchungen'}</span></span>
                <span className="tabular text-base font-semibold">{money(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-ink/[0.07]">
                <div className={`grow h-full rounded-full transition-[width] duration-500 ease-out ${tone}`} style={{ width: `${Math.max(value > 0 ? 2 : 0, share * 100)}%` }} />
            </div>
        </div>
    );
}

// One line: "↘ 462,49 € weniger gespart als im September (1.138,99 €)".
function Compare({ label, base, value }) {
    const diff = value - base;
    const up = diff >= 0;
    return (
        <p className="flex items-start gap-1 text-xs leading-snug">
            {up
                ? <ArrowUpRight size={13} className="mt-px shrink-0 text-income" />
                : <ArrowDownRight size={13} className="mt-px shrink-0 text-expense" />}
            <span>
                <span className={`tabular font-semibold ${up ? 'text-income' : 'text-expense'}`}>{money(Math.abs(diff))} {up ? 'mehr' : 'weniger'}</span>
                <span className="text-muted"> gespart {label} <span className="tabular whitespace-nowrap">({money(base)})</span></span>
            </span>
        </p>
    );
}
