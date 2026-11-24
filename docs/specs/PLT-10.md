# PLT-10 Design und Styleguide

> **Status 24.11.2026 (Umbau KI-nativ): gilt weiter, mit Änderungen.** Maßgeblich: Designsprache 3.1, E-K0-01. Erlaubt sind nur das Blatt, die Überlagerung „Frag Reziproq“ mit ⌘K und die Dialoge „So teilen“ und „Agenda freigeben“; alle anderen Pop-ups bleiben verboten. Es gibt nur ein helles Thema. Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.1 · baut auf den Design-Regeln aus der Einrichtung (Tokens, `prinzipien.md`, `visualisierung.md`, Skill `ui-design`) · deckt ab PLT-10, NAV-04, NAV-10 · überarbeitet am 31.10.2026: keine Pop-ups · überarbeitet am 8.11.2026: Bühne mit eigener Handschrift

## Ziel

Als Gründer sehe ich auf einer Seite alle Bausteine der Oberfläche in Hell und Dunkel. So wird jede neue Seite aus denselben Teilen gebaut, wirkt so ruhig wie Apple, aber mit eigener Handschrift, und kommt ohne Pop-up-Fenster aus.

## Wer darf was

| Rolle | Darf |
|---|---|
| Alle angemeldeten Nutzer | `/styleguide` öffnen. |
| Lieferant | Nicht Teil. Der Styleguide ist ein Werkzeug für das Team. |

## Daten

- Keine Fachdaten.
- Die Design-Tokens liegen an einer Stelle. Tailwind 4 liest sie über `@theme`.
- Tokens gibt es für Farben (Flächen, Text, Akzent, Status, Diagramm-Reihen), Schriftgrößen, Zeilenhöhen, Abstände, Radien, Schatten, Breakpoints und Bewegung.
- Jede Farbe hat einen Wert für Hell und einen für Dunkel.

## Ablauf

1. Der Nutzer öffnet `/styleguide`. Die Seite ist nicht in der Navigation verlinkt.
2. Oben schaltet ein Umschalter zwischen System, Hell und Dunkel, nur für diese Seite.
3. Die Seite zeigt in Abschnitten:
   - **Grundlagen:**
     - Farben mit Name, Wert und gemessenem Kontrast
     - Schriftstufen
     - Abstände, Radien und Schatten
   - **Navigation:**
     - globale Leiste
     - lokale Leiste eines Lieferanten mit Knopf „Nächster Schritt“
     - Pfad mit Zurück-Pfeil
   - **Bühne:** Kopf über die ganze Breite für Start und den Überblick eines Lieferanten, dunkel und hell
   - **Kachel (NAV-10):**
     - Aufbau: Kennzeichen, Titel, ein Satz, Kennzahl oder Grafik, höchstens zwei Knöpfe (Hauptaktion gefüllt, Nebenaktion umrandet oder als Link)
     - groß für Start und Überblick, klein für Listen
     - drei Töne: Karte (hell), Bühne (dunkel), Geteilt (Akzent hell)
   - **Knöpfe:**
     - Arten: Haupt, Neben, leise, gefährlich
     - Zustände: normal, Hover, Fokus, deaktiviert, lädt
   - **Formularseite:**
     - Eingabe, Auswahl, Mehrfachauswahl, Schalter, Datum
     - Fehlermeldung am Feld
     - Speichern und Abbrechen unten
   - **Abläufe in Schritten:** Fortschritt „Schritt 2 von 4“, Weiter, Zurück, Später fortsetzen
   - **Bestätigung auf der Seite (NAV-04):** Der Knopf wird zur Zeile „Wirklich beenden? Ja · Abbrechen“.
   - **Rückmeldezeile (NAV-04):** ruhige Zeile oben nach dem Speichern, verschwindet nach kurzer Zeit
   - **Kennzeichen Intern und Geteilt:** Symbol und Text
   - **Zustände:** leer, lädt, Fehler
   - **Tabellen und Listen:** Status-Abzeichen, Baustein Verlauf (PLT-08)
   - **Diagramme mit Beispieldaten, nach `visualisierung.md`:**
     - 3×3-Matrix
     - Heatmap
     - Hantel-Diagramm
     - P&L-Brücke als Wasserfall
     - Zeitachse

### Gestaltung

- Systemschrift über `system-ui` (auf dem Mac erscheint SF Pro), Fallback Inter. Keine eingebetteten Apple-Schriften.
- Symbole von Lucide, keine SF Symbols.
- Viel Weißraum, große Radien, Flächen statt Rahmen.

