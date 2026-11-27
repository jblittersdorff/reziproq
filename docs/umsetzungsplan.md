# Umsetzungsplan: Reziproq KI-nativ (Kapitel 1 bis 8)

Ersetzt die Phasen 2 bis 10 des bisherigen Plans. Phase 1 (Modul-Schalter `org_module`, Design-Tokens, `AppShell`, Bausteine) bleibt Voraussetzung. Claims, Risiko und Vertrag sind nicht Teil des Plans (G-4).

## So wird gearbeitet

- Ein Paket je Sitzung. Reihenfolge wie unten; ein Paket beginnt erst, wenn die Tests seiner Voraussetzungen grün sind.
- Je Paket: erst Datenmodell und Migration, dann Dienste mit Tests, dann Seiten. Jedes Kriterium unter „Fertig, wenn“ der betroffenen Specs bekommt einen Test.
- Bildvorlagen: Canvas „Reziproq Plattform“ und `docs/design/referenz/`. Maßgeblich sind die Specs; Texte und Aufbau aus den Vorlagen, Zahlen aus dem Seed.
- Jedes Paket endet mit grünen Tests, Screenshots bei 390 und 1440 px und einem lokalen Commit. Kein `git push`, kein `gh` (G-1).
- Abweichungen zwischen Spec und Code werden gemeldet, nicht still überbrückt.

## Pakete

