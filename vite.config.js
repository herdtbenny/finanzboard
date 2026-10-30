import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Runs the Vercel functions in api/ inside the Vite dev server, so `npm run dev`
// works without `vercel dev`. Only a shim of what the handlers use: req.query,
// req.body, res.status().json() and res.redirect().
function localApi() {
    return {
        name: 'local-api',
        configureServer(server) {
            server.middlewares.use('/api', async (req, res) => {
                const url = new URL(req.url, 'http://localhost');
                const name = url.pathname.replace(/^\//, '').replace(/\/$/, '');
                if (!name || name.startsWith('_')) { res.statusCode = 404; return res.end(); }

                let handler;
                try {
                    handler = (await server.ssrLoadModule(`/api/${name}.js`)).default;
                } catch {
                    res.statusCode = 404;
                    return res.end(JSON.stringify({ error: `Unbekannte API: ${name}` }));
                }

                let raw = '';
                for await (const chunk of req) raw += chunk;
                req.query = Object.fromEntries(url.searchParams);
                try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }

                res.status = (code) => { res.statusCode = code; return res; };
                res.json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return res; };
                res.redirect = (code, location) => { res.statusCode = code; res.setHeader('Location', location); res.end(); return res; };

                try {
                    await handler(req, res);
                } catch (e) {
                    res.status(500).json({ error: e.message });
                }
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    // Make .env.local visible to the api/ handlers (process.env), not just to Vite.
    Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
    return { plugins: [react(), tailwindcss(), localApi()] };
});
