import { BarChart3, Home, List, Plus, Wallet } from 'lucide-react';
import { haptic } from './ui.jsx';

export const TABS = [
    { id: 'overview', label: 'Übersicht', Icon: Home },
    { id: 'transactions', label: 'Umsätze', Icon: List },
    null,
    { id: 'analysis', label: 'Analyse', Icon: BarChart3 },
    { id: 'accounts', label: 'Konten', Icon: Wallet },
];

// A pill glides behind the active tab; its icon bounces when it gets active.
export default function TabBar({ tab, onTab, onAdd }) {
    const col = TABS.findIndex((t) => t?.id === tab);
    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/80 backdrop-blur-xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="relative mx-auto grid max-w-2xl grid-cols-5 items-center px-2 pt-1.5 pb-1.5">
                <div className="pointer-events-none absolute inset-y-1.5 left-2 w-[calc((100%-1rem)/5)] transition-transform duration-[420ms] ease-[cubic-bezier(0.3,1.3,0.4,1)]" style={{ transform: `translateX(${col * 100}%)` }}>
                    <div className="mx-auto h-full w-[4.25rem] rounded-2xl bg-ink/[0.07]" />
                </div>
                {TABS.map((t) =>
                    t ? (
                        <button
                            key={t.id}
                            onClick={() => { if (t.id !== tab) haptic(); onTab(t.id); }}
                            aria-current={tab === t.id ? 'page' : undefined}
                            className={`relative flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] ${tab === t.id ? 'font-semibold text-ink' : 'text-muted'}`}
                        >
                            <t.Icon key={tab === t.id ? 'on' : 'off'} size={22} strokeWidth={tab === t.id ? 2.2 : 1.7} className={tab === t.id ? 'pop' : ''} />
                            {t.label}
                        </button>
                    ) : (
                        <div key="add" className="flex justify-center">
                            <button
                                onClick={() => { haptic(12); onAdd(); }}
                                aria-label="Umsatz hinzufügen"
                                className="flex size-14 -translate-y-3 items-center justify-center rounded-full bg-ink text-paper shadow-lg shadow-black/25 transition-transform active:scale-90"
                            >
                                <Plus size={26} />
                            </button>
                        </div>
                    ),
                )}
            </div>
        </nav>
    );
}