| Paket | Inhalt | Specs | Tests | Voraussetzung |
|---|---|---|---|---|
| **K0** | Prüfen: Specs gegen Code, Liste der Abweichungen und offenen Fragen. Kein Code. | alle | – | – |
| **K0-b** | Klärungen aus K0 festhalten (E-K0-01 bis E-K0-32): Statusköpfe der älteren Specs, CLAUDE.md, Umsetzungsnotizen der KI-Specs, Anpassungen in Specs und Designsprache. Kein Code | alle | – | K0 |
| **K1-a** | Datenräume, Status, Herkunft; `focus_item`, `worker_setting`, Felder an `org`; Migration; Uhr je Mandant als eine Funktion für alle Dienste und Jobs, dazu ein Test gegen das Lesen der Systemuhr außerhalb dieser Funktion (vorgezogen aus K1-b) | ZA-01, HE-01 (Daten), MA-01 (Daten), DM-01 (Uhr) | ZA-01 T1-ZA* | Phase 1, K0-b |
| **K1-c** | Triage, Satzprüfung (`sentence_facts`), `next_action` als Sicht auf `focus_item` | HE-01 | HE-01 Triage | K1-a |
| **K1-d** | Rahmen: Seitenleiste, Tab-Leiste, Frag Reziproq, Startseiten; Blatt (`Sheet`) und Test gegen Pop-ups mit fester Liste erlaubter Bausteine (E-K0-01); Weiterleitungen alt → neu für alle Routen in einer Tabelle aus dem Routenbaum | NAV-10, UX-20 | NAV-10 Rahmen, TN-07 | K1-c |
| **K2-h** | CI-Leitplanken, verkleinert: Build-Prüfungen T-CI1 bis T-CI3 (Palette und selbst ausgelieferte Schriften sind fertig) | Designsprache | T-CI1 bis T-CI3 | K1-d |
| **K1-e** | Heute (Fokus und Alles), Kurz prüfen, Erledigt mit Rücknahme, Warum, Fokus-Mappe | HE-01, UX-20 §1 | HE-01 | K1-d |
| **K1-f** | Mein Agent, KI-Einstellungen, Leitplanken-Tests | MA-01, KI-04 | MA-01 | K1-e |
| **K1-b** | Gateway-Modi (`fake`, `record`, `replay`, live), Seed Demo-Mandant Hollmann als eigener Mandant (E-K0-04), Demo-Sitzung je Person (E-K0-05). Liegt seit 24.11. direkt vor K1-g: nur die Demo-Regie braucht es | DM-01, KI-01 | DM-01 | K1-f |
| **K1-g** | Demo-Regie, Drehbuch „Morgen mit Reziproq“ als E2E-Test | DM-01 | Drehbuch K1 | K1-b, K1-f |
| **K2-a** | Zusagen (Migration der Maßnahmen), Akte-Daten, Row Level Security, Weiterleitungen | ZQ-01, AK-01, ZA-01 | ZQ-01, AK-01 Sicherheit | K1-g |
| **K2-b** | Beziehungen mit Linsen, Sortierung, Mini-Spiegel; Zusagequote | BZ-01, ZQ-01 | BZ-01 | K2-a |
| **K2-c** | Akte: Kopf, drei Sichten, Blätter, Aktionen am Objekt | AK-01, NAV-10 | AK-01 | K2-b |
| **K2-d** | Postfach, „Mail rein, Zusage raus“, Schreiben, Bestätigen per Link | PO-01, BL-01, KI-03, KI-15 | PO-01, BL-01 | K2-c |
| **K2-e** | Bewertung vorausfüllen, Segment-Mappe, Segment vorschlagen | BZ-01, KI-04, UX-20 §3 | BZ-01 Segmente | K2-d |
| **K2-f** | Feedback als Objekt, Spielregeln teilen, Einladung | AK-01, UX-20 §5 | AK-01 Feedback | K2-e |
| **K2-g** | Mandat, neue Zeilen in Mein Agent, Demo Kapitel 2 | MD-01, MA-01, DM-01 | MD-01, Drehbuch K2 | K2-f |
| **K3-a** | Termin-Datenmodell, Phase, Weiterleitungen | TE-01 | TE-01 Daten | K2-g |
| **K3-b** | Termin-Seite, Phase Vorbereiten, Briefing-Worker | TE-01, KI-07 | TE-01 | K3-a |
| **K3-c** | Agenda-Freigabe, Beiträge, Beitrag per Link, Erinnern | BE-01 | BE-01 | K3-b |
| **K3-d** | Dokumenten-Dienst, Deck, Prüfung vor dem Teilen | DK-01, KI-18 | DK-01 | K3-c |
| **K3-e** | Im Termin, Protokoll-Worker, Danach, Teilen und Bestätigen | PR-01, KI-17 | PR-01 | K3-d |
| **K3-f** | Demo Kapitel 3: Zeitsprünge, Rollen, Aufzeichnungen | DM-01 | Drehbuch K3 | K3-e |
| **K4-a** | Wert-Engine, Rechenregel, Baseline, Buchung | WK-01 | WK-01 Engine | K3-f |
| **K4-b** | Wert-Seite und Wertkonto mit Sichten | WK-01, NAV-10 | WK-01 Seiten | K4-a |
| **K4-c** | Mappe „Wirkung freigeben“ und Bestätigung durch das Controlling | WK-01 | WK-01 Freigabe | K4-b |
| **K4-d** | Wertfinder und Reibung | WK-01, KI-11 | WK-01 Finder | K4-a |
| **K4-e** | Gemeinsamer Plan und Initiative | GP-01 | GP-01 | K3-e, K4-a |
| **K4-f** | Wertbericht und „Monat vorspulen“ | WB-01, DM-01 | WB-01, Drehbuch K4 | K4-c, K4-d |
| **K5-a** | Räume und Rechte für Lieferanten-Nutzer, Agent-Kontext je Beziehung | LP-01, ZA-01 | LP-01 Sicherheit | K4-f |
| **K5-b** | Lieferantenseite: Heute, Akte, Kunden, Einladung | LP-01 | LP-01 | K5-a |
| **K5-c** | Deal-Objekt, Fassungen, Kennzeichnung | DL-01, AU-01 | DL-01 Objekt | K5-a |
| **K5-d** | Mandat-Prüfung und Bewertung je Seite | DL-01, MD-01, WK-01 | DL-01 Prüfung | K5-c |
| **K5-e** | Lieferanten-Agent, Kostenspanne, Vorlagen, Hilfe | LA-01 | LA-01 | K5-b |
| **K5-f** | Verdiente Autonomie | AU-01, MA-01 | AU-01 | K5-c |
| **K5-g** | Simulator und Zwei Fenster | SI-01 | SI-01, Drehbuch K5 | K5-d, K5-e |
| **K6-a** | Strategie-Modell, Versionen, Seite mit vier Teilen | ST-01 | ST-01 Daten | K5-g |
| **K6-f** | Warengruppen-Liste und Warengruppe | ST-01, NAV-10 | ST-01 Seiten | K6-a |
| **K6-b** | Autor: Entwurf erstellen und fortschreiben, Fragen ans Team | ST-01, KI-13 | ST-01 Autor | K6-f |
| **K6-c** | Freigabe-Mappe mit Wert der Strategie | ST-01, WK-01 | ST-01 Freigabe | K6-b |
| **K6-d** | Mandat-Vorschläge und Mandatsversionen | MV-01, MD-01 | MV-01 | K6-c |
| **K6-e** | Marktsignale und Abbildung auf Beziehungen | MS-01 | MS-01, Drehbuch K6 | K6-d |
| **K7-a** | Kanal-Grundlage: `channel_link`, `channel_action`, `channel_policy` | KA-01 | KA-01 Grundlage | K6-e |
| **K7-b** | Mail-Add-in | KA-01, PO-01 | KA-01 Mail | K7-a |
| **K7-c** | Kalender: Briefing am Termin, Agenda, Protokoll | KA-01, TE-01 | KA-01 Kalender | K7-a |
| **K7-d** | Chat-App: Tageslage, Freigabe-Karten | KA-01 | KA-01 Chat | K7-a |
| **K7-e** | Sprache mobil | KA-01 | KA-01 Sprache | K7-a |
| **K7-f** | Einstellung „Kanäle“ und Drehbuch Kanäle | KA-01, DM-01 | Drehbuch K7 | K7-b bis K7-e |
| **K8-a** | Hypothesen, Annahmen, Zielwächter, Wert-Pipeline; Warengruppe nach der Freigabe | WT-01, ST-01 | WT-01 | K7-f |
| **K8-b** | Modell der Warengruppe und Soll-Kosten, Roadmap-Anfragen | WZ-01, BE-01 | WZ-01 | K8-a |
| **K8-c** | Szenarien, Anteile-Rechner, Mappe „Anteile anpassen“, Weitergabe | SZ-01, MV-01 | SZ-01 | K8-a |
| **K8-d** | Vergabe: Shortlist, Anfragen je Akte, Angebote gegen Soll, Vergabe-Mappe | VG-01 | VG-01 Vergabe | K8-b, K8-c |
| **K8-e** | Verhandlung der Agenten, Lieferantenseite Anfrage | VG-01, LA-01, LP-01, AU-01 | VG-01 Verhandlung | K8-d |
| **K8-f** | Review nach Ausnahme | RV-01 | RV-01 | K8-a |
| **K8-g** | Drehbuch „Warengruppe steuert sich“, Simulator für Saar Circuits | DM-01, SI-01 | Drehbuch K8 | K8-e, K8-f |
| **Z** | Abnahme: alle Drehbücher aus DM-01 als E2E-Tests hintereinander, Sackgassen-Test, 390-px-Test über alle Seiten, Inventar-Tests aller Kapitel (`docs/inventar.md`) | alle | alle | K8-g |

