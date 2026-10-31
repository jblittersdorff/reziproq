# PLT-11 App-Rahmen und Startseite

Release 0.1 · Reihenfolge 2 · baut auf PLT-10 · neu, steht noch nicht in der Anforderungsliste

## Ziel

Als Einkäufer sehe ich nach dem Login auf einen Blick alle Bereiche von Reziproq und komme mit einem Klick dorthin, ohne eine Anleitung zu brauchen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: alle Rollen | Startseite, Seitenleiste und alle Bereichsseiten sehen. Inhalte je Rolle kommen mit den einzelnen Funktionen. |
| Käufer: Admin (Rolle `admin` in Zitadel) | In den Einstellungen zusätzlich den Abschnitt „Organisation“ sehen (Inhalt kommt mit PLT-02 und PLT-05). |
| Lieferant | Nicht Teil. Lieferanten bekommen ab Release 0.2 eine eigene, kleinere Navigation. |

## Daten

- Keine neuen Fachdaten.
- Liest Name, E-Mail und Organisation aus `/me`.
- Das Erscheinungsbild (System, Hell, Dunkel) wird nur im Browser gespeichert. Ohne gespeicherten Wert gilt „System“.

## Ablauf

1. Der Nutzer meldet sich an und landet auf **Übersicht** (`/uebersicht`).
2. Oben steht eine Begrüßung nach Tageszeit mit Vornamen, z. B. „Guten Morgen, Anna“.
3. Darunter steht seit PLT-12 das Feld, das das Prompt-Fenster öffnet. Ein totes Eingabefeld gibt es nie.
4. Darunter stehen sechs große Kacheln. Jede ist als Ganzes anklickbar:

| Kachel | Satz auf der Kachel | Route | Kommt mit |
|---|---|---|---|
| Lieferanten | Welche Lieferanten wirklich zählen – nach Business Impact und Beziehungsqualität, nicht nur nach Spend. | `/lieferanten` | 0.1 |
| Beziehungen | Rechte und Pflichten je Beziehungstyp, Rollen und Ansprechpartner auf beiden Seiten. | `/beziehungen` | 0.2 |
| Beziehungspuls | Wie beide Seiten die Beziehung sehen – heute und gewünscht. | `/puls` | 0.2 |
| Joint Business Plans | Gemeinsame Ziele, Initiativen und KPIs mit strategischen Lieferanten. | `/jbp` | 0.3 |
| QBRs und Maßnahmen | Fortschritt regelmäßig prüfen, Zusagen nachhalten, Maßnahmen steuern. | `/qbr` | 0.3 |
| P&L-Impact | Welcher Wert aus der Zusammenarbeit in der GuV ankommt – belegt und freigegeben. | `/pnl` | 0.3 |

5. Unten auf jeder Kachel steht eine Statuszeile. Solange die Funktion fehlt, steht dort „Kommt mit Release 0.x“. Sobald es Daten gibt, steht dort eine Kennzahl, z. B. die Anzahl der Lieferanten.
6. Links ist eine Seitenleiste wie in macOS-Apps: Übersicht, die sechs Bereiche, darunter abgesetzt Einstellungen. Ganz unten ein Nutzer-Menü mit Name, E-Mail, Organisation und Abmelden.
7. Jede Bereichsseite zeigt Titel, den Satz aus der Kachel und einen leeren Zustand: ein großes Symbol, ein Satz, was hier entsteht, und mit welchem Release.
8. In den **Einstellungen** (`/einstellungen`) kann der Nutzer das Erscheinungsbild umschalten. Der Abschnitt „Organisation“ ist nur für Admins sichtbar.
9. Bei einer unbekannten Adresse erscheint eine freundliche Seite „Diese Seite gibt es nicht“ mit einem Knopf zurück zur Übersicht.

### Gestaltung

- Erinnert an Apple: viel Weißraum, wenige Elemente pro Seite, eine klare Hauptaktion, ruhige Farben.
- Kacheln sind groß und gleich hoch, mit großem Radius und einer Fläche statt eines Rahmens. Auf breiten Bildschirmen drei Spalten, mittel zwei, schmal eine.
- Ein Lucide-Symbol pro Kachel.
- Glas-Effekt höchstens in der Seitenleiste.
- Klickflächen mindestens 44 × 44 px. Alles nur aus Tokens, Bausteine aus dem Styleguide (PLT-10).
- Unter der Breite für „schmal“ (Token) klappt die Seitenleiste zu einem Menüknopf ein.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Nach dem Login landet der Nutzer auf `/uebersicht` und sieht die Begrüßung mit seinem Vornamen.
- [ ] Die Übersicht zeigt genau sechs Kacheln in der Reihenfolge der Tabelle. Ein Klick irgendwo auf eine Kachel öffnet die richtige Route.
- [ ] Die Seitenleiste zeigt Übersicht, sechs Bereiche und Einstellungen. Die aktive Seite ist markiert.
- [ ] Jede Bereichsseite zeigt Titel, Satz und leeren Zustand mit Release-Hinweis.
- [ ] Bei 390 px Breite ist die Seitenleiste eingeklappt, die Kacheln stehen einspaltig, und es gibt keine waagerechte Scrollleiste (Playwright).
- [ ] Alle Knöpfe, Links und Kacheln sind mindestens 44 × 44 px groß.
- [ ] Hell- und Dunkelmodus folgen dem System und lassen sich in den Einstellungen umschalten.
- [ ] Der Abschnitt „Organisation“ ist nur für Admins sichtbar. Seit PLT-13 entscheidet `can()` in der API anhand der Rolle `admin` aus Zitadel.
- [ ] Alles ist per Tastatur bedienbar, mit logischer Tab-Reihenfolge und sichtbarem Fokus.
- [ ] Unbekannte Adressen zeigen die Nicht-gefunden-Seite.
- [ ] Alle Texte kommen aus der deutschen Übersetzungsdatei. Ein Test schlägt fehl, wenn ein Schlüssel fehlt.

## Nicht Teil dieser Funktion

- Inhalte der Bereiche (eigene Specs)
- Prompt-Fenster (PLT-12)
- Navigation für Lieferanten (Release 0.2)
- Englische Oberfläche (PLT-09)
- Suche (QS-05) und Benachrichtigungen
