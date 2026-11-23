# WEB-01 Website

Schritt W der Warteschlange · unabhängig von der App · Vorlage: Entwurf „Reziproq Website“ in
Claude (Design-Canvas, 11 Seiten und drei Bausteine, Stand 22.11.2026)

## Ziel

Die öffentliche Website von Reziproq: erklärt das Produkt Einkäufern und Lieferanten, führt zur
Demo-Anfrage und zur Anmeldung in der App. Sie folgt der Designsprache „Zwei Kreise“ mit den Tokens
und Bausteinen der App und läuft getrennt von ihr (eigene Domain, statisch ausgeliefert).

## Seiten

| Pfad (EN) | Pfad (DE) | Seite | Inhalt laut Entwurf |
|---|---|---|---|
| `/` | `/de/` | Start | Held mit Produktansicht (Übersicht), Problem in drei Zahlen, sechs Schritte in drei Phasen, beidseitig, Wirkung (Wertpipeline), KI, Daten in Frankfurt, Preis kurz |
| `/how-it-works` | `/de/so-funktioniert-es` | So funktioniert es | drei Phasen, sechs Schritte, Tiefe je Beziehungstyp, Ergebnis |
| `/platform` | `/de/plattform` | Plattform | Segmentierung, Puls, Pläne und Reviews, Wirkung, KI, Warengruppen, Anbindungen |
| `/suppliers` | `/de/lieferanten` | Für Lieferanten | Lieferantenportal, Nutzen, wenig Aufwand, private Ebene, FAQ |
| `/security` | `/de/sicherheit` | Sicherheit und Daten | Frankfurt, EU, Unterauftragnehmer, Verarbeitung, wer sieht was, Rechte, Compliance |
| `/pricing` | `/de/preise` | Preise | zwei Preise, was als Wert zählt, drei Beispiele, Rechner, sechs Regeln, Pilot, FAQ |
| `/pilot` | `/de/pilot` | Pilot | 90 Tage, sechs Schritte, Erfolgskriterien, Zusammenarbeit, Design-Partner |
| `/company` | `/de/unternehmen` | Unternehmen | Mission, warum, Prinzipien (Team erst mit echten Angaben) |
| `/contact` | `/de/kontakt` | Kontakt und Demo | Formular, was danach passiert |
| `/login` | `/de/anmelden` | Anmelden | Weg zur Anmeldung der App (Microsoft, Google, Firmen-SSO, Mail); Lieferantenportal |
| `/legal` | `/de/rechtliches` | Impressum und Datenschutz | Gerüst mit Platzhaltern |

Bausteine: Kopf (Navigation, EN/DE, Anmelden, Demo buchen), Fuß, Kundenstimmen.

## Regeln

- Texte auf Englisch (aus dem Entwurf) und Deutsch; Umschalter EN/DE auf jeder Seite, gleiche Seite
  in der anderen Sprache.
- Farben, Schriften, Radien, Schatten nur über die Tokens der App (`apps/web/src/styles/tokens.css`).
  Bausteine aus `apps/web/src/components/ui` (Button, Badge, Monogramm, Tinte-Karte, Logo), fehlende im
  UI-Paket anlegen.
- Produktansichten auf der Website sind Bilder in HTML mit Beispieldaten und dem Hinweis „Beispieldaten“.
- Platzhalter wie `[Customer logo]`, `[Full name]` erscheinen nicht öffentlich: Abschnitte ohne
  echten Inhalt (Kundenstimmen, Team) bleiben aus, bis Inhalte da sind.
- Rechtstexte (Impressum, Datenschutz) sind Gerüst; vor dem Start prüft sie ein Anwalt.
- Zahlen mit Quelle (State of Flux, Gartner, Plante Moran) behalten ihre Fußnote.
- Anmelden führt zur App (`VITE_APP_URL`); die App bietet Microsoft, Google, Firmen-SSO und Mail an (IN-02).
- Kontaktformular: Ohne Maildienst (C5) öffnet es eine vorausgefüllte Mail; danach sendet es an die
  API.
- Statisch vorgerendert (eine HTML-Datei je Seite und Sprache), schnell ohne JavaScript lesbar; der
  Preisrechner braucht JavaScript.
- Jede Seite funktioniert auf Telefonbreite und mit Tastatur, Text mindestens 4,5:1, kein seitliches
  Scrollen.

## Fertig, wenn

