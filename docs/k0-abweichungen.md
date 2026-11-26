# K0: Spec-Paket gegen den Code geprüft

Stand 24.11.2026. Grundlage: Spec-Paket „Reziproq KI-nativ“ (Kapitel 1 bis 8, `reziproq-specs-v2.zip`) und der Code auf `spec/PNL-11` nach Commit `77cc620` (UX Phase 3). Paket K0 schreibt keinen Code. Bei Widersprüchen gilt die Rangfolge aus LIESMICH: Entscheidungen, dann Specs, dann Designsprache, dann Vorlagen.

**Stand nach K0-b (24.11.2026):**
- Alle Empfehlungen sind übernommen und als E-K0-01 bis E-K0-32 in `docs/entscheidungen.md` festgehalten. Offen bleiben C-02 und C-07, dort mit Empfehlung.
- E-K0-03 legt nur das Prinzip fest. Eine generierte Spalte, wie in F-03 genannt, geht nicht, weil die besitzende Seite aus der Beziehung gelesen werden muss; ob es eine Spalte mit Trigger oder eine Sicht wird, entscheidet K1-a.
- Neu beim Nachziehen: CLAUDE.md (Oberfläche, Regel 7) lässt bei Widersprüchen im Aussehen die Designsprache vor der Spec gelten, LIESMICH stellt die Specs allgemein vor die Designsprache. Ich lese Regel 7 als Sonderfall für das Aussehen; für Inhalt und Verhalten gilt LIESMICH (C-18).

**Stand nach K1-c (24.11.2026), Auslegungen der Triage:**
- **Strategischer Typ (E-K0-17).** Die Segmenttypen sind eine Matrix; einen Typ „strategisch“ gibt es nicht, und „Strategisch“ heißt sonst Fokuslieferant (E-K0-09).
  - Als strategischer Typ gilt deshalb die Zelle mit höchster Wirkung und bester Beziehung, bei 3 × 3 also 3/3. Sie startet mit dem Gewicht 2,0.
  - Das Gewicht ist je Typ gespeichert. Ändern lässt es sich erst mit der Segment-Mappe (K2-e).
- **Punktzahl.** Die Triage rechnet nach HE-01 ohne den Faktor 2 für Fokuslieferanten aus KI-16. Die Liste der Hinweise sortiert weiter nach ihrer alten Punktzahl.
- **Neue Spalte.** `focus_item` hat zusätzlich `href` (Ort der Erledigung), bis die Fokus-Mappe kommt (K1-e). Fokus-Themen verschwinden mit ihrer Beziehung.
- **„Heute“ für Fristen.** Die Fristen zählen wie bisher auf Start nach dem Datum in UTC. 06:00 und 07:00 gelten in Berlin. Seit K1-e.1 rechnen Heute und Triage mit dem Datum in Berlin (Dringlichkeit, überfällig, „Diese Woche“). Die Module selbst setzen ihr „heute“ weiter in UTC, etwa für die Ersatzfrist eines Hinweises; das betrifft nur die Stunde nach Mitternacht.
- **Noch nicht in der Triage.**
  - Nicht zugeordneter Eingang (E-K0-26) steht seit K1-e.1 in der Ansicht Alles unter „Zuordnen“ und ist seit K1-e.2 je Termin ein Eintrag in Kurz prüfen.
  - Handlungen auf Stufe Erledigen schreiben seit K1-e.3 `undo_payload`; die erste ist die automatische Zuordnung von Terminen. Weitere kommen mit ihren Paketen, die Stufen je Person mit K1-f.

**Stand nach K2-h (25.11.2026), Farben:** Abschnitt d nannte die Design-Tokens vollständig. Sie enthielten aber 13 Farben, die die Designsprache nicht kennt. K2-h hat sie auf Werte der Palette gesetzt: Schatten in Tinte statt `#1d1d1f`, Status-Text nach der Status-Tabelle (gut, Achtung, kritisch), Grau der Diagramme `ring-open`, Folgeskala aus Mint und Petrol, Flächen auf Tinte `dark-2`, Rand auf Tinte `input-border`, Hover-Fläche `line`. T-CI1 verhindert neue Abweichungen.

**Kurzfassung**
- Vieles ist schon gebaut und lässt sich wiederverwenden: Datenräume mit Row Level Security, Entwürfe mit Quellen, Agenten und Läufe, Gateway, Hinweise mit Punktzahl, Zusagen, Segmente, Feedback, Termine mit Briefing, Ergebnissen und Transkript, Gemeinsamer Plan, Wirkung mit Baseline und Controlling, Wertfinder, Import, Einladung mit Passkey und das Warengruppenmanagement in zehn Schritten.
- Grundlegend neu sind: `focus_item` mit Triage, Stufen je Person (`worker_setting`), Bestätigungs-Token für bindende Werkzeuge, Rücknahme (`undo_payload`), Uhr je Mandant, Modi `record` und `replay` sowie der Demo-Mandant Hollmann. Ebenfalls neu: Mandat, Deal, Bestätigen per Link, Wert-Engine mit Buchungen, Kanäle und die Objekte aus Kapitel 8.
- Phase 2 und 3 der UX-Umsetzung (NAV-10 1.1) sind gebaut und werden durch NAV-10 2.0, BZ-01 und AK-01 zum großen Teil abgelöst. Ihre Bausteine und Schnittstellen bleiben nutzbar.
- Zwei Punkte blockieren Paket K1-d, bis du entschieden hast:
  - Blatt und Überlagerung widersprechen PLT-10; ein Test verbietet sie heute (F-01).
  - Bei der Seitenleiste widerspricht das Paket deiner Entscheidung vom 23.11. (F-02).
- Phase 1 ist fertig im Sinne des Plans (Abschnitt d).

## Ablage des Pakets

Alle Dateien liegen nach der Tabelle „Ablage im Repo“. Drei Stellen weichen bewusst ab oder brauchen deinen Blick:

1. **Rechte:** `docs/rechte.md` wird aus `apps/api/src/modules/auth/permissions.ts` erzeugt (`pnpm rechte`). Ein Test schlägt fehl, wenn die Datei von Hand geändert wird (`permissions.test.ts:666`).
   - Die Rechte-Ergänzung steht deshalb wörtlich als Konstante `plannedKiNativeRights` in `apps/api/src/modules/auth/rights-doc.ts`; `docs/rechte.md` ist neu erzeugt (Abschnitt „Umbau KI-nativ (Planung)“).
   - Das ist die einzige Änderung außerhalb von `docs/`: reiner Text, kein Verhalten.
   - Der Vorrang vor den älteren Abschnitten ist im Abschnitt vermerkt, ebenso der Satz aus LIESMICH „Zeilen zu eigenen Agenten entfallen“.
2. **Glossar:** Der Glossar-Test (`apps/web/src/locales/glossary.test.ts`) liest jede Tabellenzeile in `docs/glossar.md` als Begriff mit Übersetzungsschlüsseln.
   - Die beiden Tabellen der Ergänzung stehen deshalb im Wortlaut als Listen im neuen Abschnitt „Umbau KI-nativ (Kapitel 1 bis 8)“.
   - Der Abschnitt hat Vorrang vor den älteren Abschnitten.
3. **Ersetzte KI-Specs:** Die Fassungen im Repo hatten Abschnitte „Umsetzung (Stand 23.11.2026)“ und abgehakte Kriterien mit Testdateien. Die Paketfassungen haben das nicht.
   - Betroffen: KI-03, KI-07, KI-08, KI-09, KI-11, KI-15, KI-16, KI-17. NAV-10 und UX-20 waren Fassung 1.1 ohne solche Abschnitte; ihr Stand steht in `docs/plan/ux-abweichungen.md`.
   - Die Notizen stehen weiter in Git (`git show 77cc620:docs/specs/KI-07.md`); dieser Bericht nutzt sie als Quelle (F-22).

