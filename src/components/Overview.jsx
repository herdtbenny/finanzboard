import { useState } from 'react';
import { money, monthLabel } from '../shared/format.js';
import BalanceChart from './BalanceChart.jsx';
import MonthCard from './MonthCard.jsx';
import { accountNames, TransactionRow } from './Transactions.jsx';
import { mergeTransfers } from '../shared/transfers.js';
import { Card, CardHeader } from './ui.jsx';

export default function Overview({ accounts, balances, series, transactions, month, onMonth, onOpen, onAccount, goTo }) {
    const [point, setPoint] = useState(null);
    const total = series[series.length - 1].value;
    const recent = mergeTransfers(transactions).slice(0, 5);
    const names = accountNames(accounts);

    return (
        <div className="rise space-y-4">
            {/* Hero: total balance and its trend */}
            <section className="rounded-[24px] bg-ink px-4 pt-3.5 pb-3 text-paper">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm opacity-60">{point ? `Ende ${monthLabel(point.key)}` : 'Gesamtvermögen'}</p>
                    <p className="tabular text-2xl leading-none font-semibold tracking-tight">{money(point ? point.value : total)}</p>
                </div>
                <div className="mt-3">
                    <BalanceChart series={series} onActive={setPoint} />
                </div>

                {/* How the total splits across the accounts — two compact columns */}
                <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-paper/15 pt-2">
                    {[...accounts].sort((a, b) => balances[b.id] - balances[a.id]).map((a) => (
                        <li key={a.id}>
                            <button onClick={() => onAccount(a.id)} className="flex w-full items-baseline justify-between gap-1.5 rounded-full py-0.5 text-left text-[11px] active:opacity-60">
                                <span className="truncate opacity-60">{a.name}</span>
                                <span className={`tabular shrink-0 font-medium ${balances[a.id] < 0 ? 'text-expense' : ''}`}>{money(balances[a.id])}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </section>

            <MonthCard transactions={transactions} month={month} onMonth={onMonth} onAll={() => goTo('analysis')} />

            <Card className="px-2 pb-2">
                <div className="px-3"><CardHeader title="Zuletzt" action="Alle" onAction={() => goTo('transactions')} /></div>
                <ul>
                    {recent.map((t) => <TransactionRow key={t.id} t={t} onOpen={onOpen} names={names} showDate />)}
                </ul>
            </Card>
        </div>
    );
}
