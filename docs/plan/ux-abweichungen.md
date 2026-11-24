# UX-Umsetzung · Abweichungen zwischen Vorlagen, Specs und Code (Phase 0)

Stand 23.11.2026, geprüft auf `spec/PNL-11` nach Commit `be11239`.

Grundlage:
- `CLAUDE.md`;
- `docs/specs/NAV-10.md` (Version 1.1, Release 1.1);
- `docs/specs/UX-20.md`;
- `docs/design/designsprache.md` (Version 2);
- `docs/plan/ux-umsetzung.md`;
- die 103 Vorlagen in `docs/design/referenz/`. Sie sind identisch mit dem Design-Canvas, ohne
  `C-*`, `R-*`, `V-*`, `L-Var-*`, `U-Var-*`, `U-Termin` und `Header`; Stichproben per Prüfsumme.

Ablage nach `docs/eingang/reziproq-umsetzung-ux/LIESMICH.md`:
- `NAV-10.md`, `UX-20.md`, die Designsprache und `PROMPTS.md` (als `docs/plan/ux-umsetzung.md`)
  liegen an ihrem Ort.
- Die Vorlagen sind ersetzt bzw. ergänzt, `Header.dc.html` ist gelöscht.
- Die bisherigen Fassungen von NAV-10 (1.0) und der Designsprache (Version 1) liegen unter
  `docs/eingang/alt/`. Sie enthalten die Umsetzungsnotizen und Testverweise von 1.0.

Aufwand:
- **S:** bis ein halber Tag. Vorhandenes umstellen oder neu anordnen.
- **M:** ein bis zwei Tage. Neue Seite oder neuer Baustein auf vorhandenen Daten.
- **L:** mehr als zwei Tage. Neue Daten, neuer Ablauf oder neue Fachlogik.

## Querschnitt: was für alle Phasen gilt

| Thema                                  | Stand im Code                                                                                                                                                 | Abweichung                                                                                                                                                                                               | Aufwand                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Rahmen                                 | `AppShell` gibt es nicht. `features/shell/app-layout.tsx` zeigt die globale Kopfleiste (`GlobalBar`, NAV-10 1.0) mit Pillen; unten auf dem Telefon vier Ziele | Seitenleiste ab 761 px, Tab-Leiste mit fünf Zielen bis 760 px, keine Kopfleiste. Heute liegt der Umbruch bei 1024 px (`--breakpoint-sidebar: 64rem`).                                                    | L                             |
| Tokens                                 | `styles/tokens.css` nach Designsprache 1: Karten 24 px mit Schatten, Titel 42–46 px                                                                           | Version 2: Gruppen 16–18 px ohne Schatten, Titel 34–36 px (Telefon 30), Abschnittslabel in Versalien, Zweitknopf grau gefüllt (`#e9ece8`), KI-Entwurf mit 1 px Mint-Rand statt gestricheltem Petrol-Rand | M                             |
| Modul-Schalter                         | Kein `org_module`. Es gibt `organization_feature` (nur `buyer`) als Freischalt-Tabelle. Claims, Risiko und Vertrag gibt es im Code nicht.                     | Tabelle neu (oder Erweiterung, siehe Frage F-UX-01), Prüfung in Routen, Navigation, Sichten und Texten von Reziproq                                                                                      | M                             |
| Sichten `next_action`, `timeline_item` | Gibt es als Sichten nicht. Fällige Dinge sammelt der Code je Modul (`dueItems`, `start.service`). „Nächster Schritt“ wird je Seite im Code bestimmt.          | Gemeinsame Quelle je Ort (`scope` global, relationship, category, page) mit `score`; Filter nach `org_module`. Siehe F-UX-04.                                                                            | L                             |
| `activity_feed`                        | Vorhanden (NAV-10 1.0, `activities.service`) mit Termin, Notiz, Hinweis, Agent, Mail                                                                          | Filter „Dateien“ braucht Dokumente (KI-18, offen)                                                                                                                                                        | S                             |
| Seitenregeln                           | Pro Seite gebaut, nicht als Regel geprüft. Viele Seiten haben mehrere Hauptknöpfe oder Leitfragen offen.                                                      | Höchstens eine Karte „Als Nächstes“, sonst nur Zweitknöpfe; Hilfen eingeklappt; Zurück-Link mit Namen der Ebene                                                                                          | L (verteilt über alle Phasen) |
| Begriffe                               | „Wirkung“ ist in Teilen der Oberfläche schon „Ergebnisse“                                                                                                     | überall „Ergebnisse“ und „Aktivitäten“                                                                                                                                                                   | S                             |

