import { ACCOUNT_COLUMNS, db, TRANSACTION_COLUMNS } from './_lib.js';

// All accounts and all transactions. Balances are computed in the browser
// from opening_balance + transactions, so this needs the full history.
export default async function handler(req, res) {
    const client = db(req, res);
    if (!client) return;

    // Supabase caps a select at 1000 rows, so page through.
    const transactions = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('transactions').select(TRANSACTION_COLUMNS)
            .order('booking_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, from + 999);
        if (error) return res.status(500).json({ error: error.message });
        transactions.push(...data);
        if (data.length < 1000) break;
    }

    const { data: accounts, error } = await client.from('accounts').select(ACCOUNT_COLUMNS).order('sort_order').order('created_at');
    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ accounts, transactions });
}
