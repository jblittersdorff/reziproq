# Specs für Reziproq 1.0

Hier stehen alle Specs bis Release 1.0 und danach, in der Reihenfolge, in der sie gebaut werden. Eine Spec ergibt einen Branch und einen Pull Request. Eng zusammenhängende Anforderungen aus dem Produktkonzept sind in einer Spec gebündelt. Die Spalte „Deckt ab“ zeigt, welche Anforderungs-IDs eine Spec erfüllt.

Grundlage ist das Dokument „Reziproq – Produktkonzept und Anforderungen“ vom 31.10.2026. Die Prüfung gegen den Code, die Entscheidungen und der Zeitplan stehen in [`docs/umsetzungsplan.md`](../umsetzungsplan.md).

## Gilt für jede Spec

- **Seiten statt Fenster:**
  - Jede Ansicht, jedes Formular und jeder Schritt hat eine eigene Adresse.
  - Oben steht der Pfad mit Zurück-Pfeil.
  - Bestätigungen stehen auf der Seite.
  - Keine Dialoge, Seitenpanels, Overlays oder Toasts (PLT-10, PLT-11).
- **Gestaltung:**
  - Bausteine nur aus dem Styleguide, Skill `ui-design`
  - Kacheln nach Apple: Titel, ein Satz, Kennzahl, höchstens zwei Knöpfe
  - höchstens sechs Kacheln je Seite
- **Eine Information, ein Ort:**
  - Jede Information wird nur an ihrem Ort gespeichert.
  - Überblick, Start und Portfolio lesen über Schnittstellen (Kennzahl-, Aufgaben-, Termin- und Hinweis-Quellen) und speichern nichts.
- **Datentrennung:**
  - Jede neue Tabelle kommt ins Register der Datenebenen (PLT-04), mit ihrer Art: `buyer_private`, `supplier_private`, `org_private`, `shared` oder `global`.
  - Die Tests zur Datentrennung laufen dann automatisch mit.
  - Keine Fremdschlüssel von geteilten auf private Tabellen.
- **Rechte:** Jede neue Aktion kommt in die Rechte-Matrix (`permissions.ts`) und wird über `can()` geprüft. `docs/rechte.md` wird neu erzeugt.
- **Verlauf:** Geteilte Objekte schreiben Verlauf und Outbox (PLT-08).
- **Texte:** Alle Texte auf Deutsch und Englisch (PLT-09), Fachbegriffe nach `docs/glossar.md`.
- **Zustände:** Jede Seite hat einen leeren Zustand, einen Ladezustand und einen Fehlerzustand. Der leere Zustand erklärt den nächsten Schritt (QS-04).
- **E-Mails:** nur über QS-01, mit Titel und Link, ohne Inhalte.
- **Beträge:** als Ganzzahl in Cent mit Währung.
- **Beispieldaten:**
  - Nur erfundene Firmen mit der Endung „(Demo)“, keine Daten aus Kunden- oder Beratungsprojekten (NF-09).
  - Jede Spec erweitert `pnpm db:seed` um ihre Beispieldaten.
- **Tests:**
  - Je Kriterium unter „Fertig, wenn“ mindestens ein Test.
  - Messungen von Hand stehen im Pull Request.
- **Nicht-funktionale Anforderungen** NF-01 bis NF-09 gelten immer.

## Arbeitsweise

- Eine Spec ergibt einen Branch und einen Pull Request. Sind CI und alle Tests grün, wird er gemergt. Ein zweites Review ist nicht nötig, solange es nur einen Gründer gibt.
- Ändert sich beim Bauen etwas an der Spec, wird zuerst die Spec angepasst und im selben Pull Request mitgeschickt.
- `/spec` nimmt die erste Spec mit Status „offen“, deren Abhängigkeiten alle „fertig“ sind.
- **Geteilte Specs:** IDs mit a oder b (z. B. PLT-03a) sind Teile einer Spec. Was zu welchem Teil gehört, steht in der Spec im Abschnitt „Teilung“.
- **Umbau-Specs** UMB-01 bis UMB-04 passen bestehenden Code an die Specs für 1.0 an.

