import { useRef, useState } from 'react';
import { Camera, ChevronDown } from 'lucide-react';
import { money } from '../shared/format.js';
import { parseReceipt } from '../shared/receipt.js';

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

// Reads a photographed receipt in the browser (Tesseract) and hands
// { amount, date, shop } to onResult; nothing is saved here. Returns the
// button (for the sheet's header) and the status (progress, what was found)
// for the form, so both can sit where they fit.
export function useReceiptScanner({ known, onResult }) {
    const [progress, setProgress] = useState(null);
    const [text, setText] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [showText, setShowText] = useState(false);
    const fileRef = useRef(null);
    const busy = progress !== null;

    async function onPhoto(e) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError('');
        setResult(null);
        setProgress(0);
        try {
            const { readReceipt } = await import('../shared/ocr.js');
            const raw = await readReceipt(file, setProgress);
            const r = parseReceipt(raw, { known });
            setText(raw);
            setResult(r);
            if (!r.amount && !r.shop && !r.date) setError('Nichts erkannt – bitte von Hand eintragen.');
            onResult(r);
        } catch (err) {
            setError(`Konnte das Foto nicht lesen (${err.message}).`);
        } finally {
            setProgress(null);
        }
    }

    const button = (
        <>
            <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-sm font-medium active:bg-ink/5 disabled:opacity-50"
            >
                <Camera size={16} /> Kassenzettel
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
        </>
    );

    const status = (busy || error || result) && (
        <div className="space-y-2">
            {busy && (
                <div className="rounded-2xl bg-ink/[0.04] px-4 py-3">
                    <p className="mb-2 text-xs text-muted">
                        {progress > 0 ? `Lese Kassenzettel … ${Math.round(progress * 100)} %` : 'Bereite Texterkennung vor … (beim ersten Mal etwas länger)'}
                    </p>
                    <div className="h-1.5 rounded-full bg-ink/10"><div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.max(4, progress * 100)}%` }} /></div>
                </div>
            )}
            {error && <p className="px-1 text-xs text-expense">{error}</p>}
            {result && !error && (
                <div className="rounded-2xl bg-ink/[0.04] px-4 py-2.5 text-xs">
                    <p className="text-muted">
                        Erkannt:{' '}
                        <span className="font-medium text-ink">
                            {[result.shop, result.amount != null && money(result.amount), result.date && shortDate(result.date)].filter(Boolean).join(' · ')}
                        </span>
                        {' '}– bitte prüfen.
                    </p>
                    {text && (
                        <>
                            <button type="button" onClick={() => setShowText(!showText)} className="mt-1 flex items-center gap-1 rounded-full text-muted">
                                Erkannter Text <ChevronDown size={13} className={showText ? 'rotate-180' : ''} />
                            </button>
                            {showText && <pre className="mt-1 max-h-40 overflow-auto font-sans text-[11px] whitespace-pre-wrap text-muted">{text}</pre>}
                        </>
                    )}
                </div>
            )}
        </div>
    );

    return { button, status };
}
