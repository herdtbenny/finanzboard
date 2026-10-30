import { ArrowLeftRight, Repeat } from 'lucide-react';
import { CategoryIcon } from '../shared/categoryIcons.jsx';
import { money } from '../shared/format.js';
import { nextDate, repeatLabel } from '../shared/repeat.js';
import { Card, CardHeader } from './ui.jsx';

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

// Standing orders with their rhythm and next booking date.
export default function Recurrings({ recurrings, accounts, onOpen }) {
    const names = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    const rows = recurrings
        .map((r) => ({ ...r, next: nextDate(r) }))
        .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999'));
    const monthly = rows
        .filter((r) => r.next && r.kind === 'out')
        .reduce((s, r) => s + Number(r.amount) * ({ week: 52 / 12, month: 1, year: 1 / 12 }[r.interval] / r.every), 0);

    return (
        <Card className="px-2 pb-2">
            <div className="px-3"><CardHeader title="Daueraufträge" action="Neu" onAction={() => onOpen({})} /></div>
            {!rows.length && <p className="px-3 pb-3 text-sm text-muted">Noch keine. Wiederkehrende Zahlungen werden automatisch gebucht.</p>}
            <ul>
                {rows.map((r) => (
                    <li key={r.id}>
                        <button onClick={() => onOpen(r)} className={`flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left active:bg-ink/5 ${r.next ? '' : 'opacity-45'}`}>
                            {r.kind === 'transfer'
                                ? <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06]"><ArrowLeftRight size={18} strokeWidth={1.8} /></span>
                                : <CategoryIcon category={r.category} />}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-medium">{r.counterparty || (r.kind === 'transfer' ? 'Umbuchung' : r.category)}</p>
                                <p className="flex items-center gap-1 truncate text-xs text-muted">
                                    <Repeat size={11} className="shrink-0" />
                                    {repeatLabel(r)} · {r.next ? `ab ${shortDate(r.next)}` : 'beendet'}
                                    {r.kind === 'transfer' && ` · ${names[r.account_id]} → ${names[r.to_account_id]}`}
                                </p>
                            </div>
                            <span className={`tabular shrink-0 text-[15px] font-semibold ${r.kind === 'in' ? 'text-income' : r.kind === 'transfer' ? 'text-muted' : ''}`}>
                                {r.kind === 'in' ? '+' : r.kind === 'out' ? '−' : ''}{money(r.amount)}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {monthly > 0 && (
                <p className="flex justify-between px-3 pt-2 pb-2 text-xs text-muted">
                    <span>Fixe Ausgaben pro Monat</span>
                    <span className="tabular font-semibold text-ink">{money(monthly)}</span>
                </p>
            )}
        </Card>
    );
}
