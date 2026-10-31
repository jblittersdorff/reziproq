# Umsetzungsplan Reziproq 1.0

> Die neuen Specs liegen noch unter `~/Downloads/specs 2/` (Ordnername mit Leerzeichen). Sie kommen mit UMB-04 nach `docs/specs`.

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
- **14 Meilensteine** zu je zwei Wochen, also rund 27 Wochen ab dem 2.11.2026. Ende ist damit Mitte Mai 2027, Release 1.0 bleibt Ende Juni.

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
- QS-01, QS-02, QS-03, QS-05
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
| K20 | Abschnitt „Organisation“ für alle Mitglieder (unsere Abweichung in PR #14) gegenüber neuem PLT-11 „Weg zu den Einstellungen nur für Admin“ | `settings-page.tsx`, `ContentGate` in `app-layout.tsx` | PLT-02, PLT-05, PLT-11 | Entscheidung offen (Frage 4) | klein | keins |
| K21 | Unsere Anpassungen stehen nicht in den neuen Fassungen: Rollenanzeige, Popup, `reziproq_api`, `db:roles`, Kundenliste für Betreiber, Beispieldaten mit 15 Lieferanten | `docs/specs/PLT-01.md`, `PLT-02.md`, `PLT-11.md`, `README.md` | alle | **UMB-04** | klein | keins |
| K22 | Beispieldaten passen nicht zum neuen Muster: Test-Lieferant ohne Beziehung; Spend nur ein Jahr; keine USt-IdNr.; „Beispiel AG (Demo)“ aus den Vorschlägen in PLT-12 fehlt | `packages/db/src/seed.ts` | PLT-03, PLT-12 | Behebt PLT-03 (Seed); „Beispiel AG (Demo)“ ergänzen | klein | keins |
| K23 | Migrationen aus parallelen Branches kollidieren im Drizzle-Journal | `packages/db/drizzle/meta/_journal.json` | alle Stränge | Regel: Migration erst nach dem Rebase auf `main` erzeugen, je Woche nur ein Strang mit Migration zugleich am Mergen | – | gering |

### 3.2 Widersprüche zwischen den neuen Specs

| # | Was | Specs | Vorschlag |
|---|---|---|---|
| W1 | „Bis PLT-05 gilt jeder Nutzer als Admin“, aber PLT-02 ist mit Zitadel-Rollen umgesetzt, und PLT-05 legt Rollen in die Datenbank | PLT-02, PLT-11, PLT-05 | Satz streichen; bis PLT-05 gelten die Zitadel-Rollen weiter |
| W2 | Organisation und Mitglieder sieht jeder (PLT-02, PLT-05: „Organisation und Mitglieder sehen: alle Rollen“), aber der Weg zu den Einstellungen ist nur für Admins sichtbar | PLT-02, PLT-05, PLT-11 | Frage 4 |
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

## 4. Umbau-Specs (Vorschlag, noch keine Dateien)

### UMB-01 Betreiber-Zugang nach dem neuen Muster

Release 0.1 · baut auf PLT-11, PLT-05 · ersetzt den Dialog aus PLT-13

**Ziel:** Als Mitarbeiter von Reziproq wechsle ich auf einer eigenen Seite in einen Kunden und sehe die App wie er. Jeder Zugriff ist protokolliert.

**Wer darf was:**
- Betreiber: Kundenliste sehen, wechseln, Ansicht verlassen; nur lesen.
- Käufer und Lieferant: nichts davon.

**Daten:**
- `betreiber_zugriff` wird zu `support_access_log`, Art `global` (nur Betrieb), ohne Lesezugriff für die API-Rolle. Die bestehenden Einträge bleiben.
- Betreiber-Recht: wie in Frage 1 entschieden. Vorschlag: Flag `is_operator` an `app_user`, gesetzt per Skript `pnpm operator:set <email>`. Rollen liegen nach PLT-05 in der Datenbank.
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
- W1, W3, W4, W7, W8, W9 und W10 nach den Antworten auf die offenen Fragen korrigieren.
- `CLAUDE.md`: Regel zur GuV-Wirkung präzisieren (W8).
- Status: PLT-01 und PLT-02 auf „fertig“, die teilweise umgesetzten auf „offen“ mit Vermerk.

**Fertig, wenn:**
- Die README listet 71 + 4 Specs mit Status.
- Jede Abweichung aus Abschnitt 3 ist entweder behoben oder als Entscheidung vermerkt.

## 5. Plan

**Regeln:**
- Eine Spec je Person und Woche.
- Woche 1 beginnt am Montag, dem 2.11.2026.
- Strangwechsel gegenüber der README sind mit ↔ markiert. Sie halten die Stränge ausgelastet und vermeiden gleichzeitige Änderungen an denselben Ordnern.
- **Migrationen:** Je Woche erzeugt nur der Strang mit Datenbank-Arbeit seine Migration nach dem Rebase (K23).
- **Zu groß für einen PR** und geteilt: PLT-03 (a/b), PLT-05 (a/b), PLT-07 (a/b), PUL-02 (a/b), QBR-01 (a/b), LIF-01 (a/b). Beide Teile liegen in derselben Woche, es sind zwei PRs nacheinander.

**Vorschläge zum Teilen:**

| Spec | Teil a | Teil b |
|---|---|---|
| PLT-03 | Neues Datenmodell, Migration aus `beziehung`, Seed, Liste mit Kennzahlen | Anlegen, Bearbeiten, Beenden, Profil- und Spend-Seiten mit Verlauf |
| PLT-05 | Rollen in der Datenbank, Übernahme aus Zitadel, `permissions.ts`, `/me/permissions`, `/einstellungen/organisation` | `relationship_member`, Team-Seite, Teamrolle Leser |
| PLT-07 | Baustein Import (Upload, Vorschau, Fehlerdatei), Lieferanten und Spend | Business Units und Kontakte, `lieferanten-50.xlsx` |
| PUL-02 | Welle anlegen und einladen | Beantworten über `/umfrage/<token>` ohne Anmeldung |
| QBR-01 | Termine mit Agenda, Teilnehmenden und Protokoll | Live-Abschnitte, Abschließen mit Einfrieren, Termin-Quelle |
| LIF-01 | Einladung und Annahme mit nachgebautem Zitadel | Anlage der Zitadel-Organisation über die Verwaltungsschnittstelle |

### M0 · 2.–3.11. · Dokumente

| Strang | Specs |
|---|---|
| alle | UMB-04 (ein PR, nur Dokumente) |

**Demo:** keine Oberfläche. `docs/specs/README.md` zeigt 75 Specs mit Status.

### M1 · Woche 1–2 · Neuer Rahmen ohne Pop-ups

| Strang | Woche 1 | Woche 2 |
|---|---|---|
| A | PLT-10 (Umbau) | PLT-11 |
| B | PLT-04 | PLT-08 |
| C | UMB-02 | PLT-03a |

**Demo:**
- `/styleguide`: Leisten, Pfad, Formularseite, Schritte, Bestätigung auf der Seite, Rückmeldezeile; kein Dialog mehr
- `/start`, `/lieferanten`, `/portfolio`, `/wirkung`, `/fragen`, `/profil`, `/einstellungen`
- bei 390 px: Menüknopf, dann `/menu`
- `/lieferanten` mit 15 Demo-Lieferanten, Spend zweier Jahre, Anzahl und Gesamtspend
- Zurück-Pfeil und Browser-Zurück über drei Ebenen

**Seed:**
- Beziehungen im neuen Modell, USt-IdNr. je Lieferant, Spend 2024 und 2025
- Test-Lieferant als `draft` bei beiden OEMs
- „Beispiel AG (Demo)“

### M2 · Woche 3–4 · Lieferanten pflegen, Rollen und Sprache

| Strang | Woche 3 | Woche 4 |
|---|---|---|
| A | PLT-09 | PUL-01 ↔ (vorgezogen, Abhängigkeit PLT-09 erfüllt) |
| B | PLT-05a | PLT-05b |
| C | PLT-03b | UMB-01 |

**Demo:**
- `/lieferanten/neu`: anlegen, mit Hinweis „wird verknüpft“ bei vorhandener USt-IdNr.
- `/lieferanten/<id>/strategie/profil`: Verlauf, Bearbeiten, Beziehung beenden mit Bestätigung
- `/lieferanten/<id>/strategie/spend`
- `/lieferanten?beendet=1`
- `/einstellungen/organisation` und `/einstellungen/organisation/<nutzer>`
- `/lieferanten/<id>/beziehung/team`
- `/profil`: Sprache auf Englisch, alle Seiten auf Englisch
- `/einstellungen/fragebogen`
- `/betreiber/kunden`

**Seed:**
- Rollen: je OEM ein Admin, ein Nutzer, ein Leser
- Teams mit SRO für fünf Lieferanten
- Standard-Fragebögen

### M3 · Woche 5–6 · Arbeitsbereich, Stammdaten, Import, Fragen

| Strang | Woche 5 | Woche 6 |
|---|---|---|
| A | NAV-06 | PLT-12 (Umbau) |
| B | QS-01 | SEG-01 |
| C | PLT-06 | PLT-07a, PLT-07b |

**Demo:**
- `/lieferanten/<id>` mit lokaler Leiste, Kopf, sechs Kacheln und dem Kennzeichen „Intern“
- `/lieferanten/<id>/strategie` mit Kacheln
- `/einstellungen/business-units`, `/einstellungen/warengruppen`
- Zuordnung auf `/…/profil/zuordnung`
- Import: `lieferanten-50.xlsx` mit drei Fehlerzeilen
- Fragen:
  - Cmd+K öffnet `/fragen`
  - „Welche Lieferanten haben wir in der Warengruppe Elektronik?“
- E-Mails: `http://localhost:8025` (Mailpit) mit einer Testmail auf Deutsch und Englisch
- `/einstellungen/segmentmodell`

**Seed:**
- je OEM drei BUs und sechs Warengruppen in zwei Ebenen, eigene Werte beim Zweit-OEM
- Standard-Segmentmodell
- `docs/demo/lieferanten-50.xlsx`

### M4 · Woche 7–8 · Bewertungsrunde und Feedback

| Strang | Woche 7 | Woche 8 |
|---|---|---|
| A | PUL-02a, PUL-02b | SPL-04 |
| B | SEG-03 | SEG-04 |
| C | UMB-03 | PLB-01 |

**Demo:**
- Bewertungsrunde:
  - `/portfolio/runden/neu` in vier Schritten
  - Einladungen in Mailpit
  - `/bewertungen` und `/bewertungen/<id>` mit Reglern, Pause, Zusammenfassung mit Matrix
- Feedback:
  - Welle starten auf `/lieferanten/<id>/beziehung/feedback`
  - `/umfrage/<token>` auf dem Smartphone
- `/lieferanten/<id>/strategie/spend` mit gestapeltem Diagramm Ist und Plan
- `/einstellungen/spielregeln` mit Vorschau je Typ

**Seed:**
- eine offene Runde beim Test-OEM mit zehn Lieferanten und Bewertungen in Teilen abgegeben
- Spend je BU und Warengruppe mit Planjahr
- Standardkatalog Spielregeln und Formate
- Kontakte bei fünf Lieferanten

### M5 · Woche 9–10 · Start, Segmentierung, Lieferantenzugang

| Strang | Woche 9 | Woche 10 |
|---|---|---|
| A | NAV-05 | SPL-05 |
| B | LIF-01a, LIF-01b | LIF-02 |
| C | SEG-05 | SEG-06 |

**Demo:**
- `/start` mit „Fällig bei mir“ (offene Bewertungen), `/start/faellig`
- `/lieferanten/<id>/strategie/segmentierung`: Matrix, Tabelle, Heatmap, Klick auf ein Kriterium
- konsolidieren: Kopf zeigt Ist → Soll
- Lieferantenzugang:
  - `/lieferanten/<id>/beziehung/team/einladen`
  - Mail in Mailpit
  - `/einladung/<token>`
  - als Lieferant `/kunden` und `/kunden/<beziehung>`
- `/lieferanten/<id>/strategie/profil` mit Finanzen und „Unser Anteil“

**Seed:**
- vollständig abgegebene Bewertungen für sechs Lieferanten, eine Konsolidierung
- Finanzkennzahlen für drei Lieferanten
- Test-Lieferant beim Test-OEM eingeladen

### M6 · Woche 11–12 · Portfolio und Fokus, Release 0.1 fast komplett

| Strang | Woche 11 | Woche 12 |
|---|---|---|
| A | PUL-03 | PLB-03 ↔ |
| B | LIF-03 | PLB-04 |
| C | SEG-07 | SEG-02 |

**Demo:**
- Portfolio:
  - `/portfolio` mit Kacheln
  - `/portfolio/matrix` mit 50 Lieferanten und Filter
  - `/portfolio/offen`, `/portfolio/fokus` mit Vorschlägen
- Feedback-Ergebnis `/…/beziehung/feedback/<welle>`: Hantel-Diagramm, drei größte Lücken
- als Lieferant `/kunden/<beziehung>/eigene-sicht`
- `/lieferanten/<id>/beziehung/spielregeln`: Vorschlag übernehmen, intern freigeben
- Team beider Seiten

**Seed:**
- 50 Lieferanten über `lieferanten-50.xlsx` als Seed-Option
- Konsolidierungen für 20 Lieferanten
- eine aufgedeckte Welle mit je drei Antworten
- acht Fokuslieferanten

### M7 · Woche 13–14 · Zyklus und Freigabe an den Lieferanten

| Strang | Woche 13 | Woche 14 |
|---|---|---|
| A | NAV-12 | QBR-01a, QBR-01b |
| B | ZYK-01 | ZYK-02 |
| C | SEG-10 | SPL-01 |

**Demo:**
- Lieferantenliste mit Filtern: `/lieferanten?bu=…&wg=…&typ=…&fokus=1&meine=1`
- Zyklus:
  - Zyklus-Leiste und „Nächster Schritt“ auf dem Überblick
  - `/lieferanten/<id>/zyklus/termin`
  - `/einstellungen/zyklus`
- `/…/spielregeln/teilen`, danach als Lieferant Typ im Kopf
- Termine:
  - `/lieferanten/<id>/umsetzung/termine/<id>` mit Agenda, Protokoll, Abschließen
  - Termin auf Start beider Seiten
- `/lieferanten/<id>/strategie/lieferantenplan`

**Seed:**
- Zyklen für alle Fokuslieferanten, JBP-Termine verteilt, einer überfällig
- zwei Termine je Fokuslieferant

### M8 · Woche 15–16 · Lieferantenplan, Maßnahmen, Kontaktpunkte

| Strang | Woche 15 | Woche 16 |
|---|---|---|
| A | QBR-03 | QBR-04 |
| B | ZYK-04 | PLB-06 ↔ |
| C | SPL-03 | SPL-06 |

**Demo:**
- `/lieferanten/<id>/umsetzung/massnahmen` mit Filtern, `/start/massnahmen`
- Erinnerung und Eskalation in Mailpit (Datum vorgegeben)
- `/portfolio/zyklen`
- `/lieferanten/<id>/beziehung/kontaktpunkte` mit Bild und Lücken
- Lieferantenplan:
  - Beiträge anfordern, Beitrag auf Start
  - strategische Themen

**Seed:**
- Maßnahmen beider Seiten, zwei überfällig
- Kontaktpunkte für drei Lieferanten
- Ziele und Themen im Plan

### M9 · Woche 17–18 · Release 0.2 komplett, erste KI-Entwürfe

| Strang | Woche 17 | Woche 18 |
|---|---|---|
| A | PUL-06 | PUL-08 ↔ |
| B | SEG-11 ↔ (legt `ai_draft` an) | SPL-10 ↔ |
| C | SPL-07 | JBP-01 |

**Demo:**
- Maßnahme aus einer Lücke, „Ihr habt gesagt, wir haben gehandelt“, Verlauf über zwei Wellen
- „Abweichungen erklären“ auf der Segmentierungsseite (`AI_PROVIDER=test`)
- Lieferantenplan:
  - `/…/lieferantenplan/freigabe` und `/versionen`
  - Entwurf der Zusammenfassung vorschlagen
- `/lieferanten/<id>/plan` und `/plan/vorbereitung`
- Freitexte zusammenfassen

**Seed:**
- zweite aufgedeckte Welle
- freigegebener Lieferantenplan für drei Lieferanten

### M10 · Woche 19–20 · Gemeinsamer Plan

| Strang | Woche 19 | Woche 20 |
|---|---|---|
| A | Puffer: Feinschliff 0.2, Performance-Messungen aus NAV-05 und ZYK-04 | Puffer |
| B | Puffer: Testlauf mit Testnutzern 0.2 | Puffer |
| C | JBP-02 | JBP-03 |

**Demo:**
- `/…/plan/themen` mit zwei Spalten, „Aus Lieferantenplan übernehmen“
- `/…/plan/initiativen` als Liste und Roadmap

**Seed:** Themen beider Seiten und 15 Initiativen über drei Jahre.

### M11 · Woche 21–22 · Zusagen, Wirkung, Kommentare

| Strang | Woche 21 | Woche 22 |
|---|---|---|
| A | QS-02 | QS-05 ↔ |
| B | PNL-01 | PNL-03 |
| C | JBP-05 | JBP-06 |

**Demo:**
- `/…/plan/zusagen`
- Freigabe des Gemeinsamen Plans durch beide Seiten, Versionen vergleichen
- `/lieferanten/<id>/wirkung` mit Hebel und GuV-Zeile, Baseline einfrieren, Reifegrad erhöhen
- Kommentare intern und geteilt, mit Erwähnung
- Treffer beim Tippen auf `/fragen`

**Seed:**
- Zusagen
- Wirkungen für zehn Initiativen, Baselines
- `pnl_line`-Standardzeilen

### M12 · Woche 23–24 · Scorecard und Monatswerte

| Strang | Woche 23 | Woche 24 |
|---|---|---|
| A | ZYK-05 ↔ | Puffer |
| B | PNL-05 | PNL-06 |
| C | JBP-07 | JBP-09 |

**Demo:**
- `/…/plan/scorecard` und Unterschrift beider Seiten
- Ist-Werte per CSV, Stand „auf Kurs“
- Monatswerte mit Diagramm
- `/wirkung/freigaben` und Prüfseite für Controlling
- `/lieferanten/<id>/zyklus/neu` und `/zyklus/archiv`

**Seed:**
- Scorecards mit zwölf Monatswerten
- Monatswerte Plan und Ist
- ein Controlling-Nutzer

### M13 · Woche 25–26 · Teilung, Brücke, Pre-Read

| Strang | Woche 25 | Woche 26 |
|---|---|---|
| A | QBR-06 | QS-03 |
| B | PNL-07 | PNL-10 |
| C | Puffer | QBR-07 ↔ |

**Demo:**
- Teilung, eigener Nutzen beim Lieferanten
- P&L-Brücke je Lieferant
- `/wirkung` mit Pipeline und Portfolio, Geschäftsjahr ab April
- Pre-Read als PDF vom Termin
- PDFs von Plan und Feedback
- `/einstellungen/export`
- KI-Entwurf für den Pre-Read

**Seed:** Teilungsregeln und Savings-Referenzen, Geschäftsjahr ab April beim Zweit-OEM.

### M14 · Woche 27 · Release 1.0 komplett

| Strang | Woche 27 |
|---|---|
| A | Puffer, Testlauf mit Testnutzern |
| B | PNL-11 |
| C | FS-01 |

**Demo:**
- „Excel herunterladen“ auf `/wirkung`
- `/hinweise`, `/hinweise/<id>`: annehmen erzeugt eine interne Maßnahme
- Anzahl der Hinweise auf Start und im Überblick

**Seed:** je Regel aus FS-01 eine auslösende Lage.

**Gesamt:**
- 75 Specs (71 neu und 4 Umbau) in 27 Wochen
- rund sechs Wochen Puffer in den Wochen 19, 20, 24 und 25
- Ende Mitte Mai 2027; bis Release 1.0 Ende Juni bleiben rund sechs Wochen

## 6. Offene Fragen

1. **Betreiber-Zugang (PLT-13):** Er fehlt in den 71 Specs. Behalten wir ihn (UMB-01, mit eigener Seite statt Dialog) oder entfällt er?
2. **Betreiber-Recht nach PLT-05:** Rollen liegen dann in der Datenbank. Soll `betreiber` als Flag `is_operator` in die Datenbank (per Skript gesetzt) oder als einzige Rolle weiter aus Zitadel kommen?
3. **Neuanmeldung (UMB-02):** Redirect mit kurz gespeichertem Formularentwurf statt Popup-Fenster, einverstanden? Oder ist das Popup eine erlaubte Ausnahme?
4. **Organisation sehen:** PLT-02 und PLT-05 erlauben jedem Mitglied, Organisation und Mitglieder zu sehen. PLT-11 zeigt den Weg zu den Einstellungen nur Admins. Vorschlag: `/profil` zeigt allen den Weg zu `/einstellungen/organisation` (nur lesen), alles andere unter Einstellungen nur Admins.
5. **Rollen aus Zitadel übernehmen (K15):** Einmalige Migration der heutigen Zitadel-Rollen nach `org_role` (admin bleibt admin, nutzer wird member, leser wird viewer, controlling wird `is_controlling`), danach Zitadel-Rollen nicht mehr lesen. Einverstanden?
6. **KI-SDK:** Umstieg von `@anthropic-ai/sdk` auf das Vercel AI SDK (`ai`, Apache-2.0, gepinnt) und Umbenennung der Umgebungsvariablen in `AI_PROVIDER`/`AI_MODEL`, wie PLT-12 verlangt?
7. **Lieferantenplan-Adressen (W3):** Lieferantenplan unter `/lieferanten/<id>/strategie/lieferantenplan/…`, damit er sich nicht mit dem Gemeinsamen Plan unter `/plan/…` überschneidet?
8. **Zusammenführen von Themen (W4):** in JBP-03 verschieben?
9. **Feedback ohne Anmeldung (W5):** Teilnehmende als geteilte Zeilen der einladenden Seite und Antworten über eine eng gefasste Datenbankfunktion mit Token, einverstanden?
10. **Erwähnungen (W6):** Vorschlagsliste fest unter dem Feld statt einer aufklappenden Liste, einverstanden?
11. **Erinnerungstage (W7):** eigene Tabelle `org_setting` statt `cycle_settings`?
12. **CLAUDE.md (W8):** Regel zur GuV-Wirkung auf „sobald Wirkung eingerichtet ist“ präzisieren?
13. **Strangwechsel:** PUL-01 und PLB-03 zu A, PLB-06, SEG-11 und SPL-10 zu B, PUL-08 zu A, QS-05 und ZYK-05 zu A, QBR-07 zu C. Passt das, oder sollen die Stränge der README fest bleiben (dann länger als 27 Wochen)?
14. **Soll-Specs:** SEG-11, PUL-08, SPL-10, QBR-07 und QS-05 sind „Soll“. Vorziehen wie geplant (Woche 17 bis 26) oder ans Ende stellen und bei Zeitnot streichen?
15. **Teilen zu großer Specs:** Sind die sechs Teilungen (PLT-03, PLT-05, PLT-07, PUL-02, QBR-01, LIF-01) als je zwei PRs in Ordnung?
16. **Beispieldaten:** 50 Lieferanten fest im Seed oder nur als Import-Datei `lieferanten-50.xlsx` mit einer Seed-Option?
17. **Arbeiten zu dritt:** Die README rechnet mit drei Gründern, es gibt derzeit einen. Sollen die drei Stränge trotzdem als Reihenfolge gelten (dann rund dreimal so lang, etwa 75 Wochen), oder priorisieren wir einen Strang?
