import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, ScanText, X } from 'lucide-react';
import { money } from '../shared/format.js';
import { parseReceipt } from '../shared/receipt.js';

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

// Two ways to read a receipt into the form, both on the device:
//   Foto  — Tesseract in the browser
//   Text  — a text field for the iPhone's own "Text scannen" (or pasting)
// Calls onResult({ amount, date, shop }); nothing is saved here.
export default function ReceiptScanner({ known, onResult }) {
    const [mode, setMode] = useState(null); // null | 'text'
    const [progress, setProgress] = useState(null);
    const [text, setText] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [showText, setShowText] = useState(false);
    const fileRef = useRef(null);

    function apply(raw) {
        const r = parseReceipt(raw, { known });
        setResult(r);
        setError(r.amount || r.shop || r.date ? '' : 'Nichts erkannt – bitte von Hand eintragen.');
        onResult(r);
    }

    // The scanned text arrives in one go; react once it has settled.
    useEffect(() => {
        if (mode !== 'text' || text.trim().length < 15) return;
        const id = setTimeout(() => apply(text), 400);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, mode]);

    async function onPhoto(e) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setMode(null);
        setError('');
        setResult(null);
        setProgress(0);
        try {
            const { readReceipt } = await import('../shared/ocr.js');
            const raw = await readReceipt(file, setProgress);
            setText(raw);
            apply(raw);
        } catch (err) {
            setError(`Konnte das Foto nicht lesen (${err.message}).`);
        } finally {
            setProgress(null);
        }
    }

    const busy = progress !== null;

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-full border border-line bg-card py-2.5 text-sm font-medium disabled:opacity-50"
                >
                    <Camera size={16} /> Kassenzettel
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => { setMode(mode === 'text' ? null : 'text'); setError(''); }}
                    className={`flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium disabled:opacity-50 ${mode === 'text' ? 'border-ink bg-ink text-paper' : 'border-line bg-card'}`}
                >
                    <ScanText size={16} /> Text scannen
                </button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
            </div>

            {busy && (
                <div className="rounded-2xl bg-ink/[0.04] px-4 py-3">
                    <p className="mb-2 text-xs text-muted">
                        {progress > 0 ? `Lese Kassenzettel … ${Math.round(progress * 100)} %` : 'Bereite Texterkennung vor … (beim ersten Mal etwas länger)'}
                    </p>
                    <div className="h-1.5 rounded-full bg-ink/10"><div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.max(4, progress * 100)}%` }} /></div>
                </div>
            )}

            {mode === 'text' && (
                <div className="relative">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={3}
                        placeholder="Hier lange tippen → „Text scannen“ und die Kamera auf den Kassenzettel halten. Oder Text einfügen."
                        className="w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 pr-10 text-sm outline-none focus:border-ink"
                    />
                    {text && (
                        <button type="button" onClick={() => { setText(''); setResult(null); }} aria-label="Leeren" className="absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full text-muted active:bg-ink/5">
                            <X size={15} />
                        </button>
                    )}
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
                    {mode !== 'text' && text && (
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
}
