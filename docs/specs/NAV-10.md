# NAV-10 Navigation und Seitenrahmen

Version 2.0 · alle Kapitel · Pakete K1-d (Rahmen), ergänzt in K2-c, K3-b, K4-b, K5-b, K6-f, K7-e · baut auf ZA-01, HE-01, MA-01 · **ersetzt Version 1.1** und NAV-05 (Start) · Bildvorlagen: Main, Fragen, A-MeinTag, Heute-Alles, A-Uebersicht, A-Lieferanten, A-Lieferant, A-Lieferant-Desktop, A-Warengruppen, A-Warengruppe, L5-Heute

> **Klärungen aus K0 (24.11.2026, `docs/entscheidungen.md`):** Erlaubte Überlagerungen: Blatt, „Frag Reziproq“ mit ⌘K, die Dialoge „So teilen“ und „Agenda freigeben“; alles andere bleibt verboten (E-K0-01). Seitenleiste so hoch wie der Bildschirm (E-K0-02). Termin und Gemeinsamer Plan haben keinen Akte-Kopf (E-K0-25).

## Änderungen gegenüber 1.1

- Hauptpunkte heißen Heute, Beziehungen, Warengruppen, Wert. Mein Tag wird Heute (HE-01), Übersicht wird Wert (WK-01), Lieferanten werden Beziehungen (BZ-01).
- „Suchen oder fragen“ wird **Frag Reziproq**: suchen, fragen und Aufträge geben.
- Neu in der Seitenleiste: Zeile „Im Hintergrund“ und **Mein Agent** (MA-01). Die Seite Agenten entfällt.
- Die Karte „Als Nächstes“ liest aus `focus_item` (HE-01). Neu ist „Zusammengefasst von Reziproq“ mit belegten Zahlen.
- Eine Seite gibt es nur für ein Objekt, eine Entscheidung (Mappe) oder eine Einstellung (G-8). Ablauf-Leiste, Schrittseiten und die vier Bereiche im Lieferantenkopf entfallen; an ihre Stelle treten Sichten, Blätter, Mappen und Kurz prüfen.
- Terminschiene und Lagebild mit Risiko- und Claims-Karte entfallen (G-4); Termine stehen in Heute und an den Objekten.
- Der Lieferant hat eine eigene Navigation mit denselben Bausteinen (LP-01).

## Ziel

Auf jeder Seite weiß die Person, ohne zu suchen: wo sie ist, was gerade dran ist (genau eine Karte „Als Nächstes“) und was Reziproq schon erledigt oder vorbereitet hat. Jede Seite wird zuerst für 390 px gebaut und dann für den Desktop erweitert.

| Hauptpunkt | Frage | Spec |
|---|---|---|
| **Heute** | Was braucht heute mich? | HE-01 |
| **Beziehungen** | Wie steht es mit Lieferant X? | BZ-01, AK-01 |
| **Warengruppen** | Steht meine Strategie? | ST-01 |
| **Wert** | Was haben wir erreicht? | WK-01 |

Reziproq ist kein Menüpunkt. Es erscheint als „Entwurf von Reziproq“, „Zusammengefasst von Reziproq“, in Erledigt, als Kennzeichnung an Nachrichten (AU-01) und in Frag Reziproq. Was Reziproq je Aufgabe selbst tun darf, stellt jede Person in Mein Agent ein.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer, alle mit Zugriff | alle vier Hauptpunkte; jede Zahl und Zeile nur zu Beziehungen und Warengruppen, die die Person sehen darf |
| Lead, Admin | starten in Wert (E-K1-1) |
| alle anderen Käufer | starten in Heute |
| jede Person | eigene Startseite in den Einstellungen ändern (`wert`, `heute`) |
| Lieferant | Heute, Kunden, Frag, Mein Agent, Einstellungen; keine Warengruppen, kein Wert (LP-01) |
| Gast per Link | nur die Seite des Links (BL-01, BE-01), ohne Rahmen |

## Rahmen

