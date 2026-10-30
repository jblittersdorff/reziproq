# Specs Release 0.1 – Plattform-Grundlagen

Diese zwölf Specs bauen das Fundament von Reziproq: Oberfläche, Anmeldung, Organisationen, Datentrennung, Verlauf, Lieferanten, Rollen, Stammdaten, Import, Sprachen und das Prompt-Fenster. Danach folgt die Segmentierung (SEG-01 bis SEG-06), der zweite Teil von Release 0.1.

## Reihenfolge und Abhängigkeiten

| # | Spec | Funktion | Braucht vorher | Strang | Status |
|---|---|---|---|---|---|
| 1 | PLT-10 | Design und Styleguide | – | A Oberfläche | offen |
| 2 | PLT-11 | App-Rahmen und Startseite | PLT-10 | A Oberfläche | offen |
| 3 | PLT-01 | Anmeldung und Abmeldung | – | C Fachdaten | PR offen |
| 4 | PLT-02 | Organisationen, Nutzer, Mandanten-Session | PLT-01 | B Fundament | offen |
| 5 | PLT-04 | Drei Datenebenen | PLT-02 | B Fundament | offen |
| 6 | PLT-08 | Audit-Trail | PLT-04 | B Fundament | offen |
| 7 | PLT-03 | Beziehungen und Lieferantenliste | PLT-02, PLT-04, PLT-08, PLT-11 | C Fachdaten | offen |
| 8 | PLT-05 | Rollen und Rechte | PLT-03 | B Fundament | offen |
| 9 | PLT-06 | Business Units und Warengruppen | PLT-03, PLT-05 | C Fachdaten | offen |
| 10 | PLT-07 | Import per Excel und CSV | PLT-06 | C Fachdaten | offen |
| 11 | PLT-09 | Deutsch und Englisch | PLT-11 | A Oberfläche | offen |
| 12 | PLT-12 | Prompt-Fenster | PLT-03, PLT-05, PLT-06 | A Oberfläche | offen |

Erlaubte Werte für Status: offen, in Arbeit, PR offen, fertig.

**Drei Stränge, einer je Gründer:**

- **A Oberfläche:** PLT-10 → PLT-11 → PLT-09 → PLT-12
- **B Fundament:** PLT-02 → PLT-04 → PLT-08 → PLT-05
- **C Fachdaten:** PLT-01 → PLT-03 → PLT-06 → PLT-07

C wartet mit PLT-03, bis B PLT-08 gemergt hat. B wartet mit PLT-05, bis C PLT-03 gemergt hat. A wartet mit PLT-12 auf PLT-06.

## Was gilt für jede Spec

- Eine Spec ergibt einen Branch und einen Pull Request. Ein zweiter Gründer prüft und merged.
- „Fertig, wenn“ sind die Akzeptanzkriterien. Je Kriterium schreibt Claude Code einen Test.
- Jede neue Tabelle kommt ins Register der Datenebenen (PLT-04). Die Tests zur Datentrennung laufen dann automatisch mit.
- Jedes Beispiel nutzt nur erfundene Firmen mit der Endung „(Demo)“, keine echten Namen oder Zahlen.
- Für jede Arbeit an der Oberfläche gelten Styleguide (PLT-10) und Skill `ui-design`.
- Ändert sich beim Bauen etwas an der Spec, wird zuerst die Spec angepasst und im selben Pull Request mitgeschickt.

## Neu gegenüber der Anforderungsliste

- **PLT-11 App-Rahmen** und **PLT-12 Prompt-Fenster** sind neu und gehören in die Liste.
- **PLT-02** ist auf Organisationen, Nutzer und Mandanten-Session geschnitten. Die Lieferantenliste aus der Fassung vom 29.10.2026 steht jetzt in **PLT-03**.
- **P&L-Impact** steht in der Anforderungsliste inzwischen in Release 0.3. PLT-11 zeigt das so an.
