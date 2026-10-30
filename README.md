# Finanzboard

Privates, mobiloptimiertes Haushaltsbuch: Konten und Umsätze trägst du selbst ein,
ohne Bankverbindung. Daten liegen in **Supabase**, die App läuft auf **Vercel** und ist
auf dem Handy als App installierbar („Zum Home-Bildschirm“).

## Personen und Haushalte
- Jede Person meldet sich mit **Name + Passwort** an und bleibt angemeldet, solange die App mindestens alle 7 Tage benutzt wird; nach 7 Tagen ohne Nutzung wird abgemeldet. Personen liegen in der
  Datenbank, Passwörter gehasht (scrypt).
- Daten (Konten, Umsätze, Daueraufträge) gehören zu einem **Haushalt**. Eine Person kann in
  mehreren Haushalten sein, mehrere Personen können sich einen teilen – z. B. „Mama“, „Papa“
  und „Eltern gemeinsam“. Wer mehrere hat, wechselt oben in der App.
- Admins verwalten unter **Konten → Personen / Haushalte**: anlegen, Passwort zurücksetzen,
  Zugriff vergeben. Jede Person ändert ihr eigenes Passwort unter Konten.
- Jede API-Route prüft, dass die Person Mitglied des Haushalts ist (`api/_lib.js` → `db()`).

## Bedienung
- **Konto anlegen** (💼 oben rechts) mit dem Kontostand an dem Tag, ab dem du einträgst
  (Anfangssaldo). Der aktuelle Stand ist immer Anfangssaldo + alle Umsätze.
- **„+“ unten rechts**: neuer Umsatz. Ausgabe/Einnahme, Betrag, wo/von wem, Kategorie, Datum
  (heute vorausgefüllt), Konto, Notiz. Die Kategorie wird beim Tippen anhand von Stichwörtern
  vorgeschlagen (`REWE` → Lebensmittel); ein Tipp auf eine andere überschreibt das.
  Schon benutzte Namen werden zur Auswahl angeboten.
- **Kassenzettel** (Knopf oben im „+“-Formular): fotografiert den Zettel und liest ihn per
  Texterkennung im Browser (Tesseract.js, `src/shared/ocr.js`); `src/shared/receipt.js` holt
  Betrag, Datum und Händler heraus und füllt nur das Formular vor. Das Foto verlässt das Gerät
  nicht; Texterkennung und deutsche Sprachdaten (~10 MB) lädt der Browser beim ersten Scan von
  cdn.jsdelivr.net und hält sie im Cache.
- **Umsatz antippen**: bearbeiten oder löschen (zweimal tippen zum Bestätigen).
- **Kategorie im Diagramm antippen**: filtert die Umsatzliste.
- **Umbuchung** (dritter Reiter im Formular): von Konto → nach Konto. Wird als zwei Buchungen
  gespeichert, die zusammengehören, und in der Liste als eine Zeile gezeigt. Zählt weder als
  Einnahme noch als Ausgabe.
- **Daueraufträge**: „Wiederholen“ im Formular oder unter Konten → Daueraufträge. Fällige
  Buchungen entstehen beim Öffnen der App und täglich per Cron (`api/_recurring.js`).
- **Umsätze nach Konto filtern**: Auswahl „Alle Konten“ in Umsätze, oder ein Konto in der
  Übersicht antippen. Dann zeigt die Liste den Kontoauszug mit Kontostand.
- `api/_lib.js`: Login-Prüfung, Supabase-Client
- `api/data.js`: alle Konten, Umsätze, Daueraufträge (bucht Fälliges vorher) · `api/transactions.js` / `api/accounts.js` / `api/recurrings.js`: speichern (POST) und löschen (DELETE)
- `src/components/Dashboard.jsx`: Übersicht, Salden, Monat · `TransactionSheet.jsx`: Eingabeformular · `AccountsSheet.jsx`: Konten
- `src/shared/categories.js`: Kategorien und Stichwort-Regeln für die Vorschläge