## Stand

- K0 fertig am 24.11.2026 (Commit `5859a1e`, Bericht `docs/k0-abweichungen.md`).
- K0-b fertig am 24.11.2026 (Entscheidungen E-K0-01 bis E-K0-32 in `docs/entscheidungen.md`). C-02, C-07 und C-18 nachentschieden (E-K0-33 bis E-K0-35); Push des Arbeitsbranchs wieder erlaubt (E-K0-36).
- K1-a.1 fertig am 24.11.2026: Datenräume, Herkunft, Bestätigung, Token-Schutz, `focus_item`, `worker_setting`, Felder an `org` (ZA-01 T1-ZA1 bis T1-ZA6). 
- K1-a.2 fertig am 24.11.2026: Uhr je Mandant (`currentTime`, `app_now`), Wächter gegen die Systemuhr in Diensten und Jobs. Offen für K1-b: Zeitpläne der Worker und Jobs außerhalb einer Transaktion je Mandant, Demo-Uhr in der Oberfläche.
- K1-c fertig am 24.11.2026: Triage, Punktzahl mit Segmentgewicht, Satzprüfung, `next_action` mit der Uhr je Mandant, `GET /api/heute`, „Morgen erinnern“, Lauf um 06:00 (HE-01 T1-HE2, Daten von T1-HE1, NAV-10 TN-10). „Als Nächstes“ auf Start und Mein Tag kommt aus der Triage.
- K1-d.1 fertig am 24.11.2026: Seitenleiste und Tab-Leiste nach NAV-10 2.0, neue Adressen `/heute`, `/beziehungen`, `/wert`, `/mein-agent`, Startseite nach Rolle, Tabelle alt → neu für alle Routen mit 301 (`docs/weiterleitungen.md`).
- K1-d.2 fertig am 25.11.2026: Frag Reziproq als Überlagerung mit ⌘K von jeder Seite, Blatt, feste Liste erlaubter Überlagerungen im Test gegen Pop-ups (E-K0-01). Damit ist K1-d fertig. Eine Bausteinseite statt drei (`/design` und `/styleguide` gehen in `/bausteine` auf) steht nicht im Paket. Sie kommt als eigener kleiner Schritt K1-d.3 nach Go des Gründers.
- K2-h fertig am 25.11.2026: Prüfungen beim Bauen T-CI1 bis T-CI3 (Farben, Schriften, ein helles Thema) an den Quellen und am Build von App und Website, beschrieben in der Designsprache. 13 Farben außerhalb der Palette stehen jetzt auf Werten der Designsprache; Tailwind liest Tests nicht mehr nach Klassen ab.
- K1-e.1 fertig am 25.11.2026: Heute mit den Ansichten Fokus und Alles nach den Vorlagen Main und Heute-Alles (HE-01 T1-HE1, T1-HE5; T1-HE6 für Heute), `GET /api/heute/alles`, Datum in Berlin. Die Seite Mein Tag ist entfernt. Kurz prüfen (K1-e.2), Erledigt (K1-e.3), Warum und Fokus-Mappe (K1-e.4) folgen; bis dahin führen die Zeilen an die bisherigen Orte.
- K1-e.2 fertig am 25.11.2026: Kurz prüfen nach den Vorlagen K1-Kurz-Pruefen und K1-Kurz-Pruefen-Mobil (HE-01 T1-HE3, T1-HE6), Übernehmen über die Dienste der Module mit Herkunft reziproq am Objekt, Zuordnungen als Einträge. Agenda und Anfrage an den Lieferanten sind Freigaben im Fokus.
- K1-e.3 fertig am 25.11.2026: Erledigt mit Rücknahme nach der Vorlage Erledigt (HE-01 T1-HE4). Handlungen auf Erledigen sind Läufe mit `undo_payload`; die automatische Zuordnung von Terminen ist die erste. Neu eingegangen geht in Kurz prüfen, Erledigt und Anbindungen auf.
- K1-e.4 fertig am 25.11.2026: Warum zu Hinweis, Lauf und Fokus-Thema (Vorlage K1-Warum) und Fokus-Mappe (Vorlage K1-Mappe); die Hinweisseiten gehen in Alles und Warum auf. Damit ist K1-e fertig. Offen: Aufträge in Frag Reziproq als Mappe, Entwurf oder Erinnerung (UX-20 Ablauf 1, NAV-10 TN-08).
- K1-f.1 fertig am 25.11.2026: Stufen je Person mit Obergrenze und An/Aus der Organisation (`ai_workers`), `GET/PUT /api/mein-agent`. Das Postfach hält sich an alle drei Stufen, eine ausgeschaltete Aufgabe startet keinen Lauf und ruft kein Modell auf (MA-01 T1-MA1, T1-MA3, T1-MA4). Mein Agent bietet nur Stufen an, die heute wirken. Es folgen Leitplanken mit Token (K1-f.2), die Seite Mein Agent (K1-f.3) und die KI-Einstellungen ohne die Seite Agenten (K1-f.4).
- K1-f.2 fertig am 25.11.2026: Leitplanken mit Bestätigungs-Token. Jedes bindende Werkzeug läuft durch `runTool` und nur mit dem Token der Person für genau dieses Werkzeug und Objekt (`app_use_confirm_token`, Migration 0135). Ohne Token entsteht ein Entwurf als Freigabe oder Entscheidung im Fokus, und der Lauf bricht ab (MA-01 T1-MA2, ein Test je Werkzeug).
- K1-f.3 fertig am 25.11.2026: Seite Mein Agent nach der Vorlage Mein-Agent. Je Aufgabe gibt es einen Schalter mit gesperrten Stufen, dazu die Quote, „Nie automatisch“ und „Wer sieht was“. Die Bausteine `SegmentedControl` (gesperrte Optionen) und `Row` (`control`) sind erweitert. Die alte Agenten-Liste unter `/mein-agent` ist abgelöst.
- K1-f.4 fertig am 25.11.2026: KI-Einstellungen an der Vorlage E-KI ausgerichtet, mit dem neuen Abschnitt „Aufgaben von Reziproq“ (An/Aus, beim Postfach Obergrenze) und dem Protokoll. Inventar T1-I13 ist erledigt. Als eigener Schritt K1-f.5 folgen das Entfernen der Seite Agenten und der eigenen Agenten sowie die Weiterleitungen (E-K0-13, T1-MA5).
- K1-f.5 fertig am 25.11.2026: keine Seite Agenten mehr. Der Lauf steht im Warum, alte Adressen leiten mit 301 nach Mein Agent oder ins Warum (MA-01 T1-MA5). Eigene Agenten sind aus, die Tabellen bleiben (E-K0-13). Damit ist K1-f fertig.
- K1-b.1 fertig am 25.11.2026: Gateway-Modi `fake`, `record`, `replay` und live nach `org.ai_mode`, mit Aufzeichnung `model_call_recording` (IDs als Platzhalter) nur im Demo-Mandanten. Umschalten ist nur dort möglich, auch in den KI-Einstellungen (DM-01 T1-DM1). Es folgen Demo-Sitzung (K1-b.2), Seed Hollmann (K1-b.3) und Uhr-Reste (K1-b.4).
- K1-b.2 fertig am 25.11.2026: Demo-Sitzung je Person ohne Zitadel (E-K0-05). `/demo/als/<Person>` funktioniert nur für Personen eines Demo-Mandanten, nur mit `DEMO_SESSIONS=true` und nie im Betrieb. Das Token signiert ein Schlüssel im Speicher, und jeder Tab hat seine eigene Sitzung.
- K1-b.3 fertig am 25.11.2026: Seed des Demo-Mandanten Hollmann (`pnpm demo:hollmann`, E-K0-04, G-10). Er enthält acht Personen, 16 Lieferanten mit den Zahlen der Vorlage Beziehungen (30,1 Mio. € Spend 2026), die Ansprechpartner von Rheintal und Saar, Halder Maschinenbau, Warengruppen und den JBP Rheintal am Fr 04.12. Die Uhr steht auf Mo 23.11., 07:30, der Modus auf Abspielen. Den Stand der Drehbücher legt K1-g an.
- K1-b.4 fertig am 25.11.2026: Uhr je Mandant auch in Jobs über Mandanten (`inOrgClock`) und in der Oberfläche. Die API nennt die Fachzeit im Kopf `x-reziproq-jetzt`, die Oberfläche rechnet mit `appNow`, und ein Wächter-Test verbietet die Systemuhr bis auf Technik.
- K1-b.5 fertig am 26.11.2026: Schon das erste Bild nach dem Demo-Einstieg rechnet mit der Demo-Uhr. Der Start der Sitzung nennt die Fachzeit, und die Oberfläche hält den Versatz je Tab, aber nur in einer Demo-Sitzung. Die Oberflächen von K1-b sind im Browser bei 390 und 1440 px geprüft. Zwei Web-Tests rechnen „heute“ jetzt nach Ortszeit statt nach UTC. Den gleichen Fehler in Mein Tag führt B-33 in `docs/k0-abweichungen.md`.
- K1-g: Umfang am 26.11.2026 mit dem Gründer geklärt. Die Schritte 5 bis 7 des Drehbuchs K1 brauchen Wert-Engine und Reibung (K4-a, K4-d) und stehen im Test als „folgt mit K4“. Die Mail in Erledigt mit Zurücknehmen baut K1-g mit.
- Demo-Mandant umbenannt am 26.11.2026 (Wunsch des Gründers): Hollmann Antriebe statt Nordwind, überall in Code, IDs, Adressen, Befehl (`pnpm demo:hollmann`), Doku und Bildvorlagen. Die Einträge oben nennen deshalb schon den neuen Namen.
- Nur ein `pnpm dev` zur Zeit, seit 26.11.2026: `scripts/dev-guard.mjs` bricht bei belegtem Port ab, und `pnpm dev:stop` beendet alle Dev-Prozesse des Projekts.
- K2-b.3 fertig am 27.11.2026: API der Seite Lieferanten. `GET /api/beziehungen` liefert die Liste nach Aufmerksamkeit mit Chips, Mini-Spiegel und Das Wichtigste, `GET /api/beziehungen/segmente` die Matrix über das Portfolio; dazu „Als Nächstes“ mit `bereich=beziehungen` (BZ-01 T2-01 bis T2-03 im API-Test). Der Seed von Hollmann ist regelfest: Ein Lauf der Regeln legt keinen offenen Hinweis an (B-39). Die Seite selbst baut K2-b.4.
- K2-b.2 fertig am 27.11.2026: Portfolio im Demo-Mandanten Hollmann. Es umfasst 46 Lieferanten, davon 16 aktive Beziehungen (E-K2-10). Das Modell ist 2 × 2, und die Segmente stehen bei 8, 9, 9 und 12. Kessler ist strittig; Fokus und Zusagequoten folgen der Vorlage (BZ-01, Umsetzung).
- K2-b.1 fertig am 27.11.2026: Segmentmodell 2 × 2 oder 3 × 3 je Kunde (E-K0-33). Die Achsen tragen eigene Namen. Bei 2 × 2 gibt es eine Grenze und vier Typen; das Raster ist in den Einstellungen änderbar (SEG-01, Umsetzung).
- K2-b: Umfang am 27.11.2026 (Go des Gründers): Lieferanten mit den Linsen Liste und Segmente, Sortierung nach Aufmerksamkeit, Mini-Spiegel der Zusagequoten (BZ-01 T2-01 bis T2-03). Vorher kommt das Segmentmodell 2 × 2, das die Linse Segmente für Hollmann braucht (E-K0-33). Die Karten der Bewertungsrunde bringt K2-e.
- K2-a.6 fertig am 27.11.2026: Wörter und Weiterleitungen. „Maßnahme“ kommt in der Oberfläche nicht mehr vor (B-36). Die Weiterleitung der alten Maßnahmen-Seiten in die Akte schaltet K2-c ein; bis dahin bleiben sie unter ihren Adressen (`docs/weiterleitungen.md`). Damit ist K2-a fertig.
  - Erledigt: ZQ-01 T2-ZQ1, T2-ZQ2, T2-05; AK-01 T2-S01, T2-S03.
  - Offen mit späteren Paketen: T2-09 (Akte K2-c, Ersatz aus der Mail K2-d) und T2-ZQ3 (Aufgabe „Zusagen nachhalten“, K2-b).
  - Offene Befunde: B-35 („Brauchen dich“ nennt die Art als Wort) und der Rest von B-33.
