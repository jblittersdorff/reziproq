# Umsetzungsplan Reziproq

## Warteschlange vom 22.11.2026

Dies ist die einzige aktive Reihenfolge. Das KI-Paket vom 23.11.2026 ist eingeplant (Schritte 10, 11a–c, 34–39; Prüfbericht, Nachtrag). Die Spalte Abhängigkeiten nennt fachliche Voraussetzungen. Ein Verweis auf eine spätere Lieferung schränkt den Umfang des frühen Schritts ein. Wo eine Entscheidung fehlt, ist nur der davon unabhängige Teil einplanbar. Die vollständige Abnahme bleibt am genannten Folgeschritt. Entscheidungen und Spezifikationsfassungen stehen im [Prüfbericht](eingang/PRUEFBERICHT.md).

Der lokale Stand bis `d20ed66` enthält die Lieferantenmodule einschließlich PNL-11, Block R und Block K sowie die erste Designsprache. WG-01, WG-04, WG-06, WG-18, WG-07, WG-09 und WG-10 bauten in dieser Reihenfolge darauf auf (Migrationen 0080–0087). Diese Schritte behalten ihren Platz in der Historie. In der Warteschlange steht nur neue Arbeit. Bei fehlenden Specs ist die Größe eine vorläufige Schätzung. S bezeichnet eine begrenzte Änderung, M eine modulübergreifende Anpassung und L mehrere Daten-, Rechte- oder Oberflächenänderungen.

| Nr. | Spec und Arbeit | Abhängigkeiten für diesen Umfang | Größe | Status |
|---:|---|---|:---:|---|
| 1 | Anpassung Designsprache · Ringe, Diagramme, Informationsdichte | Bestehende Tokens, Bausteine und Referenzen; [Designsprache](design/designsprache.md) und Beispiel auf `/design#insights` | M | fertig |
| 2 | Anpassung NAV-10 · Kopf, Weiterleitungen, Mein Tag, Aktivitäten aus vorhandenen Quellen | 1; NAV-05/06, FS-01, QS-05 und PNL gebaut. Lieferantenzugang und alte Lesezeichen separat testen. LS-01 liefert den Listeninhalt in 3. | L | fertig |
| 3 | Anpassung LS-01 · Lieferantenliste mit Detailleiste | 1–2; PLT-03/07, NAV-12, SEG, ZYK und WG-18 gebaut. Kurzname und Importrecht klären. Agentenzähler in 9. | L | fertig |
| 4 | Anpassung AW-01 · Diagramme und Auswertungen aus bestehenden Daten | 1–3; PNL, JBP-Scorecard und PUL gebaut. KI-Aussagen, Chancen und Risiken folgen in 9 und 11. | L | fertig (ohne KI-Teile, 22.11.2026) |
| 5 | Anpassung KI-01 · Modell-Gateway, Kontingent und bestehende Modellaufrufe | Lieferantenmodule 1.0 und PLT-12. Monatsbudget, Verbrauch und Aufgabe ab 80 % umgesetzt. Je Agentenlauf und für Freigaben folgt die Abnahme mit KI-04 und KI-09. | L | fertig (lokal mit Testanbieter) |
| 6 | Anpassung KI-03 · Käuferentwürfe und Quellen | 5. Neue Entwürfe in SEG-11, PUL-08, SPL-10 und QBR-07 speichern Quellen je Aussage. Altentwürfe ohne eindeutigen Beleg bleiben lesbar. QBR-Vorbereitungen für Lieferanten bleiben separat. Der Link von Mein Tag zu Agenten folgt mit KI-04 in Schritt 7. | L | fertig |
| 7 | KI-04 · Agenten, Werkzeuge und Läufe | 5–6. Systemvorlagen im Code, Aktivierung und Versionen je Organisation. Manueller QBR-Lauf mit Quellenrechten, Rückfragen, Budgets und Fortsetzung. Teilläufe werden bei der Budgetprüfung berücksichtigt. Ihre fachliche Auslösung bleibt offen. QBR-Zeitplan und fachliche Erweiterung in 10. Eigene Agenten in 19. | L | manueller Systemlauf fertig |
| 8 | KI-11 · Wertpotenziale | 7. JBP, Impact-Ledger und SEG. Bei mehreren zutreffenden Sicherheitsregeln gilt die niedrigste Stufe. Vorhandene Rechenregeln prüfen, Websuche in K1 mit fake. | L | fertig (Marktumfeld lokal mit Testquellen, 23.11.2026) |
| 9 | Anpassung NAV-10 / LS-01 / AW-01 · Agentenläufe, Entwürfe, Aussagen und Potenziale anschließen | 2–4, 6–8; Zusammenfassung und Rechte für aggregierte Fakten klären. | M | fertig (Risiko-Karte mit KI-16, Aussagen für Gesichert, Feedback, Scorecard offen) |
| 10 | Anpassung KI-07 · Termin-Briefing (neue Fassung vom 23.11.2026) | 7, 11b; Termine um Verhandlung, Werksbesuch/Audit, Eskalation ergänzen; Agent `qbr_prep` → `meeting_brief`; Outlook-Einladung mit IN-03. | L | fertig (Outlook-Einladung und Transkript mit IN-03, Reiter Ergebnisse mit KI-17) |
| 11a | KI-15 · Import und Zuordnung | 5, 7, WG-01; erweitert den Import aus PLT-07; `pg_trgm`; Datenmodell nach F14. | L | fertig (Fremdwährungen mit F4, Agentenlauf über Gateway) |
| 11b | KI-16 · Hinweise mit Frühwarnung | 7, FS-01; erweitert `hint`, „Wo du handeln musst“ in Mein Tag; `public_event` nur mit Testanbieter. | M | fertig (Suchanbieter, Strategie-Risiko bei `dependency` offen) |
| 11c | KI-17 · Ergebnisse nach dem Termin | 10 (Ziele aus dem Briefing), QBR-01; `meeting_capture`; Dateien erst mit Speicher (KI-18). | L | fertig (F15 zu JBP-06 offen, DOCX/PDF mit KI-18) |
| 11d | Anpassung NAV-10 / AW-01 · Hinweise anschließen | 9, 11b; Risiko und nächste Handlung mit freigegebenen Bewertungsregeln abnehmen. | M | fertig (Feedback-Risiko mit Schritt 20) |
| 12 | IN-01 · Integrationsschicht (I1.1) | 5, 7; Domänendienste, can() und Jobs; alle Anbindungen lokal mit fake. | L | fertig (lokal mit Anbieter fake) |
| 13 | IN-07 · Import-API (I1.2) | 12 und KI-15 (11a); gemeinsamer Stapel für Datei und API. | L | fertig für Lieferantenstamm und Spend (weitere Objektarten mit 35) |
| 14 | Anpassung IN-02 · Firmenanmeldung (I1.3) | 12; PLT-01/02, NAV-10; Identitätsmodell und Erstanmeldung klären. | L | fertig (lokal mit Nachbau; Zitadel-Action für den Betrieb offen) |
| 15 | Anpassung IN-03 · Termine, Zuordnung und Eingang in Mein Tag (I1.4) | 12, 14, 2, 10; QBR-01; privates Terminmodell und Briefingumfang klären. | L | fertig (lokal mit fake; Graph-Abos und Einladen aus Reziproq offen) |
| 16 | IN-04 · Mails in Aktivitäten (I1.5) | 15, 6–7; Anhänge zunächst privat. Dokumentverknüpfung setzt die ausstehende KI-18 voraus. | M | fertig (23.11.2026) |
| W | WEB-01 · Website (öffentliche Seite) | Entwurf „Reziproq Website“ in Claude (11 Seiten); Designsprache und Tokens der App; DE und EN; Rechtstexte durch Anwalt vor Go-live. Unabhängig von der App. | L | fertig (23.11.2026) |
| 17 | IN-06 · Benachrichtigungen (I1.6) | 12, 2, 6, 10, 11b–c, 15; spätere Transkripterinnerung mit 18 abnehmen. | M | fertig (23.11.2026) |
| 18 | IN-05 · Transkripte (I1.7) | 15, 17, KI-17 (11c); Betriebsvereinbarung, Rohtextrechte und Löschfrist klären. | L | offen |
| 19 | KI-09 · eigene Agenten (K3) | 7, K1 und erster Pilot; Rechte beim Fremdstart festlegen. | L | offen |
| 20 | Lieferantenmanagement abschließen · NAV-10, AW-01, KI und IN | 9–19; Umfang der fehlenden KI-18 bis KI-23 klären, Lieferantenanteile ggf. vorher spezifizieren und abnehmen; Rechte, bestehende Lieferantenansicht und alle Lieferantenkriterien lokal testen. | M | offen |
| D | Durchstich · Zitadel-Testorganisation und Microsoft-365-Testmandant echt verbinden | 14, 15, 20; noch ohne AWS. Firmenanmeldung über Entra, Domain bestätigen, Zitadel-Action, ein Termin über Graph. Vorbereitet in `docs/betrieb/durchstich.md`; Prüfung mit `pnpm durchstich:pruefen`. | S | vorbereitet |
| 21 | Anpassung WG-01 / WG-startdaten · Zuordnung und Startdaten | 20; WG-01 und produktive Seed-Dimensionen vorhanden. Pflichtfeld und Katalog vor Eingriff klären. | M | offen |
| 22 | Anpassung WG-04 / WG-06 · Rollen im Entwurf und Aktualisierung der Ist-Werte | 20–21; Strategie und Ziele gebaut. | M | offen |
| 23 | Anpassung WG-18 · Soll-Typ und Segmententscheidung | 20–21; SEG und WG-18 gebaut; Datenhoheit mit WG-15 festlegen. | M | offen |
| 24 | Anpassung WG-07 · Zuweisung von Sichten und Kostenzugriff | 22–23; bestehende Analysen und RLS. | M | offen |
| 25 | Anpassung WG-09 / KI-08 · Marktanalyse als Agent (K2-a) | 7, 20, 24; WG-09 und WG-10 gebaut; sechs Kräfte, Vorschläge und Quellen unter den Rechten des Teams. | L | offen |
| 26 | Anpassung WG-10 · Hebelkatalog und vorgeschlagene Paarungen | 21, 24–25; bestehende Bewertung und Katalogpflege. | M | offen |
| 27 | WG-12 · Scorecard und Quartalsreview | 22, 26; Abnahme von Review nach Freigabe mit WG-16. | M | offen |
| 28 | WG-15 · Supplier Map | 22–23, 26; Ist aus SEG und Spend, Soll-Typ, SRO-Zeilenzugriff; Übergabelink mit WG-20. | M | offen |
| 29 | WG-14 · Vergabeplan | 22, 26, 28 für Warnung bei Soll-Typ „beendet“; übergreifender Widerspruch mit WG-20. | M | offen |
| 30 | WG-16 · Freigabe und Versionen | 27–29 und Schritte 2–9; Review und Freigaberollen gemeinsam abnehmen. | L | offen |
| 31 | WG-20 · Zusammenführung und Übergaben | 23, 28–30; SEG, FS-01 und Lieferantenplan; NAV-10-Warengruppenreiter samt LS-Verweisen abschließen. | L | offen |
| 32 | WG-23 · Entwürfe Stufe 1 und 2 (WG-24) | 5–7, 25, 27–31; KI-Fassung WG-23.neu.md. Zielort für Feedback und Umfang von „Fragen“ klären. | L | offen |
| 33 | KI-13 · Strategie-Autor (K2-b) | 7, 25, 28–32, WG-04–16; Schritt 9 an Soll-Typ und bestätigte SEG-Daten binden. | L | offen |
| 34 | KI-18 · Dokumente und Fundstellen (K2-c) | 5–7; `pgvector`, Objektspeicher EU über `infra/`, OCR lokal mit `tesseract`. | L | offen |
| 35 | KI-19 · Vertragsleck (K2-d) | 34, 11a; Bestellzeilen und Gutschriften als neue Importarten. | L | offen |
| 36 | KI-20 · Szenarien (K2-e) | 8, 11b, WG-16. | L | offen |
| 37 | KI-21 · Verhandlungsvorbereitung (K2-f) | 10, 8, 35, 36. | L | offen |
| 38 | KI-22 · Quartalsbericht SRM (K2-g) | 6, 11b, PNL, Scorecard, JBP. | M | offen |
| 39 | KI-23 · Hilfe für Lieferanten (K3-b) | 5–7, erster Pilot; Ebenen und `billed_org_id` vorher prüfen. | L | offen |
| C1 | Betrieb · AWS EU über OpenTofu (`infra/`): Netz, Datenbank, Server, Speicher, Sicherung, Überwachung | 1–39 | L | offen |
| C2 | Zitadel produktiv · Firmenanmeldung mit App-Registrierungen und Action | C1, D | M | offen |
| C3 | Bedrock EU statt Testanbieter · Budgets und Protokoll mit echten Läufen abnehmen | C1 | M | offen |
| C4 | Microsoft Graph und Google Kalender echt · Abos, Agenda einfügen, Einladen aus Reziproq | C1, D | L | offen |
| C5 | Maildienst EU · Eingangsadresse (SPF/DKIM), SMTP, Website-Formular | C1 | M | offen |
| C6 | Pilot-Daten importieren und Abnahme mit echten Konten | C1–C5 | M | offen |

