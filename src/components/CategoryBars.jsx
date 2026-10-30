import { money } from '../shared/format.js';

// Expenses of the month per category, largest first. Tapping one filters the
// transaction list below.
export default function CategoryBars({ transactions, active, onSelect }) {
    const sums = {};
    for (const t of transactions) {
        if (t.amount < 0) sums[t.category] = (sums[t.category] || 0) - t.amount;
    }
    const rows = Object.entries(sums).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return null;
    const max = rows[0][1];

    return (
        <section className="rounded-3xl border border-line bg-card p-4">
            <h2 className="mb-3 font-medium">Ausgaben nach Kategorie</h2>
            <ul className="space-y-1">
                {rows.map(([name, sum]) => {
                    const on = active === name;
                    return (
                        <li key={name}>
                            <button
                                onClick={() => onSelect(on ? null : name)}
                                className={`w-full rounded-2xl px-2 py-2 text-left transition-colors ${on ? 'bg-ink/5' : ''} ${active && !on ? 'opacity-45' : ''}`}
                            >
                                <div className="flex justify-between text-sm">
                                    <span>{name}</span>
                                    <span className="tabular font-medium">{money(sum)}</span>
                                </div>
                                <div className="mt-1.5 h-1.5 rounded-full bg-line">
                                    <div className="h-full rounded-full bg-expense" style={{ width: `${Math.max(2, (sum / max) * 100)}%` }} />
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
