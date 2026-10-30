// Text recognition in the browser (Tesseract.js): the photo never leaves the
// device. Tesseract and the German language data (~10 MB) are only loaded on
// the first scan, then cached by the browser.

// Smaller, grey and with stretched contrast reads faster and better —
// especially faded thermal paper.
async function prepare(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = g;
        if (g < min) min = g;
        if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    for (let i = 0; i < d.length; i += 4) {
        const v = ((d[i] - min) / range) * 255;
        d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

// Resolves to the recognised text; onProgress gets 0–1.
export async function readReceipt(file, onProgress = () => {}) {
    const [{ createWorker }, canvas] = await Promise.all([import('tesseract.js'), prepare(file)]);
    const worker = await createWorker('deu', 1, {
        logger: (m) => { if (m.status === 'recognizing text') onProgress(m.progress); },
    });
    try {
        const { data } = await worker.recognize(canvas);
        return data.text;
    } finally {
        await worker.terminate();
    }
}