### Handschrift „Bühne“ (seit 8.11.2026)

Vorbild bleibt Apple in Ruhe und Klarheit, kopiert wird es nicht.

- **Farben:**
  - Tinte (fast schwarz, leicht blaugrün) für dunkle Flächen
  - Petrol als einzige Akzentfarbe, im Dunkeln Minze
  - Seite in warmem Hellgrau, Karten weiß
  - kein Apple-Blau
- **Bühne:**
  - Start und der Überblick eines Lieferanten beginnen mit einer Fläche über die ganze Breite.
  - Oben klein in Akzentfarbe Datum oder Warengruppe, darunter ein sehr großer Titel, linksbündig.
  - Dazu ein Satz, höchstens zwei Knöpfe und rechts bis zu drei Kennzahlen.
  - Start ist dunkel, der Lieferant hell.
- **Schrift:**
  - Überschriften linksbündig, fett, mit engem Buchstabenabstand.
  - Zwei neue Stufen: Seitentitel (2xl) und Bühne (display).
  - Kachel-Titel stehen linksbündig. Das ersetzt die zentrierten Titel aus NAV-10.
- **Knöpfe** mit leicht runden Ecken, keine Pillenform.
- **Globale Leiste:**
  - hell, mit Bildmarke aus zwei Kreisen für Käufer und Lieferant
  - die aktive Seite mit einer Akzentlinie unten
  - in der lokalen Leiste markiert eine Linie den aktiven Bereich
- **Ebenen sichtbar:**
  - Was mit der anderen Seite geteilt ist, trägt den Ton Geteilt und das Kennzeichen „Geteilt“.
  - Interne Inhalte bleiben hell oder dunkel.
- **Statusgrün** ist ein Blattgrün und hebt sich vom Petrol ab, immer mit Symbol und Text.
- Klickflächen mindestens 44 × 44 px.
- Bei „Bewegung reduzieren“ laufen keine Animationen.
- **Erlaubt:** native Auswahllisten.
- **Verboten:** Dialog, AlertDialog, Sheet, Drawer, Popover mit Inhalt, Toast und Overlay.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] `/styleguide` zeigt alle oben genannten Abschnitte in Hell und Dunkel.
- [ ] Eine automatische Prüfung schlägt fehl bei festen Farben, Schriftgrößen oder Abständen außerhalb der Token-Datei.
- [ ] Ein Test berechnet den WCAG-Kontrast aller Text- und Hintergrund-Paare der Tokens:
  - normaler Text mindestens 4,5:1
  - großer Text und Symbole mindestens 3:1
  - in Hell und Dunkel
  - mit einer eigenen kleinen Funktion, ohne neue Abhängigkeit
- [ ] Ein Test schlägt fehl, wenn eine verbotene Komponente im Code vorkommt: Dialog, AlertDialog, Sheet, Drawer, Toast oder Overlay, auch die von shadcn/ui.
- [ ] Alle Bausteine sind per Tastatur erreichbar und zeigen einen sichtbaren Fokus.
- [ ] Jede Klickfläche ist mindestens 44 × 44 px groß (Playwright misst nach).
- [ ] Die Diagramm-Beispiele nutzen nur Diagramm-Tokens.
- [ ] Die Kontrastprüfung umfasst auch Text auf der Bühne und im Ton Geteilt.
- [ ] Kein Apple-Blau in den Tokens (#0071e3, #0066cc, #2997ff).
- [ ] Kachel-Titel und Kachel-Text stehen linksbündig.
- [ ] Start und der Überblick eines Lieferanten zeigen die Bühne mit dem Seitentitel; bei 390 px ohne waagerechte Scrollleiste.
- [ ] Der Styleguide zeigt die Bühne hell und dunkel und die drei Kacheltöne.

## Nicht Teil dieser Funktion

- Navigation mit echten Routen (PLT-11)
- Englische Texte (PLT-09)
- Diagramme mit Fachdaten (eigene Specs)

## Änderung vom 15.11.2026: nur ein helles Thema

Mit der Designsprache „Zwei Kreise“ (`docs/design/designsprache.md`) gibt es nur ein helles Thema.
Der Dunkelmodus, die Seite `/profil/erscheinungsbild` und der Umschalter im Styleguide sind
entfernt (Entscheidung des Gründers). Kriterien zu Hell und Dunkel gelten seitdem nur noch für Hell.
