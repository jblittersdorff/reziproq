# Spec Lieferantenliste

| Datei | Wohin |
|---|---|
| `LS-01.md` | `docs/specs/` (vorher prüfen, ob die Kennung frei ist; sonst nächste freie Nummer der Lieferantenliste nehmen) |
| `referenz/Lieferanten.dc.html` | ersetzt `docs/design/referenz/Lieferanten.dc.html` |
| `referenz/Header.dc.html` | nur zur Ansicht; ersetzt nichts, wenn die Fassung im Repo neuer ist |

Prompt für Claude Code:

> Lies `CLAUDE.md`, `docs/specs/LS-01.md`, `docs/glossar.md`, `docs/rechte.md` und `docs/design/designsprache.md`. Ersetze die Kartenansicht der Seite Lieferanten durch die Liste mit Detailleiste aus LS-01. Erst Abfrage und Tests, dann die Seite nach der Vorlage `docs/design/referenz/Lieferanten.dc.html`. Jedes Kriterium unter „Fertig, wenn“ bekommt einen Test. Arbeite lokal: kein `git push`, kein `gh`. Am Ende ein lokaler Commit und eine Liste offener Fragen.
