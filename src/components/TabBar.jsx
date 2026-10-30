import { BarChart3, Home, List, Plus, Wallet } from 'lucide-react';

const TABS = [
    { id: 'overview', label: 'Übersicht', Icon: Home },
    { id: 'transactions', label: 'Umsätze', Icon: List },
    null,
    { id: 'analysis', label: 'Analyse', Icon: BarChart3 },
    { id: 'accounts', label: 'Konten', Icon: Wallet },
];

export default function TabBar({ tab, onTab, onAdd }) {
    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/85 backdrop-blur-xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="mx-auto grid max-w-2xl grid-cols-5 items-center px-2 pt-1.5 pb-1.5">
                {TABS.map((t) =>
                    t ? (
                        <button
                            key={t.id}
                            onClick={() => onTab(t.id)}
                            aria-current={tab === t.id ? 'page' : undefined}
                            className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] transition-colors ${tab === t.id ? 'font-semibold text-ink' : 'text-muted'}`}
                        >
                            <t.Icon size={22} strokeWidth={tab === t.id ? 2.2 : 1.7} />
                            {t.label}
                        </button>
                    ) : (
                        <div key="add" className="flex justify-center">
                            <button
                                onClick={onAdd}
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