## Phase 1 · Grundlagen

**Stand 23.11.2026: umgesetzt.**
- `org_module` (Migration 0129, nur lesen für die App, Standard Claims/Risiko/Vertrag aus), über
  `/me` als `modules`.
- Tokens Version 2 (Gruppen 18 px ohne Schatten, Tinte-Karte 24 px, Titel 36 / Telefon 30 px,
  Zweitknopf grau, KI-Entwurf mit Mint-Rand, Umbruch 761 px und 1100 px).
- Bausteine in `components/ui/`: `app-shell`, `next-card`, `so-what`, `chart-card`,
  `process-chain`, `row-group`, `collapsible`, `form-page`, `back-link`, `entity-header`
  (`SupplierHeader`, `CategoryHeader`), `flow-bar`.
- Testseite `/bausteine` mit den Texten der Vorlagen.
- Die Vorgänger (`NextStep`, `ListCard`, `Steps`, `StepProgress`, `GroupBar`, `LocalBar`,
  `GlobalBar` u. a.) bleiben, bis die Seiten in den Phasen 2 bis 9 umgezogen sind; danach werden
  sie entfernt, damit jeder Baustein genau einmal existiert.
- Die Testseite zeigt Beispielzahlen aus den Vorlagen; auf echten Seiten kommen Zahlen nur aus den
  Daten.

| Seite oder Baustein                                       | Stand im Code                                                                                         | Aufwand                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `org_module` mit Migration und Zeilensicherheit           | fehlt; `organization_feature` vorhanden (F-UX-01)                                                     | M                                                                                                           |
| Design-Tokens Version 2                                   | `tokens.css` nach Version 1; Testseiten `/design` und `/styleguide` vorhanden                         | M                                                                                                           |
| `AppShell` (Seitenleiste, Tab-Leiste, Inhalt bis 1200 px) | `AppLayout` mit `GlobalBar`, Bühne (`StageSlot`) und lokaler Leiste (`LocalBarSlot`)                  | L                                                                                                           |
| `NextCard`                                                | `NextStep` (Tinte-Karte, Ringe im Hintergrund, Ziel optional)                                         | S: ohne Ringe, Ziel Pflicht, Fehler ohne Ziel, auf dem Telefon volle Breite, in Prozessschritten fest unten |
| `SoWhat` („Das Wichtigste“)                               | `InsightHeading`, `EvidenceCard` (AW-01, Grenzen je Seite in `page-limits`)                           | M: Aussage mit Zahl, bis drei Punkte mit Status-Chip und Link, daneben Grafik                               |
| `ChartCard`                                               | `ChartFrame`, `RangeBars`, `GoalRings`, `ShareStack`, `MeterBar`                                      | M: Bereichslabel, Aussage als Titel, Diagramm, Quellzeile, genau ein Link                                   |
| `ProcessChain`                                            | `Steps`, `StepProgress`, `StepDots`, `Chain` (mehrere Varianten)                                      | M: eine Kette für alle Abläufe, Glieder als Links, Schritte ohne Recht grau ohne Link                       |
| `RowGroup`                                                | `ListCard`, `ListRow`, `ListRowText`, `LinkList`                                                      | S: Zeile ohne Ziel ohne Pfeil und nicht klickbar                                                            |
| `Collapsible`                                             | `<details>` an einzelnen Stellen (Supplier Map, Marktanalyse), kein Baustein                          | S                                                                                                           |
| `FormPage`                                                | `FormField`, `FormActions`; Formulare je Seite                                                        | M: ein Hauptknopf unten (Petrol), Zweitknopf grau                                                           |
| `SupplierHeader`                                          | `SupplierBar` (NAV-06/NAV-10 1.0) mit Reitern, Profil-Knopf, Unterseiten als Pillen                   | M: Zurück-Link, graue Zeile mit Segment, Warengruppe und Schritt, Segment-Umschalter, schlichte Links       |
| `CategoryHeader`                                          | `GroupBar` (Monogramm, Stand als Chip)                                                                | M                                                                                                           |
| `FlowBar`                                                 | Ablauf-Kopf der Strategie (`strategy-pages.tsx`), Ablauf-Leiste im Gemeinsamen Plan (`jbp-pages.tsx`) | M: ein Baustein, Weiter als Zweitknopf                                                                      |
| Testseite mit Texten der Vorlagen                         | `/design` (Bausteine Version 1) und `/styleguide`                                                     | S                                                                                                           |

