import {
    ArrowLeftRight, Baby, Beer, Bike, Book, Briefcase, Bus, Camera, Car, Cat, Cigarette, Coffee, Coins, CreditCard,
    Dog, Dumbbell, FileText, Film, Flower2, Fuel, Gamepad2, Gem, Gift, Glasses, GraduationCap, Heart, HeartPulse,
    Home, Landmark, Laptop, Music, Package, Palette, PiggyBank, Pill, Pizza, Plane, Receipt, Scale, Scissors, Shapes,
    ShieldCheck, Shirt, ShoppingBasket, Smartphone, Sofa, Sparkles, Sprout, Stethoscope, Tag, Ticket, Train, TreePine,
    TrendingUp, Trophy, Users, UtensilsCrossed, Wallet, Wifi, Wine, Wrench, Zap, ShoppingBag,
} from 'lucide-react';
import { customCategories } from './categories.js';

// Icons to pick from for an own category, by name (stored in the database).
export const ICON_SET = {
    Tag, Shapes, ShoppingBasket, UtensilsCrossed, Coffee, Pizza, Beer, Wine, Car, Fuel, Train, Bus, Bike, Plane,
    Home, Sofa, Zap, Wifi, Smartphone, Laptop, Gamepad2, Film, Music, Ticket, Camera, Palette, Book, GraduationCap,
    Shirt, Glasses, Scissors, Sparkles, Gem, HeartPulse, Pill, Stethoscope, Dumbbell, Trophy, Baby, Dog, Cat,
    Gift, Heart, Users, Flower2, Sprout, TreePine, Wrench, Package, Receipt, CreditCard, Wallet, Coins, PiggyBank,
    Landmark, Briefcase, ShieldCheck, FileText, Cigarette,
};

const ICONS = {
    Lebensmittel: ShoppingBasket,
    'Essen gehen': UtensilsCrossed,
    Mobilität: Car,
    Wohnen: Home,
    'Abos & Verträge': FileText,
    Versicherungen: ShieldCheck,
    Shopping: ShoppingBag,
    'Drogerie & Gesundheit': HeartPulse,
    'Sport & Freizeit': Bike,
    Urlaub: Plane,
    Geschenke: Gift,
    Sonstiges: Shapes,
    'Gehalt & Jobs': Briefcase,
    Taschengeld: PiggyBank,
    Verkäufe: Tag,
    Umbuchung: ArrowLeftRight,
    Investieren: TrendingUp,
    Kontostand: Scale,
    Wertänderung: TrendingUp,
};

export function iconFor(category) {
    if (ICONS[category]) return ICONS[category];
    const own = customCategories().find((c) => c.name === category);
    return (own && ICON_SET[own.icon]) || Shapes;
}

export function CategoryIcon({ category, size = 'md' }) {
    const Icon = iconFor(category);
    const box = { xs: 'size-5', sm: 'size-8', md: 'size-10' }[size];
    const px = { xs: 11, sm: 15, md: 18 }[size];
    return (
        <span className={`${box} flex shrink-0 items-center justify-center rounded-full bg-ink/[0.06]`}>
            <Icon size={px} strokeWidth={1.8} />
        </span>
    );
}