Weitere Punkte:
- `docs/design/referenz/` ist vollständig ersetzt (94 Boards und `INDEX.md`; vorher 141 Dateien).
- Die Kopie des Pakets in `docs/reziproq-specs-v2/` war identisch mit der Zip und ist gelöscht.
- Die Zip liegt weiter in `~/Downloads` und ist nicht im Repo.

## a) Was es schon gibt und wiederverwendet werden kann

| Spec                                          | Vorhanden                                                                                                                                                                                                                                         | Fundstelle                                                                                                                                       | So wird es genutzt                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ZA-01 Räume                                   | Register der Datenebenen (`buyer_private`, `supplier_private`, `org_private`, `shared`, `global`), Funktion `app_apply_layer` setzt die Policies, Prüfungen für jede Tabelle, Cross-Tenant-Tests                                                  | `packages/db/src/layers.ts:11`, `packages/db/drizzle/0011_verlauf.sql:34`, `layers.test.ts`, `rls.test.ts`                                       | Grundlage für `space`. Geteilte Tabellen haben schon `owner_org_id` und `visibility` (`internal` oder `shared`); daraus folgt der Raum je Zeile (F-03) |
| ZA-01 Paar eindeutig                          | `unique('relationship_paar')` auf Käufer und Lieferant                                                                                                                                                                                            | `packages/db/src/schema/relationship.ts:49`                                                                                                      | erfüllt; keine Migration nötig                                                                                                                         |
| UX-20 Module                                  | `org_module` mit Standard Claims, Risiko und Vertrag aus; `/me` liefert `modules`                                                                                                                                                                 | `drizzle/0129_ux20_org_module.sql`, `apps/api/src/modules/me/me.service.ts:104`                                                                  | bleibt                                                                                                                                                 |
| HE-01, KI-03 Entwürfe                         | `ai_draft` mit Quellen je Aussage (`ai_source`), Übernehmen nur einmal, Verwerfen mit Grund, Person und Zeit                                                                                                                                      | `packages/db/src/schema/ai-draft.ts:63`, `:103`                                                                                                  | wird der Stapel für Kurz prüfen; Felder ergänzen (Abschnitt b, B-04)                                                                                   |
| HE-01 Triage                                  | Hinweise mit Punktzahl aus Schwere × Spendanteil × Segmentgewicht × Fokus; „Als Nächstes“ mit `scope` und `?beziehung=`; Termine und Fristen je Beziehung                                                                                         | `apps/api/src/modules/hints/early-warning-rules.ts`, `apps/api/src/modules/start/start.service.ts:413`, `:467`, `my-day-data.ts:42`              | Regeln und Punktzahl gehen in die Triage; `next_action` wird Sicht auf `focus_item`                                                                    |
| MA-01, KI-04 Aufgaben und Läufe               | `agent`, `agent_version`, `agent_run` mit Schritten, Kosten, Prüfsumme, Systemagenten; Werkzeuge lesen mit den Rechten der Person                                                                                                                 | `packages/db/src/schema/agent.ts:40`, `:70`, `:141`, `apps/api/src/modules/agents/system-agents.ts`                                              | wird die Registry; Stufen und `binding` ergänzen                                                                                                       |
| KI-01, DM-01 Gateway                          | Gateway mit Anbietern `bedrock_eu`, `fake`, `anthropic`, Kontingent je Monat, Protokoll `model_call`, Modellklassen                                                                                                                               | `apps/api/src/modules/ai-gateway/model-gateway.ts`, `routing.ts:3`                                                                               | Modi `record` und `replay` kommen dazu                                                                                                                 |
| NAV-10 Startseite                             | `user_setting.start_page`; Admin und Lead starten in der Übersicht                                                                                                                                                                                | `packages/db/src/schema/app-user.ts:77`, `me.service.ts:113`                                                                                     | Werte umbenennen (`wert`, `heute`)                                                                                                                     |
| NAV-10 Frag Reziproq                          | Suche über Lieferanten, Termine und Notizen (QS-05) und Fragen mit Werkzeugen, Limit und Systemtext (PLT-12)                                                                                                                                      | `apps/api/src/modules/search/search.service.ts`, `apps/api/src/modules/prompt/prompt.service.ts`                                                 | Kern von Frag; Aufträge kommen dazu                                                                                                                    |
| ZQ-01 Zusagen                                 | `commitment` mit Seite, Verantwortlichen, Frist und Status, geteilt; Maßnahmen `action` mit `visibility` und Quelle                                                                                                                               | `packages/db/src/schema/initiative.ts:136`, `action.ts:23`                                                                                       | Migration nach ZQ-01: geteilte Maßnahmen werden Zusagen, interne werden `task`                                                                         |
| BZ-01 Segmente                                | Bewertungsrunden, Bewertungen, Konsolidierung, Segmententscheidung, Segmentmodell, Fokuslieferanten                                                                                                                                               | `packages/db/src/schema/rounds.ts`, `segment.ts`, SEG-01 bis SEG-11                                                                              | Runden, Bewertungen und Mappe bauen darauf; Schrittseiten entfallen                                                                                    |
| AK-01 Feedback                                | Wellen, Teilnehmer, Antworten, Aufdecken ab Schwelle, Freitext zusammengefasst, Link ohne Konto                                                                                                                                                   | `packages/db/src/schema/survey.ts:53`, Route `/umfrage/$token` (PUL-01 bis PUL-08)                                                               | wird das Objekt Feedback; Link-Seite ist Muster für `/b/<token>`                                                                                       |
| AK-01 Akte                                    | Lieferantenplan (SPL), Spielregeln (PLB), Team (PLT-05), Kontaktpunkte, Notizen, Verlauf, Profil mit Spend und Kontakten                                                                                                                          | `supplier-plan.ts:46`, `rule-set.ts:26`, `relationship.ts:207`, `touchpoint.ts:21`, `features/suppliers/supplier-profile-page.tsx`               | Inhalte der Sichten und Blätter                                                                                                                        |
| LP-01 Einladung                               | Einladung mit Name, Rolle und Passkey; Konto über Zitadel                                                                                                                                                                                         | `packages/db/src/schema/invitation.ts:16`, Routen `/einladung/$token/{name,passkey}`, `apps/api/src/modules/invitations/identity-provisioner.ts` | Vorlage für L5-Einladung und den Passkey in BL-01                                                                                                      |
| PO-01, KA-01 Mail und Kalender                | abgelegte Mails mit Anhängen, Eingangsadresse, Eingang für unklare Termine, Outlook-Add-in, Anbindungen mit Anbieter `fake`                                                                                                                       | `packages/db/src/schema/mail.ts:24`, `calendar.ts:100`, Route `/addin/outlook`, IN-01 bis IN-07                                                  | Grundlage für Postfach, Add-in und Kalender                                                                                                            |
| TE-01, PR-01 Termin                           | Termin mit Typ und Dauer, Agenda mit Freigabe an den Lieferanten, Briefing-Lauf alle 15 Minuten mit Prüfsumme, Ergebnisse mit Fundstellen und Protokoll teilen, Transkript mit Betriebsvereinbarung und Aufbewahrung 30/90/180 Tage (Standard 90) | `meeting.ts:34`, `:109`, `:166`, `transcript.ts:33`, `apps/api/src/modules/agents/meeting-brief.worker.ts`, `transcripts.service.ts:140`         | E-K3-7 ist schon erfüllt; Phasen-Seite baut darauf                                                                                                     |
| GP-01 Plan                                    | Gemeinsamer Plan mit Versionen, Freigabe, Themen, Scorecard, Kennzahlwerten, Unterschriften                                                                                                                                                       | `packages/db/src/schema/jbp.ts:23`, `:167`, `:203` (JBP-01 bis JBP-09)                                                                           | `plan_version` als Erweiterung von `jbp_version`                                                                                                       |
| WK-01 Wert                                    | Initiative mit Wirkung: Hebel, GuV-Zeile, Wirkungsart, eingefrorene Baseline, Reifegrad 1 bis 5, Monatswerte, Freigabe durch Controlling; Beträge in Cent mit Währung                                                                             | `packages/db/src/schema/impact.ts:47`, `:206`, `packages/shared/src/levers.ts:21`                                                                | Kern der Wert-Engine; Buchung je Monat und Bestätigung per Link kommen dazu                                                                            |
| WK-01 Wertfinder                              | `value_opportunity`, `value_market_signal`, `value_data_gap`, neun Rechenvorlagen, monatlicher Lauf für Fokuslieferanten (E-K4-5 erfüllt)                                                                                                         | `packages/db/src/schema/value-opportunity.ts:39`, `:103`, `apps/api/src/modules/opportunities/calculation.ts`                                    | wird `value_potential`                                                                                                                                 |
| HE-01 Rücknahme                               | Import rückgängig bis 30 Tage                                                                                                                                                                                                                     | `apps/api/src/modules/imports/imports.service.ts`                                                                                                | Muster für `undo_payload`                                                                                                                              |
| KA-01, LP-01 Benachrichtigung                 | Benachrichtigungen, Kanäle, Mail-Protokoll, Outbox                                                                                                                                                                                                | IN-06, `notification.ts`                                                                                                                         | Mail mit Link an Lieferanten (E-K7-5)                                                                                                                  |
| ST-01, MS-01, WT-01, VG-01, RV-01 Warengruppe | Strategie in zehn Schritten mit Zielen, Sichten, Marktkräften, SWOT, Hebeln, Supplier Map, Vergabeplan, Quartalsreview, Fragen ans Team, Freigabe; Marktanalyse-Agent; Zusammenführung je Lieferant                                               | `packages/db/src/schema/material-group-strategy.ts:29`, `:62`, `:542`, `:574`, `:611`, `apps/api/src/modules/material-groups/market.service.ts`  | Inhaltsquelle für die vier Teile und für Kapitel 8                                                                                                     |
| LP-01 Lieferantenseite                        | Routen `/kunden/$id/…` mit Beziehung, eigener Sicht, Plan, Umsetzung                                                                                                                                                                              | `apps/web/src/routes/_app/kunden/`                                                                                                               | wird die gespiegelte Akte                                                                                                                              |
| Designsprache 3.1                             | alle Farbwerte der Tabelle 3.1, Abschnittslabel `#5a636b`, Figtree und Outfit selbst ausgeliefert                                                                                                                                                 | `apps/web/src/styles/tokens.css`, `styles/fonts.css`, `public/fonts`                                                                             | bleibt; K2-h wird klein (Abschnitt f)                                                                                                                  |
| UX-20 Bausteine                               | `AppShell`, `NextCard`, `SoWhat`, `RowGroup`, `Collapsible`, `ChartCard`, `FormPage`, `SegmentedControl`, `Monogram`, `DateCircle`, `Switch`, `VisibilityBadge`, `AiDraft`, `StatusLine`; Testseite `/bausteine`                                  | `apps/web/src/components/ui/`                                                                                                                    | `SegmentedControl` trägt Sichten- und Stufen-Umschalter, `AiDraft` den Entwurf von Reziproq                                                            |
| Rechte                                        | Rechte-Matrix mit `can()`, Dokument daraus erzeugt                                                                                                                                                                                                | `permissions.ts`, `rights-doc.ts`                                                                                                                | neue Handlungen werden Aktionen                                                                                                                        |

