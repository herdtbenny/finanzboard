import { useState } from 'react';
import { money, monthLabel } from '../shared/format.js';
import BalanceChart from './BalanceChart.jsx';
import MonthCard from './MonthCard.jsx';
import { accountNames, TransactionRow } from './Transactions.jsx';
import { mergeTransfers } from '../shared/transfers.js';
import { Bar, Card, CardHeader } from './ui.jsx';

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
            </section>

            <MonthCard transactions={transactions} month={month} onMonth={onMonth} onAll={() => goTo('analysis')} />

            {/* Accounts: compact list with each one's share of the total */}
            <Card className="px-2 py-2">
                <ul>
                    {[...accounts].sort((a, b) => balances[b.id] - balances[a.id]).map((a) => {
                        const share = total > 0 ? Math.max(0, balances[a.id]) / total : 0;
                        return (
                            <li key={a.id}>
                                <button onClick={() => onAccount(a.id)} className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2 text-left active:bg-ink/5">
                                    <span className="w-28 shrink-0 truncate text-sm">{a.name}</span>
                                    <span className="flex-1"><Bar value={share} /></span>
                                    <span className={`tabular w-24 shrink-0 text-right text-sm font-semibold ${balances[a.id] < 0 ? 'text-expense' : ''}`}>{money(balances[a.id])}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </Card>

            <Card className="px-2 pb-2">
                <div className="px-3"><CardHeader title="Zuletzt" action="Alle" onAction={() => goTo('transactions')} /></div>
                <ul>
                    {recent.map((t) => <TransactionRow key={t.id} t={t} onOpen={onOpen} names={names} showDate />)}
                </ul>
            </Card>
        </div>
    );
}
