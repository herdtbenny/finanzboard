import { checkState, eb, getSupabase, logSync, psuFrom, syncAll } from './_lib.js';

// The bank sends the browser back here after the login + TAN. We trade the
// code for a session, store its accounts and run a first, deeper sync.
export default async function handler(req, res) {
    const { code, state, error, error_description: desc } = req.query;
    const back = (msg) => res.redirect(302, `/?${new URLSearchParams(msg)}`);

    if (error) return back({ error: desc || error });
    if (!code || !checkState(state)) return back({ error: 'Ungültige oder abgelaufene Anfrage' });

    try {
        const db = getSupabase();
        if (!db) throw new Error('Supabase ist nicht konfiguriert.');

        const session = await eb('/sessions', { method: 'POST', body: { code } });
        const bank = session.aspsp?.name || 'Bank';

        const { error: sErr } = await db.from('bank_sessions').upsert({
            id: session.session_id,
            aspsp_name: bank,
            valid_until: session.access?.valid_until,
        });
        if (sErr) throw sErr;

        // A new consent replaces the account rows of the old one (same IBAN →
        // new uid), so drop accounts from this bank's earlier sessions first.
        const fresh = session.accounts.map((a) => a.account_id?.iban).filter(Boolean);
        if (fresh.length) await db.from('accounts').delete().in('iban', fresh).neq('session_id', session.session_id);

        const { error: aErr } = await db.from('accounts').upsert(session.accounts.map((a) => ({
            uid: a.uid,
            session_id: session.session_id,
            bank,
            iban: a.account_id?.iban || null,
            name: a.name || a.product || a.details || null,
            currency: a.currency || 'EUR',
        })));
        if (aErr) throw aErr;

        // Right after the TAN most banks hand out more history than later on.
        const result = await syncAll({ initialDays: 365, psu: psuFrom(req) });
        await logSync(true, `Verbunden: ${bank}, ${result.transactions} Umsätze`);
        back({ connected: bank });
    } catch (e) {
        await logSync(false, e.message);
        back({ error: e.message });
    }
}
