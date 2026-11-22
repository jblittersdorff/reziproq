# Spec Navigation

| Datei | Wohin |
|---|---|
| `NAV-10.md` | `docs/specs/` (vorher prüfen, ob die Kennung frei ist) |
| `referenz/*.dc.html` | `docs/design/referenz/` (ersetzt `Header`, `SupplierBar`, `GroupBar`, `Main`; neu `Uebersicht`, `L-Notizen`, `D-Diagramme`)
| `designsprache.md` aus `reziproq-designsprache.zip` | ersetzt `docs/design/designsprache.md` (neu: Ringe, Diagramme, Informationsdichte) | |

Ergänzung für `docs/glossar.md`:

| Begriff | Bedeutung |
|---|---|
| Übersicht | Hauptpunkt mit den Ergebnissen des ganzen Programms. Startseite für Lead und Admin. |
| Mein Tag | Hauptpunkt mit allem, was die Person heute tun muss. Ersetzt Start. Startseite für alle anderen Käufer. |
| Ergebnisse | In der Oberfläche der neue Name für Wirkung: gesicherter Wert, Wertpotenziale, Feedback. |
| Aktivitäten | Verlauf je Lieferant aus Terminen, Notizen, Mails, Transkripten, Dateien, Hinweisen und Einträgen von Reziproq. |
| Von Reziproq vorbereitet | Block in Mein Tag mit offenen Entwürfen der Agenten für die Person. |

Hinweise für Claude Code:
- Specs, die „Start (NAV-05)“ nennen, meinen ab jetzt Mein Tag.
- Erst Weiterleitungen und Tests, dann Kopfzeile und Leisten, dann Übersicht und Mein Tag, zuletzt Aktivitäten.
- Lokal arbeiten: kein `git push`, kein `gh`.

Prompt:

> Lies `CLAUDE.md`, `docs/specs/NAV-10.md`, `docs/specs/LS-01.md`, `docs/glossar.md`, `docs/rechte.md` und `docs/design/designsprache.md`. Setze die neue Navigation nach NAV-10 um, mit den Vorlagen aus `docs/design/referenz/`. Erst Weiterleitungen und Tests, dann Kopfzeile, Lieferantenleiste und Warengruppenleiste, dann Übersicht und Mein Tag, zuletzt Aktivitäten mit `note` und `activity_feed`. Jedes Kriterium unter „Fertig, wenn“ bekommt einen Test. Arbeite lokal: kein `git push`, kein `gh`. Am Ende ein lokaler Commit und eine Liste offener Fragen.
