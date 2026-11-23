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