**Seitenleiste** (ab 761 px): 236 px, Fläche `#eceeea`, so hoch wie der Bildschirm; sie scrollt nicht mit, nur der Inhalt scrollt (E-K0-02). Von oben: Logo (zur Startseite), Feld „Frag Reziproq“ mit ⌘K, Heute mit Zahl der offenen Fokus-Themen, Beziehungen, Warengruppen, Wert; Abstand; Zeile „Im Hintergrund: …“ (13 px, Punkt Petrol, zeigt einen laufenden Lauf; Klick öffnet Erledigt); Mein Agent; Einstellungen; Person mit Initialen. Aktiver Punkt weiß mit leichtem Schatten, Symbol Petrol. Beim Lieferanten: Heute, Kunden; Mein Agent, Einstellungen; Person als „<Name> · <Firma>“.

**Tab-Leiste** (bis 760 px): fest unten, weiß durchscheinend. Käufer: Heute, Beziehungen, Frag, Warengruppen, Wert. Lieferant: Heute, Kunden, Frag. Aktiv Petrol, Text 11 px, Inhalt unten 92 px Abstand. Mein Agent und Einstellungen erreichen beide Seiten mobil über die Person in Heute.

**Frag Reziproq** (⌘K, mobil Vollbild, mobil auch per Sprache nach KA-01):
- Suchen: Beziehungen, Warengruppen, Termine, Zusagen, Notizen; Treffer sofort.
- Fragen: Antwort mit Quellen und belegten Zahlen; Kontext ist das geöffnete Objekt.
- Aufträge („Bereite das JBP vor“, „Erinnere mich Freitag“): enden als Mappe, Entwurf in Kurz prüfen oder Erinnerung; nie als bindende Handlung.
- Beim Lieferanten nur innerhalb seiner Akten; Fragen nach Daten der Kundenseite beantwortet Reziproq mit „kann Reziproq nicht sehen“ (LP-01).

## Seitenregeln

1. **Wo bin ich.** Titel Outfit 700, 34 bis 36 px (mobil 30 px); darüber Zurück-Link mit dem Namen der Ebene („‹ Beziehungen“, „‹ Heute“). Startseiten der Hauptpunkte ohne Zurück-Link. Hauptpunkt markiert.
2. **Genau eine Karte „Als Nächstes“.** Tinte-Karte mit Kurzzeile (Mint), Titel, Satz, genau einem Hauptknopf und höchstens einem Zweitknopf; direkt unter dem Kopf. Quelle: `next_action` (Sicht auf `focus_item` mit `level = focus` und passendem Ort). Ohne Kandidat keine Karte. Jeder andere Knopf der Seite ist ein Zweitknopf; Formulare haben genau einen Hauptknopf.
3. **Zusammengefasst von Reziproq.** Wo eine Seite einen Satz von Reziproq zeigt, stehen seine Zahlen in `sentence_facts`; Quellen-Chips darunter. Ein Satz mit einer Zahl ohne Beleg wird nicht angezeigt (G-6). Wertarten werden nie addiert (G-3).
4. **Alles andere tritt zurück.** Inhalte in weißen Gruppen mit Zeilen; Details öffnen als Blatt (620 px von rechts, Esc schließt, mobil volle Seite); Herleitung, Verlauf, „Wer sieht was“ und Leitfragen sind eingeklappt.
5. **Mobil zuerst.** Unter 760 px keine Seitenleiste; Spalten untereinander; Tabellen scrollen im Rahmen, die Seite nie seitwärts; Bedienflächen mindestens 44 px.

Fortschritt zeigt das Objekt selbst: Phasen-Umschalter am Termin (TE-01), Teile-Umschalter an der Strategie (ST-01), Freigabe-Schritte am Plan (GP-01), „So geht es weiter“ in jeder Mappe (HE-01).

## Seiten und Adressen

