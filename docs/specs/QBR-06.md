# QBR-06 Pre-Read als PDF

Release 0.3 · baut auf QBR-01, JBP-09 · legt den PDF-Baustein für alle späteren Exporte an

## Ziel

Vor jedem Termin erzeugt ein Klick ein sauberes PDF mit Agenda und aktuellem Stand, das jede Seite an ihre Teilnehmenden geben kann.

## Wer darf was

| Rolle        | Darf                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| Beide Seiten | Pre-Read erzeugen. Es enthält nur, was die erzeugende Seite sehen darf. |

## Daten

- Keine neuen Tabellen.
- **PDF-Baustein:**
  - Druckseiten im Web unter `/druck/…`, mit eigenem Druck-Layout aus den Tokens
  - Ein Job im Backend rendert sie mit Playwright (Chromium) als PDF.
  - Das PDF wird direkt ausgeliefert und nicht gespeichert.
- Interne Notizen und interne Objekte erscheinen nur im Pre-Read der eigenen Seite.

## Ablauf

1. Auf der Termin-Seite erzeugt **Pre-Read als PDF** die Datei und lädt sie herunter.
2. **Inhalt:**
   - Titelseite mit Termin, Teilnehmenden und Agenda
   - Scorecard mit Ist-Werten
   - Initiativen mit Status
   - Zusagen
   - offene Maßnahmen
   - bei der eigenen Seite interne Notizen, als „Intern“ markiert
3. Bei abgeschlossenen Terminen erzeugt derselbe Knopf das Protokoll aus dem eingefrorenen Stand.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Ein Klick erzeugt das PDF in unter zehn Sekunden (lokal gemessen) (`apps/api/src/modules/meetings/qbr-06.test.ts`; Knopf: `apps/web/src/features/meetings/qbr-06.test.ts`).
- [x] Das PDF des Lieferanten enthält keine internen Inhalte des Käufers, und umgekehrt (Test über den Text des PDFs) (`apps/api/src/modules/meetings/qbr-06.test.ts`, Text über pdf.js).
- [x] Bei abgeschlossenen Terminen zeigt das PDF den eingefrorenen Stand (`apps/api/src/modules/meetings/qbr-06.test.ts`).
- [x] Das Layout nutzt die Tokens und ist in Schwarz-Weiß lesbar (`apps/api/src/modules/meetings/qbr-06.test.ts`).

## Umsetzung (16.11.2026)

- **Abweichung bei den Druckseiten:** Die Druckseite entsteht nicht als Route `/druck/…` im Web,
  sondern in der API (`apps/api/src/modules/print`). Sonst bräuchte der Renderer eine laufende
  Web-App und eine angemeldete Sitzung im Hintergrund-Browser. Tokens und Schriften liest die API
  aus `apps/web/src/styles/tokens.css` und `apps/web/public/fonts`, es gibt sie also weiter nur an
  einer Stelle. Im Betrieb zeigt `PRINT_ASSETS_DIR` auf diese Dateien.
- Chromium kommt über `playwright-core` (gleiche Version wie Playwright in der Web-App). Der
  Browser startet beim ersten PDF und bleibt offen; jedes PDF bekommt einen eigenen Kontext ohne
  Netz.
- Neuer Live-Abschnitt „Initiativen“ im Termin (auch auf der Termin-Seite und im eingefrorenen
  Stand); die Scorecard zeigt den letzten Ist-Wert mit Einheit.

## Nicht Teil dieser Funktion

- Weitere PDFs (QS-03)
- KI-Entwurf des Pre-Reads (QBR-07)
