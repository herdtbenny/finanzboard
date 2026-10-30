import {
    ArrowLeftRight, Bike, Briefcase, Car, FileText, Gift, HeartPulse, Home, Laptop, PiggyBank, Plane, Scale,
    Shapes, ShieldCheck, Shirt, ShoppingBasket, Tag, TrendingUp, Users, UtensilsCrossed,
} from 'lucide-react';

const ICONS = {
    Lebensmittel: ShoppingBasket,
    'Essen gehen': UtensilsCrossed,
    Mobilität: Car,
    Wohnen: Home,
    'Abos & Verträge': FileText,
    Versicherungen: ShieldCheck,
    Kleidung: Shirt,
    'Shopping & Technik': Laptop,
    'Drogerie & Gesundheit': HeartPulse,
    'Sport & Freizeit': Bike,
    Urlaub: Plane,
    Geschenke: Gift,
    Sonstiges: Shapes,
    'Gehalt & Jobs': Briefcase,
    Taschengeld: PiggyBank,
    Familie: Users,
    Verkäufe: Tag,
    Umbuchung: ArrowLeftRight,
    Investieren: TrendingUp,
    Kontostand: Scale,
    Wertänderung: TrendingUp,
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
