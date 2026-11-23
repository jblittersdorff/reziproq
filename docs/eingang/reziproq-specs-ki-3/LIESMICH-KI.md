# Specs KI und Agenten

| Datei | Wohin |
|---|---|
| `KI-01.md`, `KI-03.md`, `KI-04.md`, `KI-07.md`, `KI-08.md`, `KI-09.md`, `KI-11.md`, `KI-13.md`, `KI-15.md` bis `KI-23.md` | `docs/specs/` (`KI-01`, `KI-04`, `KI-07` ersetzen ältere Fassungen) |
| `WG-23.md` | ersetzt `docs/specs/WG-23.md` |
| `referenz/*.dc.html` | `docs/design/referenz/` (ersetzt `Header`, `Fragen`, `SupplierBar` und `Main`) |
| `ergaenzung-glossar-ki.md` | Inhalt in `docs/glossar.md` einfügen |
| `ergaenzung-rechte-ki.md` | Inhalt in `docs/rechte.md` einfügen |
| `ergaenzung-umsetzungsplan-ki.md` | Inhalt in `docs/umsetzungsplan.md` einfügen |

| Spec | Titel | Aufgabe des Einkäufers | Release |
|---|---|---|---|
| KI-01 | Modell-Gateway und Kontingent | Kern | K1 |
| KI-03 | Entwürfe und Quellen | Kern | K1 |
| KI-04 | Agenten und Läufe | Kern | K1 |
| KI-15 | Import und Zuordnung | Daten reinbekommen | K1 |
| KI-16 | Hinweise mit Frühwarnung | Wissen, wo man handeln muss | K1 |
| KI-11 | Wertpotenzial-Finder | Geld finden | K1 |
| KI-07 | Termin-Briefing: Ziele, Agenda, offene Fragen | Termine vorbereiten | K1 |
| KI-17 | Ergebnisse nach dem Termin | Vereinbartes festhalten | K1 |
| KI-08 | Agent Marktanalyse | Strategie der Warengruppe | K2 |
| KI-13 | Strategie-Autor | Strategie der Warengruppe | K2 |
| KI-18 | Dokumente und Fundstellen | Baustein für Verträge und Quellen | K2 |
| KI-19 | Vertragsleck | Geld finden | K2 |
| KI-20 | Szenarien | Entscheiden | K2 |
| KI-21 | Verhandlungsvorbereitung | Verhandeln | K2 |
| KI-22 | Quartalsbericht SRM | Wirkung nachweisen | K2 |
| KI-09 | Eigene Agenten | Eigene Abläufe | K3 |
| KI-23 | Hilfe für Lieferanten | Zusammenarbeit | K3 |

Gilt für alle Specs:
- Der Code rechnet und erkennt, die KI erklärt.
- Jede KI-Ausgabe ist ein Entwurf mit Quelle.
- Ein Lauf handelt mit den Rechten einer Person.
- Der Lieferant sieht nie private Daten.

Prompt für Claude Code, je Paket:

> Lies `CLAUDE.md`, `docs/specs/<Spec>.md`, `docs/glossar.md`, `docs/rechte.md` und `docs/design/designsprache.md`. Setze Paket <Paket> aus `docs/umsetzungsplan.md` um. Erst Datenmodell und Migration, dann Dienste mit Tests, dann Seiten. Jedes Kriterium unter „Fertig, wenn“ bekommt einen Test. Arbeite lokal: kein `git push`, kein `gh`. Am Ende ein lokaler Commit und eine Liste offener Fragen.