## Phase 2 · Navigation und Start

**Stand 24.11.2026: umgesetzt.**
- Rahmen `AppShell` für jede angemeldete Seite: Seitenleiste ab 761 px (so hoch wie der
  Bildschirm, bleibt beim Scrollen stehen; Entscheidung des Gründers vom 23.11.2026), Tab-Leiste
  bis 760 px mit „Frag“; „Suchen oder fragen“ mit ⌘K, Einstellungen, Person.
- `next_action` und `timeline_item` als Funktionen im Code (F-UX-04): `packages/shared/src/my-day.ts`
  (Auswahl, Zeitbedarf je Art, Modulfilter, Sortierung) und `apps/api/src/modules/start/my-day-data.ts`
  (Quellen in der Mandanten-Session). Endpunkte `GET /start/mein-tag`, `/start/termine?tage=`,
  `/start/als-naechstes`, `/start/brauchen-dich`.
- Mein Tag nach `Main`/`A-MeinTag`, Übersicht nach `Uebersicht`/`A-Uebersicht`, Alle Aufgaben nach
  `Aufgaben`, Hinweise oben nach `Hinweise` (Ablauf, „Als Nächstes“, „Das Wichtigste“).
- Neue Bausteine: `page-title`, `timeline-rail`, `date-list`, `ChartColumns` in `chart-card`;
  erweitert: `DateCircle` (Ring, 44 px), `SoWhat` (Quellen, Zweitaktion), `NextCard`
  (`ariaLabel`), `AreaSwitch` als Export. Alle auf `/bausteine`.
- In der Seitenleiste markieren `/start/…` (Alle Aufgaben, Maßnahmen) und `/hinweise` den
  Hauptpunkt Mein Tag, wie in den Vorlagen `Aufgaben` und `Hinweise`.
- Screenshots: `docs/plan/screens/phase-2/` (Mein Tag, Übersicht, Alle Aufgaben, Hinweise, Bausteine;
  je 390 und 1440 px, erzeugt mit `UX_SHOTS=… playwright test e2e/ux-20-phase-2.spec.ts`).

Bewusste Abweichungen in Phase 2:
- **Warengruppen-Karte der Übersicht** zeigt den Stand der Strategien je Warengruppe statt „EBIT
  gesichert gegen Ziel“: Es gibt noch kein EBIT-Ziel je Warengruppe und keine Zuordnung der
  Initiativen zu Warengruppen (F-UX-15).
- **Terminschiene ohne Freigabetermine der Warengruppen:** WG-16 kennt kein Datum der Freigabe,
  nur offene Unterschriften (F-UX-16). Enthalten sind Termine, offene Zusagen beider Seiten, Fristen
  offener Bewertungsrunden und Reviews der Warengruppen.
- **Wirkung in „Als Nächstes“** ist der Spend des Lieferanten; der Faktor Segment fehlt, bis das
  Segmentmodell Gewichte trägt (F-UX-17).
- **Kein Link „Alle Termine“** unter Terminschiene und Fristen: Es gibt keine Seite mit allen
  Terminen; ein Link ohne Ziel ist verboten.
