# PLT-10 Design und Styleguide

Release 0.1 · Reihenfolge 1 · baut auf den Design-Regeln aus der Einrichtung auf (Tokens, `prinzipien.md`, `visualisierung.md`, Skill `ui-design`)

## Ziel

Als Gründer sehe ich auf einer Seite alle Bausteine der Oberfläche in Hell und Dunkel, damit jede neue Seite aus denselben Teilen gebaut wird und nach Apple aussieht.

## Wer darf was

| Rolle | Darf |
|---|---|
| Alle angemeldeten Nutzer | `/styleguide` öffnen. |
| Lieferant | Nicht Teil. Der Styleguide ist ein Werkzeug für das Team, kein Produktbereich. |

## Daten

- Keine Fachdaten.
- Die Design-Tokens liegen an einer Stelle. Tailwind 4 liest sie über `@theme`.
- Token-Gruppen: Farben (Flächen, Text, Akzent, Status, Diagramm-Reihen), Schriftgrößen, Zeilenhöhen, Abstände, Radien, Schatten, Breakpoints, Bewegung (Dauer, Kurve).
- Jede Farbe hat einen Wert für Hell und einen für Dunkel.

## Ablauf

1. Der Nutzer öffnet `/styleguide`. Die Seite ist nicht in der Seitenleiste verlinkt.
2. Oben steht ein Umschalter: System, Hell, Dunkel. Er gilt nur für diese Seite, damit man beide Modi schnell vergleicht.
3. Die Seite zeigt in Abschnitten:
   - **Farben:** jedes Token als Fläche mit Name und Wert, Textfarben auf ihren Hintergründen mit dem gemessenen Kontrast.
   - **Schrift:** alle Stufen von Großtitel bis Fußnote, jeweils mit Beispielsatz.
   - **Abstände, Radien, Schatten:** als sichtbare Muster.
   - **Bausteine:** Knöpfe (Haupt, Neben, leise, gefährlich; normal, Hover, Fokus, deaktiviert, lädt), Eingabefeld, Suchfeld, Auswahl, Schalter, Checkbox, Dialog, Seitenpanel (Sheet), Hinweis (Toast), Status-Abzeichen, Tabelle, Kachel groß (Startseite), Kachel klein (Liste), Seitenleiste, leerer Zustand, Ladezustand, Fehlerzustand.
   - **Diagramme:** je ein Beispiel für 3×3-Matrix, Heatmap, Hantel-Diagramm und P&L-Brücke als Wasserfall, nach den Regeln aus `visualisierung.md`, mit erfundenen Werten und dem Hinweis „Beispieldaten“.
4. Jeder Abschnitt zeigt, aus welcher Datei der Baustein kommt, damit man ihn wiederverwendet statt neu baut.

### Gestaltung

- Systemschrift über `system-ui` (auf dem Mac SF Pro), Fallback Inter. Keine eingebetteten Apple-Schriften.
- Symbole: Lucide. Keine SF Symbols.
- Viel Weißraum, große Radien, Flächen statt Rahmen, sanfte Schatten.
- Glas-Effekte nur in Seitenleiste und Overlays.
- Klickflächen mindestens 44 × 44 px.
- Bewegung kurz und ruhig. Bei „Bewegung reduzieren“ im System sind Animationen aus.
- Diagramme mit ECharts. Farben kommen aus den Diagramm-Tokens, nicht aus dem ECharts-Standard.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] `/styleguide` zeigt alle oben genannten Abschnitte und Bausteine in Hell und Dunkel.
- [ ] Eine automatische Prüfung schlägt fehl, wenn im Code von `apps/web` eine feste Farbe, Schriftgröße oder ein fester Abstand außerhalb der Token-Datei steht.
- [ ] Ein Test berechnet den Kontrast aller Text- und Hintergrund-Paare der Tokens nach WCAG. Normaler Text erreicht mindestens 4,5:1, großer Text und Symbole mindestens 3:1, in Hell und Dunkel. Die Kontrastrechnung ist eine eigene kleine Funktion, keine neue Abhängigkeit.
- [ ] Alle Bausteine sind per Tastatur erreichbar und haben einen sichtbaren Fokus.
- [ ] Bei „Bewegung reduzieren“ laufen keine Animationen.
- [ ] Die Diagramm-Beispiele nutzen nur Diagramm-Tokens.
- [ ] Jede Klickfläche im Styleguide ist mindestens 44 × 44 px groß (Playwright misst nach).

## Nicht Teil dieser Funktion

- App-Rahmen und Startseite (PLT-11)
- Englische Texte (PLT-09)
- Echte Diagramme mit Fachdaten (SEG-03, SEG-04, PUL-05, PNL-10)
- Styleguide in der späteren Produktion ausblenden
