# Finanzboard

Privates, mobiloptimiertes Dashboard für die eigenen Girokonten (z. B. VR Bank).
Kontostände und Umsätze werden über **Enable Banking** (PSD2, offizielle
Bankschnittstelle) täglich automatisch abgerufen und in **Supabase** gespeichert.
Läuft auf **Vercel**, auf dem Handy als App installierbar („Zum Home-Bildschirm“).

```
Bank ──PSD2──▶ Enable Banking ──REST──▶ /api/sync (Vercel-Cron, täglich 05:00 UTC)
                                              │
                                              ▼
                     Handy ◀── /api/data ◀── Supabase
```

## Einrichtung (einmalig, ca. 20 Min.)

### 1. Supabase
1. Auf supabase.com ein neues Projekt anlegen (oder das bestehende nutzen, die Tabellennamen kollidieren nicht).
2. **SQL Editor** → Inhalt von `supabase-schema.sql` ausführen.
3. Unter **Project Settings → API** die `Project URL` und den `service_role`-Key kopieren.

### 2. Enable Banking
1. Auf **enablebanking.com** registrieren und das **Control Panel** öffnen.
2. **Applications → Add a new application**:
   - Environment: **Production**
   - Name: z. B. `Finanzboard`
   - Redirect URLs: `https://<deine-domain>/api/callback`
     (für lokale Tests zusätzlich `http://localhost:5173/api/callback`)
   - Den Haken bei „Generate private RSA key in the browser“ setzen. Die `.pem`-Datei wird heruntergeladen.
     **Gut aufheben, nie committen.**
3. Die angezeigte **Application ID** kopieren.
4. Die Anwendung für die eigene Nutzung aktivieren: Im Control Panel bei der App
   **„Activate by linking accounts“** wählen und dein VR-Bank-Konto einmal verknüpfen.
   Damit ist die App kostenlos im eingeschränkten Modus aktiv und darf nur auf
   deine eigenen, verknüpften Konten zugreifen.

### 3. Vercel
1. Repo auf GitHub pushen und auf vercel.com importieren (Framework: Vite wird erkannt).
2. **Settings → Environment Variables** (siehe `.env.example`):

| Variable | Wert |
|---|---|
| `DASHBOARD_PASSWORD` | dein Login-Passwort |
| `DASHBOARD_SESSION_SECRET` | `openssl rand -hex 32` |
| `SUPABASE_URL` | aus Schritt 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | aus Schritt 1 |
| `ENABLEBANKING_APP_ID` | aus Schritt 2 |
| `ENABLEBANKING_PRIVATE_KEY` | Inhalt der `.pem`, als eine Zeile: `awk '{printf "%s\\n",$0}' key.pem \| pbcopy` |
| `APP_URL` | z. B. `https://finanzen.websbybenny.de` (ohne `/` am Ende) |
| `CRON_SECRET` | `openssl rand -hex 32` |

3. Neu deployen. Optional eine Subdomain unter **Settings → Domains** eintragen
   (DNS-CNAME auf `cname.vercel-dns.com`). Danach `APP_URL` und die Redirect-URL bei Enable Banking anpassen.

### 4. Bank verbinden
1. Seite auf dem Handy öffnen → einloggen → ⚙️ → „Bank verbinden“ → nach deiner VR Bank suchen.
2. Du landest im Online-Banking der Bank → Login → Freigabe per **VR SecureGo plus**.
3. Zurück im Dashboard sind Konten und bis zu 12 Monate Umsätze da.
4. iPhone: Teilen → „Zum Home-Bildschirm“. Android: Menü → „App installieren“.

## Automatisierung im Betrieb
- **Beim Öffnen der App** (und wenn sie aus dem Hintergrund zurückkommt) werden sofort die
  gespeicherten Daten gezeigt und parallel frische Umsätze von der Bank geholt. Liegt der letzte
  Abruf unter 5 Minuten zurück, wird übersprungen. Die App schickt dabei deine IP und deinen
  Browser mit (`Psu-Ip-Address` / `Psu-User-Agent`), damit die Bank den Abruf als „von dir
  ausgelöst“ wertet. Solche Abrufe fallen nicht unter das PSD2-Limit von 4 Hintergrund-Abrufen pro Tag.
- Der 🔄-Button holt jederzeit sofort neu.
- **Zusätzlich 1× täglich (05:00 UTC)** läuft der Vercel-Cron `/api/sync`, damit die Daten auch
  ohne Öffnen nicht veralten und das kostenlose Supabase-Projekt aktiv bleibt.
- Pro Abruf werden die letzten 10 Tage neu gelesen, Duplikate werden erkannt.
- **Freigabe erneuern:** Die Bank-Freigabe gilt je nach Bank 90–180 Tage. 14 Tage vorher
  erscheint im Dashboard ein Hinweis, „Erneuern“ wiederholt Schritt 4.2. Das ist gesetzlich
  vorgeschrieben und gilt für jede App.

## Lokal entwickeln
```bash
npm install
cp .env.example .env.local   # ausfüllen, APP_URL=http://localhost:5173
npm run dev                  # startet Frontend + /api auf :5173
```
Die Funktionen in `api/` laufen dabei direkt im Vite-Server (`vite.config.js`).

## Kategorien anpassen
`src/shared/categories.js`: Stichwort-Regeln, erste passende gewinnt. Die Kategorien
werden im Browser berechnet, Änderungen gelten also auch für alle alten Umsätze.
Umbuchungen zwischen eigenen Konten zählen weder als Einnahme noch als Ausgabe.

## Aufbau
- `api/_lib.js`: Login-Prüfung, Supabase-Client, Enable-Banking-Client (RS256-JWT), Sync-Logik
- `api/connect.js` → `api/callback.js`: Freigabe-Flow (signierter `state`, da die Bank ohne Token zurückleitet)
- `api/sync.js`: Cron und Button · `api/data.js`: alles fürs Dashboard (13 Monate)
- `src/components/`: Dashboard, Monatsverlauf, Kategorien, Umsatzliste, Einstellungs-Sheet