- **„n von m für heute erledigt“** zählt als erledigt nur Quellen mit Erledigt-Zeitpunkt:
  Maßnahmen, Beiträge zum Lieferantenplan, Freigaben der Wirkung, abgegebene Bewertungen.
- **Mein Tag ohne Karte „Wo du handeln musst“ (KI-16)** und ohne eigenes Fragefeld: Die Vorlage
  hat dafür die Zeile „Hinweise“ und das Feld in der Seitenleiste bzw. „Frag“. Die wichtigsten
  Hinweise stehen oben auf `/hinweise`.
- **Übersicht ohne Zeilen „In Umsetzung“, „Cash“, „Wertpotenziale“ und Fragevorschläge** (AW-01):
  NAV-10 1.1 nennt sie nicht; Cash steht als Quellzeile der Ergebnisse, nie addiert.
- **Risiko und Claims:** keine Karte, keine Zeile, kein Termin; beide Module sind aus und haben
  keine Quelle. Der Modulfilter ist trotzdem gebaut und getestet.
- **Lieferantenseite:** Start der Lieferanten bleibt vorerst der bisherige (LIF-02) im neuen
  Rahmen; die Bausteine dort folgen mit Phase 10.
- **Nach Phase 3 und 9 verschoben:** Liste „Brauchen dich“/„Laufen gut“ (Phase 3, nutzt
  `/start/brauchen-dich`), `/warengruppen/<id>` als Überblick und sprechende Schrittadressen
  (Phase 9, F-UX-07), Matrix und Runde als Ansichten von `/lieferanten` (Phase 3).

Kriterien aus NAV-10 „Fertig, wenn“ und ihre Tests:

| Kriterium | Test |
| --- | --- |
| Seitenleiste ab 761 px mit vier Hauptpunkten, darunter Einstellungen | `e2e/ux-20-phase-1.spec.ts`, `e2e/ux-20-phase-2.spec.ts` (761, 1440), `plt-11.test.tsx` |
| Bis 760 px Tab-Leiste mit fünf Zielen, verdeckt nichts | `e2e/ux-20-phase-1.spec.ts`, `e2e/ux-20-phase-2.spec.ts` (390, 760) |
| 390 px ohne seitliches Scrollen, Tabellen und Schiene in ihrem Rahmen | `e2e/ux-20-phase-2.spec.ts` (auch Terminschiene) |
| Zurück-Link außer auf den Startseiten | `start.test.tsx` (Alle Aufgaben), `ki-16.test.tsx` (Hinweise); übrige Seiten mit Phase 3 bis 9, Begehung Phase 10 |
| Höchstens eine Karte „Als Nächstes“, kein Hauptknopf außerhalb; Formulare ein Hauptknopf | `components/ui/ux-20.test.tsx`, `start.test.tsx`, `ki-16.test.tsx`, `e2e/ux-20-phase-2.spec.ts` |
| Ohne Kandidat keine Karte | `packages/shared/src/my-day.test.ts`, `api start/ux-20-phase-2.test.ts`, `start.test.tsx` |
| Eingeklappt beim Laden, öffnet mit Klick und Tastatur | `components/ui/ux-20.test.tsx`, `e2e/ux-20-phase-1.spec.ts` |
| Lead startet in der Übersicht, SRO in Mein Tag; geänderte Startseite gilt | `plt-11.test.tsx` („beachtet Rollenstandard …“) |
| Alte Adressen leiten weiter | `plt-11.test.tsx` (`/`, `/start`), `nav-10.test.tsx` (`/agenten`); `/warengruppen/<id>` als Überblick mit Phase 9 |
| Übersicht: Ring nur mit Ziel, eine Karte, Schiene ≤ 8, Karte je Bereich mit Daten, EBIT und Cash nie addiert | `insights/aw-01.test.tsx` (NAV-10 1.1), `api impact/aw-01.test.ts` (Quartale) |
| Schiene nur sichtbare Lieferanten, jeder Eintrag öffnet sein Objekt | `api start/ux-20-phase-2.test.ts`, `insights/aw-01.test.tsx`, `e2e/ux-20-phase-2.spec.ts` |
| Satz mit Zahl außerhalb der Fakten wird nicht angezeigt | `api impact/aw-01.test.ts`, `insights/aw-01.test.tsx` (neutraler Titel) |
| Ohne Zugriff kein Lieferant in Zahl, Zeile oder „Als Nächstes“ | `api start/ux-20-phase-2.test.ts`, `api impact/aw-01.test.ts` |
| Lauf eines Agenten in den Aktivitäten als Reziproq | `api activities/nav-10.test.ts`, `api agents/ki-04.test.ts` |
| Private Notiz nur für die Autorin | `api activities/nav-10.test.ts` |
| ⌘K überall, „Frag“ auf dem Telefon, Frage mit Lieferant als Kontext | `prompt/plt-12.test.tsx`, `e2e/ux-20-phase-2.spec.ts` |
| Lieferantenkopf mit vier Bereichen und „···“; jede Seite einem Bereich | `components/ui/ux-20.test.tsx`; Zuordnung aller Seiten mit Phase 3 |
| Agenten nur über Einstellungen, KI | `activities/nav-10.test.tsx` |
| Lieferant sieht weder Übersicht noch Mein Tag noch Aktivitäten | `customers/lif-02.test.tsx`, `activities/nav-10.test.tsx` |