- K2-a.5 fertig am 27.11.2026: Zusagen 2026 im Demo-Mandanten Hollmann. Hollmann hält 9 von 10 (90 %), Rheintal 7 von 9 (78 %), dazu sechs offene wie in L-Ueberblick. T2-05 ist mit den Zahlen von Rheintal belegt (78 → 70 %).
- K2-a.4 fertig am 26.11.2026: Sicherheit der Akte. T2-S01: Keine Abfrage der Käuferseite liefert eine Zeile im Raum `supplier_private`; geprüft über den abgeleiteten Raum, denn eine Spalte `space` hat nur `task`. T2-S03: Notizen „Nur ich“ sieht nur die Autorin, auch nicht über Frag Reziproq. Ohne Tabelle `shared_item` (E-K2-9).
- Feste Vorschau seit 26.11.2026 (Go des Gründers): `pnpm vorschau` zeigt unter localhost:5173 den letzten grünen Commit. Sie läuft aus einem eigenen Worktree neben dem Repo mit eigener Datenbank `reziproq_vorschau`, frisch aus dem Seed, und nicht im Watch-Modus. Demo-Sitzungen überstehen einen Neustart (`DEMO_SESSION_SECRET`). Grund: Der Gründer sah die Testdaten nicht immer, weil seine App aus der Arbeitskopie lief und bei jeder Änderung neu startete.
- Namen geändert am 26.11.2026 auf Wunsch des Gründers (E-K2-8): Die Hauptpunkte heißen Lieferanten statt Beziehungen und Ergebnisse statt Wert, ebenso Seitentitel, Zurück-Links und „Meine Lieferanten“. Die Adressen `/beziehungen` und `/wert` bleiben. Die Tab-Leiste gibt jedem Ziel nun mindestens 44 px statt 60 px Breite, damit die längeren Namen bei 390 px nicht aneinanderstoßen.
- K2-a.3 fertig am 26.11.2026: Maßnahmen umgezogen (Migrationen `0143`, `0144`, T2-ZQ1).
  - Geteilte Maßnahmen sind Zusagen, interne sind Aufgaben, mit denselben IDs. Die Tabelle `action` entfällt.
  - Die alten Seiten heißen „Zusagen und Aufgaben“: Status je Art, „Gehalten“ mit Beleg, im Formular die Art statt der Sichtbarkeit.
  - Offen: weitere Texte mit „Maßnahme“ (B-36) und der Grund „fällig“ in der Lieferantenliste (B-35).