| Adresse | Seite | Spec |
|---|---|---|
| `/` | Startseite der Person | – |
| `/heute` (`?ansicht=alles`), `/kurz-pruefen`, `/erledigt`, `/warum/<id>` | Heute, Kurz prüfen, Erledigt, Warum | HE-01 |
| `/mappe/<art>/<id>` | Mappe (u. a. `deal`, `wert`, `strategie`, `mandat`, `segment`, `autonomie`, `anteile`, `vergabe`, `review`) | HE-01 und die Spec der Art |
| `/beziehungen` (`?linse=segmente`) | Beziehungen | BZ-01 |
| `/beziehungen/<id>` (`?sicht=privat`, `?sicht=geteilt`), `/profil`, `/spielregeln`, `/feedback` | Akte | AK-01 |
| `/beziehungen/<id>/mandat` | Mandat | MD-01 |
| `/beziehungen/<id>/plan`, `/initiativen/<id>` | Gemeinsamer Plan, Initiative | GP-01 |
| `/beziehungen/<id>/wert` | Wertkonto | WK-01 |
| `/beziehungen/<id>/deals/<deal>` | Deal | DL-01 |
| `/termine/<id>` | Termin | TE-01 |
| `/warengruppen`, `/warengruppen/<id>`, `/warengruppen/<id>/strategie` | Warengruppen, Warengruppe, Strategie | ST-01 |
| `/warengruppen/<id>/hypothesen/<code>` | Hypothese | WT-01 |
| `/warengruppen/<id>/soll-kosten`, `/warengruppen/<id>/szenarien` | Blätter Soll-Kosten und Szenarien | WZ-01, SZ-01 |
| `/warengruppen/<id>/vergaben/<vid>` | Vergabe | VG-01 |
| `/wert`, `/wert/bericht/<jahr-monat>` | Wert, Wertbericht | WK-01, WB-01 |
| `/mein-agent` | Mein Agent | MA-01 |
| `/einstellungen`, `/einstellungen/ki`, `/einstellungen/kanaele` | Einstellungen | MA-01, KA-01 |
| `/kunden`, `/kunden/<id>`, `/einladung/<token>` | Lieferantenseite | LP-01 |
| `/kunden/<id>/anfragen/<vid>` | Anfrage und Angebot beim Lieferanten | VG-01 |
| `/b/<token>` | Bestätigen oder Beitrag per Link | BL-01, BE-01 |
| `/demo` | Demo-Regie (nur Demo-Mandant) | DM-01, SI-01 |

**Weiterleitungen (301)** aus Version 1.1: `/uebersicht` und `/wirkung` → `/wert`; `/mein-tag` und `/start` → `/heute`; `/lieferanten[/…]` → `/beziehungen[/…]` (Einzelregeln in AK-01 und BZ-01); `/portfolio` → `/beziehungen?linse=segmente`; `/agenten` und `/einstellungen/ki/agenten` → `/mein-agent`; `/hinweise` → `/heute?ansicht=alles`; `/warengruppen/<id>/strategie/<schritt>` → `/warengruppen/<id>/strategie#teil-<n>`; `/warengruppen/<id>/strategie/freigabe` → `/mappe/strategie/<aktuelle Version>`; Termin-Reiter nach TE-01. Lesezeichen und Links in Mails funktionieren weiter.

## Daten

| Tabelle oder Sicht | Änderung |
|---|---|
| `user_setting.start_page` | Werte `wert`, `heute`; leer = nach Rolle |
| `next_action` | Sicht auf `focus_item` mit `level = focus`; Punktzahl aus der Triage (HE-01); `scope` `global`, `relationship`, `category`, `object` |
| `activity_feed` | heißt in der Oberfläche Verlauf; steht in der Akte unter Nur für dich; enthält Läufe von Reziproq mit Verweis auf Erledigt |
| `timeline_item` | Arten `meeting`, `deadline`, `approval`, `commitment`, `agenda_due`, `contributions_due`; `risk` entfällt (Modul aus) |
| `note` | unverändert (`visibility` `team`, `private`) |

## Begriffe in der Oberfläche

| Bisher | Jetzt |
|---|---|
| Übersicht, Ergebnisse, Wirkung (als Bereich) | Wert |
| Wirkung einer Initiative | bleibt nur im Namen der Mappe „Wirkung freigeben“ |
| Mein Tag | Heute |
| Lieferanten | Beziehungen (Lieferant bleibt für das Unternehmen) |
| Aktivitäten, Notizraum | Verlauf |
| Maßnahme | Zusage; intern Aufgabe |
| Agenten | Mein Agent |
| Wertpotenzial-Finder | Wertfinder |
| Forecast | Prognose |

