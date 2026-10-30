import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { money, monthLabel, shiftMonth } from '../shared/format.js';
import { balanceChange, hasMonth, monthSummary, usualSaved } from '../shared/insights.js';
import { isNeutral, isRefund } from '../shared/categories.js';
import { monthKey } from '../shared/format.js';
import { Bar, Card, MonthSwitch } from './ui.jsx';

// The chosen month in one card: income against expenses and what was saved
// (with the savings rate), the comparison with last month and with the six
// months before, and the biggest expense categories.
export default function MonthCard({ transactions, month, onMonth, onAll }) {
    const summary = monthSummary(transactions, month);
    const prevKey = shiftMonth(month, -1);
    const prev = hasMonth(transactions, prevKey) ? monthSummary(transactions, prevKey).net : null;
    const usual = usualSaved(transactions, month);
    // Depot value changes move the wealth without being saved money.
    const valueChange = balanceChange(transactions, month) - summary.net;
    const top = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const scale = Math.max(summary.in, summary.out, 1);
    const [explain, setExplain] = useState(false);

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
                <MonthSwitch month={month} onChange={onMonth} />
            </div>

            {/* Income − expenses = saved */}
            <div className="space-y-2.5">
                <Flow label="Einnahmen" count={nIn} value={summary.in} share={summary.in / scale} tone="bg-income" />
                <Flow label="Ausgaben" count={nOut} value={summary.out} share={summary.out / scale} tone="bg-expense" />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3 rounded-2xl bg-ink/[0.04] px-4 py-2.5">
                <span className="text-sm text-muted">Gespart</span>
                <span className="tabular truncate text-right">
                    <span className={`text-lg font-semibold ${summary.net < 0 ? 'text-expense' : 'text-income'}`}>
                        {summary.net >= 0 ? '+' : ''}{money(summary.net)}
                    </span>
                    {summary.rate != null && summary.net >= 0 && <span className="ml-1.5 text-sm text-muted">· {Math.round(summary.rate * 100)} %</span>}
                </span>
            </div>
            {Math.abs(valueChange) > 0.005 && (
                <p className="tabular mt-1.5 px-1 text-xs text-muted">
                    Depot {valueChange >= 0 ? '+' : ''}{money(valueChange)} → Vermögen {summary.net + valueChange >= 0 ? '+' : ''}{money(summary.net + valueChange)}
                </p>
            )}

            <p className="mt-3 px-1 text-sm leading-snug text-muted">
                <Sentence summary={summary} prev={prev} prevName={prevName} usual={usual} />
            </p>

            {/* Compared with last month and the usual month */}
            {(prev != null || usual != null) && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {prev != null && <Compare label={`vs. ${prevName}`} note={`${avgTo}: ${money(prev)}`} base={prev} value={summary.net} />}
                    {usual != null && <Compare label="vs. Ø 6 Monate" note={`Ø ${avgFrom}–${avgTo}: ${money(usual)}`} base={usual} value={summary.net} />}
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

            <button onClick={() => setExplain(!explain)} className="mt-4 flex items-center gap-1 rounded-full text-xs text-muted">
                So wird gerechnet <ChevronDown size={13} className={explain ? 'rotate-180' : ''} />
            </button>
            {explain && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-snug text-muted">
                    <li><b className="font-medium text-ink">Gespart</b> = Einnahmen − Ausgaben. Investiertes Geld gilt als gespart.</li>
                    <li><b className="font-medium text-ink">%</b> hinter Gespart = welcher Anteil deiner Einnahmen übrig blieb, die Sparquote.</li>
                    <li><b className="font-medium text-ink">Ausgaben</b> nach Abzug von Erstattungen (z. B. Anteile von Freunden, Rückzahlungen).</li>
                    <li>Umbuchungen zwischen deinen Konten, Investieren, Kontostand-Korrekturen und Depot-Kursänderungen zählen weder als Einnahme noch als Ausgabe.</li>
                    <li>Die Vergleiche zeigen, wie viel mehr oder weniger du gespart hast als im Vormonat bzw. im Schnitt der 6 Monate davor.</li>
                </ul>
            )}
        </Card>
    );
}

// One plain sentence about the month.
function Sentence({ summary, prev, prevName, usual }) {
    if (!summary.in && !summary.out) return 'In diesem Monat gibt es noch keine Buchungen.';
    const parts = [];
    if (summary.net >= 0) {
        parts.push(summary.rate != null
            ? `Du hast ${Math.round(summary.rate * 100)} % deiner Einnahmen behalten`
            : 'Du hast mehr eingenommen als ausgegeben');
    } else {
        parts.push(`Du hast ${money(-summary.net)} mehr ausgegeben als eingenommen`);
    }
    const vs = [];
    if (prev != null) vs.push(`${money(Math.abs(summary.net - prev))} ${summary.net >= prev ? 'mehr' : 'weniger'} als im ${prevName}`);
    if (usual != null) vs.push(`${money(Math.abs(summary.net - usual))} ${summary.net >= usual ? 'mehr' : 'weniger'} als im Schnitt`);
    if (vs.length === 2) {
        const sameDirection = (summary.net >= prev) === (summary.net >= usual);
        return `${parts[0]} – ${vs[0]}, ${sameDirection ? 'und' : 'aber'} ${vs[1]}.`;
    }
    return `${parts[0]}${vs.length ? ` – ${vs[0]}` : ''}.`;
}

function Flow({ label, count, value, share, tone }) {
    return (
        <div>
            <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">{label} <span className="text-xs">· {count} {count === 1 ? 'Buchung' : 'Buchungen'}</span></span>
                <span className="tabular font-semibold">{money(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-ink/[0.07]">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(value > 0 ? 2 : 0, share * 100)}%` }} />
            </div>
        </div>
    );
}

// How much more or less was saved than in `base`.
function Compare({ label, note, base, value }) {
    const diff = value - base;
    const up = diff >= 0;
    return (
        <div className={`rounded-2xl px-3 py-2.5 ${up ? 'bg-income/10' : 'bg-expense/10'}`}>
            <p className="truncate text-[11px] text-muted">{label}</p>
            <p className={`tabular flex items-center gap-1 truncate text-sm font-semibold ${up ? 'text-income' : 'text-expense'}`}>
                {up ? <ArrowUpRight size={14} className="shrink-0" /> : <ArrowDownRight size={14} className="shrink-0" />}
                {up ? '+' : '−'}{money(Math.abs(diff))}
            </p>
            <p className="tabular truncate text-[11px] text-muted">{note}</p>
        </div>
    );
}