Festlegung des Gründers vom 23.11.2026: Erst die Lösung lokal vollständig bauen (Schritte bis 39), dann Betrieb und echte Anbieter (Block C). Jede Anbindung läuft bis dahin mit dem Anbieter fake. Nach Schritt 20 prüft ein Durchstich (D) die echten Schnittstellen von Zitadel und Microsoft, ohne AWS. Die Website (W) steht als eigener Schritt nach 16. GitHub dient seit 23.11.2026 nur als Sicherung (Push des Arbeitsbranchs, Workflows aus).

Die ersten vier Schritte priorisieren bestehende Seiten. Der Vorschlag trennt ihre Darstellung von der späteren Datenanbindung. Ob diese Teilabnahmen gelten dürfen, ist im Prüfbericht offen. Die Reihenfolge von I1.1 bis I1.7 folgt der Ergänzungsdatei. Import kommt vor Kalender und Mail, Transkripte nach der Mandantenfreigabe zuletzt. Die Stufe 2 mit Slack, Zoom, Gmail-Add-on, SharePoint/Drive, SFTP, SAP S/4HANA, Qualitätsdaten, SCIM, lesender API und Webhooks hat noch keine Bau-Specs.

K1 läuft lokal mit `fake` für Modelle und Websuche. Für reale Läufe ist `bedrock_eu` vorgesehen, Zugangsdaten kommen aus der Umgebung. Für KI-11 gelten die konfigurierten SEG-Typen und die vorhandenen PNL-Hebelversionen. KI-09 setzt den ersten Pilot voraus. Die Paketnummern K1–K3 und I1 bezeichnen hier Pakete; die externe Release-Nummer für Warengruppen ist offen. Die Warengruppen-Vorlagen, Tabellenzuordnungen und die noch zu bestätigenden Hebeldimensionen stehen im Prüfbericht.

## Historie und frühere Entscheidungen

Die folgenden Abschnitte dokumentieren die Reihenfolge und den damaligen Wissensstand vom 31.10. bis 16.11.2026. Datierte Aussagen wie „offen“ und damalige Terminprognosen gehören zum jeweiligen Stichtag. Für die nächste Arbeit gilt die Warteschlange oben.

<details>
<summary>Frühere Planung und Nachweise in ihrer ursprünglichen Reihenfolge</summary>

> Historischer Stand vor UMB-04. Die Specs sind inzwischen unter `docs/specs/` abgelegt.

Stand: 31.10.2026. Grundlage:
- die 71 neuen Specs und ihre README
- CLAUDE.md
- die bisherigen Specs in `docs/specs`
- der Code auf `main` nach PR #14

## 1. Kurzfassung

- **Fertig:** 2 von 71 Specs. **Teilweise:** 9. **Offen:** 60.
- **Größte Umbauten:**
  - Navigation: globale Leiste oben statt Seitenleiste, keine Pop-ups
  - Rollen kommen aus der Datenbank statt aus Zitadel
  - Tabellen mit englischen Namen und dem neuen Beziehungsmodell
