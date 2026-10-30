import { useState } from 'react';
import { iconFor } from '../shared/categoryIcons.jsx';

// All categories as round icons. Once one is tapped (or an entry is being
// edited) the grid folds away and only the chosen one stays, with its name;
// tapping it opens the grid again. Until then the suggestion is highlighted
// and named above the grid.
export default function CategoryPicker({ options, value, picked, onPick }) {
    const [open, setOpen] = useState(!picked);
    const Icon = iconFor(value);

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center gap-3 rounded-full border border-line bg-card py-1.5 pr-4 pl-1.5 text-left"
            >
                <span className="flex size-10 items-center justify-center rounded-full bg-ink text-paper"><Icon size={18} strokeWidth={1.8} /></span>
                <span className="flex-1 font-medium">{value}</span>
                <span className="text-xs text-muted">ändern</span>
            </button>
        );
    }

    return (
        <div>
            <p className="mb-2 px-1 text-sm">
                <span className="text-muted">Vorschlag: </span><span className="font-medium">{value}</span>
            </p>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                {options.map((c) => {
                    const I = iconFor(c);
                    const on = c === value;
                    return (
                        <button
                            key={c}
                            type="button"
                            title={c}
                            aria-label={c}
                            aria-pressed={on}
                            onClick={() => { onPick(c); setOpen(false); }}
                            className={`flex aspect-square items-center justify-center rounded-full border transition-transform active:scale-90 ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-card'}`}
                        >
                            <I size={19} strokeWidth={1.8} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
