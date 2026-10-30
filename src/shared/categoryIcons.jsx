import {
    ArrowLeftRight, Briefcase, Dumbbell, Fuel, Gift, Home, PiggyBank, Plane, Scale, Shapes,
    ShieldCheck, Shirt, Sparkles, Ticket, TrendingUp, UtensilsCrossed,
} from 'lucide-react';

const ICONS = {
    'Essen & Trinken': UtensilsCrossed,
    Sonstiges: Shapes,
    Geschenke: Gift,
    Sprit: Fuel,
    Kleidung: Shirt,
    'Trade Republic': TrendingUp,
    Versicherungen: ShieldCheck,
    Aktivitäten: Ticket,
    Urlaub: Plane,
    Gym: Dumbbell,
    Drogerie: Sparkles,
    Miete: Home,
    Umbuchung: ArrowLeftRight,
    Kontostand: Scale,
    Taschengeld: PiggyBank,
    Gehalt: Briefcase,
};

export const iconFor = (category) => ICONS[category] || Shapes;

export function CategoryIcon({ category, size = 'md' }) {
    const Icon = iconFor(category);
    const box = size === 'sm' ? 'size-8' : 'size-10';
    return (
        <span className={`${box} flex shrink-0 items-center justify-center rounded-full bg-ink/[0.06]`}>
            <Icon size={size === 'sm' ? 15 : 18} strokeWidth={1.8} />
        </span>
    );
}