## b) Abweichungen zwischen Spec und Code

### Grundlagen (Kapitel 1)

- **B-01 Räume je Zeile (ZA-01).** Die Spec verlangt an jeder Objekttabelle `space`, `origin`, `origin_run_id`, `origin_user_id` und an geteilten Objekten `confirm_state` mit Bestätigung je Seite.
  - Code: Art je Tabelle (`layers.ts:11`); geteilte Tabellen mit `owner_org_id` und `visibility` (`0011_verlauf.sql:100`).
  - Herkunft gibt es nur einzeln: `ai_draft.run_id`, Quelle `import` am Spend.
  - Bestätigungen sind je Objekt eigen gebaut: `jbp_approval`, `scorecard_signature`, `segment_decision`.
  - Folge: F-03.
- **B-02 `focus_item` fehlt (HE-01).** Mein Tag rechnet live aus Hinweisen, Aufgaben und Terminen (`my-day-data.ts:42`, `start.service.ts:467`). Es gibt keine Triage um 06:00, keine Stufe `review`/`done` und kein `sentence_facts`.
  - Die Prüfung „Zahl im Satz muss belegt sein“ gibt es schon je Lauf: KI-07, KI-11 und KI-16 verwerfen Texte mit unbelegten Zahlen.
- **B-03 Status der Entwürfe.** Code `draft|accepted|discarded` (`ai-draft.ts:61`); HE-01 nennt `adopted` (T1-HE3). Es fehlen `review_seconds`, `review_order` und `author_kind`.
- **B-04 Rücknahme fehlt.** `agent_run` hat kein `undo_payload`, `undone_at` oder `undone_by` (`agent.ts:141`). Rücknahme gibt es nur beim Import.
- **B-05 Stufen und bindende Werkzeuge (MA-01).** Es fehlen:
  - in der Registry die Stufen: `allowed_levels`, `default_level`, `review_seconds`;
  - an den Werkzeugen `binding` und `binding_scope`;
  - die Tabelle `worker_setting`;
  - ein Bestätigungs-Token.
  - Die Seite Agenten gibt es noch (`/agenten`, `/einstellungen/ki/agenten/…`).
  - Stand K1-f.1 (25.11.2026): Stufen je Person, Obergrenze und An/Aus je Aufgabe sind gebaut. Das Postfach wirkt auf allen drei Stufen. Die anderen Aufgaben wirken zunächst nur auf ihrer heutigen Stufe (`liveLevels`, MA-01). Das Token für bindende Werkzeuge folgt in K1-f.2, das Entfernen der Seite Agenten in K1-f.4.
  - Stand K1-f.2 (25.11.2026): Der Wächter für bindende Werkzeuge mit Bestätigungs-Token ist gebaut (`runTool`, `app_use_confirm_token`). Die Werkzeuge selbst kommen mit ihren Paketen.
  - Stand K1-f.5 (25.11.2026): Die Seite Agenten ist entfernt; alte Adressen leiten weiter (T1-MA5).
- **B-06 Eigene Agenten sind gebaut (KI-09).** Gebaut am 23.11. als Schritt 19 des alten Plans: `features/agents/custom-agent-pages.tsx:49`, `apps/api/src/modules/agents/custom-tools.ts`, Migration 0122, Freigabe `ai_custom_agent_approval`.
  - Das Paket stellt KI-09 zurück, MA-01 ersetzt den Baukasten (F-13).
  - Stand K1-f.5 (25.11.2026): Oberfläche, Routen und API der eigenen Agenten sind entfernt, die Funktion ist aus. Die Tabellen bleiben (E-K0-13).
