# PLT-11 App-Rahmen und Startseite

Release 0.1 · neu, ergänzt PLT-10 (Design) und QS-04 (leere Zustände)

## Ziel

Als Einkäufer sehe ich nach dem Login auf einen Blick alle Bereiche von Reziproq und komme mit einem Klick dorthin, ohne eine Anleitung zu brauchen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin, Nutzer, Leser, Controlling | Startseite, Seitenleiste und alle Bereichsseiten sehen. Inhalte je Rolle kommen mit den einzelnen Funktionen. |
| Käufer: Admin | Zusätzlich in den Einstellungen den Abschnitt „Organisation“ sehen (vorerst nur Platzhalter). |
| Lieferant | Nicht Teil dieser Funktion. Lieferanten bekommen ab Release 0.2 eine eigene, kleinere Navigation. |

## Daten

- Keine neuen Fachdaten.
- Liest Name, E-Mail und Organisation aus `/me`.
- Erscheinungsbild (System, Hell, Dunkel) wird nur im Browser gespeichert. Ohne gespeicherten Wert gilt „System“.
- Keine käuferprivaten, geteilten oder lieferantenprivaten Daten in dieser Funktion.

## Ablauf

1. Der Nutzer meldet sich an und landet auf **Übersicht** (`/uebersicht`).
2. Oben steht eine Begrüßung nach Tageszeit mit Vornamen, z. B. „Guten Morgen, Anna“.
3. Darunter ist Platz für das Prompt-Fenster (kommt mit PLT-12; bis dahin bleibt der Platz leer, kein totes Eingabefeld).
4. Darunter sechs große Kacheln, jede ganz anklickbar:

| Kachel | Satz auf der Kachel | Route | Kommt mit |
|---|---|---|---|
| Lieferanten | Welche Lieferanten wirklich zählen – nach Business Impact und Beziehungsqualität, nicht nur nach Spend. | `/lieferanten` | 0.1 |
| Beziehungen | Rechte und Pflichten je Beziehungstyp, Rollen und Ansprechpartner auf beiden Seiten. | `/beziehungen` | 0.2 |
| Beziehungspuls | Wie beide Seiten die Beziehung sehen – heute und gewünscht. | `/puls` | 0.2 |
| Joint Business Plans | Gemeinsame Ziele, Initiativen und KPIs mit strategischen Lieferanten. | `/jbp` | 0.3 |
| QBRs und Maßnahmen | Fortschritt regelmäßig prüfen, Zusagen nachhalten, Maßnahmen steuern. | `/qbr` | 0.3 |
| P&L-Impact | Welcher Wert aus der Zusammenarbeit in der GuV ankommt – belegt und freigegeben. | `/pnl` | 1.0 |

5. Jede Kachel zeigt unten eine Statuszeile. Solange die Funktion fehlt: „Kommt mit Release 0.x“. Sobald es Daten gibt, eine Kennzahl (z. B. Anzahl Lieferanten).
6. Links eine Seitenleiste wie in macOS-Apps: Übersicht, die sechs Bereiche, darunter abgesetzt Einstellungen. Unten Nutzer-Menü mit Name, E-Mail und Abmelden.
7. Jede Bereichsseite zeigt Titel, den Satz aus der Kachel und einen leeren Zustand: ein großes Symbol, ein Satz, was hier entsteht, und mit welchem Release.
8. **Einstellungen** (`/einstellungen`): Erscheinungsbild umschalten (System, Hell, Dunkel). Abschnitt „Organisation“ nur für Admins, vorerst Platzhalter.
9. Unbekannte Adresse: freundliche Seite „Diese Seite gibt es nicht“ mit Knopf zurück zur Übersicht.

### Gestaltung

- Erinnert an Apple: viel Weißraum, wenige Elemente pro Seite, eine klare Hauptaktion, ruhige Farben.
- Kacheln groß und gleich hoch, abgerundete Ecken, dezenter Schatten oder Fläche statt Rahmen. Auf breiten Bildschirmen drei Spalten, mittel zwei, schmal eine.
- Schrift: Systemschrift über `system-ui` (auf dem Mac erscheint SF Pro), Fallback Inter. Keine eingebetteten Apple-Schriften.
- Symbole: Lucide, keine SF Symbols. Ein Symbol pro Kachel.
- Glas- und Unschärfe-Effekte höchstens in der Seitenleiste, nie hinter Text in Kacheln.
- Klickflächen mindestens 44 × 44 px.
- Alle Farben, Abstände, Radien und Schriftgrößen nur aus den Tokens. Regeln aus `prinzipien.md` und Skill `ui-design` gelten.
- Unter der Breite für „schmal“ (Token) klappt die Seitenleiste zu einem Menüknopf ein.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Nach dem Login landet der Nutzer auf `/uebersicht` und sieht die Begrüßung mit seinem Vornamen.
- [ ] Die Übersicht zeigt genau sechs Kacheln in der Reihenfolge der Tabelle. Ein Klick irgendwo auf eine Kachel öffnet die richtige Route.
- [ ] Die Seitenleiste zeigt Übersicht, sechs Bereiche und Einstellungen. Die aktive Seite ist markiert.
- [ ] Jede Bereichsseite zeigt Titel, Satz und leeren Zustand mit Release-Hinweis.
- [ ] Bei 390 px Breite: Seitenleiste eingeklappt, Kacheln einspaltig, keine waagerechte Scrollleiste (Playwright).
- [ ] Alle Knöpfe, Links und Kacheln sind mindestens 44 × 44 px groß (Playwright misst nach).
- [ ] Hell- und Dunkelmodus folgen der Systemeinstellung und lassen sich in den Einstellungen umschalten.
- [ ] Der Abschnitt „Organisation“ in den Einstellungen ist nur für Admins sichtbar.
- [ ] Die ganze Seite ist per Tastatur bedienbar: logische Tab-Reihenfolge, sichtbarer Fokus.
- [ ] Unbekannte Adressen zeigen die Nicht-gefunden-Seite.
- [ ] Alle Texte kommen aus der deutschen Übersetzungsdatei. Ein Test schlägt fehl, wenn ein Schlüssel fehlt.
- [ ] Keine festen Farben, Abstände oder Schriftgrößen außerhalb der Tokens (bestehende Prüfung bleibt grün).

## Nicht Teil dieser Funktion

- Inhalte der Bereiche (eigene Specs je Anforderung)
- Prompt-Fenster (PLT-12)
- Navigation für Lieferanten (Release 0.2)
- Englische Oberfläche (PLT-09)
- Organisationseinstellungen mit Inhalt
- Suche (QS-05) und Benachrichtigungen
