import { isBooked, today } from './schedule.js';

// Downloads every transaction as a CSV that Excel / Numbers open directly
// (semicolons, decimal comma, UTF-8 with BOM).
export function exportCsv(transactions, accounts) {
    const name = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    const now = today();
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Datum', 'Konto', 'Betrag', 'Kategorie', 'Name', 'Notiz', 'Status']]
        .concat([...transactions].reverse().map((t) => [
            t.booking_date, name[t.account_id], String(t.amount.toFixed(2)).replace('.', ','), t.category, t.counterparty, t.purpose,
            isBooked(t, now) ? 'gebucht' : 'vorgemerkt',
        ]));
    const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `umsaetze-${now}.csv` });
    a.click();
    URL.revokeObjectURL(url);
}