Tabellen und Code dürfen alte Namen behalten.

## Ausnahmen ohne Rahmen

Phase „Im Termin“ im Vollbild (TE-01); Seiten ohne Anmeldung (Anmeldung, Einladung, Seiten per Link); Zwei-Fenster-Modus der Demo (SI-01).

## Umsetzung des Rahmens (K1-d.1, 24.11.2026)

- **Seitenleiste und Tab-Leiste** nach 2.0 (`components/ui/app-shell.tsx`, `features/shell/navigation.tsx`).
  - Seitenleiste: Frag Reziproq, Heute, Beziehungen, Warengruppen, Wert, „Im Hintergrund“, Mein Agent, Einstellungen, Person.
  - Die Zahl an Heute sind die offenen Fokus-Themen aus `GET /api/heute`.
  - „Im Hintergrund“ nennt den jüngsten laufenden Lauf der Person und führt bis K1-e zu Mein Agent (danach zu Erledigt).
  - Tab-Leiste: Käufer Heute, Beziehungen, Frag, Warengruppen, Wert; Lieferant Heute, Kunden, Frag.
- **Neue Adressen** `/heute`, `/beziehungen`, `/wert`, `/mein-agent`. Bis zu ihren Paketen zeigen sie die bisherigen Seiten:
  - Heute: Mein Tag, beim Lieferanten den Start (bis K1-e);
  - Beziehungen: die Lieferantenliste (bis K2-b);
  - Wert: die Übersicht (bis K4-b);
  - Mein Agent: die Agenten (bis K1-f).
  - Titel, Zurück-Links und Pfade nennen schon die neuen Namen.
- **Startseite** (TN-06): Lead und Admin landen in Wert, alle anderen in Heute; die eigene Wahl geht vor. Die Werte bleiben im Code `overview` und `my_day`.
- **Weiterleitungen** (TN-07): Tabelle alt → neu für alle Routen in `packages/shared/src/route-moves.ts`, ausführlich in `docs/weiterleitungen.md` (`pnpm weiterleitungen`).
  - Die API antwortet mit 301, bevor sie die App ausliefert; die App leitet beim Laden um.
  - Aktiv: `/mein-tag` und `/start` → `/heute`, `/uebersicht` und `/wirkung` → `/wert`, `/lieferanten` → `/beziehungen`, `/agenten` und `/einstellungen/ki/agenten` → `/mein-agent`.
  - Alle übrigen Adressen haben ihr Paket in der Tabelle und schalten mit ihm um.
- **Bewusst offen:** Mein Agent beim Lieferanten kommt mit dem Lieferanten-Agenten (K5-e).

## Umsetzung von Frag Reziproq und Blatt (K1-d.2, 25.11.2026)

- **Frag Reziproq** ist eine Überlagerung (`components/ui/ask-overlay.tsx`), keine Seite mehr.
  - Öffnen: ⌘K oder Strg+K auf jeder Seite, das Feld in der Seitenleiste, „Frag“ in der Tab-Leiste. Ab 761 px oben über der Seite, bis 760 px Vollbild.
  - Esc, der runde Knopf und Zurück schließen sie; sie ist offen, solange die Adresse `?frag=1` trägt.
  - Auf der Seite einer Beziehung hat die Frage sie als Kontext, beim Lieferanten den Kunden.
  - `/fragen` leitet auf `/heute?frag=1` (Frage und Kontext aus `q`, `lieferant`, `kunde`).
  - Läuft die Anmeldung ab, steht der Hinweis zum neu Anmelden auch in der Überlagerung (UMB-02); nach der Rückkehr ist die getippte Frage wieder da.
