import { getSupabase, isAuthorized } from './_lib.js';

// Everything the dashboard shows: accounts, the last 13 months of
// transactions, the consents with their expiry and the latest sync.
export default async function handler(req, res) {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Nicht angemeldet' });
    const db = getSupabase();
    if (!db) return res.status(500).json({ error: 'Supabase ist nicht konfiguriert' });

    const since = new Date();
    since.setMonth(since.getMonth() - 13);

    // Supabase caps a select at 1000 rows, so page through.
    const transactions = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from('transactions')
            .select('id,account_uid,booking_date,amount,currency,counterparty,purpose,status')
            .gte('booking_date', since.toISOString().slice(0, 10))
            .order('booking_date', { ascending: false })
            .range(from, from + 999);
        if (error) return res.status(500).json({ error: error.message });
        transactions.push(...data);
        if (data.length < 1000) break;
    }

    const [accounts, sessions, lastSync] = await Promise.all([
        db.from('accounts').select('uid,bank,iban,name,currency,balance,balance_date,updated_at').order('bank'),
        db.from('bank_sessions').select('id,aspsp_name,valid_until').order('valid_until', { ascending: false }),
        db.from('sync_log').select('at,ok,message').order('at', { ascending: false }).limit(1),
    ]);

    res.status(200).json({
        accounts: accounts.data || [],
        transactions,
        sessions: sessions.data || [],
        lastSync: lastSync.data?.[0] || null,
    });
}
