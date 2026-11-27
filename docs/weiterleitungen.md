# Weiterleitungen alt → neu

Erzeugt aus `packages/shared/src/route-moves.ts` und dem Routenbaum der App (`pnpm weiterleitungen`); ein Test schlägt fehl, wenn die Datei veraltet ist. Grundlage: NAV-10 2.0, TN-07 und UX-20 TU-07.

- **aktiv** (14): leitet mit 301 vom Server und in der App weiter.
- **geplant** (180): Das genannte Paket baut das Ziel und schaltet die Regel ein; bis dahin bleibt die Seite.
- **bleibt** (81): Die Adresse gilt auch nach NAV-10 2.0.

| Adresse | Neue Adresse | Paket | Stand |
|---|---|---|---|
| `/` | – (Startseite der Person) | NAV-10 | bleibt |
| `/$` | – (Seite nicht gefunden) | PLT-11 | bleibt |
| `/addin/outlook` | – (ohne Rahmen) | IN-04 | bleibt |
| `/agenten` | `/mein-agent` | K1-d | aktiv |
| `/auth/callback` | – (ohne Rahmen) | PLT-01 | bleibt |
| `/bausteine` | – | UX-20 | bleibt |
| `/betreiber/kunden` | – | PLT-13 | bleibt |
| `/bewertungen` | offen (Bewertung in Kurz prüfen) | K2-e | geplant |
| `/bewertungen/$id` | offen (Bewertung in Kurz prüfen) | K2-e | geplant |
| `/bewertungen/$id/qualitaet` | offen (Bewertung in Kurz prüfen) | K2-e | geplant |
| `/bewertungen/$id/zusammenfassung` | offen (Bewertung in Kurz prüfen) | K2-e | geplant |
| `/beziehungen` | – (Seite Lieferanten mit Liste (K2-b.4) und Segmenten) | K1-d | bleibt |
| `/demo` | – (Demo-Regie) | K1-g.4 | bleibt |
| `/demo/als/$person` | – (Demo-Sitzung) | K1-b.2 | bleibt |
| `/design` | `/bausteine` | K1-d.3 | geplant |
| `/einladung/$token` | – (ohne Rahmen) | LP-01 | bleibt |
| `/einladung/$token/name` | – (ohne Rahmen) | LP-01 | bleibt |
| `/einladung/$token/passkey` | – (ohne Rahmen) | LP-01 | bleibt |
| `/einstellungen` | – | NAV-10 | bleibt |
| `/einstellungen/anbindungen` | – | NAV-10 | bleibt |
| `/einstellungen/business-units` | – | NAV-10 | bleibt |
| `/einstellungen/business-units/$id/bearbeiten` | – | NAV-10 | bleibt |
| `/einstellungen/business-units/neu` | – | NAV-10 | bleibt |
| `/einstellungen/daten/import` | – | NAV-10 | bleibt |
| `/einstellungen/daten/import/$batchId` | – | NAV-10 | bleibt |
| `/einstellungen/erinnerungen` | – | NAV-10 | bleibt |
| `/einstellungen/export` | – | NAV-10 | bleibt |
| `/einstellungen/fragebogen` | – | NAV-10 | bleibt |
| `/einstellungen/fragebogen/$kind` | – | NAV-10 | bleibt |
| `/einstellungen/fragebogen/$kind/$questionKey` | – | NAV-10 | bleibt |
| `/einstellungen/fragebogen/$kind/neu` | – | NAV-10 | bleibt |
| `/einstellungen/fragebogen/$kind/vorschau` | – | NAV-10 | bleibt |
| `/einstellungen/geschaeftsjahr` | – | NAV-10 | bleibt |
| `/einstellungen/guv-zeilen` | – | NAV-10 | bleibt |
| `/einstellungen/guv-zeilen/$key/bearbeiten` | – | NAV-10 | bleibt |
| `/einstellungen/guv-zeilen/neu` | – | NAV-10 | bleibt |
| `/einstellungen/hinweise` | – | NAV-10 | bleibt |
| `/einstellungen/ki` | – | NAV-10 | bleibt |
| `/einstellungen/ki/agenten` | `/mein-agent` | K1-d | aktiv |
| `/einstellungen/ki/agenten/*` | `/mein-agent` | K1-f.5 | aktiv |
| `/einstellungen/ki/agenten/laeufe/$id` | `/warum/$id` (Warum zum Lauf) | K1-f.5 | aktiv |
| `/einstellungen/organisation` | – | NAV-10 | bleibt |
| `/einstellungen/organisation/$nutzer` | – | NAV-10 | bleibt |
| `/einstellungen/rollen` | – | NAV-10 | bleibt |
| `/einstellungen/segmentmodell` | – | NAV-10 | bleibt |
| `/einstellungen/segmentmodell/gewichte` | – | NAV-10 | bleibt |
| `/einstellungen/segmentmodell/grenzen` | – | NAV-10 | bleibt |
| `/einstellungen/segmentmodell/kriterium/$key` | – | NAV-10 | bleibt |
| `/einstellungen/segmentmodell/raster` | – | NAV-10 | bleibt |
| `/einstellungen/segmentmodell/typ/$pair` | – | NAV-10 | bleibt |
| `/einstellungen/spielregeln` | – | NAV-10 | bleibt |
| `/einstellungen/spielregeln/formate` | – | NAV-10 | bleibt |
| `/einstellungen/spielregeln/formate/$id` | – | NAV-10 | bleibt |
| `/einstellungen/spielregeln/formate/neu` | – | NAV-10 | bleibt |
| `/einstellungen/spielregeln/rechte` | – | NAV-10 | bleibt |
| `/einstellungen/spielregeln/rechte/$id` | – | NAV-10 | bleibt |
| `/einstellungen/spielregeln/rechte/neu` | – | NAV-10 | bleibt |
| `/einstellungen/spielregeln/typ/$typ` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/$id/bearbeiten` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/$id/teilen` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/$id/zusammenlegen` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/bezeichnung` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/freigabeweg` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/hebel` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/import` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/kennzahlen` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/leitfragen` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/neu` | – | NAV-10 | bleibt |
| `/einstellungen/warengruppen/vergabe` | – | NAV-10 | bleibt |
| `/einstellungen/zielkategorien` | – | NAV-10 | bleibt |
| `/einstellungen/zielkategorien/$key/bearbeiten` | – | NAV-10 | bleibt |
| `/einstellungen/zielkategorien/neu` | – | NAV-10 | bleibt |
| `/einstellungen/zyklus` | – | NAV-10 | bleibt |
| `/erledigt` | – (Erledigt im Hintergrund) | K1-e.3 | bleibt |
| `/feedback` | offen (Feedback als Objekt) | K2-f | geplant |
| `/feedback/$id` | offen (Feedback als Objekt) | K2-f | geplant |
| `/fragen` | `/heute?frag=1` (öffnet Frag Reziproq) | K1-d | aktiv |
| `/heute` | – (Fokus und Alles) | K1-e | bleibt |
| `/hinweise` | `/heute?ansicht=alles` (Gruppe Hinweise) | K1-e.4 | aktiv |
| `/hinweise/$id` | `/warum/$id` (Warum zum Hinweis) | K1-e.4 | aktiv |
| `/kunden` | – | LIF-02 | bleibt |
| `/kunden/$id` | – | LIF-02 | bleibt |
| `/kunden/$id/beziehung` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/beziehung/feedback` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/beziehung/feedback/$waveId` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/beziehung/feedback/$waveId/einladen` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/beziehung/kontaktpunkte` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/beziehung/spielregeln` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/beziehung/team` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/beziehung/team/bearbeiten` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/eigene-sicht` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/eigene-sicht/sicht` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/eigene-sicht/ziele/$objectiveId` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/eigene-sicht/ziele/neu` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/eigene-sicht/zusammenfassung` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/freigabe` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/initiativen` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/initiativen/$initiativeId` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/initiativen/$initiativeId/bearbeiten` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/initiativen/neu` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/scorecard` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/scorecard/$kpiId` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/scorecard/$kpiId/bearbeiten` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/scorecard/$kpiId/wert` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/scorecard/import` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/scorecard/neu` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/scorecard/unterschreiben` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/themen` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/themen/$topicId` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/themen/neu` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/themen/zusammenfuehren` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/versionen` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/vorbereitung` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/vorbereitung/geschaeftsupdate` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/zusagen` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/zusagen/$commitmentId` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/plan/zusagen/neu` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/massnahmen` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/massnahmen/$actionId` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/massnahmen/neu` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/termine` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/termine/$meetingId` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/termine/$meetingId/agenda` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/termine/$meetingId/bearbeiten` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/termine/$meetingId/notiz` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/termine/$meetingId/protokoll` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/umsetzung/termine/neu` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/wirkung` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kunden/$id/wirkung/initiativen/$initiativeId/nutzen` | offen (gespiegelte Akte) | K5-b | geplant |
| `/kurz-pruefen` | – (Kurz prüfen) | K1-e.2 | bleibt |
| `/lieferanten` | `/beziehungen` | K1-d | aktiv |
| `/lieferanten/$id` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/aktivitaeten` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/feedback` | `/beziehungen/$id/feedback` | K2-f | geplant |
| `/lieferanten/$id/beziehung/feedback/$waveId` | `/beziehungen/$id/feedback` | K2-f | geplant |
| `/lieferanten/$id/beziehung/feedback/$waveId/einladen` | `/beziehungen/$id/feedback` | K2-f | geplant |
| `/lieferanten/$id/beziehung/feedback/$waveId/frist` | `/beziehungen/$id/feedback` | K2-f | geplant |
| `/lieferanten/$id/beziehung/feedback/neu` | `/beziehungen/$id/feedback` | K2-f | geplant |
| `/lieferanten/$id/beziehung/kontaktpunkte` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/kontaktpunkte/$touchpointId` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/kontaktpunkte/neu` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/spielregeln` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/spielregeln/bearbeiten` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/spielregeln/teilen` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/spielregeln/vorschlag` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/team` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/team/bearbeiten` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/team/einladen` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/beziehung/team/sro` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/plan` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/freigabe` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/initiativen` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/initiativen/$initiativeId` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/initiativen/$initiativeId/bearbeiten` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/initiativen/neu` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/scorecard` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/scorecard/$kpiId` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/scorecard/$kpiId/bearbeiten` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/scorecard/$kpiId/wert` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/scorecard/import` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/scorecard/neu` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/scorecard/unterschreiben` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/themen` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/themen/$topicId` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/themen/neu` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/themen/uebernehmen` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/themen/zusammenfuehren` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/versionen` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/vorbereitung` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/vorbereitung/geschaeftsupdate` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/zusagen` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/zusagen/$commitmentId` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/plan/zusagen/neu` | `/beziehungen/$id/plan` (Gemeinsamer Plan) | K4-e | geplant |
| `/lieferanten/$id/strategie` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/beitraege/neu` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/beitrag/$contributionId` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/freigabe` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/themen/$topicId/bearbeiten` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/themen/neu` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/versionen` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/ziele/$objectiveId/bearbeiten` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/ziele/neu` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/lieferantenplan/zusammenfassung/bearbeiten` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil/bearbeiten` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil/einschaetzung` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil/geschaeftsleitung` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil/kennzahlen/$kennzahl` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil/kennzahlen/import` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil/kennzahlen/neu` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil/unternehmen` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/profil/zuordnung` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/segmentierung` | offen (Segment-Mappe) | K2-e | geplant |
| `/lieferanten/$id/strategie/segmentierung/konsolidieren` | offen (Segment-Mappe) | K2-e | geplant |
| `/lieferanten/$id/strategie/segmentierung/kriterium/$key` | offen (Segment-Mappe) | K2-e | geplant |
| `/lieferanten/$id/strategie/spend` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/spend/$eintrag` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/spend/neu` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/strategie/warengruppen` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/umsetzung` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/umsetzung/massnahmen` | `/beziehungen/$id` (Zusagen und Aufgaben; bis dahin die alte Seite) | K2-c | geplant |
| `/lieferanten/$id/umsetzung/massnahmen/$actionId` | `/beziehungen/$id` (Zusagen und Aufgaben; bis dahin die alte Seite) | K2-c | geplant |
| `/lieferanten/$id/umsetzung/massnahmen/neu` | `/beziehungen/$id` (Zusagen und Aufgaben; bis dahin die alte Seite) | K2-c | geplant |
| `/lieferanten/$id/umsetzung/termine` | offen (Termin /termine/<id>) | K3-a | geplant |
| `/lieferanten/$id/umsetzung/termine/$meetingId` | offen (Termin /termine/<id>) | K3-a | geplant |
| `/lieferanten/$id/umsetzung/termine/$meetingId/agenda` | offen (Termin /termine/<id>) | K3-a | geplant |
| `/lieferanten/$id/umsetzung/termine/$meetingId/bearbeiten` | offen (Termin /termine/<id>) | K3-a | geplant |
| `/lieferanten/$id/umsetzung/termine/$meetingId/notiz` | offen (Termin /termine/<id>) | K3-a | geplant |
| `/lieferanten/$id/umsetzung/termine/$meetingId/protokoll` | offen (Termin /termine/<id>) | K3-a | geplant |
| `/lieferanten/$id/umsetzung/termine/neu` | offen (Termin /termine/<id>) | K3-a | geplant |
| `/lieferanten/$id/wirkung` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/bruecke` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId/baseline` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId/einrichten` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId/freigabe` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId/import` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId/monat` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId/reifegrad` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId/savings` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/initiativen/$initiativeId/teilung` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/wirkung/wertpotenziale` | `/beziehungen/$id/wert` (Wertkonto) | K4-b | geplant |
| `/lieferanten/$id/zyklus/archiv` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/zyklus/neu` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/zyklus/start` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/$id/zyklus/termin` | `/beziehungen/$id` (Sichten und Blätter der Akte) | K2-c | geplant |
| `/lieferanten/importieren` | offen | K2-b | geplant |
| `/lieferanten/neu` | offen | K2-b | geplant |
| `/mappe/$art/$id` | – (Fokus-Mappe) | K1-e.4 | bleibt |
| `/mein-agent` | – (Mein Agent) | K1-f.3 | bleibt |
| `/mein-tag` | `/heute` | K1-d | aktiv |
| `/mein-tag/eingang` | `/heute?ansicht=alles` (Gruppe Zuordnen) | K1-e.3 | aktiv |
| `/menu` | – | PLT-11 | bleibt |
| `/portfolio` | `/beziehungen?linse=segmente` (Linse Segmente) | K2-b | aktiv |
| `/portfolio/fokus` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/fokus/$id` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/matrix` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/offen` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/runden` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/runden/$id` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/runden/$id/bewertende` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/runden/$id/lieferanten` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/runden/$id/nachnominieren` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/runden/$id/name` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/runden/$id/pruefen` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/runden/neu` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/portfolio/zyklen` | offen (Bewertungsrunden und Segmente) | K2-e | geplant |
| `/profil` | – | PLT-09 | bleibt |
| `/profil/benachrichtigungen` | – | PLT-09 | bleibt |
| `/profil/sprache` | – | PLT-09 | bleibt |
| `/start` | `/heute` | K1-d | aktiv |
| `/start/faellig` | `/heute?ansicht=alles` (beim Käufer schon Alles) | K5-b | geplant |
| `/start/massnahmen` | `/heute?ansicht=alles` (Zusagen und Aufgaben) | K5-b | geplant |
| `/styleguide` | `/bausteine` | K1-d.3 | geplant |
| `/uebersicht` | `/wert` | K1-d | aktiv |
| `/uebersicht/ergebnisse` | `/wert` | K4-b | geplant |
| `/uebersicht/wertpotenziale` | offen (Wertfinder) | K4-d | geplant |
| `/umfrage/$token` | – (ohne Rahmen) | PUL-01 | bleibt |
| `/warengruppen` | – | WG-01 | bleibt |
| `/warengruppen/$id` | – | WG-01 | bleibt |
| `/warengruppen/$id/review/$reviewId` | offen | K6-a | geplant |
| `/warengruppen/$id/segmentierung` | offen | K6-f | geplant |
| `/warengruppen/$id/strategie` | `/warengruppen/$id/strategie` | K6-a | geplant |
| `/warengruppen/$id/strategie/$step` | `/warengruppen/$id/strategie` | K6-a | geplant |
| `/warum/$id` | – (Warum) | K1-e.4 | bleibt |
| `/wert` | – (zeigt bis K4-b die Übersicht) | K1-d | bleibt |
| `/wirkung` | `/wert` | K1-d | aktiv |
| `/wirkung/freigaben` | offen (Mappe Wirkung freigeben) | K4-c | geplant |
| `/wirkung/freigaben/$validationId` | offen (Mappe Wirkung freigeben) | K4-c | geplant |