- **B-07 Demo-Technik (DM-01, KI-01).**
  - Es fehlen `org.ai_mode`, die Modi `record`/`replay`, `model_call_recording`, `org.is_demo`, `org.demo_now`, `demo_event`, `demo_snapshot` und die Seite `/demo`.
  - Stand K1-b.1 (25.11.2026): `is_demo`, `ai_mode` und `demo_now` gibt es seit K1-a. Die Modi und `model_call_recording` sind gebaut. Es fehlen noch `demo_event`, `demo_snapshot` und `/demo` (K1-g).
  - Stand K1-b.2 (25.11.2026): Die Demo-Sitzung je Person ist gebaut (E-K0-05).
  - Stand K1-g.1 (26.11.2026): `demo_event` und `demo_snapshot` (Stand „start“) sind gebaut, dazu die Regie-API. Es fehlt noch die Seite `/demo` (K1-g.4).
  - Stand K1-g.4 (26.11.2026): Die Seite `/demo` ist gebaut (⌥D in einer Demo-Sitzung). Seit K1-g.1 stoßen „Neuer Tag“ und „Auf Datum springen“ die fälligen Läufe an. Damit ist B-07 erledigt; die Fachzeit für „heute“ an weiteren Stellen steht unter B-33.
  - Es gibt keine Uhr je Mandant. In der API stehen 201 `new Date()`, 21 `Date.now()` und 45 `now()` in SQL, dazu Standardwerte `defaultNow()` und Zeitpläne in zehn Workern. Das ist der breiteste Umbau des Pakets (Abschnitt f).
  - Stand K1-b.4 (25.11.2026): Die Uhr je Mandant gibt es seit K1-a in den Anfragen und in SQL (`app_now()`).
    - **Jobs:** Jobs über Mandanten rechnen jetzt je Mandant mit dessen Uhr (`inOrgClock`).
    - **Oberfläche:** Sie rechnet „heute“ mit der Fachzeit aus dem Kopf `x-reziproq-jetzt` (`appNow`).
    - **Offen:** Nur die Zeitpläne selbst laufen in Echtzeit. „Neuer Tag“ und „Auf Datum springen“ stößt K1-g an.
- **B-08 Demo-Daten (DM-01, G-10).** Heute gibt es „Test-OEM (Demo)“, „Zweit-OEM“ und „Test-Lieferant“ (`packages/db/src/seed.ts:42`), dazu `demo-story.ts`.
  - Stand K1-b.3 (25.11.2026): Hollmann Antriebe ist ein eigener Demo-Mandant (`pnpm demo:hollmann`) mit den Personen und Lieferanten aus DM-01 und den Zahlen der Vorlage Beziehungen. Den Stand der Drehbücher legt K1-g an.
  - Einige Lieferanten heißen schon wie im Paket (Rheintal Elektronik, Silesia Guss, Pearl River), haben aber andere Zahlen.
  - Es fehlen: Hollmann Antriebe, die Personen aus DM-01, Halder Maschinenbau, Saar Circuits, Moldau PCB, Weser PCB, Kessler Präzision, Nordwerk Guss, Baltic Logistics und Donau Print (F-04).
- **B-09 Rahmen (NAV-10 2.0).** Code:
  - Hauptpunkte Übersicht, Mein Tag, Lieferanten, Warengruppen (`features/shell/navigation.tsx:101`);
  - Startseite `overview`/`my_day` (`app-user.ts:77`, `packages/shared/src/me.ts:10`);
  - Frag ist eine eigene Seite `/fragen` (PLT-12), keine Überlagerung mit ⌘K;
  - „Im Hintergrund“, Mein Agent und die Zahl an Heute fehlen;
  - die Tab-Leiste hat Frag nicht als drittes von fünf Zielen.
- **B-10 Blatt, Überlagerung, Dialog.** PLT-10 verbietet Dialog, Sheet, Drawer, Popover, Toast und Overlay. Der Test `apps/web/src/components/ui/no-popups.node.test.ts:5` erzwingt das; die Liste der Ausnahmen ist seit UMB-01 leer.
  - Das Paket verlangt:
    - ein Blatt 620 px von rechts mit Hintergrund Tinte 25 % (NAV-10 Regel 4, Designsprache „Blatt“, K2-Profil, K5-Szenarien);
    - Frag als Überlagerung;
    - den Dialog „So teilen“ (Inventar T3-I12);
    - den Freigabe-Dialog mit abwählbaren Anfragen (BE-01).
  - Folge: F-01.
- **B-11 Module ohne Wirkung.** `value_finder` und `category_strategy` stehen in `org_module`, schalten aber nichts ab. Nur `features/insights/overview-page.tsx:76` liest `category_strategy`.
  - UX-20 2.1: Ist ein Modul aus, gibt es keine Route, keinen Menüpunkt, keine Karte und kein `focus_item`.

### Beziehungen, Akte, Postfach (Kapitel 2)

- **B-12 Phase 2 und 3 abgelöst.** Gebaut nach NAV-10 1.1 und jetzt gestrichen:
  - Lieferantenkopf mit vier Bereichen und Unterseiten (`components/ui/entity-header.tsx:139`, `features/workspace/supplier-workspace.tsx`), Phasenkette und Zeilen im Überblick;
  - Liste mit Gruppen „Brauchen dich“ und „Laufen gut“, Ampelpunkt und Detailleiste (`features/suppliers/supplier-list.tsx:54`); BZ-01 streicht genau diese;
  - Terminschiene auf Mein Tag (E-K1-4);
  - Übersicht mit Terminschiene.
  - Weiter nutzbar sind die API-Parameter `?beziehung=`, die Kennzahlen im Überblick (`overview/figures.ts`), `StatusDot` und die Bausteine.
- **B-13 Adressen.** Der Code hat auf der Käuferseite etwa 145 Routen außerhalb der Einstellungen, davon 103 unter `/lieferanten/<id>/{strategie,beziehung,plan,umsetzung,wirkung,zyklus}/…`. Dazu kommen `/portfolio`, `/uebersicht`, `/mein-tag`, `/start`, `/hinweise`, `/wirkung`, `/bewertungen`, `/agenten` und `/fragen`. Die Lieferantenseite hat 52 Routen unter `/kunden/<id>/…`.
  - Die Weiterleitungen in AK-01 nennen Adressen der Fassung 1.0 (`/beziehungen/<id>/segmentierung`, `/aktivitaeten`, `/zusagen`, `/team`, `/netz` …), nicht die heutigen.
  - Für TN-07 und TU-07 braucht es eine vollständige Tabelle alt → neu aus dem Routenbaum.
- **B-14 Zusagen (ZQ-01).** Der Status ist heute `open|kept|missed` (`initiative.ts:129`), die Spec verlangt `offen|gehalten|verfehlt|ersetzt|zurueckgezogen`.
  - Es fehlen `measure`, `source_*`, `supersedes_id`, `condition_id`, `fulfilled_evidence` und `confirm_state`.
  - Maßnahmen haben `open|in_progress|done|cancelled` (`action.ts:20`).
  - Offen aus KI-17: Ein freigegebener Gemeinsamer Plan nimmt keine neuen Zusagen an (409, JBP-06, F15 im alten Prüfbericht); siehe F-16.
  - Stand K2-a.1 (26.11.2026): Die Status bleiben englisch, nach Entscheidung des Gründers; `replaced` und `withdrawn` sind dazugekommen. Die fehlenden Spalten gibt es jetzt (`confirm_state` seit K1-a), dazu die Tabelle `task` für Aufgaben (ZQ-01, Abschnitt Umsetzung).
- **B-15 Rollen.**
  - Käufer haben die Rollen `admin|member|viewer` und ein Controlling-Kennzeichen.
  - Einen Lead gibt es nur je Warengruppe; eine Vertretung (E-K5-2, E-K6-2, E-K8-3) fehlt.
  - Die Lieferanten-Teamrollen sind `sro|sponsor|member` (`packages/shared/src/invitations.ts:44`), LP-01 nennt Sponsor, Key Account, Mitglied.
  - `supplier_approval_rule` und `customer_rating` fehlen.