- [x] Alle elf Seiten in EN und DE, mit Kopf und Fuß, nach dem Entwurf.
- [x] Umschalter EN/DE führt zur gleichen Seite in der anderen Sprache.
- [x] Keine Hex-Werte und keine Schriftnamen in den Seiten, nur Tokens und Bausteine.
- [x] Der Preisrechner rechnet wie im Entwurf (Staffel 10 %, 5 %, 2 %; 8 % auf freigesetztes Kapital).
- [x] Keine Platzhalter in eckigen Klammern auf öffentlichen Seiten außer im Gerüst der Rechtstexte.
- [x] 390 und 1440 Pixel ohne seitliches Scrollen; Tastatur erreicht alle Links und Knöpfe.
- [x] Build erzeugt statische Seiten je Sprache.

## Nicht Teil dieser Funktion

- Hosting, Domain, Maildienst (Block C)
- Blog, Kundenreferenzen, Cookie-Banner (keine Cookies außer technisch nötigen)

## Umsetzung (23.11.2026)

- Eigene App `apps/website` (Vite, React). `pnpm build` rendert jede Seite je Sprache als HTML vor
  (`prerender.mjs`, 22 Seiten, dazu `<pfad>.html` für Adressen ohne Schrägstrich); das Skript im
  Browser hydratisiert nur für Preisrechner und Kontaktformular. Entwicklung: `pnpm website`
  (Port 5180).
- Tokens, Schriften und Bausteine kommen aus `apps/web` (Alias `@`), nichts ist kopiert. Neu in den
  Tokens: Stufen `site-hero`, `site-title`, `site-lead`, `site-figure`, Abschnittsabstand, Breite,
  Radien `site`/`site-lg`, Schatten `site-frame`. Neu im UI-Paket: `Range` (Schieberegler).
- Texte in `src/content/en.ts` und `de.ts`; der Typ und ein Test halten beide gleich.
- Preisrechner rechnet in Cent (`src/pricing.ts`); die drei Beispiele der Seite sind als Test
  nachgerechnet.
- Abweichungen von der Vorlage, jeweils mit Kommentar im Code:
  - Kundenstimmen und Team fehlen, bis es echte Inhalte gibt.
  - Kontakt öffnet das Mailprogramm mit der ausgefüllten Anfrage an `hello@reziproq.de`
    (Adresse vom Gründer zu bestätigen), bis der Maildienst kommt (C5).
  - Anmelden zeigt die Wege als Text und führt mit einer Hauptaktion zur Anmeldung der App; die
    Website meldet nicht selbst an. Einen Anmeldelink für Lieferanten per Mail gibt es erst mit C5.
  - Tabellen (Tiefe je Beziehungstyp, Unterauftragnehmer) stehen auf dem Telefon als Karten; die
    Beispieltabelle der Preise scrollt dort in sich, die Seite nie.
- Tests: `src/web-01.test.tsx` (Seiten, Pfade, Sprachen, Platzhalter, Rechner, Kontakt),
  `e2e/web-01.spec.ts` (jede Seite und Sprache auf 390 und 1440 Pixel: eine h1, kein seitliches
  Scrollen; Sprachumschalter), Token-Prüfung in `apps/web/src/styles/tokens.node.test.ts` deckt
  `apps/website` mit ab. `pnpm test:e2e` startet beide E2E-Läufe.

## Navigation ohne Neuladen (23.11.2026)

Auf Wunsch des Gründers wechselt die Website zwischen ihren Seiten ohne Neuladen
(`apps/website/src/navigation.tsx`). Die Links bleiben normale Verweise auf die vorgerenderten
Seiten, damit Suchmaschinen und Besucher ohne JavaScript sie wie bisher nutzen. Mit JavaScript
übernimmt die Website interne Klicks: Sie tauscht den Inhalt, setzt Adresse, Titel und Sprache,
springt nach oben oder zum Anker und setzt den Fokus auf den Inhalt. Zurück und Vor im Browser
funktionieren. Strg- oder Cmd-Klick, neue Tabs, Downloads, „Anmelden“ (App) und fremde Adressen lädt
der Browser wie gewohnt. Tests: `apps/website/src/web-01.test.tsx`, `apps/website/e2e/web-01.spec.ts`.

## Menü auf kleinen Bildschirmen (23.11.2026)

Unter 1280 px Breite zeigt der Kopf statt der Leiste einen Knopf „Menü“. Er klappt die Seiten
untereinander auf, dazu Sprache, Anmelden und Demo buchen, im Seitenfluss ohne Popup. Ein
Seitenwechsel und Esc schließen das Menü. Vorher brach die Leiste auf Telefon und Tablet innerhalb
ihrer Pille um. Das Etikett über dem Titel der Startseite bricht auf schmalen Bildschirmen um, statt
abgeschnitten zu werden; die nachgebaute App-Leiste in der Produktansicht zeigt dort nur die Marke.