## Reihenfolge und Abhängigkeiten

Erlaubte Werte für Status: offen, in Arbeit, PR offen, fertig. „Teilweise umgesetzt“ steht als Vermerk; der Status bleibt „offen“, bis die Spec vollständig erfüllt ist.

**Release 1.0** ist der Kernpfad M0 bis M15 (Ende Juni 2027). Die Blöcke danach folgen als 1.1, 1.2 usw.:

- **F** Feedback
- **S** Lieferantenwissen
- **P** Zyklus und Lieferantenplan
- **J** Gemeinsamer Plan
- **W** Wirkung
- **R** Rest
- **K** KI und Suche (Soll)

| # | Spec | Funktion | Deckt ab | Braucht vorher | Release | Meilenstein | Strang | Status | Vermerk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PLT-01 | Anmeldung und Abmeldung | PLT-01 | – | 1.0 | – | C | fertig | PR #11; Popup ersetzt UMB-02 |
| 2 | PLT-02 | Organisationen, Nutzer, Mandanten-Session | PLT-02 | PLT-01 | 1.0 | – | B | fertig | PR #14 |
| 3 | PLT-13 | Betreiber-Zugang zu Kunden | – | PLT-02 | 1.0 | – | B | fertig | PR #7; Anpassung UMB-01 |
| 4 | UMB-04 | Specs und Dokumente zusammenführen | – | – | 1.0 | M0 | – | PR offen | – |
| 5 | PLT-10 | Design und Styleguide | PLT-10, NAV-04, NAV-10 | – | 1.0 | M1 | A | offen | teilweise umgesetzt, siehe Umsetzungsplan |
| 6 | UMB-02 | Neu anmelden ohne Fenster und Overlay | – | PLT-01, PLT-10 | 1.0 | M1 | C | offen | – |
| 7 | PLT-11 | App-Rahmen, globale Leiste, Seitenmuster | PLT-11, NAV-01, NAV-02, NAV-03 | PLT-10 | 1.0 | M1 | A | offen | teilweise umgesetzt, siehe Umsetzungsplan |
| 8 | PLT-04 | Drei Datenebenen | PLT-04 | PLT-02 | 1.0 | M2 | B | offen | teilweise umgesetzt, siehe Umsetzungsplan |
| 9 | PLT-03a | Beziehungen: Datenmodell und Liste | PLT-03 | PLT-04, PLT-11 | 1.0 | M2 | C | offen | Teil a von PLT-03; teilweise umgesetzt, siehe Umsetzungsplan |
| 10 | PLT-08 | Audit-Trail | PLT-08 | PLT-04 | 1.0 | M3 | B | offen | – |
| 11 | PLT-03b | Beziehungen: anlegen, ändern, beenden | PLT-03 | PLT-03a, PLT-08 | 1.0 | M3 | C | offen | Teil b von PLT-03 |
| 12 | PLT-05a | Rollen in der Datenbank und Rechte-Matrix | PLT-05 | PLT-02, PLT-03b | 1.0 | M4 | B | offen | Teil a von PLT-05; teilweise umgesetzt, siehe Umsetzungsplan |
| 13 | PLT-05b | Team je Beziehung | PLT-05 | PLT-05a | 1.0 | M4 | B | offen | Teil b von PLT-05 |
| 14 | UMB-01 | Betreiber-Zugang nach dem neuen Muster | – | PLT-11, PLT-05a | 1.0 | M4 | B | offen | – |
| 15 | NAV-06 | Lieferanten-Arbeitsbereich | NAV-06, NAV-07, NAV-08, NAV-09 | PLT-03b, PLT-05b, PLT-11 | 1.0 | M5 | A | offen | – |
| 16 | PLT-09 | Deutsch und Englisch | PLT-09 | PLT-11 | 1.0 | M5 | A | offen | teilweise umgesetzt, siehe Umsetzungsplan |
| 17 | PLT-06 | Business Units und Warengruppen | PLT-06 | PLT-03b, PLT-05b | 1.0 | M6 | C | offen | – |
| 18 | UMB-03 | Bestandsdaten in die neuen Tabellen überführen | – | PLT-03b, PLT-06 | 1.0 | M6 | C | offen | – |
| 19 | PLT-07a | Import: Baustein, Lieferanten und Spend | PLT-07 | PLT-06 | 1.0 | M6 | C | offen | Teil a von PLT-07 |
| 20 | PLT-07b | Import: Business Units und Kontakte | PLT-07 | PLT-07a | 1.0 | M6 | C | offen | Teil b von PLT-07 |
| 21 | PLT-12 | Fragen-Seite | PLT-12, NAV-11 | NAV-06, PLT-06, PLT-03b, PLT-05b | 1.0 | M7 | A | offen | teilweise umgesetzt, siehe Umsetzungsplan |
| 22 | QS-01 | E-Mail-Versand | QS-01 | PLT-08, PLT-09 | 1.0 | M7 | B | offen | – |
| 23 | SEG-01 | Segmentmodell | SEG-01 | PLT-05b, PLT-06 | 1.0 | M8 | B | offen | – |
| 24 | SEG-03 | Bewertungsrunde starten | SEG-03 | SEG-01, QS-01, PLT-06 | 1.0 | M8 | B | offen | – |
| 25 | SEG-04 | Bewertung abgeben | SEG-04 | SEG-03 | 1.0 | M9 | B | offen | – |
| 26 | NAV-05 | Start | NAV-05 | NAV-06, SEG-04, PLT-11 | 1.0 | M9 | A | offen | teilweise umgesetzt, siehe Umsetzungsplan |
| 27 | SEG-05 | Segmentierung je Lieferant mit Abweichungen | SEG-05, SEG-09 | SEG-04, NAV-06 | 1.0 | M10 | C | offen | – |
| 28 | SEG-06 | Konsolidierung | SEG-06 | SEG-05, PLT-05b | 1.0 | M10 | C | offen | – |
| 29 | SEG-07 | Portfolio | SEG-07, SEG-08 | SEG-06, PLT-11 | 1.0 | M11 | C | offen | – |
| 30 | SEG-02 | Fokuslieferanten | SEG-02 | SEG-07 | 1.0 | M11 | C | offen | – |
| 31 | NAV-12 | Filter der Lieferantenliste | NAV-12 | SEG-02, PLT-06, SEG-06 | 1.0 | M12 | A | offen | – |
| 32 | LIF-01a | Lieferanten einladen: Einladung und Annahme | LIF-01, LIF-05 | PLT-03b, QS-01 | 1.0 | M12 | B | offen | Teil a von LIF-01 |
| 33 | LIF-01b | Lieferanten einladen: Zitadel-Organisation anlegen | LIF-01, LIF-05 | LIF-01a | 1.0 | M12 | B | offen | Teil b von LIF-01 |
| 34 | LIF-02 | Arbeitsbereich des Lieferanten | LIF-02 | LIF-01b, NAV-05, NAV-06 | 1.0 | M13 | B | offen | – |
| 35 | PLB-01 | Kataloge für Spielregeln und Formate | PLB-01, PLB-02 | SEG-01 | 1.0 | M13 | C | offen | – |
| 36 | PLB-03 | Spielregeln je Beziehung | PLB-03 | PLB-01, SEG-06 | 1.0 | M14 | C | offen | – |
| 37 | SEG-10 | Typ und Spielregeln an Lieferanten freigeben | SEG-10, PLB-07 | PLB-03, LIF-02, SEG-06 | 1.0 | M14 | C | offen | – |
| 38 | QBR-01a | Termine: Agenda, Teilnehmende, Protokoll | QBR-01, QBR-02 | PLB-03, LIF-02, NAV-05 | 1.0 | M15 | A | offen | Teil a von QBR-01 |
| 39 | QBR-01b | Termine: Live-Abschnitte, Abschließen, Termin-Quelle | QBR-01, QBR-02 | QBR-01a | 1.0 | M15 | A | offen | Teil b von QBR-01 |
| 40 | QBR-03 | Maßnahmen | QBR-03, QBR-05 | QBR-01b | 1.0 | M15 | A | offen | – |
| 41 | PUL-01 | Fragebogen | PUL-01 | PLT-09 | nach 1.0 | Block F | A | offen | – |
| 42 | PUL-02a | Feedback-Welle: anlegen und einladen | PUL-02 | PUL-01, QS-01, PLT-07b | nach 1.0 | Block F | A | offen | Teil a von PUL-02 |
| 43 | PUL-02b | Feedback-Welle: beantworten ohne Anmeldung | PUL-02 | PUL-02a | nach 1.0 | Block F | A | offen | Teil b von PUL-02 |
| 44 | PUL-03 | Auswertung und Wahrnehmungslücken | PUL-03, PUL-04, PUL-05 | PUL-02b, LIF-02 | nach 1.0 | Block F | A | offen | – |
| 45 | LIF-03 | Eigene Sicht des Lieferanten | LIF-03 | LIF-02 | nach 1.0 | Block F | B | offen | – |
| 46 | PLB-04 | Team beider Seiten | PLB-04, PLB-05 | LIF-02, PLT-05b | nach 1.0 | Block F | B | offen | – |
| 47 | PUL-06 | Maßnahmen aus Lücken und Verlauf | PUL-06, PUL-07 | PUL-03, QBR-03 | nach 1.0 | Block F | A | offen | – |
| 48 | SPL-04 | Spend-Entwicklung | SPL-04 | PLT-07b, PLT-03b, PLT-06 | nach 1.0 | Block S | A | offen | – |
| 49 | SPL-05 | Profil und Finanzen | SPL-05 | SPL-04 | nach 1.0 | Block S | A | offen | – |
| 50 | ZYK-01 | Zyklus und Zyklus-Leiste | ZYK-01, ZYK-03 | SEG-02, NAV-06 | nach 1.0 | Block P | B | offen | – |
| 51 | ZYK-02 | Planung rückwärts vom JBP | ZYK-02, ZYK-06 | ZYK-01, QS-01 | nach 1.0 | Block P | B | offen | – |
| 52 | SPL-01 | Lieferantenplan und Zielkategorien | SPL-01, SPL-02 | ZYK-01, SEG-06, PLT-06 | nach 1.0 | Block P | C | offen | – |
| 53 | SPL-03 | Beiträge der Funktionen | SPL-03 | SPL-01, NAV-05, QS-01 | nach 1.0 | Block P | C | offen | – |
| 54 | SPL-06 | Strategische Themen | SPL-06 | SPL-01 | nach 1.0 | Block P | C | offen | – |
| 55 | SPL-07 | Freigabe und Versionen des Lieferantenplans | SPL-07, SPL-09 | SPL-03, SPL-06, SPL-01, PLT-05b | nach 1.0 | Block P | C | offen | – |
| 56 | QBR-04 | Erinnerung und Eskalation | QBR-04 | QBR-03, QS-01 | nach 1.0 | Block P | A | offen | – |
| 57 | PLB-06 | Kontaktpunkte | PLB-06 | PLB-03, PLT-07b | nach 1.0 | Block P | C | offen | – |
| 58 | JBP-01 | Vorbereitung des Joint Business Planning | JBP-01 | QBR-01b, SPL-07, PUL-03, SEG-10, ZYK-02 | nach 1.0 | Block J | C | offen | – |
| 59 | JBP-02 | Themen beider Seiten | JBP-02, LIF-04 | JBP-01, SPL-06 | nach 1.0 | Block J | C | offen | – |
| 60 | JBP-03 | Initiativen und Roadmap | JBP-03, JBP-04 | JBP-02 | nach 1.0 | Block J | C | offen | – |
| 61 | JBP-05 | Zusagen | JBP-05 | JBP-03 | nach 1.0 | Block J | C | offen | – |
| 62 | JBP-06 | Freigabe und Versionen des Gemeinsamen Plans | JBP-06 | JBP-05, JBP-02, JBP-03 | nach 1.0 | Block J | C | offen | – |
| 63 | JBP-07 | Scorecard und Unterschrift | JBP-07, JBP-08 | JBP-06, ZYK-02 | nach 1.0 | Block J | C | offen | – |
| 64 | JBP-09 | Ist-Werte der Kennzahlen | JBP-09 | JBP-07 | nach 1.0 | Block J | C | offen | – |
| 65 | PNL-01 | Wirkung einrichten und Hebel-Vorlagen | PNL-01, PNL-02, JBP-10 | JBP-03, QBR-03 | nach 1.0 | Block W | B | offen | – |
| 66 | PNL-03 | Baseline und Reifegrade | PNL-03, PNL-04 | PNL-01 | nach 1.0 | Block W | B | offen | – |
| 67 | PNL-05 | Monatswerte Plan und Ist | PNL-05 | PNL-03 | nach 1.0 | Block W | B | offen | – |
| 68 | PNL-06 | Freigabe durch Controlling | PNL-06 | PNL-05, PLT-05b | nach 1.0 | Block W | B | offen | – |
| 69 | PNL-07 | Teilungsregel, Wirkungsarten, Doppelzählung | PNL-07, PNL-08, PNL-09 | PNL-06, LIF-03 | nach 1.0 | Block W | B | offen | – |
| 70 | PNL-10 | P&L-Brücke und Wirkung im Portfolio | PNL-10 | PNL-07, SEG-07 | nach 1.0 | Block W | B | offen | – |
| 71 | PNL-11 | Excel-Export für das Controlling | PNL-11 | PNL-10 | nach 1.0 | Block W | B | offen | – |
| 72 | QS-02 | Kommentare | QS-02 | JBP-03, QBR-03, QS-01 | nach 1.0 | Block R | A | offen | – |
| 73 | QBR-06 | Pre-Read als PDF | QBR-06 | QBR-03, JBP-09 | nach 1.0 | Block R | A | offen | – |
| 74 | QS-03 | Exporte | QS-03, SPL-08, LIF-06 | QBR-06, JBP-06, SPL-07, PUL-03, LIF-02 | nach 1.0 | Block R | A | offen | – |
| 75 | ZYK-04 | Stand der Zyklen | ZYK-04 | ZYK-02 | nach 1.0 | Block R | B | offen | – |
| 76 | ZYK-05 | Neuer Zyklus | ZYK-05 | JBP-06, ZYK-01, SPL-07 | nach 1.0 | Block R | B | offen | – |
| 77 | FS-01 | Hinweise | FS-01, FS-02 | PNL-10, QBR-03, ZYK-02 | nach 1.0 | Block R | A | offen | – |
| 78 | SEG-11 | KI erklärt Abweichungen (Soll) | SEG-11 | SEG-05, PLT-12 | nach 1.0 | Block K | C | offen | Soll |
| 79 | PUL-08 | KI fasst Freitexte zusammen (Soll) | PUL-08 | PUL-03, SEG-11 | nach 1.0 | Block K | C | offen | Soll |
| 80 | SPL-10 | KI-Entwurf der Strategie-Zusammenfassung (Soll) | SPL-10 | SPL-07, SEG-11 | nach 1.0 | Block K | C | offen | Soll |
| 81 | QBR-07 | KI-Entwurf für den Pre-Read (Soll) | QBR-07 | QBR-06, SEG-11 | nach 1.0 | Block K | C | offen | Soll |
| 82 | QS-05 | Suche (Soll) | QS-05 | PLT-12, JBP-03, QBR-03 | nach 1.0 | Block K | B | offen | Soll |

## Stränge

Die Spalte „Strang“ zeigt die Herkunft aus der ursprünglichen Planung zu dritt:

- **A** Oberfläche und Austausch
- **B** Fundament und Wirkung
- **C** Fachlogik

Mit einer Person gilt der Kernpfad. Kommen weitere Personen dazu, lassen sich die Blöcke wieder auf Stränge verteilen. Dann gibt jeder seine Spec ausdrücklich an, z. B. `/spec SEG-03`.