- **B-16 Bestätigen per Link (BL-01).** `confirm_link` fehlt. Bestätigen ohne Konto gibt es nicht: Der Umfrage-Link hat keinen Passkey, die Einladung mit Passkey legt ein Konto an (F-06).
- **B-17 Postfach (PO-01).** Mails werden heute von Hand über das Add-in oder per Weiterleitung abgelegt (`mail.ts:22`, Quellen `addin|forward`). Es gibt keine Zuordnung nach Konfidenz 0,9, keine Erkennung von Zusagen in Mails und keinen Antwortentwurf. Termine laufen über „Neu eingegangen“ (`calendar.ts:100`).
- **B-18 Mandat (MD-01, MV-01).** Mandat und Mandatsversion fehlen ganz. Lieferantenplan und Spielregeln als Quelle sind vorhanden.

### Termin (Kapitel 3)

- **B-19 Termin-Seite.** Heute Reiter unter `/lieferanten/<id>/umsetzung/termine/<id>` (`?reiter=ergebnisse`), TE-01 verlangt `/termine/<id>` mit drei Phasen nach der Uhr.
  - Briefing-Vorlauf JBP 7 Tage (`packages/shared/src/meeting-brief.ts:33`), E-K3-4 verlangt 10.
  - `meeting_goal` fehlt; Ziele stehen heute im Briefing-Entwurf.
  - Ein Termintyp „Review Warengruppe“ fehlt (RV-01).
- **B-20 Beiträge und Deck (BE-01, DK-01).** Beiträge je Agendapunkt, Deck, Folien, Prüfung vor dem Teilen und der Dokumentendienst (KI-18, im alten Plan Schritt 34, offen) fehlen. `plan_contribution` sind Beiträge zum Lieferantenplan, nicht zum Termin.
- **B-21 Ergebnisse (PR-01).** `meeting_capture` deckt Festhalten und Ergänzungen ab.
  - Abweichungen: Zitate mit Uhrzeit aus dem Transkript statt Fundstellen aus Notizen; ein Ziel-Abgleich je Ziel fehlt.
  - Bestätigung durch den Lieferanten per Link fehlt (B-16).

### Wert (Kapitel 4)

- **B-22 Wert-Engine (WK-01).** Die Wirkung ist heute Hebel × GuV-Zeile × Wirkungsart mit Reifegrad 1 bis 5 (`levers.ts:24`). Das Controlling gibt über sein Konto frei (`impact.ts:206`).
  - Die Spec verlangt `value_rule` mit Versionen, `value_booking` mit Zustand je Monat und eine Bestätigung per Link (E-K4-1).
  - Wertarten: Code `ebit|cost_avoidance|cash|strategic` (`levers.ts:21`), die Spec kennt drei (F-11).
  - Die SQL-Skizzen nutzen `numeric` ohne Währung; CLAUDE.md und der Code verlangen Cent als Ganzzahl mit Währung (F-10).
  - Reibung, Kostensätze, Beziehungsrendite und Wertbericht fehlen.
- **B-23 Gemeinsamer Plan (GP-01).** Versionen und Freigaben sind da. Es fehlt der Entwurf der nächsten Version aus dem Protokoll mit Quelle je Änderung.
- **B-24 Wertfinder.** Er heißt heute „Wertpotenziale“ unter `/lieferanten/<id>/wirkung/wertpotenziale`. Die Sicherheit ist `high|medium|low`, die Spec schreibt `hoch|mittel|niedrig`; Code darf die alten Namen behalten (NAV-10).

### Lieferantenseite (Kapitel 5)

- **B-25 Lieferantenseite (LP-01, LA-01).** Kunden und Akte mit Reitern sind da. Es fehlen:
  - Heute beim Lieferanten;
  - Sichten statt Reiter;
  - Agent, Reibung, Kostenspanne und Vorlagen beim Lieferanten.
- **B-26 Deal, Autonomie, Simulator (DL-01, AU-01, SI-01).** Fehlen ganz; KI-20 und KI-21 waren nicht gebaut.

### Warengruppen (Kapitel 6 bis 8)

- **B-27 Strategie (ST-01).** Heute zehn Schritte unter `/warengruppen/<id>/strategie/<step>`, die Spec verlangt vier Teile mit Versionen.
  - Offene Schritte des alten Plans gehen in ST-01 auf (F-15): 31b (WG-20 Übergaben), 32 (WG-23), 33 (KI-13).
- **B-28 Marktsignale (MS-01).** Marktkräfte (WG-09), Marktanalyse (KI-08) und `value_market_signal` (KI-11) sind da. Es fehlen Quellen mit Lizenzangabe und die Abbildung je Beziehung mit Rechenweg. Öffentliche Recherche läuft nur mit dem Testanbieter.
- **B-29 Kapitel 8.** Hypothesen, Annahmen, Zielwächter, Soll-Kosten, Szenarien, Anteile und Verhandlung fehlen. Vergabeplan (WG-14), Review (WG-12), Supplier Map und Hebel sind als Inhalt da.

### Kanäle und Querschnitt (Kapitel 7)

- **B-30 Kanäle (KA-01).** Das Outlook-Add-in und die Anbindungen laufen nur mit dem Anbieter `fake`. Chat, Sprache und `channel_*` fehlen.
- **B-31 Rechte.** Keine Handlung aus der Rechte-Ergänzung ist eine Aktion in `permissions.ts`. Sie stehen als Planung in `docs/rechte.md`.
- **B-32 Glossar.** Die Tabelle mit Schlüsseln prüft die heutigen Texte (Lieferant, Maßnahme, Ergebnisse, Aktivitäten, Portfolio). Mit K1-d und K2 werden Zeilen und Schlüssel umgestellt; sonst schlägt `glossary.test.ts` fehl.
- **B-33 „Heute“ nach UTC statt nach Berlin (gefunden am 26.11.2026 in K1-b.5; Mein Tag behoben am 26.11.2026, Rest offen).**
  - **Befund:** Mein Tag (`apps/api/src/modules/start/start.service.ts:60`) rechnet „heute“ nach UTC. Heute und Triage rechnen nach Berlin (`today/berlin.ts`).
  - **Mischung:** In Mein Tag kommt „überfällig seit“ nach Berlin. „Erledigt heute“ vergleicht `done_at::date` in der Zeitzone der Datenbank-Sitzung (`my-day-data.ts`).
  - **Folge:** Zwischen 00:00 und 01:00 (im Sommer 02:00) rutscht eine Aufgabe mit Frist heute in „diese Woche“. `ux-20-phase-2.test.ts` scheitert in dieser Stunde, auch ohne Änderung.
  - **Behoben in Mein Tag:** „Heute“ kommt aus `berlinDate(currentTime())`, also nach Berlin und nach der Uhr des Mandanten.
    - Terminschiene und „erledigt heute“ rechnen im SQL mit Berliner Tagen (`at time zone 'Europe/Berlin'`), unabhängig von der Zeitzone der Datenbank-Sitzung.
    - Test: `ux-20-phase-2.test.ts` mit Demo-Uhr 00:30 in Berlin und einer Sitzung in UTC; er läuft zu jeder Uhrzeit gleich.
  - **Schon behoben:** Zwei Web-Tests mit derselben Annahme (Erledigt, Harness von Heute) rechnen seit K1-b.5 nach Ortszeit.
  - **Offen:** Dasselbe Muster (`toISOString().slice(0, 10)` für ein Datum) steht an 28 weiteren Stellen der API.
    - 26 meinen fachlich „heute“: Fristen und Überfälligkeit (Maßnahmen, Zusagen, Runden, Wellen, JBP, Beiträge), Briefing, Übersicht und Zyklus, Wirkung und Portfolio, Hinweise, Wertpotenziale, Markt, Erinnerungs-Jobs, Kontingent des Monats und Geschäftsjahr.
    - 2 sind Dateinamen (PDF, Excel-Export).
