import { db } from './_lib.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, NEUTRAL_CATEGORIES } from '../src/shared/categories.js';

const RESERVED = new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...NEUTRAL_CATEGORIES].map((c) => c.toLowerCase()));

// The Haushalt's own categories.
// POST { id, name, kind, icon } creates or updates one; a new name is carried
//   over to every transaction and standing order that used the old one.
// DELETE ?id=… removes it; its transactions move to "Sonstiges".
export default async function handler(req, res) {
    const s = await db(req, res);
    if (!s) return;
    const { client, spaceId } = s;
    const fail = (msg, code = 400) => res.status(code).json({ error: msg });

    const rename = async (from, to) => {
        await client.from('transactions').update({ category: to }).eq('space_id', spaceId).eq('category', from);
        await client.from('recurrings').update({ category: to }).eq('space_id', spaceId).eq('category', from);
    };

    if (req.method === 'DELETE') {
        const { data: old } = await client.from('categories').select('name').eq('id', req.query.id).eq('space_id', spaceId).maybeSingle();
        if (!old) return fail('Kategorie nicht gefunden', 404);
        await rename(old.name, 'Sonstiges');
        const { error } = await client.from('categories').delete().eq('id', req.query.id).eq('space_id', spaceId);
        return error ? fail(error.message, 500) : res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const c = req.body || {};
    const name = String(c.name || '').trim();
    if (!c.id || !name || !['out', 'in'].includes(c.kind)) return fail('Name und Art sind Pflicht');
    if (name.length > 30) return fail('Höchstens 30 Zeichen');
    if (RESERVED.has(name.toLowerCase())) return fail('Diese Kategorie gibt es schon als Standard');

    const { data: same } = await client.from('categories').select('id').eq('space_id', spaceId).ilike('name', name);
    if ((same || []).some((x) => x.id !== c.id)) return fail('Diese Kategorie gibt es schon');

    const { data: old } = await client.from('categories').select('name,space_id').eq('id', c.id).maybeSingle();
    if (old && old.space_id !== spaceId) return fail('Kein Zugriff', 403);

    const { data, error } = await client.from('categories')
        .upsert({ id: c.id, space_id: spaceId, name, kind: c.kind, icon: String(c.icon || 'Tag').slice(0, 40) })
        .select('id,name,kind,icon').single();
    if (error) return fail(error.message, 500);
    if (old && old.name !== name) await rename(old.name, name);
    res.status(200).json(data);
}