| Seite oder Baustein                                                                           | Stand im Code                                                                                                                        | Aufwand                                                                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seitenleiste mit vier Hauptpunkten, Einstellungen, Person; Tab-Leiste mit „Frag“              | Kopfleiste mit vier Hauptpunkten (NAV-10 1.0), unten vier Ziele auf dem Telefon, ⌘K vorhanden                                        | M (nach Phase 1)                                                                                                                                 |
| Weiterleitungen (`/wirkung`, `/start`, `/portfolio`, `/agenten`, `/`)                         | Teilweise: `/uebersicht` und `/mein-tag` gibt es; `/start`, `/wirkung`, `/portfolio`, `/agenten` sind eigene Seiten                  | S                                                                                                                                                |
| `/warengruppen/<id>` als Überblick, Schritt 10 unter `/strategie/freigabe`                    | `/warengruppen/<id>` ist die Warengruppe; Schritte als `/strategie/1` bis `/10` (F-UX-07)                                            | S bis M                                                                                                                                          |
| Startseite nach Rolle, `user_setting.start_page`                                              | `user_setting.start_page` vorhanden (NAV-10 1.0), Einstellung in Profil                                                              | S                                                                                                                                                |
| Übersicht (`Uebersicht`, `A-Uebersicht`)                                                      | `/uebersicht` aus AW-01: Ring gegen Jahresziel, Ergebnisse, Wertpotenziale, Aussage von Reziproq; Zeitraum-Umschalter in Ergebnissen | L: Lagebild mit „Als Nächstes“, Zusammenfassung mit drei Chips, Terminschiene, vier Diagrammkarten (Risiko und Claims nur mit Modul, also nicht) |
| Mein Tag (`Main`, `A-MeinTag`)                                                                | `/mein-tag` (NAV-05/NAV-10 1.0): fällige Dinge, Termine, Eingang, Hinweise                                                           | L: zwei Spalten, „n von m erledigt“, „Von Reziproq vorbereitet“, „Diese Woche“, „Wartet auf andere“, Zeitbedarf (F-UX-05)                        |
| Alle Aufgaben (`Aufgaben`)                                                                    | `/start/faellig`, `/start/massnahmen`                                                                                                | M                                                                                                                                                |
| Hinweise (`Hinweise`)                                                                         | `/hinweise` (FS-01, KI-16)                                                                                                           | M                                                                                                                                                |
| Fragen (`Fragen`)                                                                             | `/fragen` (PLT-12, KI-03)                                                                                                            | S                                                                                                                                                |
| Sicht `timeline_item`                                                                         | fehlt; Termine, Zusagen, Freigaben, Runden liegen in eigenen Tabellen                                                                | L                                                                                                                                                |
| Sicht `next_action`                                                                           | fehlt (siehe Querschnitt)                                                                                                            | L                                                                                                                                                |
| Einstellungen, Abschnitt KI (`E-Uebersicht`, `E-KI`, `KI-Agenten`, `KI-Baukasten`, `KI-Lauf`) | `/einstellungen/ki`, `/einstellungen/ki/agenten` vorhanden; `/agenten` als Hauptseite                                                | M                                                                                                                                                |