- **B-34 Weitergeleitete Mails in Heute und Kurz prüfen (gefunden am 26.11.2026 mit dem Drehbuch K1; Begründung behoben, Anzeige offen).**
  - **Absender:** Kurz prüfen zeigt „Mail von nils-ott@rheintal.example“, also die Adresse statt des Namens (`inbound_from` in `review.service.ts`). Erledigt nennt seit K1-g.2 den Namen aus den Ansprechpartnern der Beziehung.
  - **Ohne Betreff:** Eine Mail ohne Betreff bekommt den Betreff „–“ (`mails.service.ts`).
    - In Kurz prüfen heißt die Karte dann „Mail zuordnen: –“.
    - In Heute, Ansicht Alles, Gruppe „Zuordnen“ steht als Titel nur „–“.
    - Vorschlag: „Mail von Nils Ott“ als Titel, wie in Erledigt.
  - **Folge für die Demo:** In den Schritten 3 und 4 des Drehbuchs K1 sieht man die Mail von Nils Ott so. Der Drehbuch-Test prüft Gruppe, Vorschlag und Karte, nicht diesen Titel.
  - **Nebenbefund:** In Heute, Ansicht Alles, steht „1 offene Zusagen und Aufgaben bei 1 Beziehung“, im Plural auch bei 1.
  - **Behoben in K1-g.5:** Die Begründung einer Mail, die auf Stufe Vorbereiten in Kurz prüfen wartet, nannte einen fehlenden Zugriff („Die weiterleitende Person darf hier keine Mails ablegen.“). Seit MA-01 (K1-f) ist der Grund aber die Stufe. Jetzt nennt sie die Stufe: „Auf Stufe Vorbereiten legt das Postfach Mails nicht selbst ab.“

## c) Widersprüche zwischen den Specs

Je Punkt: Fundstellen, welche Quelle nach der Rangfolge gilt und wie ich ohne deine Antwort weiterarbeiten würde.

- **C-01 Akte-Kopf auf Termin und Plan.**
  - E-K2-7: Der Kopf der Akte bleibt nicht auf Termin- und Plan-Seiten.
  - AK-01: „Seiten aus Kapitel 3 und 4, die zu einer Beziehung gehören, binden denselben Kopf ein“; GP-01: „Kopf der Akte (Sicht Gemeinsam)“ auf `/beziehungen/<id>/plan`.
  - Gilt: E-K2-7. Termin mit eigenem Kopf (TE-01 passt), Plan mit Zurück-Link „‹ <Beziehung>“ statt Akte-Kopf.
- **C-02 Matrix der Segmente.**
  - BZ-01 „Matrix … mit vier Feldern“, T2-03 „Felder 9, 8, 9, 12“.
  - Designsprache „Matrix 3 × 3“; Glossar (Impact hoch/mittel/niedrig × Qualität schwach/ausbaufähig/stark); Code-Segmentmodell 3 × 3.
  - Gilt: BZ-01 (Spec). Vier Felder passen aber nicht zum Modell; Klärung nötig (F-20).
- **C-03 Gruppen der Ansicht Alles.**
  - HE-01: Für dich, Bei anderen, Hinweise, Zusagen und Aufgaben.
  - Inventar T1-I01: „Maßnahmen“; T1-I05: „Weitere Hinweise“; DM-01 K1 Schritt 3 und Inventar T7-04: Gruppe „Zuordnen“.
  - Gilt: HE-01, ergänzt um „Zuordnen“, weil zwei Drehbücher sie prüfen.
- **C-04 Zusage des Käufers in Kurz prüfen.**
  - HE-01: „Nie in Kurz prüfen: Zusagen im Namen des Käufers“; PO-01 Schritt 3: dann Fokus-Thema.
  - DM-01 K2 Schritt 3 und Board K2-Mail-Zusage zeigen den Entwurf mit Hollmanns Zusage „Zeichnung Rev. C bis 30.11.“ in Kurz prüfen.
  - Gilt: HE-01 und PO-01. Der Entwurf erscheint als Fokus-Thema, Schritt 3 des Drehbuchs öffnet ihn aus Heute.
- **C-05 Wer bestätigt einen Strategie-Teil.**
  - ST-01: Lead oder Commodity Manager.
  - Rechte-Ergänzung: Admin, Lead, SRO im Team, Mitglied im Team.
  - Gilt: ST-01 (Specs vor der Rechte-Ergänzung, die nicht in der Rangfolge steht). Bitte bestätigen.
- **C-06 Wer bekommt die Anfrage an einen neuen Lieferanten.**
  - SZ-01-Tabelle: Commodity Manager.
  - SZ-01-Demo: Paul Hahn, laut MV-01 zuständig für Saar Circuits; Commodity Manager ist laut DM-01 Jonas Feld.
  - Gilt: Tabelle. Die Demo braucht Jonas Feld oder eine Zuständigkeit je Lieferant.
- **C-07 Monat des Wertberichts.**
  - WB-01: am ersten Montag für den Vormonat.
  - DM-01 K4 und T4-20: am Mo 21.12. „Bericht Dezember“; WB-01 nennt als Frist Mo 30.11.
  - Nach der Regel läge am 23.11. der Oktober vor, am 21.12. der November. Klärung nötig.
- **C-08 Briefing-Vorlauf in der Demo.**
  - E-K3-4: 10 Tage vor dem JBP (Fr 04.12.), also ab Di 24.11.
  - Inventar Kapitel 1 und DM-01 K3: Das Briefing liegt am Mo 23.11. schon als Entwurf vor.
  - Gilt: E-K3-4. Der Seed legt das Briefing für die Demo vorab an, oder der Vorlauf wird 11 Tage.
- **C-09 Bedeutung von „Von <Gegenüber>“.**
  - AK-01: was das Gegenüber aktiv geteilt hat.
  - WK-01 (Wertkonto): was das Gegenüber sieht.
  - Gilt: AK-01. Was der Lieferant sieht, steht im Wertkonto als Zeile „Was <Lieferant> sieht“.
- **C-10 Designsprache in sich.**
  - Die Überschrift „Dreizehn Regeln“ steht über 15 Regeln; CLAUDE.md nennt ebenfalls dreizehn.
  - Die Bausteintabelle verweist auf Boards, die nicht beiliegen: `Aufgaben`, `C-Claim` (Claims, G-4), `P-Zusagen`, `P-Scorecard`, `P-Initiativen`, `WG-Markt`, `WG-Ziele`. `INDEX.md` nennt nur `Aufgaben`.
  - Gilt: die Regeln selbst; Aufbau dieser Bausteine nach ähnlichen Boards (`L-Ueberblick`, `W-Initiative`, `K6-Strategie`).
- **C-11 „Lead der Beziehung“.**
  - E-K5-2, MD-01 und DL-01 nennen ihn; eine Beziehung hat einen SRO, einen Lead gibt es je Warengruppe.
  - Die Demo nennt Sara Ost, Lead Einkauf und Lead Leiterplatten. Siehe F-07.
- **C-12 Seitenleiste.** NAV-10 2.0 („so hoch wie die Seite“) und Designsprache 3.1 („nicht fixiert“) stehen gegen deine Entscheidung vom 23.11.
  - Entscheidung: Leiste so hoch wie der Bildschirm, nur der Inhalt scrollt (`docs/plan/fragen.md:155`, Code `app-shell.tsx:86`).
  - Das Paket hat die dafür angepassten Fassungen überschrieben (F-02).
