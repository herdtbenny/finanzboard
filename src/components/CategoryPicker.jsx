import { iconFor } from '../shared/categoryIcons.jsx';

// All categories as small round icons that stay visible; the chosen (or,
// until one is tapped, the suggested) one is filled and named above.
export default function CategoryPicker({ options, value, picked, onPick }) {
    return (
        <div>
            <p className="mb-2 px-1 text-sm">
                <span className="text-muted">{picked ? 'Gewählt: ' : 'Vorschlag: '}</span>
                <span className="font-medium">{value}</span>
            </p>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                {options.map((c) => {
                    const Icon = iconFor(c);
                    const on = c === value;
                    return (
                        <button
                            key={c}
                            type="button"
                            title={c}
                            aria-label={c}
                            aria-pressed={on}
                            onClick={() => onPick(c)}
                            className={`flex aspect-square items-center justify-center rounded-full border transition-transform active:scale-90 ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-card'}`}
                        >
                            <Icon size={15} strokeWidth={1.8} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