## Phase 3 · Lieferanten

| Seite oder Baustein                                              | Stand im Code                                                                     | Aufwand                                                                                                                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liste (`Lieferanten`, `A-Lieferanten`)                           | `/lieferanten` (LS-01) mit Detailleiste, Filter, Matrix unter `/portfolio/matrix` | M: Umschalter Meine/Strategisch/Alle, Gruppen „Brauchen dich“ und „Laufen gut“ mit Grund (F-UX-06), Matrix und Runde als Ansichten                                      |
| Lieferantenkopf (`SupplierBar`)                                  | NAV-10 1.0: vier Reiter, Knopf „Profil“, Unterseiten als Pillen                   | M                                                                                                                                                                       |
| Überblick (`L-Ueberblick`, `A-Lieferant`, `A-Lieferant-Desktop`) | `/lieferanten/<id>` mit Kopf, Zyklus, Kacheln je Bereich, Ringpaar (AW-01)        | L: vier Phasen, „Als Nächstes“, Zeilen mit Stand-Chip (ohne „Claims und Risiken“), Leistung, Kennzahlen, Termine, wichtigste Kontakte (braucht Beziehungsnetz, Phase 4) |
| Profil und Spend (`L-Profil`)                                    | `/strategie/profil`, `/strategie/spend` getrennt                                  | M                                                                                                                                                                       |
| Aktivitäten (`L-Notizen`)                                        | `/lieferanten/<id>/aktivitaeten` (NAV-10 1.0)                                     | S bis M                                                                                                                                                                 |

## Phase 4 · Beziehung

| Seite oder Baustein                                                                      | Stand im Code                                                                          | Aufwand                                                          |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Team (`B-Team`)                                                                          | `/beziehung/team`, SRO, Bearbeiten                                                     | S                                                                |
| Person hinzufügen (`B-Einladen`)                                                         | `/beziehung/team/einladen` (PLB-04)                                                    | S                                                                |
| Einladung, Anmeldung (`O-Einladung`, `O-Anmeldung`)                                      | `/einladung/<token>` mit Name und Passkey, Anmeldeseite                                | S                                                                |
| Spielregeln, Teilen (`B-Spielregeln`, `B-Spielregeln-Teilen`)                            | `/beziehung/spielregeln`, `/teilen`, `/vorschlag` (SEG-10)                             | S                                                                |
| Beziehungsnetz, Person (`B-Netz`, `B-Person`)                                            | fehlt; nur Kontaktpunkte (`/beziehung/kontaktpunkte`)                                  | L, ohne Spec für Daten (F-UX-02)                                 |
| Feedback: Art, Personen, Starten, Rücklauf (`B-Feedback-Art`, `-Neu`, `-Start`, `-Lauf`) | `/beziehung/feedback/neu`, `/<welle>/einladen`, `/frist`; Art (Puls, Jahr) im Formular | M: Kette „Ablauf Feedback“, je Schritt eine Seite                |
| Ergebnis, Lücke (`B-Feedback`, `B-Feedback-Luecke`)                                      | Ergebnis je Welle (PUL-03), Themen (PUL-06), größte Lücke im Überblick                 | M: eigene Seite je Lücke mit Weg zur Maßnahme oder zum JBP-Thema |
| Umfrage für Befragte (`O-Umfrage`)                                                       | `/umfrage/<token>` (PUL-02)                                                            | S                                                                |
| Aufdecken ab drei Antworten je Seite                                                     | so umgesetzt (PUL-03)                                                                  | –                                                                |

## Phase 5 · Segmentierung