- **C-13 Haltung je Person.**
  - Inventar T2-I25 führt „Haltung“ einer Person des Lieferanten (früheres Board B-Person: unterstützend, neutral, kritisch).
  - CLAUDE.md: „Keine Bewertung einzelner Personen, nur Organisationen, Funktionen und Beziehungen“.
  - Für das Beziehungsnetz gibt es weiter kein Datenmodell in einer Spec. Der geplante Entwurf F-UX-02 ist nicht im Paket (F-21).
- **C-14 Ältere Specs ohne Ablösehinweis.** NAV-05 (durch HE-01), LS-01 (durch BZ-01), NAV-06 und NAV-12 (durch AK-01), AW-01, PLT-10 (Blatt), JBP-01 bis JBP-09 (GP-01) und QBR-01 bis QBR-07 (TE-01, PR-01) widersprechen den neuen Specs, tragen aber keinen Statuskopf wie die KI-Specs.
  - Dazu liegen Entwürfe `WG-*.neu.md`, `WG-23.neu2.md` und `docs/design/designsprache.neu.md` herum.
  - Gilt: die neuen Specs. Siehe F-21.

Widersprüche zu CLAUDE.md und früheren Festlegungen:

- **C-15 Push.** CLAUDE.md („Lokaler Betrieb“) und F-UX-00a erlauben den Push des Arbeitsbranchs; G-1 verbietet `git push`.
  - Gilt: G-1. Ich pushe nicht mehr. CLAUDE.md sollte nachgezogen werden (F-23).
- **C-16 Demo.**
  - CLAUDE.md: `pnpm demo:setup` richtet die echten Konten ein, „ohne erfundene Personen“.
  - DM-01 und G-10: Demo-Mandant Hollmann mit erfundenen Personen (F-04).
- **C-17 Geld.**
  - CLAUDE.md: Cent als Ganzzahl mit Währung.
  - Die SQL-Skizzen in WK-01, DL-01, LA-01, VG-01, WZ-01 und SZ-01 nutzen `numeric` ohne Währung.
  - Gilt im Code: CLAUDE.md (F-10).
- **C-18 Knopf „Erledigt“ für Zusagen (gefunden am 26.11.2026 in K2-a.2).**
  - IN-06: Die Karte zu einer fälligen Zusage bucht mit dem Knopf „Erledigt“ in Teams.
  - ZQ-01 Regel 2, T2-ZQ2: gehalten nur mit Beleg; ein Klick auf die eigene Zusage ist keiner.
  - Umgesetzt nach ZQ-01, der neueren Spec für Zusagen: Neue Karten haben nur noch den Link zur Zusage. Ein Klick auf einer älteren Karte bucht nichts und sagt, dass ein Beleg nötig ist. KA-01 legt die Knöpfe der Kanäle in K7 neu fest.

## d) Ist Phase 1 fertig?

**Ja, im Sinne des Plans.** Phase 1 wurde nach UX-20 1.1 gebaut und am 23.11. abgenommen (`docs/plan/ux-abweichungen.md`, Abschnitt Phase 1, Commit `f322cee`).

| Teil                        | Stand                                                                                                                                 | Was für die Fassungen 2.x fehlt                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modul-Schalter `org_module` | Tabelle mit Zeilensicherheit, nur lesen für die App, Standard Claims, Risiko, Vertrag aus, über `/me`                                 | `value_finder` und `category_strategy` schalten nichts ab (B-11). Klein, vor K1-d                                                                                                                                                                                                                                                                 |
| Design-Tokens               | alle Farbwerte der Designsprache 3.1 vorhanden; Abschnittslabel `#5a636b`; Figtree und Outfit selbst ausgeliefert; kein dunkles Thema | nichts Wesentliches. Die CI-Leitplanken T-CI1 bis T-CI3 aus K2-h sind zum Teil schon da (`tokens.node.test.ts` prüft feste Werte, Kontrast und das helle Thema; keine Schrift wird von Google geladen, ein Test dafür fehlt noch)                                                                                                                 |
| `AppShell`                  | Seitenleiste 236 px ab 761 px, Tab-Leiste fest unten bis 760 px, Inhalt bis 1200 px, unten 92 px Abstand                              | Inhalt nach NAV-10 2.0: Hauptpunkte, Zahl an Heute, „Im Hintergrund“, Mein Agent, Tab-Leiste mit Frag, ⌘K als Überlagerung. Das ist Paket K1-d. Offen: fixiert oder nicht (C-12)                                                                                                                                                                  |
| Bausteine                   | UX-20 1.1 vollständig, Testseite `/bausteine`                                                                                         | UX-20 2.1 neu: `FocusMappe`, `DraftStack`, `DoneLog`, `WhyPanel`, `Mirror`, `AkteKopf` mit `ViewSwitch`, `Sheet`, `PhaseSwitch`, `PartSwitch`, `LevelSegment`, `AuthorChip`, `DemoDirector`, `TwoWindow`. Aus der Designsprache: Wertart-Kachel, Reife-Chip, Wert-Pipeline, Hypothesen-Zeile, Option mit getrennten Größen, Abstand-Balken, Runde |

Entfallen sind `ProcessChain`, `FlowBar`, `SupplierHeader` und `CategoryHeader` (`entity-header.tsx`). Im Code stehen noch weitere Vorgänger, die nach Phase 1 hätten entfernt werden sollen: `NextStep`, `ListCard`, `Steps`, `StepProgress`, `StepDots`, `Chain`, `GroupBar`, `LocalBar`, `GlobalBar`, `TimelineRail`. Sie werden mit den Seiten abgebaut, die sie heute tragen.

Die Voraussetzung für K1-a ist erfüllt. K1-d braucht vorher F-01 (Blatt und Überlagerung) und F-02 (Seitenleiste). Die neuen Bausteine entstehen in ihren Paketen im UI-Paket und auf `/bausteine`; `Sheet` zuerst, weil fast jedes Paket es nutzt.

## e) Offene Fragen an dich

Jede Frage mit meiner Empfehlung. „Empfehlungen übernehmen“ reicht als Antwort, wenn du allen folgst.

