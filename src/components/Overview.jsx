import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { money, moneyShort, monthLabel } from '../shared/format.js';
import { averageBefore, currentMonth, monthSummary } from '../shared/insights.js';
import BalanceChart from './BalanceChart.jsx';
import { accountNames, TransactionRow } from './Transactions.jsx';
import { mergeTransfers } from '../shared/transfers.js';
import { Bar, Card, CardHeader, MonthSwitch } from './ui.jsx';

export default function Overview({ accounts, balances, series, transactions, month, onMonth, onOpen, onAccount, goTo }) {
    const [point, setPoint] = useState(null);
    const total = series[series.length - 1].value;
    const change = total - series[series.length - 2].value;

    const summary = monthSummary(transactions, month);
    const avg = averageBefore(transactions, month);
    const top = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const recent = mergeTransfers(transactions).slice(0, 5);
    const names = accountNames(accounts);

    return (
        <div className="rise space-y-4">
            {/* Hero: total balance and its trend */}
            <section className="rounded-[28px] bg-ink px-5 pt-4 pb-4 text-paper">
                <p className="text-xs opacity-60">{point ? `Ende ${monthLabel(point.key)}` : 'Gesamtvermögen'}</p>
                <p className="tabular mt-1 text-[30px] leading-none font-semibold tracking-tight">{money(point ? point.value : total)}</p>
                <div className="mt-2 h-6">
                    {!point && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-paper/10 px-2.5 py-1 text-xs font-medium">
                            {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {change >= 0 ? '+' : ''}{money(change)} diesen Monat
                        </span>
                    )}
                </div>
                <div className="mt-2">
                    <BalanceChart series={series} onActive={setPoint} />
                </div>
            </section>

            {/* Accounts: compact list with each one's share of the total */}
            <Card className="px-2 py-2">
                <ul>
                    {accounts.map((a) => {
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

            {/* The month at a glance */}
            <Card>
                <div className="mb-5 flex items-center justify-between gap-2">
                    <h2 className="text-[15px] font-semibold">Monat</h2>
                    <MonthSwitch month={month} onChange={onMonth} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Figure label="Einnahmen" value={summary.in} dot="bg-income" />
                    <Figure label="Ausgaben" value={summary.out} dot="bg-expense" />
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-ink/[0.04] px-4 py-3 text-sm">
                    <span className="text-muted">Übrig</span>
                    <span className={`tabular font-semibold ${summary.net < 0 ? 'text-expense' : 'text-income'}`}>
                        {summary.net >= 0 ? '+' : ''}{money(summary.net)}
                        {summary.rate != null && summary.net > 0 && <span className="ml-1.5 font-normal text-muted">· {Math.round(summary.rate * 100)} % gespart</span>}
                    </span>
                </div>
                {avg && avg.out > 0 && <Pace out={summary.out} avg={avg} running={month === currentMonth()} />}
            </Card>

            {top.length > 0 && (
                <Card>
                    <CardHeader title="Wofür" action="Analyse" onAction={() => goTo('analysis')} />
                    <ul className="space-y-4">
                        {top.map(([cat, sum]) => (
                            <li key={cat} className="flex items-center gap-3">
                                <CategoryIcon category={cat} />
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1.5 flex justify-between gap-2 text-sm">
                                        <span className="truncate">{cat}</span>
                                        <span className="tabular font-medium">{money(sum)}</span>
                                    </div>
                                    <Bar value={sum / top[0][1]} tone="bg-expense" />
                                </div>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <Card className="px-2 pb-2">
                <div className="px-3"><CardHeader title="Zuletzt" action="Alle" onAction={() => goTo('transactions')} /></div>
                <ul>
                    {recent.map((t) => <TransactionRow key={t.id} t={t} onOpen={onOpen} names={names} showDate />)}
                </ul>
            </Card>
        </div>
    );
}

function Figure({ label, value, dot }) {
    return (
        <div>
            <p className="flex items-center gap-1.5 text-xs text-muted"><span className={`size-2 rounded-full ${dot}`} />{label}</p>
            <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{moneyShort(value)}</p>
        </div>
    );
}

// Expenses against the average of the previous months.
function Pace({ out, avg, running }) {
    const ratio = out / avg.out;
    const diff = Math.round(Math.abs(1 - ratio) * 100);
    const text = ratio <= 1
        ? `${diff} % unter deinem Schnitt`
        : `${diff} % über deinem Schnitt`;
    return (
        <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs text-muted">
                <span>{running ? 'Bisher ' : ''}{text}</span>
                <span className="tabular">Ø {moneyShort(avg.out)}</span>
            </div>
            <Bar value={ratio / Math.max(1, ratio)} marker={1 / Math.max(1, ratio)} tone={ratio > 1 ? 'bg-expense' : 'bg-ink'} />
        </div>
    );
}