| Seite oder Baustein                | Stand im Code                                                           | Aufwand                                                             |
| ---------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Runde starten (`PF-Runde-Start`)   | `/portfolio/runden/neu`, Name, Lieferanten, Bewertende, Prüfen (SEG-03) | M: eine Seite statt mehrerer Schritte, Kette                        |
| Bewerten (`PF-Bewerten`)           | `/bewertungen/<id>` (SEG-04)                                            | M: „nächster Lieferant“, am Ende Rücklauf                           |
| Rücklauf (`PF-Runde`)              | `/portfolio/runden/<id>`                                                | M                                                                   |
| Konsolidieren (`PF-Konsolidieren`) | `/strategie/segmentierung/konsolidieren` (SEG-06), Begründung Pflicht   | M: Pflicht ab Spanne 2 je Kriterium prüfen; heute Pflicht je Gruppe |
| Entscheiden (`L-Segmentierung`)    | `/strategie/segmentierung` mit Matrix                                   | M                                                                   |
| Portfolio (`PF-Portfolio`)         | `/portfolio/matrix`, `/portfolio/offen`, `/portfolio/fokus`             | M: Ansicht unter `/lieferanten?ansicht=matrix`                      |

## Phase 6 · Termine, Aktivitäten, Maßnahmen

| Seite oder Baustein                                         | Stand im Code                                                    | Aufwand                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Termine (`U-Termine`)                                       | `/umsetzung/termine` je Lieferant (QBR-01)                       | M: Bereich Aktivitäten, Termin führt ins Briefing                   |
| Outlook-Add-in, Eingangsadresse (`O-Outlook`)               | `/addin/outlook` (IN-02), Eingangsadresse (IN-04)                | S                                                                   |
| Neu eingegangen (`Aktivitaeten`)                            | `/mein-tag/eingang` (IN-03/IN-04)                                | S bis M                                                             |
| Verlauf (`L-Notizen`)                                       | `/aktivitaeten` (NAV-10 1.0)                                     | S                                                                   |
| Maßnahme anlegen, verfolgen (`U-Massnahme`, `U-Massnahmen`) | `/umsetzung/massnahmen/neu`, Liste, `/start/massnahmen` (QBR-04) | M: Anlass aus Hinweis, Feedback, Termin; Verweis auf Krise entfällt |

## Phase 7 · JBP-Termin und Lieferantenseite

| Seite oder Baustein                                                                      | Stand im Code                                                                    | Aufwand                                                 |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Briefing (`Termin-Briefing`)                                                             | Briefing zum Termin (KI-07), Agenda                                              | M                                                       |
| Beiträge anfordern, sammeln (`J-Anfordern`, `J-Beitraege`, `K-Beitrag`)                  | Beiträge der Funktionen gibt es im Lieferantenplan (SPL-03), nicht im JBP-Termin | L, Spec fehlt (F-UX-03)                                 |
| Datei zuordnen (`J-Upload`)                                                              | fehlt; Dateien brauchen den Objektspeicher (KI-18, Schritt 34, AWS C1)           | L, blockiert (F-UX-03)                                  |
| Präsentation, Teilen, Präsentationsmodus (`J-Deck`, `J-Teilen`, `J-Moderation`, `K-JBP`) | fehlt; geteilte Vorbereitung im Gemeinsamen Plan vorhanden (JBP-01)              | L, Spec fehlt (F-UX-03)                                 |
| Ergebnisse aus Termin und Transkript (`Termin-Ergebnisse`)                               | KI-17 mit Transkript (IN-05)                                                     | M                                                       |
| Protokoll teilen (`Termin-Protokoll`)                                                    | `/umsetzung/termine/<id>/protokoll` (QBR-02)                                     | S bis M                                                 |
| Lieferantenseite (`K-Start`, `K-Arbeitsbereich`)                                         | `/kunden`, `/kunden/<id>` mit Bereichen                                          | M: gleiche Bausteine, eigene Navigation (Start, Kunden) |

## Phase 8 · Plan und Ergebnis

