import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { CategoryIcon, ICON_SET } from '../shared/categoryIcons.jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../shared/categories.js';
import { newId } from '../shared/format.js';
import Sheet, { Field, inputClass } from './Sheet.jsx';
import { Card, CardHeader } from './ui.jsx';

// The Haushalt's own categories, plus the defaults to look at.
export default function Categories({ categories, onSave, onDelete }) {
    const [editing, setEditing] = useState(null);
    const [showDefaults, setShowDefaults] = useState(false);

    return (
        <Card className="px-2 pb-2">
            <div className="px-3"><CardHeader title="Kategorien" action="Neu" onAction={() => setEditing({ kind: 'out', icon: 'Tag' })} /></div>
            {!categories.length && <p className="px-3 pb-2 text-sm text-muted">Noch keine eigenen. Leg welche an, wenn dir die Standard-Kategorien nicht reichen.</p>}
            <ul>
                {categories.map((c) => (
                    <li key={c.id}>
                        <button onClick={() => setEditing(c)} className="flex w-full items-center gap-3 rounded-[20px] px-3 py-2 text-left active:bg-ink/5">
                            <CategoryIcon category={c.name} size="sm" />
                            <span className="flex-1 truncate text-[15px] font-medium">{c.name}</span>
                            <span className="text-xs text-muted">{c.kind === 'out' ? 'Ausgabe' : 'Einnahme'}</span>
                        </button>
                    </li>
                ))}
            </ul>

            <button onClick={() => setShowDefaults(!showDefaults)} className="mt-1 flex items-center gap-1 rounded-full px-3 py-2 text-xs text-muted">
                Standard-Kategorien <ChevronDown size={13} className={showDefaults ? 'rotate-180' : ''} />
            </button>
            {showDefaults && (
                <div className="space-y-3 px-3 pb-2">
                    {[['Ausgaben', EXPENSE_CATEGORIES], ['Einnahmen', INCOME_CATEGORIES]].map(([label, list]) => (
                        <div key={label}>
                            <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {list.map((c) => (
                                    <span key={c} className="flex items-center gap-1.5 rounded-full bg-ink/[0.05] py-1 pr-2.5 pl-1 text-xs">
                                        <CategoryIcon category={c} size="xs" /> {c}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editing && <CategorySheet category={editing} onSave={onSave} onDelete={onDelete} onClose={() => setEditing(null)} />}
        </Card>
    );
}

function CategorySheet({ category, onSave, onDelete, onClose }) {
    const isNew = !category.id;
    const [name, setName] = useState(category.name || '');
    const [kind, setKind] = useState(category.kind);
    const [icon, setIcon] = useState(category.icon);
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function run(fn) {
        setBusy(true);
        setError('');
        try {
            await fn();
            onClose();
        } catch (e) {
            setError(e.message);
            setBusy(false);
        }
    }

    return (
        <Sheet title={isNew ? 'Neue Kategorie' : category.name} onClose={onClose}>
            <form onSubmit={(e) => { e.preventDefault(); run(() => onSave({ id: category.id || newId(), name, kind, icon })); }} className="space-y-4 pb-4">
                <Field label="Name">
                    <input autoFocus={isNew} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Haustier" className={inputClass} />
                </Field>
                <Field label="Art" group>
                    <div className="grid grid-cols-2 rounded-full border border-line bg-card p-1">
                        {[['out', 'Ausgabe', 'bg-expense text-white'], ['in', 'Einnahme', 'bg-income text-white']].map(([k, label, active]) => (
                            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full py-2 text-sm font-medium ${kind === k ? active : 'text-muted'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                </Field>
                <Field label="Icon" group>
                    <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
                        {Object.entries(ICON_SET).map(([key, Icon]) => (
                            <button
                                key={key}
                                type="button"
                                aria-label={key}
                                aria-pressed={icon === key}
                                onClick={() => setIcon(key)}
                                className={`flex aspect-square items-center justify-center rounded-full border ${icon === key ? 'border-ink bg-ink text-paper' : 'border-line bg-card'}`}
                            >
                                <Icon size={17} strokeWidth={1.8} />
                            </button>
                        ))}
                    </div>
                </Field>
                {!isNew && name.trim() !== category.name && name.trim() && (
                    <p className="px-1 text-xs text-muted">Alle Einträge mit „{category.name}“ heißen danach „{name.trim()}“.</p>
                )}

                {error && <p className="text-sm text-expense">{error}</p>}
                <div className="flex gap-2 pt-2">
                    {!isNew && (
                        <button
                            type="button"
                            onClick={() => (confirm ? run(() => onDelete(category.id)) : setConfirm(true))}
                            className={`flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium ${confirm ? 'border-expense bg-expense text-white' : 'border-line bg-card text-expense'}`}
                        >
                            <Trash2 size={16} />{confirm ? 'Einträge → Sonstiges?' : ''}
                        </button>
                    )}
                    <button disabled={busy || !name.trim()} className="flex-1 rounded-full bg-ink py-3 font-medium text-paper disabled:opacity-40">
                        {busy ? 'Speichern …' : 'Speichern'}
                    </button>
                </div>
            </form>
        </Sheet>
    );
}
