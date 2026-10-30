# Finanzboard

Privates, mobiloptimiertes Haushaltsbuch: Konten und Umsätze trägst du selbst ein,
ohne Bankverbindung. Daten liegen in **Supabase**, die App läuft auf **Vercel** und ist
auf dem Handy als App installierbar („Zum Home-Bildschirm“).

## Bedienung
- **Konto anlegen** (💼 oben rechts) mit dem Kontostand an dem Tag, ab dem du einträgst
  (Anfangssaldo). Der aktuelle Stand ist immer Anfangssaldo + alle Umsätze.
- **„+“ unten rechts**: neuer Umsatz. Ausgabe/Einnahme, Betrag, wo/von wem, Kategorie, Datum
  (heute vorausgefüllt), Konto, Notiz. Die Kategorie wird beim Tippen anhand von Stichwörtern
  vorgeschlagen (`REWE` → Lebensmittel); ein Tipp auf eine andere überschreibt das.
  Schon benutzte Namen werden zur Auswahl angeboten.
- **Umsatz antippen**: bearbeiten oder löschen (zweimal tippen zum Bestätigen).
- **Kategorie im Diagramm antippen**: filtert die Umsatzliste.
- „Umbuchung“ (Geld zwischen eigenen Konten) zählt weder als Einnahme noch als Ausgabe.
  Trag sie zweimal ein: als Ausgabe beim einen und als Einnahme beim anderen Konto.

## Einrichtung
1. **Supabase**: Projekt anlegen → SQL Editor → `supabase-schema.sql` ausführen.
   Achtung: das Skript löscht und erstellt alle Tabellen neu.
2. **Lokal**: `cp .env.example .env.local`, ausfüllen, `npm install`, `npm run dev`
   (Frontend + API auf http://localhost:5173, die `api/`-Funktionen laufen im Vite-Server).
3. **Vercel**: Repo importieren, die Variablen aus `.env.example` setzen, deployen.
   Der Cron in `vercel.json` (`/api/keep-alive`, täglich) hält das kostenlose
   Supabase-Projekt aktiv, das sonst nach 7 Tagen ohne Zugriff pausiert.
4. Handy: iPhone → Teilen → „Zum Home-Bildschirm“, Android → Menü → „App installieren“.

## Aufbau
- `api/_lib.js`: Login-Prüfung, Supabase-Client
- `api/data.js`: alle Konten und Umsätze · `api/transactions.js` / `api/accounts.js`: speichern (POST) und löschen (DELETE)
- `src/components/Dashboard.jsx`: Übersicht, Salden, Monat · `TransactionSheet.jsx`: Eingabeformular · `AccountsSheet.jsx`: Konten
- `src/shared/categories.js`: Kategorien und Stichwort-Regeln für die Vorschläge