- **Blatt** (`components/ui/sheet.tsx`): 620 px von rechts, Hintergrund Tinte 25 % (Token `scrim`), Schatten `shadow-sheet`, mobil volle Seite; zu sehen auf `/bausteine`.
- **Gemeinsam:** Beide nutzen das native `dialog` des Browsers (`components/ui/modal-dialog.ts`). Der Fokus bleibt darin, ein markiertes Feld bekommt ihn beim Öffnen, und beim Schließen geht er an das Element zurück, das ihn vorher hatte.
- **Test gegen Pop-ups** (`no-popups.node.test.ts`): eine feste Liste erlaubter Überlagerungen nach E-K0-01 (Blatt, Frag Reziproq, später „So teilen“ und „Agenda freigeben“); er erkennt jetzt auch native Dialoge.
- **Bewusst offen:** Aufträge in Frag Reziproq („Bereite das JBP vor“) enden als Mappe, Entwurf oder Erinnerung, sobald es Mappe und Kurz prüfen gibt (K1-e).

## Fertig, wenn

- [x] TN-01 Ab 761 px zeigt jede Käuferseite die Seitenleiste mit Heute, Beziehungen, Warengruppen, Wert in dieser Reihenfolge, darunter „Im Hintergrund“, Mein Agent, Einstellungen. (K1-d.1: `plt-11.test.tsx`, `e2e/plt-11.spec.ts`)
- [x] TN-02 Bis 760 px ist die Seitenleiste verborgen; die Tab-Leiste zeigt beim Käufer fünf, beim Lieferanten drei Ziele und verdeckt keinen Inhalt. (K1-d.1: `plt-11.test.tsx`, `e2e/ux-20-phase-2.spec.ts`)
- [ ] TN-03 Bei 390 px ist auf keiner Seite ein waagerechter Bildlauf der Seite möglich.
- [ ] TN-04 Jede Seite außer den Startseiten hat einen Zurück-Link mit dem Namen der Ebene darüber.
- [ ] TN-05 Jede Seite hat höchstens eine Karte „Als Nächstes“ und außerhalb davon keinen Hauptknopf; ohne Kandidat erscheint keine Karte.
- [x] TN-06 Ein Lead landet nach der Anmeldung in Wert, ein SRO in Heute; eine geänderte Startseite gilt ab der nächsten Anmeldung. (K1-d.1: `plt-11.test.tsx`)
- [ ] TN-07 Jede alte Adresse aus der Liste leitet mit 301 auf die neue weiter. (K1-d.1: die Adressen der Hauptpunkte und der Agenten, `configure-app.test.ts`, `route-moves.node.test.ts`; die übrigen mit ihren Paketen nach `docs/weiterleitungen.md`)
- [ ] TN-08 ⌘K öffnet Frag Reziproq auf jeder Seite; eine Frage auf einer Akte hat diese als Kontext; ein Auftrag endet als Mappe, Entwurf oder Erinnerung. (K1-d.2: ⌘K und Kontext erfüllt, `plt-12.test.tsx`, `nav-10.test.tsx`, `e2e/plt-12.spec.ts`; Aufträge mit K1-e)
- [ ] TN-09 Es gibt keine Seite Agenten und keine Ablauf-Leiste; jede frühere Schrittseite leitet auf ihr Objekt, ihre Mappe oder Kurz prüfen.
- [x] TN-10 Ein Satz mit einer Zahl, die nicht in `sentence_facts` steht, wird nicht angezeigt. (K1-c, wie T1-HE2)
- [ ] TN-11 Eine Handlung auf Stufe Erledigen steht in Erledigt und im Verlauf des Objekts.
- [ ] TN-12 Ein Käufer ohne Zugriff auf eine Beziehung sieht sie in keiner Zahl, keiner Zeile und keiner Karte „Als Nächstes“. (K1-c: Heute und „Als Nächstes“ erfüllt, `he-01.test.ts`; die übrigen Seiten mit ihren Paketen)
- [x] TN-13 Die Navigation des Lieferanten enthält weder Warengruppen noch Wert (T5-LP1). (K1-d.1: `nav-10.test.tsx`, `lif-02.test.tsx`)

## Nicht Teil

Eigene Startseiten oder Widgets je Person; dunkles Thema; eigene App für iOS oder Android (die Weboberfläche ist als Web-App installierbar); Claims, Risiko, Vertrag (G-4).