- **Bestehende Daten** sind nur Demo- und Testdaten. Das Risiko ist gering, wenn die Migrationen sie mitnehmen.
- **Vier Umbau-Specs:** UMB-01 bis UMB-04.
- **Arbeitsweise:** Es gibt derzeit einen Gründer. Der Plan folgt deshalb einem **Kernpfad** statt drei paralleler Stränge (Entscheidung 17).
- **Kernpfad:** 38 Specs bzw. Teile in 16 Meilensteinen (M0 bis M15, meist zwei Wochen), vom 2.11.2026 bis zum 4.6.2027, mit einer Woche Pause über Weihnachten. Release 0.1 ist am 9.4.2027 komplett. Danach lässt sich Reziproq mit einem ersten Kunden testen.
- **Vorschlag für Release 1.0 Ende Juni:** genau dieser Kernpfad. Feedback, Gemeinsamer Plan, Wirkung und der Rest folgen in Blöcken danach (Abschnitt 5.3).

## 2. Stand

| Spec | Stand | Belege |
|---|---|---|
| PLT-01 Anmeldung | fertig | PR #11. `apps/web/src/lib/auth.ts`, `features/auth/require-login.tsx`, `api/src/modules/auth/plt-01.test.ts`, `web/e2e/plt-01.spec.ts`. **Kollidiert mit PLT-10/11:** Hinweis als festes Overlay und Neuanmeldung im Popup-Fenster (siehe K5). |
| PLT-02 Organisationen, Mandanten-Session | fertig | PR #14. Migration `packages/db/drizzle/0007_organisationen.sql`, `packages/db/src/plt-02.test.ts`, `api/src/modules/organizations/plt-02.test.ts`, `common/database.module.ts` (TenantDatabase, AccountStore), `org:link`, `db:roles`. |
| PLT-10 Styleguide | teilweise | Tokens, Kontrasttest, Verbot fester Werte, Lucide, 44-px-Test (`src/styles/*`, `features/styleguide/*`, `e2e/plt-10.spec.ts`). **Fehlt:** Verbots-Test für Dialog, Sheet, Toast und Overlay; neue Abschnitte (globale und lokale Leiste, Pfad, Formularseite, Schritte, Bestätigung auf der Seite, Rückmeldezeile, Intern/Geteilt, Verlauf, Zeitachse). Dialog, Sheet und Toast müssen raus. |
| PLT-11 App-Rahmen | teilweise | Rahmen mit Login-Sperre, 404-Seite, Hell/Dunkel, Tastatur, 390 px (`features/shell/*`, `plt-11.test.tsx`, `e2e/plt-11.spec.ts`). **Weicht ab:** Seitenleiste statt Leiste oben, Routen `/uebersicht` und die sechs Bereichsseiten statt `/start`, `/portfolio`, `/wirkung`, `/fragen`, `/profil`. Pfad mit Zurück fehlt. |
| PLT-04 Datenebenen | teilweise | RLS mit FORCE auf allen Tabellen, Rollen `reziproq_api`/`reziproq_app`/`reziproq_anmeldung`, `app.user_id`/`app.org_id` (0004, 0007). **Fehlt:** Register, die Arten `shared`/`org_private`/…, Hilfsfunktionen, `app.can_see_relationship`, `app.customer_org_id`, Test-Gerüst je Ebene, Policies für Schreiben. |
| PLT-03 Beziehungen, Lieferantenliste | teilweise | Lesende Liste mit Suche und Sortierung (`features/suppliers/*`, `api/modules/suppliers/*`). Tabellen `beziehung`, `beziehung_kaeufer` (0003). **Fehlt:** Anlegen, Bearbeiten, Beenden, `status`, USt-IdNr.-Abgleich, `relationship_side`, Spend je Jahr, Profil- und Spend-Seiten, Verlauf. |
| PLT-05 Rollen und Rechte | teilweise | `can()` in `api/src/modules/auth/can.ts`, Rollen aus dem Zitadel-Token (`roles.ts`). **Weicht ab:** Rollen gehören in die Datenbank (`org_role`, `is_controlling`). Es fehlen `permissions.ts`, `docs/rechte.md`, `/me/permissions`, `relationship_member` und die Team-Seite. |
| PLT-09 Deutsch und Englisch | teilweise | Dateien `locales/de.ts`, `en.ts` mit gleichen Schlüsseln (`locales.test.ts`), `Intl` für Beträge (`lib/money.ts`). **Fehlt:** `app_user.locale`, Umschalter auf `/profil`, Glossar, Fehlercodes übersetzt. |
| PLT-12 Fragen-Seite | teilweise | KI-Modul mit Werkzeugen, Testmodell, Protokoll ohne Text und Ratenbegrenzung (`api/modules/prompt/*`, `features/prompt/*`). **Weicht ab:** Dialog statt Seite `/fragen`, `KI_ANBIETER`/`KI_MODELL` statt `AI_PROVIDER`/`AI_MODEL`, Anthropic-SDK statt Vercel AI SDK, Werkzeug `bereich_oeffnen` statt `seite_oeffnen`. |
| NAV-05 Start | teilweise | Begrüßung nach Tageszeit und Fragefeld (`features/overview/*`, `greeting.ts`). Statt der vier Kacheln aus Quellen gibt es sechs Bereichskacheln. |
| SEG-05, SEG-07, PUL-03, PNL-10 | offen, Baustein da | ECharts-Bausteine Matrix, Heatmap, Hantel und Wasserfall mit Diagramm-Tokens (`components/charts/*`). Wiederverwendbar. |

**Offen ohne Vorarbeit** (alle übrigen):
- PLT-08
- NAV-06, NAV-12
- PLT-06, PLT-07
- QS-02, QS-03, QS-05
- SEG-01, SEG-02, SEG-03, SEG-04, SEG-06, SEG-10, SEG-11
- ZYK-01, ZYK-02, ZYK-04, ZYK-05
- PLB-01, PLB-03, PLB-04, PLB-06
- SPL-01, SPL-03, SPL-04, SPL-05, SPL-06, SPL-07, SPL-10
- PUL-01, PUL-02, PUL-06, PUL-08
- LIF-01, LIF-02, LIF-03
- QBR-01, QBR-03, QBR-04, QBR-06, QBR-07
- JBP-01, JBP-02, JBP-03, JBP-05, JBP-06, JBP-07, JBP-09
- PNL-01, PNL-03, PNL-05, PNL-06, PNL-07, PNL-11
- FS-01

