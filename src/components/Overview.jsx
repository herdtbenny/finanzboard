import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { money, monthLabel } from '../shared/format.js';
import { monthSummary } from '../shared/insights.js';
import BalanceChart from './BalanceChart.jsx';
import { accountNames, TransactionRow } from './Transactions.jsx';
import { mergeTransfers } from '../shared/transfers.js';
import { Bar, Card, CardHeader, MonthSwitch } from './ui.jsx';

export default function Overview({ accounts, balances, series, transactions, month, onMonth, onOpen, onAccount, goTo }) {
    const [point, setPoint] = useState(null);
    const total = series[series.length - 1].value;
    const change = total - series[series.length - 2].value;
    // How much the total usually changes in a month: the six full months
    // before this one.
    const deltas = series.slice(-8).map((p, i, arr) => (i ? p.value - arr[i - 1].value : null)).slice(1, -1);
    const usual = deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : null;

    const summary = monthSummary(transactions, month);
    const top = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const recent = mergeTransfers(transactions).slice(0, 5);
    const names = accountNames(accounts);

    return (
        <div className="rise space-y-4">
            {/* Hero: total balance and its trend */}
            <section className="rounded-[28px] bg-ink px-5 pt-4 pb-4 text-paper">
                <p className="text-xs opacity-60">{point ? `Ende ${monthLabel(point.key)}` : 'Gesamtvermögen'}</p>
                <p className="tabular mt-1 text-[30px] leading-none font-semibold tracking-tight">{money(point ? point.value : total)}</p>
                <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5">
                    {!point && (
                        <>
                            <span className={`inline-flex items-center gap-1 rounded-full bg-paper/10 px-2.5 py-1 text-xs font-medium ${change >= 0 ? 'text-hero-up' : 'text-hero-down'}`}>
                                {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {change >= 0 ? '+' : ''}{money(change)} diesen Monat
                            </span>
                            {usual != null && (
                                <span className={`tabular inline-flex items-center rounded-full bg-paper/10 px-2.5 py-1 text-xs font-medium ${change - usual >= 0 ? 'text-hero-up' : 'text-hero-down'}`}>
                                    {change - usual >= 0 ? '+' : '−'}{money(Math.abs(change - usual))} {change - usual >= 0 ? 'über' : 'unter'} Ø ({money(usual)})
                                </span>
                            )}
                        </>
                    )}
                </div>
                <div className="mt-2">
                    <BalanceChart series={series} onActive={setPoint} />
                </div>
            </section>

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
                {summary.invested > 0 && (
                    <div className="mt-2 flex items-center justify-between px-4 text-sm">
                        <span className="text-muted">Investiert</span>
                        <span className="tabular font-semibold">{money(summary.invested)}</span>
                    </div>
                )}
                {top.length > 0 && (
                    <div className="mt-5">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-medium text-muted">Top-Ausgaben</p>
                            <button onClick={() => goTo('analysis')} className="-mr-2 rounded-full px-2 py-0.5 text-xs text-muted active:bg-ink/5">Alle</button>
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
            <p className="tabular mt-1 text-xl font-semibold tracking-tight">{money(value)}</p>
        </div>
    );
}