- K2-a.2 fertig am 26.11.2026: Regeln der Zusagen.
  - „Gehalten“ nur mit Beleg (T2-ZQ2), in der Datenbank und in der API. Der Gemeinsame Plan fragt in der Zeile nach dem Beleg, und die Termin-Ergebnisse buchen den Termin als Beleg.
  - Ersatz nach E-K2-2 und die Quote je Seite.
  - Der Knopf „Erledigt“ an der Teams-Karte entfällt (C-18).
- K2-a.1 fertig am 26.11.2026: Datenmodell der Zusagen und Aufgaben (Migration `0141`). Zusagen hängen an der Beziehung, und beide Seiten ändern ihren Status. Aufgaben sieht nur die eigene Organisation. Noch ohne Migration der Maßnahmen.
- K2-a: Umfang am 26.11.2026 mit dem Gründer geklärt. K2-a stellt ganz um: Die Tabelle der Maßnahmen entfällt, und die alten Maßnahmen-Seiten zeigen bis K2-c Zusagen und Aufgaben. Die Status speichert die Datenbank englisch.
- K1-g.5 fertig am 26.11.2026: Drehbuch K1 als E2E-Test gegen die echte API. Die Schritte 1 bis 4 und 8 bis 10 laufen zweimal hintereinander gleich; 5 bis 7 folgen mit K4. Damit ist K1-g fertig. Dabei behoben: Der Briefing-Entwurf im Seed ließ sich nicht übernehmen, und die Begründung auf Stufe Vorbereiten war falsch (B-34).
- K1-g.4 fertig am 26.11.2026: Demo-Regie unter `/demo`, in einer Demo-Sitzung mit ⌥D. Sie enthält Szenario, Signal „Mail von Kim Kaiser“, Zeit, Rolle, Gegenüber, Antworten der KI und Zurücksetzen. Was erst spätere Pakete bauen, steht als „folgt mit …“ da, nicht als Knopf.
- K1-g.3 fertig am 26.11.2026: Stand für Drehbuch K1 im Seed von Hollmann. Jan-Luka hat um Mo 23.11., 07:30 drei Fokus-Themen, vier Entwürfe in Kurz prüfen und 14 Vorgänge in Erledigt (Abweichungen von den Vorlagen in DM-01). Dabei behoben: Ergebnis-Entwürfe hießen in Kurz prüfen „action“ oder „decision“ statt ihres Titels.
- K1-g.2 fertig am 26.11.2026: Mail in Erledigt mit Zurücknehmen (HE-01 Dienst 3), die offene Lücke aus K1-f. Auf Stufe Erledigen legt das Postfach die Mail über den Eingang ab; Zurücknehmen legt sie wieder unter „Zuordnen“.
- K1-g.1 fertig am 26.11.2026: Regie-API (`/api/demo/regie`) mit Zeit und fälligen Läufen (T1-DM5), Zurücksetzen auf den Stand „start“ aus dem Seed, Protokoll `demo_event`, 404 außerhalb des Demo-Mandanten.
- K1-b.6 fertig am 26.11.2026: Frag Reziproq folgt dem Demo-Modus. Aufzeichnen und Abspielen gelten auch für gestreamte Antworten, abgespielt ohne Tokens und Kosten. Damit ist K1-b fertig. Offen für K1-g: „Neuer Tag“ und „Auf Datum springen“ stoßen die Jobs für den Demo-Mandanten an.
- Reihenfolge am 24.11. auf Wunsch des Gründers geändert: K1-b (Demo-Technik) kommt nach K1-f, direkt vor K1-g; zuerst die sichtbaren Pakete K1-c bis K1-f.
- Aufgeräumt am 24.11.: `pnpm check` von rund 9 auf gut 4 Minuten (`docs/altlasten-tests.md`).
- Geändert nach K0 (Abschnitt f des Berichts): K0-b neu; Uhr je Mandant von K1-b nach K1-a; K2-h verkleinert und nach K1-d gezogen; Weiterleitungen gesammelt in K1-d.

