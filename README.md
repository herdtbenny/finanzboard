# Finanzboard

Privates, mobiloptimiertes Haushaltsbuch: Konten und Umsätze trägst du selbst ein,
ohne Bankverbindung. Daten liegen in **Supabase**, die App läuft auf **Vercel** und ist
auf dem Handy als App installierbar („Zum Home-Bildschirm“).

## Personen
- Jede Person meldet sich mit **Name + Passwort** an und bleibt angemeldet, solange die App mindestens alle 7 Tage benutzt wird; nach 7 Tagen ohne Nutzung wird abgemeldet. Personen liegen in der
  Datenbank, Passwörter gehasht (scrypt). Nach 5 falschen Passwörtern für einen Namen (oder 20 von
  einem Gerät) ist der Login 15 Minuten gesperrt.
- Jede Person hat ihre **eigenen** Konten, Umsätze, Daueraufträge und Kategorien (`user_id`) und
  sieht nur diese. Jede API-Route liest und schreibt nur die Daten der angemeldeten Person.
- Admins verwalten unter **Konten → Personen**: anlegen, Passwort zurücksetzen, löschen (mit allen
  Daten). Jede Person ändert ihr eigenes Passwort unter Konten. Ein neues Passwort meldet die Person
  auf allen anderen Geräten ab (`users.token_version`).

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
- **Vorgemerkt / Noch nicht bezahlt**: Ein Umsatz mit Datum in der Zukunft oder mit dem Schalter
  „Noch nicht bezahlt“ steht in den Umsätzen und zählt im Monat mit, aber noch **nicht zum
  Kontostand**. Zukünftige zählen automatisch ab ihrem Tag, nicht bezahlte erst nach „Bezahlt“ im
  Formular. Die Übersicht zeigt sie in der Karte „Vorgemerkt“ und den Stand danach.
- **Daueraufträge**: „Wiederholen“ im Formular oder unter Analyse → Daueraufträge. Sie werden
  31 Tage im Voraus gebucht (also vorgemerkt) und zählen an ihrem Tag. Das passiert beim Öffnen der
  App und täglich per Cron (`api/_recurring.js`). Ändern oder Beenden setzt die vorgemerkten
  Buchungen neu bzw. entfernt sie; eine einzelne vorgemerkte Buchung zu löschen, setzt sie aus.
- **Umsätze nach Konto filtern**: Auswahl „Alle Konten“ in Umsätze, oder ein Konto in der
  Übersicht antippen. Dann zeigt die Liste den Kontoauszug mit Kontostand.
- `api/_lib.js`: Login-Prüfung, Supabase-Client · `api/login.js`: Anmeldung mit Sperre nach Fehlversuchen
- `api/data.js`: alle Konten, Umsätze, Daueraufträge (bucht Fälliges vorher) · `api/transactions.js` / `api/accounts.js` / `api/recurrings.js`: speichern (POST) und löschen (DELETE)
- `src/components/Dashboard.jsx`: lädt alles, Salden · `TransactionSheet.jsx`: Eingabeformular · `Accounts.jsx`: Konten, Kategorien, Personen
- `src/shared/schedule.js`: Termine der Daueraufträge, `isBooked()` (gebucht oder vorgemerkt), „heute“ in deutscher Zeit
- `src/shared/categories.js`: Kategorien und Stichwort-Regeln für die Vorschläge