Nicht mehr in den neuen Specs: **PLT-13 Betreiber-Zugang**. Er ist gebaut (PR #7) und wird mit UMB-01 an die neuen Regeln angepasst.

## 3. Kollisionen

### 3.1 Code und bisherige Specs gegen neue Specs

| # | Was | Wo im Code | Welche Spec | Was zu tun ist | Aufwand | Risiko für bestehende Daten |
|---|---|---|---|---|---|---|
| K1 | Seitenleiste links statt globaler Leiste oben; Menü als Sheet | `web/src/features/shell/app-layout.tsx`, `app-sidebar.tsx`, `components/ui/sheet.tsx` | PLT-11 | Leiste oben, Menü als eigene Seite, Sheet entfernen | mittel | keins |
| K2 | Nutzer-Menü als Dropdown (Popover mit Inhalt) | `features/shell/user-menu.tsx`, `components/ui/dropdown-menu.tsx` | PLT-10, PLT-11 | Seite `/profil` mit Name, Organisation, Erscheinungsbild und Abmelden | klein | keins |
| K3 | Bausteine Dialog, Sheet und Toast samt Beispielen und Tests | `components/ui/dialog.tsx`, `sheet.tsx`, `toast.tsx`, `features/styleguide/building-blocks.tsx`, `e2e/plt-10.spec.ts`, `main.tsx` (ToastProvider) | PLT-10 | Entfernen; Verbots-Test; Bestätigung und Rückmeldezeile auf der Seite als Baustein | mittel | keins |
| K4 | Prompt-Fenster als Dialog mit Cmd+K | `features/prompt/prompt-dialog.tsx`, `prompt-provider.tsx`, `prompt-trigger.tsx` | PLT-12 | Seite `/fragen`, `/fragen?q=`, Cmd+K öffnet die Seite | mittel | keins |
| K5 | Neuanmeldung: Hinweis als fest positioniertes Overlay, Neuanmeldung im Popup-Fenster | `features/auth/reauth-notice.tsx`, `require-login.tsx` | PLT-01 neu (Hinweis mit Knopf), PLT-10/11 (kein Overlay, kein Fenster) | **UMB-02** | klein | keins |
| K6 | Kundenwahl des Betreibers als Dialog; Header heißt `x-reziproq-kunde`; „Kunde“ bedeutet beim Lieferanten künftig etwas anderes (`app.customer_org_id`) | `features/support/customer-dialog.tsx`, `lib/support.ts`, `api/modules/auth/auth.guard.ts` | keine (PLT-13 fehlt), PLT-04, LIF-02 | **UMB-01** | klein | keins |
| K7 | Routen `/uebersicht`, `/beziehungen`, `/puls`, `/jbp`, `/qbr`, `/pnl`; sechs Bereichskacheln; Liste `areas` | `web/src/routes/_app/*.tsx`, `features/overview/*`, `features/shell/area-page.tsx`, `packages/shared/src/areas.ts`, Prompt-Werkzeug `bereich_oeffnen` | PLT-11, NAV-05, NAV-06, PLT-12 | Neue Routen; alte entfernen; `areas` durch die Ziele der globalen Leiste ersetzen; Werkzeug `seite_oeffnen` | mittel | keins (alte Lesezeichen führen zu 404) |
| K8 | Einstellungen als eine Seite mit Abschnitten (Darstellung, Konto/Rollen, Organisation) | `features/settings/settings-page.tsx` | PLT-11 (Erscheinungsbild auf `/profil`), PLT-05 (`/einstellungen/organisation`), PLT-06 | Unterseiten mit eigener Adresse; Erscheinungsbild und Sprache auf `/profil` | klein | keins |
| K9 | Tabellen mit deutschen Namen `beziehung`, `beziehung_kaeufer` ohne Status, ohne Ende, ohne eigene Nummer | `packages/db/src/schema/beziehung.ts`, `drizzle/0003`, `0004` | PLT-03 | `relationship` (shared, status, ended_at), `relationship_side` (org_private), `relationship_spend` (buyer_private). Migration überführt die Zeilen. | mittel | mittel: Demo-Beziehungen und Spend müssen in die neuen Tabellen umziehen |
| K10 | **Doppelt gespeichert (künftig):** Warengruppe als Freitext an der Beziehung | `beziehung_kaeufer.warengruppe`, `suppliers.service.ts`, Prompt-Werkzeug | PLT-06 | `material_group` und Zuordnung; Freitext überführen: **UMB-03** | klein | mittel: ohne Überführung gehen Warengruppen verloren |
| K11 | Spend nur für ein Jahr je Beziehung | `beziehung_kaeufer.jahresspend_cent`, `spend_jahr` | PLT-03, SPL-04 | `relationship_spend` je Jahr; behebt PLT-03 | – | gering |
| K12 | Kein Register der Datenebenen; Policies von Hand; keine Schreib-Policies | `drizzle/0004_rls.sql`, `0007_organisationen.sql` | PLT-04 | Register, Hilfsfunktionen, alle bestehenden Tabellen eintragen | mittel | gering |
| K13 | `organization` nur in eine Richtung sichtbar (Käufer sieht seine Lieferanten, nicht umgekehrt) | Policy `organization_eigene_und_lieferanten` in `0004` | PLT-04 (Art `global`) | Policy für beide Seiten einer Beziehung | klein | keins |
| K14 | Protokolltabelle `betreiber_zugriff` mit deutschem Namen, nicht im Register | `packages/db/src/schema/betreiber-zugriff.ts` | PLT-04 | In **UMB-01** umbenennen, Art `global` (nur Betrieb) | klein | gering (Einträge werden mitgenommen) |
| K15 | **Doppelt gespeichert:** Rollen im Zitadel-Token (`admin`, `nutzer`, `leser`, `controlling`, `betreiber`), künftig zusätzlich in der Datenbank | `api/modules/auth/roles.ts`, `can.ts`, `packages/shared/src/me.ts` (`roles`) | PLT-05: Rollen nur in der Datenbank, `org_role` admin/member/viewer und `is_controlling` | Bestehende Zitadel-Rollen einmalig übernehmen, dann nicht mehr lesen; `betreiber` regelt UMB-01 | mittel | mittel: neue Nutzer starten als `viewer`. Ohne Übernahme verlieren Admins ihre Rechte. |
| K16 | `can(user, action)` ohne Ressource; keine Matrix-Datei, kein `docs/rechte.md`, kein `/me/permissions` | `can.ts`, `me.service.ts` (`permissions`) | PLT-05 | `permissions.ts`, `can(user, action, resource)`, Endpunkt | mittel | keins |
| K17 | Rollenanzeige unter Einstellungen (Zusatz aus PLT-01) | `settings-page.tsx`, `/me.roles` | PLT-05 | Zeigt künftig die Rolle aus der Datenbank auf `/profil`; der Zitadel-Bezug entfällt | klein | keins |
| K18 | Sprache nur im Browser-Zustand, startet immer auf Deutsch | `web/src/lib/i18n.tsx` | PLT-09 | `app_user.locale`, Umschalter auf `/profil` | – (in PLT-09) | keins |
| K19 | KI-Konfiguration und SDK | `api/src/config/env.ts`, `modules/prompt/anthropic-model.ts`, `.env.example` | PLT-12 | `AI_PROVIDER`/`AI_MODEL`, Vercel AI SDK (Apache-2.0), Anbieter `bedrock` | mittel | keins (Umgebungsvariablen umbenennen) |
| K20 | Abschnitt „Organisation“ für alle Mitglieder (unsere Abweichung in PR #14) gegenüber neuem PLT-11 „Weg zu den Einstellungen nur für Admin“ | `settings-page.tsx`, `ContentGate` in `app-layout.tsx` | PLT-02, PLT-05, PLT-11 | Entscheidung 4: `/profil` zeigt allen den Weg zu `/einstellungen/organisation`, nur lesen | klein | keins |
| K21 | Unsere Anpassungen stehen nicht in den neuen Fassungen: Rollenanzeige, Popup, `reziproq_api`, `db:roles`, Kundenliste für Betreiber, Beispieldaten mit 15 Lieferanten | `docs/specs/PLT-01.md`, `PLT-02.md`, `PLT-11.md`, `README.md` | alle | **UMB-04** | klein | keins |
| K22 | Beispieldaten passen nicht zum neuen Muster: Test-Lieferant ohne Beziehung; Spend nur ein Jahr; keine USt-IdNr.; „Beispiel AG (Demo)“ aus den Vorschlägen in PLT-12 fehlt | `packages/db/src/seed.ts` | PLT-03, PLT-12 | Behebt PLT-03 (Seed); „Beispiel AG (Demo)“ ergänzen | klein | keins |
| K23 | Migrationen aus parallelen Branches kollidieren im Drizzle-Journal | `packages/db/drizzle/meta/_journal.json` | alle Stränge | Allein entfällt das. Bei mehreren Personen: Migration erst nach dem Rebase auf `main` erzeugen | – | gering |

### 3.2 Widersprüche zwischen den neuen Specs

| # | Was | Specs | Vorschlag |
|---|---|---|---|
| W1 | „Bis PLT-05 gilt jeder Nutzer als Admin“, aber PLT-02 ist mit Zitadel-Rollen umgesetzt, und PLT-05 legt Rollen in die Datenbank | PLT-02, PLT-11, PLT-05 | Satz streichen; bis PLT-05 gelten die Zitadel-Rollen weiter |
| W2 | Organisation und Mitglieder sieht jeder (PLT-02, PLT-05: „Organisation und Mitglieder sehen: alle Rollen“), aber der Weg zu den Einstellungen ist nur für Admins sichtbar | PLT-02, PLT-05, PLT-11 | Entscheidung 4 |
| W3 | `/…/plan/freigabe` und `/…/plan/versionen` gibt es zweimal: Lieferantenplan (unter `/strategie/plan`) und Gemeinsamer Plan (`/lieferanten/<id>/plan`) | SPL-01, SPL-07, JBP-01, JBP-06 | Lieferantenplan unter `/lieferanten/<id>/strategie/lieferantenplan/…` |
| W4 | „Zu Initiative zusammenführen“ braucht Initiativen; `jbp_topic` hat kein Feld für die Initiative | JBP-02, JBP-03 | Zusammenführen nach JBP-03 verschieben, Verknüpfung über `initiative_topic` |
| W5 | Teilnehmende des Lieferanten sind `org_private` der Lieferantenseite, werden aber vom Käufer angelegt. Antworten kommen ohne Anmeldung, also ohne Mandanten-Session. `survey_response` soll `org_private` sein, hat aber keine `org_id`. | PUL-02 | Teilnehmende als `shared` mit `owner_org_id` (einladende Seite) und `visibility = internal`; Antworten über eine eng gefasste Datenbankfunktion mit Token (wie die Anmeldefunktionen aus PLT-02); `org_id` der antwortenden Seite ergänzen |
| W6 | Die Liste nach „@“ ist eine aufklappende Liste mit Inhalt, Popover sind verboten | QS-02, PLT-10 | Vorschlagsliste fest unter dem Feld im Seitenfluss |
| W7 | QBR-04 schreibt Einstellungen beider Seiten in `cycle_settings`; das ist käuferprivat und nur für den Zyklus gedacht | QBR-04, ZYK-02 | Eigene Tabelle `org_setting` (`org_private`) für Erinnerungstage |
| W8 | CLAUDE.md: „Jede gemeinsame Initiative trägt ihre GuV-Wirkung“; PNL-01: Wirkung wird bei Bedarf eingerichtet, Initiativen ohne Wirkung sind möglich | CLAUDE.md, PNL-01, JBP-03 | CLAUDE.md präzisieren: „sobald Wirkung eingerichtet ist“ |
| W9 | Kopfzeilen nennen mehr Abhängigkeiten als die README, z. B. SEG-03→PLT-06, QBR-01→NAV-05, JBP-01/JBP-07→ZYK-02, PUL-02→PLT-07, SPL-01→PLT-06, QS-03→SPL-07/PUL-03/LIF-02, PNL-10→SEG-07 | mehrere | Der Plan nutzt die Vereinigung. Die Reihenfolge der README erfüllt sie bereits. README angleichen (UMB-04). |
| W10 | Verweise auf Anforderungs-IDs statt Specs: PLT-04 nennt „SEG-07, JBP-04“ für Freigaben, PLT-08 „QBR-02“ für Erinnerungen | PLT-04, PLT-08 | In UMB-04 auf SEG-10/JBP-06 bzw. QBR-04 korrigieren |
| W11 | PLT-12 steht in Strang A, braucht aber NAV-06 und PLT-06, und ist großteils schon gebaut | README | Als Umbau in Woche 6 einplanen |
| W12 | NAV-05: „Bis PLT-12 ist das Feld nicht da“, die Fragen-Funktion gibt es aber schon | NAV-05 | Feld führt zu `/fragen` (nach K4) |

## 4. Umbau-Specs (noch keine Dateien, kommen mit UMB-04)

### UMB-01 Betreiber-Zugang nach dem neuen Muster

Release 0.1 · baut auf PLT-11, PLT-05a · ersetzt den Dialog aus PLT-13

**Ziel:** Als Mitarbeiter von Reziproq wechsle ich auf einer eigenen Seite in einen Kunden und sehe die App wie er. Jeder Zugriff ist protokolliert.

**Wer darf was:**
- Betreiber: Kundenliste sehen, wechseln, Ansicht verlassen; nur lesen.
- Käufer und Lieferant: nichts davon.

**Daten:**
- `betreiber_zugriff` wird zu `support_access_log`, Art `global` (nur Betrieb), ohne Lesezugriff für die API-Rolle. Die bestehenden Einträge bleiben.
- Betreiber-Recht: Flag `is_operator` an `app_user`, gesetzt per Skript `pnpm operator:set <email>` (Entscheidung 2). Die Zitadel-Rolle `betreiber` entfällt.
- Header `x-reziproq-kunde` wird zu `x-reziproq-support-org`, Speicherschlüssel entsprechend. So bleibt „Kunde“ frei für `app.customer_org_id` (LIF-02).

**Ablauf:**
1. `/profil` zeigt Betreibern den Weg „In einen Kunden wechseln“. Er führt zu `/betreiber/kunden`.
2. Die Seite listet die Kunden mit Feature `buyer` als Kacheln. Ein Klick wechselt und führt zu `/start`.
3. Die Hinweisleiste bleibt oben im Seitenfluss, mit „Verlassen“.

**Fertig, wenn:**
- Es gibt keinen Dialog mehr (Prüfung aus PLT-10).
- `/betreiber/kunden` ist per Adresse erreichbar, für Nicht-Betreiber 403.
- Jeder Zugriff landet im Protokoll; die API-Rolle kann es nicht lesen.
- Die Umbenennung verliert keine Einträge.
- Die Tests aus PLT-13 laufen weiter.

**Nicht Teil:** Schreibrechte für Betreiber.

### UMB-02 Neu anmelden ohne Fenster und Overlay

Release 0.1 · baut auf PLT-01, PLT-10

**Ziel:** Scheitert die Erneuerung des Tokens, melde ich mich neu an, ohne dass sich ein Fenster oder Overlay öffnet. Was ich eingegeben habe, bleibt erhalten.

**Wer darf was:** jeder angemeldete Nutzer.

**Daten:**
- Entwurf der offenen Formularfelder kurz in `sessionStorage`, nie Tokens.
- Gelöscht nach der Wiederherstellung oder nach 30 Minuten.

**Ablauf:**
1. Ein Hinweis „Bitte melde dich neu an“ steht als Rückmeldezeile oben im Seitenfluss, nicht fest positioniert.
2. Der Knopf speichert den Entwurf, leitet zu Zitadel weiter und kehrt zur selben Adresse zurück.
3. Dort werden die Felder wiederhergestellt.

**Fertig, wenn:**
- Es gibt kein Popup und kein fest positioniertes Element (Test).
- Nach der Neuanmeldung steht der Text wieder im Feld (Playwright).
- `sessionStorage` enthält nie ein Token.

**Nicht Teil:** Entwürfe über Gerätewechsel hinweg.

### UMB-03 Bestandsdaten in die neuen Tabellen überführen

Release 0.1 · baut auf PLT-03, PLT-06

**Ziel:** Nach dem Umbau fehlt nichts: Warengruppen und Spend der bestehenden Beziehungen stehen an ihrem neuen Ort, und nichts liegt mehr doppelt.

**Wer darf was:** keine Oberfläche.

**Daten:**
- Freitext `beziehung_kaeufer.warengruppe` wird je Organisation zu `material_group` (Code aus dem Namen), dazu `relationship_material_group` mit `is_primary`.
- `jahresspend_cent`/`spend_jahr` wird zu `relationship_spend` (`source = import`).
- Danach entfällt `beziehung_kaeufer`.

**Ablauf:** eine Migration, idempotent, mit Protokoll der überführten Zeilen.

**Fertig, wenn:**
- Ein Test füllt den Stand vor der Migration, migriert und vergleicht.
- Keine Warengruppe und kein Spend fehlt.
- `beziehung_kaeufer` existiert nicht mehr.
- Die Prüfungen aus PLT-04 laufen für alle neuen Tabellen.

**Nicht Teil:** Zusammenführen ähnlich geschriebener Warengruppen.

### UMB-04 Specs und Dokumente zusammenführen

Release 0.1 · keine Abhängigkeit · nur Dokumente

**Ziel:** In `docs/specs` steht ein Stand, der zum Code passt. Jede bewusste Abweichung ist sichtbar.

**Daten:**
- Die 71 neuen Specs und die README ersetzen `docs/specs`.
- `PLT-13.md` bleibt, angepasst an UMB-01.
- `UMB-01.md` bis `UMB-03.md` kommen dazu.
- In PLT-01, PLT-02 und PLT-11 die Entscheidungen aus PR #11 und #14 nachtragen: `reziproq_api`/`db:roles`, Kundenliste für Betreiber, 15 Demo-Lieferanten, Rollenanzeige.
- W1, W3, W4, W5, W6, W7, W8, W9 und W10 nach den Entscheidungen in Abschnitt 6 korrigieren.
- Release-Spalte der README nach Abschnitt 7.1 anpassen und den Kernpfad aus Abschnitt 5.2 als Reihenfolge eintragen.
- `CLAUDE.md`: Regel zur GuV-Wirkung präzisieren (W8).
- Status: PLT-01 und PLT-02 auf „fertig“, die teilweise umgesetzten auf „offen“ mit Vermerk.

**Fertig, wenn:**
- Die README listet 71 + 4 Specs mit Status.
- Jede Abweichung aus Abschnitt 3 ist entweder behoben oder als Entscheidung vermerkt.

## 5. Plan

### 5.1 Regeln

- **Eine Person, eine Spec je Woche.** Kleine Umbau-Specs (UMB-01, UMB-02, UMB-03) laufen in derselben Woche mit, weil sie nur einen bis zwei Tage brauchen.
- **Woche 1** beginnt am Montag, dem 2.11.2026. In der Woche vom 21.12. ruht die Arbeit, sie zählt nicht mit.
- **Sichtbares zuerst:** Wo die Abhängigkeiten es erlauben, wechseln sich Fundament und sichtbare Seiten ab. So gibt es alle zwei Wochen etwas Neues im Browser.
- **Stränge:** Die Spalte „Strang“ der README gilt nur noch als Herkunft. Kommen weitere Personen dazu, lassen sich die Blöcke aus 5.3 wieder auf Stränge verteilen.
- **Zu groß für einen PR** und geteilt in zwei PRs nacheinander: PLT-03, PLT-05, PLT-07, PUL-02, QBR-01, LIF-01.

**Vorschläge zum Teilen:**

| Spec | Teil a | Teil b |
|---|---|---|
| PLT-03 | Neues Datenmodell, Migration aus `beziehung`, Seed, Liste mit Kennzahlen | Anlegen, Bearbeiten, Beenden, Profil- und Spend-Seiten mit Verlauf |
| PLT-05 | Rollen in der Datenbank, Übernahme aus Zitadel, `permissions.ts`, `/me/permissions`, `/einstellungen/organisation` | `relationship_member`, Team-Seite, Teamrolle Leser |
| PLT-07 | Baustein Import (Upload, Vorschau, Fehlerdatei), Lieferanten und Spend | Business Units und Kontakte, `lieferanten-50.xlsx` |
| PUL-02 | Welle anlegen und einladen | Beantworten über `/umfrage/<token>` ohne Anmeldung |
| QBR-01 | Termine mit Agenda, Teilnehmenden und Protokoll | Live-Abschnitte, Abschließen mit Einfrieren, Termin-Quelle |
| LIF-01 | Einladung und Annahme mit nachgebautem Zitadel | Anlage der Zitadel-Organisation über die Verwaltungsschnittstelle |

**Abweichung von der README-Reihenfolge:** PLT-03 ist in a und b geteilt. PLT-03a braucht nur PLT-04 und kommt deshalb vor PLT-08. PLT-03b mit dem Verlauf folgt nach PLT-08. Alle übrigen Abhängigkeiten der README und der Kopfzeilen der Specs (W9) sind eingehalten.

### 5.2 Kernpfad bis Release 1.0

#### M0 · 2.–3.11. · Dokumente

- **Specs:** UMB-04
- **Demo:** keine Oberfläche. `docs/specs/README.md` zeigt alle Specs mit Status und den Kernpfad.

#### M1 · Woche 1–2 · Neuer Rahmen ohne Pop-ups

| Woche | Spec |
|---|---|
| 1 | PLT-10 (Umbau), dazu UMB-02 |
| 2 | PLT-11 |

**Demo:**
- `/styleguide`: Leisten, Pfad, Formularseite, Schritte, Bestätigung auf der Seite, Rückmeldezeile; kein Dialog mehr
- `/start`, `/lieferanten`, `/portfolio`, `/wirkung`, `/fragen`, `/profil`, `/einstellungen` mit Titel und leerem Zustand
- bei 390 px: Menüknopf, dann `/menu` als eigene Seite
- Zurück-Pfeil und Browser-Zurück über drei Ebenen
- Neuanmeldung ohne Popup: Text eingeben, Token ablaufen lassen, neu anmelden, Text steht noch da

**Seed:** unverändert.

#### M2 · Woche 3–4 · Datenebenen und neues Beziehungsmodell

| Woche | Spec |
|---|---|
| 3 | PLT-04 |
| 4 | PLT-03a |

**Demo:**
- `/lieferanten`: 15 Demo-Lieferanten mit eigener Nummer und dem Spend des letzten vollen Jahres, Anzahl und Gesamtspend; Suche und Sortierung in der Adresse
- als Zweit-OEM: drei gemeinsame Lieferanten mit eigenen Werten

**Seed:**
- Beziehungen im neuen Modell, USt-IdNr. je Lieferant, Spend 2024 und 2025
- Test-Lieferant als `draft` bei beiden OEMs
- „Beispiel AG (Demo)“

#### M3 · Woche 5–6 · Verlauf und Lieferanten pflegen

| Woche | Spec |
|---|---|
| 5 | PLT-08 |
| 6 | PLT-03b |

**Demo:**
- `/lieferanten/neu`: anlegen, mit Hinweis „wird verknüpft“ bei vorhandener USt-IdNr.
- `/lieferanten/<id>/strategie/profil`: Verlauf, Bearbeiten, Beziehung beenden mit Bestätigung auf der Seite
- `/lieferanten/<id>/strategie/spend` mit Jahr hinzufügen
- `/lieferanten?beendet=1`
- `/styleguide`: Baustein Verlauf

**Seed:** Verlaufseinträge zu drei Lieferanten.

#### M4 · Woche 7–8 · Rollen, Team und Betreiber-Seite

| Woche | Spec |
|---|---|
| 7 | PLT-05a |
| 8 | PLT-05b, dazu UMB-01 |

**Demo:**
- `/profil`: eigene Rolle, Weg zu `/einstellungen/organisation` (für alle, nur lesen)
- `/einstellungen/organisation/<nutzer>`: Rolle und Controlling ändern (Admin)
- als Leser: kein Knopf „Lieferant hinzufügen“, die API antwortet mit 403
- `/lieferanten/<id>/beziehung/team` und `/…/team/bearbeiten`
- `/betreiber/kunden`: Wechsel in Test-OEM, Hinweisleiste, Verlassen

**Seed:**
- je OEM ein Admin, ein Nutzer, ein Leser, ein Controlling-Haken
- Teams mit SRO für fünf Lieferanten

#### M5 · Woche 9–10 · Arbeitsbereich je Lieferant und Englisch

| Woche | Spec |
|---|---|
| 9 | NAV-06 |
| 10 | PLT-09 |

**Demo:**
- `/lieferanten/<id>`:
  - lokale Leiste, Kopf mit SRO
  - sechs Kacheln, Release-Hinweise
  - Kennzeichen „Intern“ im Bereich Strategie
- `/lieferanten/<id>/strategie` mit Kacheln
- `/profil`: Sprache Englisch, alle Seiten auf Englisch, auch nach erneuter Anmeldung

**Seed:** `app_user.locale` für einen Testnutzer auf `en`.

#### M6 · Woche 11–12 · Stammdaten und Import

| Woche | Spec |
|---|---|
| 11 | PLT-06, dazu UMB-03 |
| 12 | PLT-07a, PLT-07b |

**Demo:**
- `/einstellungen/business-units`, `/einstellungen/warengruppen`
- `/lieferanten/<id>/strategie/profil/zuordnung`; Haupt-Warengruppe auf den Karten
- Import:
  - `/lieferanten/importieren`
  - `docs/demo/lieferanten-50.xlsx` mit drei Fehlerzeilen, Fehlerdatei herunterladen
  - zweiter Import meldet „unverändert“

**Seed:**
- je OEM drei BUs und sechs Warengruppen in zwei Ebenen; der Zweit-OEM mit eigenen Werten
- Zuordnung aller Demo-Lieferanten
- Seed-Option `pnpm db:seed --viele` lädt die 50 Lieferanten

#### M7 · Woche 13–14 · Fragen-Seite und E-Mails

| Woche | Spec |
|---|---|
| 13 | PLT-12 (Umbau) |
| 14 | QS-01 |

**Demo:**
- Cmd+K öffnet `/fragen`
- „Welche Lieferanten haben wir in der Warengruppe Elektronik?“, Treffer als Karten
- „Öffne den Spend von Beispiel AG (Demo)“ führt zur Spend-Seite
- `http://localhost:8025` (Mailpit): Testmail auf Deutsch und Englisch

**Seed:** keine Änderung. `docker-compose.yml` bekommt Mailpit.

#### M8 · Woche 15–16 · Segmentmodell und Bewertungsrunde

| Woche | Spec |
|---|---|
| 15 | SEG-01 |
| 16 | SEG-03 |

**Demo:**
- `/einstellungen/segmentmodell`: Kriterien, Gewichte, Grenzen, Typen; Entwurf aktivieren
- `/portfolio/runden/neu` in vier Schritten, Einladungen in Mailpit
- `/portfolio/runden/<id>` mit Fortschritt

**Seed:** Standard-Segmentmodell für beide OEMs, eine offene Runde mit zehn Lieferanten.

#### M9 · Woche 17–18 · Bewerten und Start

| Woche | Spec |
|---|---|
| 17 | SEG-04 |
| 18 | NAV-05 |

**Demo:**
- `/bewertungen` und `/bewertungen/<id>`: Regler Ist und Soll, später fortsetzen, Zusammenfassung mit Matrix, abgeben
- `/start`: „Fällig bei mir“ mit offenen Bewertungen, `/start/faellig`; Fragefeld führt zu `/fragen?q=…`

**Seed:** Bewertungen teils abgegeben, teils als Entwurf.

#### M10 · Woche 19–20 · Segmentierung je Lieferant

| Woche | Spec |
|---|---|
| 19 | SEG-05 |
| 20 | SEG-06 |

**Demo:**
- `/lieferanten/<id>/strategie/segmentierung`:
  - Matrix, Tabelle je BU und Warengruppe, Heatmap der Abweichungen
  - Klick auf ein Kriterium zeigt die Begründungen
- Konsolidieren in mehreren Schritten; danach zeigt der Kopf Ist → Soll

**Seed:** vollständig abgegebene Bewertungen für sechs Lieferanten, eine Konsolidierung.

#### M11 · Woche 21–22 · Portfolio und Fokus (Release 0.1 komplett)

| Woche | Spec |
|---|---|
| 21 | SEG-07 |
| 22 | SEG-02 |

**Demo:**
- `/portfolio` mit Kacheln
- `/portfolio/matrix` mit Filter (mit `--viele` 50 Lieferanten)
- `/portfolio/offen`
- `/portfolio/fokus` mit Vorschlägen und Begründung; Abzeichen „Fokus“ auf Karten und im Kopf

**Seed:** Konsolidierungen für zwanzig Lieferanten, acht Fokuslieferanten.

#### M12 · Woche 23–24 · Filter und Lieferanten einladen

| Woche | Spec |
|---|---|
| 23 | NAV-12 |
| 24 | LIF-01a, LIF-01b |

**Demo:**
- `/lieferanten?bu=…&wg=…&typ=…&fokus=1&meine=1`; Zurück aus einem Lieferanten behält die Filter
- `/lieferanten/<id>/beziehung/team/einladen`, Mail in Mailpit, `/einladung/<token>` in drei Schritten

**Seed:** eine offene Einladung beim Test-Lieferanten.

#### M13 · Woche 25–26 · Lieferantenzugang und Spielregel-Katalog

| Woche | Spec |
|---|---|
| 25 | LIF-02 |
| 26 | PLB-01 |

**Demo:**
- als Lieferant: `/start`, `/kunden`, `/kunden/<beziehung>` ohne Bereich Strategie; Kundenwechsel behält den Bereich
- `/einstellungen/spielregeln`: Rechte, Pflichten, Formate, Vorschau je Typ

**Seed:**
- Test-Lieferant bei beiden OEMs aktiv, mit zwei Nutzern
- Standardkatalog Spielregeln und Formate

#### M14 · Woche 27–28 · Spielregeln je Beziehung und Freigabe an den Lieferanten

| Woche | Spec |
|---|---|
| 27 | PLB-03 |
| 28 | SEG-10 |

**Demo:**
- `/lieferanten/<id>/beziehung/spielregeln`: Vorschlag übernehmen, bearbeiten mit Begründung, intern freigeben
- `/…/spielregeln/teilen`; danach sieht der Lieferant Typ und Spielregeln

**Seed:** Spielregeln für drei Fokuslieferanten, eine davon geteilt.

#### M15 · Woche 29–30 · Termine und Maßnahmen (Kernpfad komplett)

| Woche | Spec |
|---|---|
| 29 | QBR-01a, QBR-01b |
| 30 | QBR-03 |

**Demo:**
- `/lieferanten/<id>/umsetzung/termine`: neuer Termin aus den Formaten, Agenda, Protokoll, Abschließen
- Termin im Kopf und auf Start beider Seiten
- `/lieferanten/<id>/umsetzung/massnahmen` mit Filtern, Maßnahme aus Termin, `/start/massnahmen`
- dieselben Seiten als Lieferant unter `/kunden/<beziehung>/umsetzung/…`

**Seed:** zwei Termine je Fokuslieferant, Maßnahmen beider Seiten, zwei davon überfällig.

**Zeitplan:** 30 Arbeitswochen plus eine Woche Weihnachtspause. Ende Woche 30 ist der 4.6.2027. Bis Ende Juni bleiben gut drei Wochen Puffer für Feinschliff und den Testlauf mit dem ersten Kunden.

### 5.3 Nach dem Kernpfad: Blöcke in der Reihenfolge des Kundennutzens

Die Reihenfolge der Blöcke wird nach dem Testlauf entschieden. Innerhalb eines Blocks gelten die Abhängigkeiten der README.

| Block | Specs | Wochen | Braucht |
|---|---|---|---|
| F Feedback | PUL-01, PUL-02a/b, PUL-03, PUL-06, LIF-03, PLB-04 | etwa 7 | Kernpfad |
| S Lieferantenwissen | SPL-04, SPL-05 | 2 | Kernpfad |
| P Zyklus und Lieferantenplan | ZYK-01, ZYK-02, SPL-01, SPL-03, SPL-06, SPL-07, QBR-04, PLB-06 | 8 | Kernpfad; PLB-06 braucht PLT-07 |
| J Gemeinsamer Plan | JBP-01, JBP-02, JBP-03, JBP-05, JBP-06, JBP-07, JBP-09 | 7 | F (PUL-03) und P (SPL-07, ZYK-02) |
| W Wirkung | PNL-01, PNL-03, PNL-05, PNL-06, PNL-07, PNL-10, PNL-11 | 7 | J (JBP-03); PNL-07 braucht LIF-03 aus F |
| R Rest | QS-02, QBR-06, QS-03, ZYK-04, ZYK-05, FS-01 | 6 | J und W |
| K KI und Suche (Soll) | SEG-11, PUL-08, SPL-10, QBR-07, QS-05 | 5 | jeweils ihr Modul; ganz am Ende, bei Zeitnot gestrichen |

**Wichtig für die Reihenfolge:** Wirkung (W) hängt an den Initiativen aus dem Gemeinsamen Plan (JBP-03). Soll die Wirkung früher kommen als F, P und J (zusammen etwa 22 Wochen), braucht es eine kleine Zusatz-Spec, die Initiativen auch ohne Gemeinsamen Plan erlaubt. Die Quelle `action` aus PNL-01 deutet das schon an. Siehe Abschnitt 7.

Mit einer Person ergeben die Blöcke F bis R rund 37 weitere Wochen, also etwa bis Ende Februar 2028. Mit weiteren Personen lassen sich F, S und P parallel bauen.

## 6. Entscheidungen

Am 31.10.2026 nach Empfehlung getroffen. UMB-04 überträgt sie in die Specs.

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Betreiber-Zugang (PLT-13) behalten? | Ja, mit eigener Seite statt Dialog (UMB-01). |
| 2 | Betreiber-Recht | Flag `is_operator` an `app_user`, gesetzt per Skript `pnpm operator:set <email>`. Nicht mehr aus Zitadel. |
| 3 | Neuanmeldung | Weiterleitung mit kurz gespeichertem Formularentwurf statt Popup (UMB-02). |
| 4 | Organisation sehen | `/profil` zeigt allen den Weg zu `/einstellungen/organisation` (nur lesen); alles andere unter Einstellungen nur Admins. |
| 5 | Rollen aus Zitadel | Einmalige Übernahme nach `org_role` (admin bleibt admin, nutzer wird member, leser wird viewer, controlling wird `is_controlling`), danach keine Zitadel-Rollen mehr. Teil von PLT-05a. |
| 6 | KI-SDK | Vercel AI SDK (`ai`, Apache-2.0, gepinnt), `AI_PROVIDER`/`AI_MODEL`. Im Umbau von PLT-12. |
| 7 | Adressen des Lieferantenplans (W3) | `/lieferanten/<id>/strategie/lieferantenplan/…` |
| 8 | Themen zusammenführen (W4) | in JBP-03, Verknüpfung über `initiative_topic` |
| 9 | Feedback ohne Anmeldung (W5) | Teilnehmende als geteilte Zeilen der einladenden Seite (`visibility = internal`); Antworten über eine eng gefasste Datenbankfunktion mit Token; `org_id` der antwortenden Seite an `survey_response` |
| 10 | Erwähnungen (W6) | Vorschlagsliste fest unter dem Feld im Seitenfluss |
| 11 | Erinnerungstage (W7) | eigene Tabelle `org_setting` (`org_private`) |
| 12 | CLAUDE.md (W8) | „Jede gemeinsame Initiative trägt ihre GuV-Wirkung, sobald Wirkung eingerichtet ist …“ |
| 13 | Strangwechsel | Entfällt, solange es eine Person gibt; der Plan folgt dem Kernpfad. |
| 14 | Soll-Specs | ans Ende (Block K), bei Zeitnot streichen |
| 15 | Teilung großer Specs | ja, sechs Specs in je zwei PRs |
| 16 | 50 Lieferanten | als `docs/demo/lieferanten-50.xlsx`; Seed bleibt bei 15, `pnpm db:seed --viele` lädt die 50 |
| 17 | Arbeiten allein | Kernpfad statt dreier Stränge; Umfang von 1.0 bewusst verkleinern |

**W1 und W10** werden in UMB-04 ohne weitere Entscheidung korrigiert:
- **W1:** „Bis PLT-05 gilt jeder als Admin“ wird zu „Bis PLT-05 gelten die Zitadel-Rollen“.
- **W10:** falsche Verweise korrigieren.

## 7. Weitere Entscheidungen

Am 31.10.2026 bestätigt.

1. **Umfang von Release 1.0:** 1.0 Ende Juni 2027 ist genau der Kernpfad (M0 bis M15). Die Blöcke F bis K folgen als 1.1, 1.2 usw. UMB-04 passt die Release-Spalte der README an.
2. **Wirkung:** keine Zusatz-Spec. Block W folgt nach F, P und J, weil er die Initiativen aus JBP-03 braucht.
3. **Reihenfolge der Blöcke:** F, S, P, J, W, R, K. Nach dem Testlauf im Juni wird sie noch einmal geprüft. Am 8.11.2026 geändert, siehe 8.

## 8. Testlauf-Pfad (Entscheidung vom 8.11.2026)

Der Kernpfad ist bis auf QBR-01b und QBR-03 gebaut, aus Block P fehlen nur SPL-07, QBR-04 und PLB-06. Der Gründer möchte bald einen Testlauf mit einem Lieferanten durch alle Funktionen machen:

- Segmentierung je Warengruppe
- Terminvorbereitung
- Joint Business Planning
- Business Impact Scorecard
- Maßnahmen mit ihrer Nachverfolgung

Dafür gilt diese Reihenfolge vor den übrigen Blöcken:

| # | Spec | Wofür im Testlauf |
|---|---|---|
| 1 | UMB-05 | Einfachere Oberfläche: nur Gebautes, ein Lieferant auf einer Seite, Start als Aufgabenliste |
| 2 | QBR-01b | Termin live führen, abschließen, nächster Termin auf Start |
| 3 | QBR-03 | Maßnahmen dokumentieren und ihren Stand verfolgen |
| 4 | SPL-07 | Lieferantenplan freigeben, Eingang ins JBP |
| 5 | JBP-01 | Vorbereitung des Joint Business Planning |
| 6 | JBP-02 | Themen beider Seiten |
| 7 | JBP-03 | Initiativen und Roadmap |
| 8 | JBP-05 | Zusagen |
| 9 | JBP-06 | Freigabe und Versionen des Gemeinsamen Plans |
| 10 | JBP-07 | Scorecard mit Zielwerten und Unterschrift (Business Impact Scorecard) |
| 11 | JBP-09 | Ist-Werte der Kennzahlen |
| 12 | PNL-01 | Wirkung einrichten, Hebel |
| 13 | PNL-03 | Baseline und Reifegrade |
| 14 | PNL-05 | Monatswerte Plan und Ist |
| 15 | PNL-06 | Freigabe durch Controlling |

- **JBP-01 ohne PUL-03:** Das Feedback-Ergebnis ist in JBP-01 ohnehin nur sichtbar, wenn es aufgedeckt ist. Bis Block F gebaut ist, entfällt der Abschnitt. Die Abhängigkeit ist damit weich.
- **Danach:** F (Feedback), dann der Rest von P (QBR-04, PLB-06), S, PNL-07 bis PNL-11, R und K.

## 9. Lieferantenmanagement vor Warengruppenmanagement (Entscheidung vom 15.11.2026)

Das Warengruppenmanagement (Specs `WG-01` bis `WG-23` und `WG-startdaten.md`, abgelegt unter
`docs/reziproq-specs-warengruppen/`) wird erst nach dem Lieferantenmanagement umgesetzt.

1. **Zuerst** werden alle Specs des Lieferantenmanagements bis einschließlich Release 1.0 fertig:
   umgesetzt, alle Kriterien unter „Fertig, wenn“ durch Tests belegt, alles lokal grün
   (`pnpm check`). Offen sind am 15.11.2026 Block R (QS-02, QBR-06, QS-03, ZYK-04, ZYK-05, FS-01)
   und Block K (SEG-11, PUL-08, SPL-10, QBR-07, QS-05).
2. **Erst danach** beginnt Release 1.1 Warengruppenmanagement, in der Reihenfolge der sieben Pakete
   unten. Bis dahin entsteht nichts dafür: keine Tabellen, keine Routen, keine Platzhalter. Die
   bestehenden Tabellen, die die WG-Specs später erweitern (Warengruppe `material_group`,
   Bewertungsrunde `segmentation_round`, Segmententscheidung `segment_decision`), bleiben unverändert.
   Ausnahme nur auf ausdrückliche Anweisung des Gründers.

### 9.1 Pakete des Warengruppenmanagements (aus `ergaenzung-umsetzungsplan.md`)

Die Reihenfolge ist verbindlich, weil spätere Specs auf früheren aufbauen. Jedes Paket ist für sich
lauffähig und testbar.

| Paket | Specs | Inhalt | Voraussetzung |
|---|---|---|---|
| 1 | WG-01 | Warengruppen, Produktgruppen, Team, Bezeichnung, Import, Startdaten | Release 1.0 |
| 2 | WG-04, WG-06 | Strategie, Ablauf-Leiste, Seite Warengruppen, Aufsetzen, Ziele | Paket 1 |
| 3 | WG-18 | Bewertungsrunde je Warengruppe, Portfolio-Filter | Paket 1, Modul SEG |
| 4 | WG-07, WG-09, WG-10 | Analysen, Marktanalyse, Bewertung und Hebel, zunächst ohne KI | Pakete 2 und 3 |
| 5 | WG-12, WG-14, WG-15, WG-16 | Scorecard, Review, Vergabeplan, Supplier Map, Freigabe | Paket 4 |
| 6 | WG-20 | Zusammenführung, Widersprüche, Übergaben in den Lieferantenplan | Paket 5 |
| 7 | WG-23 | KI-Entwürfe Stufe 1, danach Stufe 2 | Paket 6 |

Vor Paket 1:

- Die Tabellennamen der Warengruppe und des Moduls SEG im Schema nachsehen und in WG-01 und WG-18
  eintragen.
- Prüfen, ob die Kennungen WG-01 bis WG-24 und die Release-Nummer 1.1 frei sind.
- Die Zuordnung der Hebel zu Zieldimensionen in `WG-startdaten.md` nachtragen.

Vorlagen für die Oberfläche liegen in `docs/design`: Canvas-Seite „Warengruppenstrategie (Basis)“
und „Warengruppen zusammengeführt“.

**Vorarbeit erledigt (16.11.2026), Start auf Anweisung des Gründers:** Specs liegen in `docs/specs/`
(`WG-01` … `WG-23`, `WG-startdaten.md`, `WG-rechte.md`). Kennungen WG-01 bis WG-24 und Release 1.1
waren frei. Tabellennamen stehen in WG-01 und WG-18 (`material_group`, `relationship_material_group`,
`relationship_spend`, `segmentation_round`, `segment_decision`). Die Hebel tragen einen Vorschlag
für ihre Zieldimensionen (zu bestätigen). Die Warengruppe am Spend bleibt optional (Gründer).

Offen zur Klärung: Entscheidung 1 in Abschnitt 6 sieht die Blöcke F bis K als Releases 1.1, 1.2
usw. vor; die WG-Specs belegen 1.1 für das Warengruppenmanagement.

</details>
