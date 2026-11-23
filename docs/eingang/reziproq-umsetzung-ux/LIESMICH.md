# Übergabe an Claude Code: neue Oberfläche (ohne Claims, Risiko, Vertrag)

## Ablage im Repo

| Datei | Wohin |
|---|---|
| `NAV-10.md` | ersetzt `docs/specs/NAV-10.md` |
| `UX-20.md` | neu: `docs/specs/UX-20.md` (vorher prüfen, ob die Kennung frei ist) |
| `designsprache.md` | ersetzt `docs/design/designsprache.md` |
| `referenz/*.dc.html` | `docs/design/referenz/` (gleichnamige ersetzen, `Header.dc.html` dort löschen) |
| `PROMPTS.md` | `docs/plan/ux-umsetzung.md` |

Die Vorlagen sind Bildvorlagen für Aufbau, Texte und Werte, kein Code zum Übernehmen. Maßgeblich sind die Specs.

Nicht enthalten, weil nicht Teil der Umsetzung: alle Seiten zu Claims (`C-*`), Risiko (`R-*`) und Vertrag (`V-*`), verworfene Varianten (`L-Var-*`, `U-Var-*`) und die alte Live-Ansicht `U-Termin`.

## Reihenfolge

Eine Phase je Sitzung. Jede Phase endet mit grünen Tests, Screenshots bei 390 und 1440 px und einem lokalen Commit.

| Phase | Inhalt | Warum hier |
|---|---|---|
| 0 | Prüfen: Specs gegen Code, Liste der Abweichungen und offenen Fragen. Kein Code. | Claude Code kennt den Stand im Repo besser als die Vorlagen. |
| 1 | Modul-Schalter `org_module`, Design-Tokens, `AppShell`, alle Bausteine aus UX-20 mit Storybook oder Testseite | Alles Weitere baut darauf auf. |
| 2 | Navigation, Weiterleitungen, Übersicht, Mein Tag, Aufgaben, Hinweise, Sichten `next_action` und `timeline_item` | Erster sichtbarer Wert, prüft die Bausteine. |
| 3 | Lieferanten: Liste, Überblick, Profil, Lieferantenkopf | Rahmen für alle Lieferantenabläufe. |
| 4 | Beziehung: Team, Einladen, Spielregeln, Beziehungsnetz, Feedback-Ablauf | Abgeschlossen und überschaubar, guter Test für `ProcessChain`. |
| 5 | Segmentierung: Runde bis Portfolio | |
| 6 | Termine, Aktivitäten, Maßnahmen | Voraussetzung für das JBP. |
| 7 | JBP-Termin: Briefing bis Protokoll, Lieferantenseite K-* | Größter Ablauf, braucht 3 bis 6. |
| 8 | Gemeinsamer Plan, Lieferantenplan, Ergebnis, Wertpotenziale | |
| 9 | Warengruppen: Liste, Überblick, zehn Schritte, Kopf und Ablauf-Leiste | Nach dem Lieferantenmanagement, wie vereinbart. |
| 10 | Abnahme: E2E-Tests aller Abläufe aus UX-20, Sackgassen-Test, 390-px-Test über alle Seiten | |

## Regeln für jede Phase

- Lokal arbeiten: kein `git push`, kein `gh`, keine GitHub Actions. Keine Zugangsdaten ins Repo.
- Lieferanten sehen nie private Daten. Wirkungsarten werden in der Oberfläche nie addiert.
- Claims, Risiko und Vertrag nicht bauen. Was in den Vorlagen darauf verweist, hängt am Modul-Schalter und erscheint nicht.
- Texte aus den Vorlagen übernehmen. Zahlen kommen aus den Daten, nie fest im Code.
