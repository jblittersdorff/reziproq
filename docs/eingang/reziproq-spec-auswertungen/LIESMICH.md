# Spec Auswertungen

| Datei | Wohin |
|---|---|
| `AW-01.md` | `docs/specs/` (vorher prüfen, ob die Kennung frei ist) |
| `referenz/*.dc.html` | `docs/design/referenz/` (ersetzt gleichnamige Vorlagen; neu `KI-Wert-Detail`, `D-Diagramme`) |

Voraussetzungen: NAV-10 und die Designsprache mit den Abschnitten „Informationsdichte“, „Ringe“ und „Diagramme“ (aus `reziproq-designsprache.zip`).

Ergänzung für `docs/glossar.md`:

| Begriff | Bedeutung |
|---|---|
| Aussage | Satz von Reziproq oben auf einer Auswertung, nur aus belegten Fakten. Ohne Beleg wird er nicht angezeigt. |
| Beleg | Ringpaar oder Diagramm, das die Aussage beweist. |
| Fakten-Baukasten | Code je Seite, der die Zahlen für Aussage und Beleg mit den Rechten der Person liest. |
| Ziel des Lieferanten | EBIT-Ziel je Jahr und Beziehung, vom SRO vorgeschlagen, vom Lead freigegeben. |

Reihenfolge für Claude Code:
1. Diagramm-Bibliothek mit Storybook-Seiten oder Testseiten nach `D-Diagramme`.
2. `insight_summary` mit Fakten-Baukasten und Prüfung.
3. Die Seiten in der Reihenfolge der Tabelle.

Lokal arbeiten: kein `git push`, kein `gh`.

Prompt:

> Lies `CLAUDE.md`, `docs/specs/AW-01.md`, `docs/specs/NAV-10.md`, `docs/design/designsprache.md`, `docs/glossar.md` und `docs/rechte.md`. Baue zuerst die Diagramm-Bibliothek nach der Vorlage `docs/design/referenz/D-Diagramme.dc.html`, dann `insight_summary` mit Fakten-Baukasten, dann die Seiten aus AW-01 nach ihren Vorlagen. Die Logik der Seiten bleibt, nur die Darstellung ändert sich. Jedes Kriterium unter „Fertig, wenn“ bekommt einen Test. Arbeite lokal: kein `git push`, kein `gh`. Am Ende ein lokaler Commit und eine Liste offener Fragen.
