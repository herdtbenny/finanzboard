import { money, monthLabel, shiftMonth } from '../shared/format.js';
import { currentMonth, monthSummary } from '../shared/insights.js';

const MONTHS = 6;

// Income vs. expenses for six months; tapping a month selects it for the
// whole page. The selected month is drawn at full strength, the rest muted.
// Ends with the current month, or with the chosen one when it lies ahead.
export default function MonthChart({ transactions, month, onSelect }) {
    const now = currentMonth();
    let end = now;
    if (month > now) end = month;
    else if (month < shiftMonth(now, -(MONTHS - 1))) end = shiftMonth(month, MONTHS - 1);
    const keys = Array.from({ length: MONTHS }, (_, i) => shiftMonth(end, i - (MONTHS - 1)));

    const totals = Object.fromEntries(keys.map((k) => [k, monthSummary(transactions, k)]));
    const max = Math.max(1, ...keys.flatMap((k) => [totals[k].in, totals[k].out]));

    return (
        <section className="rounded-[28px] border border-line bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Verlauf</h2>
                <div className="flex gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-income" />Einnahmen</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-expense" />Ausgaben</span>
                </div>
            </div>

            <div className="relative h-36">
                <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
                <span className="tabular absolute right-0 -top-4 text-[10px] text-muted">{money(max)}</span>
                <div className="absolute inset-x-0 bottom-0 border-t border-line" />
                <div className="flex h-full items-end">
                    {keys.map((k) => {
                        const active = k === month;
                        return (
                            <button
                                key={k}
                                onClick={() => onSelect(k)}
                                aria-label={`${monthLabel(k)}: Einnahmen ${money(totals[k].in)}, Ausgaben ${money(totals[k].out)}`}
                                className={`flex h-full flex-1 items-end justify-center gap-[2px] rounded-full transition-opacity ${active ? '' : 'opacity-30'}`}
                            >
                                <span className="w-3 rounded-t-[4px] bg-income sm:w-4" style={{ height: `${(totals[k].in / max) * 100}%` }} />
                                <span className="w-3 rounded-t-[4px] bg-expense sm:w-4" style={{ height: `${(totals[k].out / max) * 100}%` }} />
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="mt-2 flex">
                {keys.map((k) => (
                    <span key={k} className={`flex-1 text-center text-xs ${k === month ? 'font-medium' : 'text-muted'}`}>
                        {monthLabel(k, { month: 'short' }).replace('.', '')}
                    </span>
                ))}
            </div>
        </section>
    );
}