| Nr.  | Frage                                                                                                                                              | Empfehlung                                                                                                                                                                                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Blatt, Frag als Überlagerung und zwei Dialoge widersprechen PLT-10 und dem Test gegen Pop-ups. Aufheben?                                           | Ja, eng: Erlaubt werden nur `Sheet` (620 px, Esc, Fokus bleibt im Blatt, mobil volle Seite), die ⌘K-Überlagerung und die Dialoge „So teilen“ und „Agenda freigeben“. Der Test bekommt eine feste Liste erlaubter Bausteine; Toasts und Popover bleiben verboten. PLT-10 bekommt einen Statuskopf                     |
| F-02 | Seitenleiste fixiert (deine Entscheidung vom 23.11.) oder „so hoch wie die Seite“ (NAV-10 2.0, Designsprache 3.1)?                                 | Bei deiner Entscheidung bleiben; ich ziehe NAV-10 und die Designsprache wieder nach                                                                                                                                                                                                                                  |
| F-03 | `space` als neue Spalte an allen Tabellen oder aus Ebene, `owner_org_id` und `visibility` abgeleitet?                                              | Abgeleitet: generierte Spalte `space` auf den geteilten Tabellen, bei privaten Tabellen fest. Die Policies bleiben wie heute; sie sind für alle 162 Tabellen des Registers getestet. Neue Tabellen bekommen `space` direkt. `origin` und `confirm_state` als echte Spalten nur an den Objekten, die die Specs nennen |
| F-04 | Hollmann neben Test-OEM oder statt Test-OEM? CLAUDE.md sagt „ohne erfundene Personen“                                                              | Hollmann als eigener Demo-Mandant mit eigenem Seed. Test-OEM bleibt für die automatischen Tests, `demo:setup` für deine echten Konten bleibt. CLAUDE.md nachziehen                                                                                                                                                   |
| F-05 | Rollenwechsel der Demo-Regie (Jan-Luka, Sara Ost, Kim Kaiser, Tom Weber, Mia Kuhn) bei Anmeldung über Zitadel: Konten je Person oder Demo-Sitzung? | Demo-Sitzung je Person ohne Zitadel, nur wenn `org.is_demo` gilt und nie in Produktion. Bestätigungslinks nutzen echte Passkeys                                                                                                                                                                                      |
| F-06 | Bestätigen per Link „mit Passkey, an die Person gebunden“, ohne Konto: Wie wird der Passkey beim ersten Öffnen an die Person gebunden?             | Einmalcode an die Mailadresse der Person, dann Passkey anlegen (Gast-Identität). Ein weitergeleiteter Link scheitert am Code (T2-BL1)                                                                                                                                                                                |
| F-07 | Wer ist „Lead der Beziehung“ (E-K5-2, DL-01)?                                                                                                      | Der Lead der Haupt-Warengruppe der Beziehung; Vertretung je Lead unter Einstellungen › Organisation                                                                                                                                                                                                                  |
| F-08 | Rollen beim Lieferanten: heute `sro`, `sponsor`, `member`, LP-01 nennt Sponsor, Key Account, Mitglied                                              | `sro` beim Lieferanten wird „Key Account“ (Migration, Rechte unverändert)                                                                                                                                                                                                                                            |
| F-09 | Wer ist „strategisch“ (Pflicht zum Mandat E-K2-4, Filter in BZ-01)? Früher F-UX-18                                                                 | Fokuslieferanten (SEG-02)                                                                                                                                                                                                                                                                                            |
| F-10 | Geldbeträge in den neuen Tabellen                                                                                                                  | Cent als `bigint` mit Währung, Spannen als `low_cents` und `high_cents`; die SQL in den Specs ist eine Skizze                                                                                                                                                                                                        |
| F-11 | Wertart „strategisch“ gibt es im Code, WK-01 kennt sie nicht                                                                                       | Bleibt als Wirkungsart ohne Euro; erscheint nicht in Kacheln, Pipeline oder Summen                                                                                                                                                                                                                                   |
| F-12 | Controlling bestätigt heute mit Konto; E-K4-1 per Link                                                                                             | Link dazu, Konto bleibt möglich                                                                                                                                                                                                                                                                                      |
| F-13 | Eigene Agenten (KI-09) sind gebaut, das Paket stellt sie zurück                                                                                    | In K1-f Oberfläche und Routen entfernen, Funktion aus. Tabellen bleiben, bis über KN-54 entschieden ist                                                                                                                                                                                                              |
| F-14 | Der Pilotpfad vom 23.11. abends (Durchstich D, C1, C2/C3/C5, Pilot C6) steht nicht im neuen Plan. Gilt er weiter?                                  | Ja, parallel: D, sobald deine Zugänge da sind; C1 bis C6 nach K2-g, wenn die Akte mit Zusagen pilotfähig ist                                                                                                                                                                                                         |
| F-15 | Alte offene Schritte: 31b, 32, 33, 34 bis 39                                                                                                       | Ruhen. 32 und 33 gehen in ST-01 auf, 35 (KI-19) entfällt, 36 und 37 in DL-01 und SZ-01, 38 in WB-01, 39 in LA-01. 34 (KI-18 Dokumente) wird Teil von K3-d. 31b nicht mehr bauen                                                                                                                                      |
| F-16 | Freigegebener Plan nimmt keine neuen Zusagen an (JBP-06, F15)                                                                                      | Mit ZQ-01 hängen Zusagen an der Beziehung, nicht an der Planversion; der Konflikt entfällt                                                                                                                                                                                                                           |
| F-17 | Gewicht des Segments in der Triage (HE-01; früher F-UX-17)                                                                                         | Gewicht je Segmenttyp im Segmentmodell, Start 1,0, strategisch 2,0                                                                                                                                                                                                                                                   |
| F-18 | EBIT-Ziel je Warengruppe (ST-01, WK-01; früher F-UX-15)                                                                                            | Initiative bekommt die Warengruppe; Ziel je Warengruppe in Cent                                                                                                                                                                                                                                                      |
| F-19 | Termin „Freigabe Strategie“ als Datum (ST-01 Chip „Freigabe am“; früher F-UX-16)                                                                   | Feld „Freigabe geplant am“ an der Strategie-Version                                                                                                                                                                                                                                                                  |
| F-20 | Widersprüche C-01 bis C-09                                                                                                                         | wie in Abschnitt c beschrieben weiterarbeiten. C-02 (vier Felder) und C-07 (Monat des Wertberichts) brauchen deine Antwort                                                                                                                                                                                           |
| F-21 | Beziehungsnetz: kein Datenmodell in einer Spec, „Haltung“ je Person (C-13). Dazu: Statusköpfe für ältere Specs (C-14)                              | Netz nur aus Funktionen und Gesprächspaaren mit „Draht“ (wie K2-Akte-Privat), keine Haltung je Person. Statusköpfe „abgelöst durch“ als reine Doku in K1-a                                                                                                                                                           |
| F-22 | Umsetzungsnotizen der ersetzten KI-Specs sind aus den Dateien verschwunden                                                                         | Als Abschnitt „Umsetzung bis 23.11.2026“ unter den Statuskopf zurückholen (aus `77cc620`)                                                                                                                                                                                                                            |
| F-23 | CLAUDE.md nachziehen: Push (G-1), Demo (DM-01), „dreizehn Regeln“, Verweis auf Abschnitt 9 des alten Plans                                         | Ja, mit diesem Paket als Quelle                                                                                                                                                                                                                                                                                      |
| F-24 | UX-Plan (`docs/plan/ux-umsetzung.md`, Phasen 4 bis 10) und die Spec-Entwürfe F-UX-02 und F-UX-03                                                   | Als abgelöst markieren; F-UX-03 (JBP-Termin) entfällt durch TE-01, F-UX-02 geht in F-21 auf                                                                                                                                                                                                                          |

## f) Reihenfolge der Pakete

Die Reihenfolge des Plans passt. Vier Änderungen empfehle ich:

1. **K0-b vor K1-a (Doku, kein Code):** F-01, F-02, F-03 und F-23 umsetzen. Das sind Statusköpfe, CLAUDE.md, die Anpassung von NAV-10 und Designsprache bei F-02 und die Umsetzungsnotizen (F-22). Grund: K1-a (`space`) und K1-d (Blatt, Rahmen) hängen direkt an diesen Antworten.
2. **Uhr je Mandant in K1-a statt K1-b:** Triage (K1-c), Briefing, Erinnerungen und alle Fristen lesen die Zeit. Etwa 270 Stellen müssen auf eine Funktion je Mandant umgestellt werden.
   - Je früher das geschieht, desto weniger neuer Code liest die Systemuhr.
   - Ein Test, der `new Date()` außerhalb der Uhr verbietet, verhindert Rückfälle.
   - Gateway-Modi und Seed bleiben in K1-b.
3. **K2-h verkleinern und nach K1-d ziehen:** Palette als CSS-Variablen und selbst ausgelieferte Schriften sind fertig. Übrig bleiben die Build-Prüfungen (T-CI1 bis T-CI3); sie gehören zum Rahmen.
4. **Weiterleitungen als eigener Schritt in K1-d:** Die Tabelle alt → neu für etwa 145 Käufer- und 52 Lieferanten-Routen entsteht einmal (B-13). K2-c, K3-a, K4-b und K6-f ergänzen nur noch ihre Ziele. So greift TN-07 von Anfang an.

Unverändert gilt: G-9 (Warengruppen ab K6) und G-4 (Claims, Risiko, Vertrag nicht bauen).