## Parallel: Pilotpfad (E-K0-14)

Läuft neben den Paketen, sobald Zugänge oder Budget des Gründers da sind:

| Schritt | Inhalt | Voraussetzung |
|---|---|---|
| D | Durchstich: echte Schnittstellen von Zitadel und Microsoft 365 ohne AWS | Testmandant Microsoft 365 und Zitadel-Zugang des Gründers |
| C1 | Testumgebung AWS EU über OpenTofu (`infra/`) | K2-g |
| C2 | Zitadel produktiv mit Firmenanmeldung | C1, D |
| C3, C5 | Bedrock EU, Maildienst EU | C1 |
| C4 | Microsoft Graph und Kalender echt | C1, D |
| C6 | Pilot mit echten Konten | C1 bis C5 |

Der frühere Plan ruht (E-K0-15): Die Schritte 32 und 33 gehen in ST-01 auf, 35 (KI-19) entfällt, 36 und 37 gehen in DL-01 und SZ-01 auf, 38 in WB-01, 39 in LA-01, 34 (KI-18) wird Teil von K3-d; 31b wird nicht gebaut. Seine Fassung steht in Git (Commit `77cc620`).

## Prompt je Paket

> Lies `CLAUDE.md`, `docs/umsetzungsplan.md`, `docs/entscheidungen.md`, `docs/glossar.md`, `docs/rechte.md`, `docs/design/designsprache.md` und die Specs des Pakets aus der Tabelle. Setze Paket <Paket> um: erst Datenmodell und Migration, dann Dienste mit Tests, dann Seiten nach den Bildvorlagen in `docs/design/referenz/`. Prüfe den vorhandenen Code, bevor du änderst, und nenne Abweichungen, statt sie still zu überbrücken. Regeln G-1 bis G-10 aus `docs/entscheidungen.md` gelten immer. Jedes Kriterium unter „Fertig, wenn“ der Specs bekommt einen Test. Arbeite lokal: kein `git push`, kein `gh`, keine Zugangsdaten im Repo. Am Ende ein lokaler Commit, Screenshots bei 390 und 1440 px und eine Liste offener Fragen.

