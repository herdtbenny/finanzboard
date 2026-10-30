import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { isNeutral } from '../shared/categories.js';
import { money, moneyShort, monthKey } from '../shared/format.js';
import { averageBefore, monthSummary } from '../shared/insights.js';
import MonthChart from './MonthChart.jsx';
import { accountNames, TransactionRow } from './Transactions.jsx';
import { Bar, Card, CardHeader, MonthSwitch, PageTitle } from './ui.jsx';

export default function Analysis({ transactions, accounts, month, onMonth, onCategory, onOpen }) {
    const summary = monthSummary(transactions, month);
    const avg = averageBefore(transactions, month);
    const cats = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
    const biggest = transactions
        .filter((t) => monthKey(t.booking_date) === month && t.amount < 0 && !isNeutral(t))
        .sort((a, b) => a.amount - b.amount)
        .slice(0, 5);

    return (
        <div className="rise space-y-4">
            <PageTitle>Analyse</PageTitle>
            <MonthSwitch month={month} onChange={onMonth} />

            <MonthChart transactions={transactions} month={month} onSelect={onMonth} />

            <Card>
                <CardHeader title="Ausgaben nach Kategorie" />
                {!cats.length && <p className="text-sm text-muted">Keine Ausgaben in diesem Monat.</p>}
                <ul className="-mx-2 space-y-1">
                    {cats.map(([cat, sum]) => {
                        const share = summary.out ? sum / summary.out : 0;
                        const usual = avg?.byCategory[cat] || 0;
                        const delta = sum - usual;
                        return (
                            <li key={cat}>
                                <button onClick={() => onCategory(cat)} className="flex w-full items-center gap-3 rounded-[20px] px-2 py-2.5 text-left active:bg-ink/5">
                                    <CategoryIcon category={cat} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between gap-2 text-sm">
                                            <span className="truncate font-medium">{cat}</span>
                                            <span className="tabular font-semibold">{money(sum)}</span>
                                        </div>
                                        <div className="my-1.5"><Bar value={share} tone="bg-expense" /></div>
                                        <div className="flex justify-between text-xs text-muted">
                                            <span className="tabular">{Math.round(share * 100)} %</span>
                                            {avg && (
                                                <span className={`tabular ${delta > 0.5 && usual ? 'text-expense' : ''}`}>
                                                    {usual ? `${delta >= 0 ? '+' : '−'}${moneyShort(Math.abs(delta))} zum Ø` : 'neu diesen Monat'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {avg && <p className="mt-3 text-xs text-muted">Ø = Durchschnitt der {avg.months} Monate davor.</p>}
            </Card>

            {biggest.length > 0 && (
                <Card className="px-2 pb-2">
                    <div className="px-3"><CardHeader title="Größte Ausgaben" /></div>
                    <ul>{biggest.map((t) => <TransactionRow key={t.id} t={t} onOpen={onOpen} names={accountNames(accounts)} showDate />)}</ul>
                </Card>
            )}
        </div>
    );
}