| Seite oder Baustein                                                | Stand im Code                                                                        | Aufwand                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Warengruppen zusammenführen (`L-Warengruppen`)                     | `/strategie/warengruppen` (WG-20, Teil 31a, gestern gebaut nach der älteren Vorlage) | S bis M: Vorlage seither geändert, Übergaben (31b) offen   |
| Lieferantenplan, neue Version (`L-Plan-Neu`, `L-Lieferantenplan`)  | `/strategie/lieferantenplan` mit Beiträgen, Freigabe, Versionen (SPL-01 bis SPL-10)  | M: Kette „Ablauf Lieferantenplan“                          |
| Gemeinsamer Plan (`P-Vorbereitung` bis `P-Kennzahl`)               | alle Seiten unter `/plan/…` vorhanden (JBP-01 bis JBP-09), Ablauf-Leiste vorhanden   | M: Seitenregeln, `SoWhat` und `ChartCard` aus Phase 1      |
| Ergebnis (`W-Initiative`, `W-Pruefung`, `W-Uebersicht`)            | `/wirkung/initiativen/<id>`, `/wirkung/freigaben`, `/uebersicht/ergebnisse`          | M: Kette „Ablauf Ergebnis“; Wirkungsarten bleiben getrennt |
| Wertpotenziale (`KI-Wert-Uebersicht`, `KI-Wert`, `KI-Wert-Detail`) | `/uebersicht/wertpotenziale`, `/wirkung/wertpotenziale` (KI-11)                      | M: Weg „als Thema ins JBP“                                 |

## Phase 9 · Warengruppen

| Seite oder Baustein                                              | Stand im Code                                                         | Aufwand                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Liste (`WG-Uebersicht`, `A-Warengruppen`)                        | `/warengruppen` (WG-04): Jahr, „Nächster Schritt“, Liste              | M: Gruppen „Brauchen dich“, „Freigegeben“, „Noch nicht begonnen“, Spalten, Diagrammkarte, Termine |
| Kopf und Ablauf-Leiste (`GroupBar`, `Flow`)                      | vorhanden (Version 1)                                                 | M (Phase 1)                                                                                       |
| Überblick (`WG-Start`, `A-Warengruppe`, `A-Warengruppe-Desktop`) | fehlt; heute zeigt `/warengruppen/<id>` die Warengruppe mit Strategie | L: vier Phasen, „Als Nächstes“, Gruppe Strategie, Umsatzanteile, Kennzahlen, Team, Termine        |
| Zehn Schritte (`WG-Aufsetzen` bis `WG-Freigabe`)                 | alle zehn gebaut (WG-04 bis WG-16)                                    | M: Seitenregeln; Schritt 10 unter `/strategie/freigabe`                                           |
| Bereiche Lieferanten und Ergebnisse                              | Supplier Map ist Schritt 9, Scorecard Schritt 7                       | M: eigene Bereiche im Kopf                                                                        |
| Strategie-Entwurf durch Reziproq (`KI-Autor-Start`, `KI-Autor`)  | fehlt (KI-13, Warteschlange Schritt 33)                               | L                                                                                                 |

## Phase 10 · Abnahme

| Seite oder Baustein                                   | Stand im Code                                         | Aufwand |
| ----------------------------------------------------- | ----------------------------------------------------- | ------- |
| E2E je Ablauf aus UX-20                               | E2E je Seite und Spec vorhanden, nicht je Ablauf      | L       |
| Sackgassen-Test (alle `NextCard`-Ziele gültig)        | fehlt; Routenbegehung (`e2e/route-walk.ts`) vorhanden | M       |
| 390 px über alle Seiten, nichts hinter der Tab-Leiste | je Spec-Test vorhanden, nicht über alle Seiten        | M       |
| Suche nach `/claims`, `/risiken`, `/vertrag`          | Routen gibt es nicht; Texte von Reziproq prüfen       | S       |

## Widersprüche zwischen Vorlagen und Specs

Siehe `docs/plan/fragen.md`. Wo nichts anderes entschieden ist, gilt die Spec.