## Tabellen und wo sie definiert sind

| Tabelle oder Sicht | Spec |
|---|---|
| Spalten `space`, `confirm_state`, `origin` an allen geteilten Objekten; `confirm_link` | ZA-01, BL-01 |
| `focus_item` (mit `sentence_facts`), `ai_draft` (Felder `review_seconds`, `review_order`), `agent_run` (`undo_payload`, `undone_at`, `undone_by`) | HE-01, KI-03, KI-04 |
| `worker_setting`, Registry `agent` (`allowed_levels`, `default_level`, `review_seconds`, Werkzeuge mit `binding`) | MA-01, KI-04 |
| `org.is_demo`, `org.ai_mode`, `org.demo_now`, `model_call_recording`, `demo_event` | DM-01, KI-01 |
| `user_setting.start_page`, Sichten `next_action`, `timeline_item` | NAV-10 |
| `commitment` (erweitert), `task`, Sicht `commitment_rate`, `rating`, `feedback_wave`, `shared_item` (erweitert) | ZQ-01, AK-01, BZ-01 |
| `mandate`, `mandate_version` (neu in Kapitel 6) | MD-01, MV-01 |
| `mail_message` | PO-01 |
| `meeting` (Felder), `meeting_goal`, `agenda_item`, `contribution`, `deck`, `slide`, `capture_item`, `transcript` | TE-01, BE-01, DK-01, PR-01 |
| `initiative`, `value_rule`, `value_booking`, Sicht `value_account`, `value_potential`, `friction_event`, `friction_rate`, `relationship_yield`, `value_report` | WK-01, WB-01 |
| `plan_version` | GP-01 |
| `deal`, `deal_offer`, `deal_message`, `mandate_check`, `deal_valuation` | DL-01 |
| `cost_range`, `supplier_friction` | LA-01 |
| `relationship_member`, `supplier_approval_rule`, `invitation`, `customer_rating` | LP-01 |
| `supplier_template` | LA-01 |
| `autonomy_offer`; Feld `ai_draft.author_kind` | AU-01 |
| `sim_run`; Felder `demo_event.script`, `step`, `actor` | SI-01 |
| `strategy_version`, `strategy_part`, `strategy_item`, `strategy_signoff`, `team_question` | ST-01 |
| `mandate_proposal` | MV-01 |
| `market_source`, `market_signal` | MS-01 |
| `channel_link`, `channel_action`, `channel_policy`, `channel_user_setting`; Registry-Feld `binding_scope` | KA-01 |
| `hypothesis`, `assumption`, `assumption_check`, `certainty_change`, `goal_watch`, Sicht `strategy_pipeline` | WT-01 |
| `should_cost_model`, `should_cost_line`, Sicht `should_cost_gap` | WZ-01 |
| `scenario_run`, `share_decision`; Feld `mandate_proposal.from_share_decision` | SZ-01, MV-01 |
| `sourcing_event`, `sourcing_invite`, `sourcing_offer`, `sourcing_evaluation`, `negotiation_frame`, `negotiation_round`, `supplier_negotiation_setting`, `sourcing_award` | VG-01 |
| `review_pack` | RV-01 |
