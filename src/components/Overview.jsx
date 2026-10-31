import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { money, monthLabel } from '../shared/format.js';
import BalanceChart from './BalanceChart.jsx';
import MonthCard from './MonthCard.jsx';
import { accountNames, TransactionRow } from './Transactions.jsx';
import { mergeTransfers } from '../shared/transfers.js';
import { Card, CardHeader } from './ui.jsx';

export default function Overview({ accounts, balances, series, transactions, month, onMonth, onOpen, onAccount, onNewAccount, goTo }) {
    const [point, setPoint] = useState(null);
    const total = series[series.length - 1].value;
    const recent = mergeTransfers(transactions).slice(0, 5);
    const names = accountNames(accounts);
    // Bars share what's on the plus side, so a credit card in the red
    // doesn't push the others past 100 %.
    const positive = accounts.reduce((s, a) => s + Math.max(0, balances[a.id]), 0);

    return (
        <div className="space-y-4">
            {/* Hero: total balance and its trend */}
            <section className="rounded-[28px] bg-ink px-5 pt-4 pb-4 text-paper">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm opacity-60">{point ? `Ende ${monthLabel(point.key)}` : 'Gesamtvermögen'}</p>
                    <p className="tabular text-2xl leading-none font-semibold tracking-tight">{money(point ? point.value : total)}</p>
                </div>
                <div className="mt-3">
                    <BalanceChart series={series} onActive={setPoint} />
                </div>

                {/* How the total splits across the accounts */}
                <div className="mt-3 border-t border-paper/15 pt-3">
                    {accounts.length ? (
                        <ul className="space-y-1">
                            {[...accounts].sort((a, b) => balances[b.id] - balances[a.id]).map((a) => {
                                const share = positive > 0 ? Math.max(0, balances[a.id]) / positive : 0;
                                return (
                                    <li key={a.id}>
                                        <button onClick={() => onAccount(a.id)} className="-mx-2 w-[calc(100%+1rem)] rounded-xl px-2 py-1.5 text-left active:bg-paper/10">
                                            <span className="flex items-baseline justify-between gap-3 text-sm">
                                                <span className="truncate opacity-75">{a.name}</span>
                                                <span className="flex shrink-0 items-baseline gap-2">
                                                    <span className="tabular text-xs opacity-45">{Math.round(share * 100)} %</span>
                                                    <span className={`tabular font-semibold ${balances[a.id] < 0 ? 'text-expense' : ''}`}>{money(balances[a.id])}</span>
                                                </span>
                                            </span>
                                            <span className="mt-1.5 block h-1.5 rounded-full bg-paper/12">
                                                <span className="grow block h-full rounded-full bg-paper/85 transition-[width] duration-500" style={{ width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%` }} />
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <button onClick={onNewAccount} className="flex w-full items-center gap-3 rounded-2xl bg-paper/[0.08] px-3 py-3 text-left active:bg-paper/15">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink"><Plus size={18} /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold">Erstes Konto anlegen</span>
                                <span className="block text-xs opacity-60">Mit seinem aktuellen Kontostand</span>
                            </span>
                            <ChevronRight size={18} className="opacity-50" />
                        </button>
                    )}
                </div>
            </section>

            <MonthCard transactions={transactions} month={month} onMonth={onMonth} onAll={() => goTo('analysis')} />

            <Card className="px-2 pb-2">
                <div className="px-3"><CardHeader title="Zuletzt" action={recent.length ? 'Alle' : null} onAction={() => goTo('transactions')} /></div>
                {recent.length ? (
                    <ul>
                        {recent.map((t) => <TransactionRow key={t.id} t={t} onOpen={onOpen} names={names} showDate />)}
                    </ul>
                ) : (
                    <p className="px-3 pb-3 text-sm text-muted">
                        Noch keine Umsätze. {accounts.length ? 'Tippe auf + für den ersten.' : 'Leg zuerst ein Konto an, dann kannst du mit + buchen.'}
                    </p>
                )}
            </Card>
        </div>
    );
}
