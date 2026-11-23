# Abnahme Lieferantenmanagement (Schritt 20)

Stand 23.11.2026. Je Spec die Zahl der Kriterien unter „Fertig, wenn“ und die Tests, die sie prüfen.
Alle hier genannten Tests laufen in `pnpm check` (Typprüfung, Lint, Unit-, RLS-, Cross-Tenant- und
E2E-Tests) und waren beim Abschluss von Schritt 20 grün. Warengruppen (`WG-…`) gehören zu
Release 1.1 und sind nicht Teil dieser Abnahme.

Manche älteren Specs haken ihre Kriterien nicht ab, obwohl die Tests sie prüfen; maßgeblich sind
die Testdateien. Die Testdateien tragen die ID der Spec im Namen; Ausnahmen stehen in der Spalte
„Tests“ ausdrücklich.

| Spec | Titel | Kriterien | Tests |
|---|---|---|---|
| AW-01 | Auswertungen: Aussage, Beleg, Daten | 13 | `apps/api/src/modules/impact/aw-01.test.ts`<br>`apps/web/src/features/insights/aw-01.test.tsx` |
| FS-01 | Hinweise | 4 | `apps/api/src/modules/hints/fs-01.test.ts`<br>`apps/web/e2e/fs-01.spec.ts`<br>`apps/web/src/features/hints/fs-01.test.tsx` |
| IN-01 | Integrationsschicht und Einstellungen Anbindungen | 9 | `apps/api/src/modules/integrations/in-01.test.ts`<br>`apps/web/e2e/in-01.spec.ts`<br>`apps/web/src/features/integrations/in-01.test.tsx` |
| IN-02 | Anmeldung über Microsoft und Google | 7 | `apps/api/src/modules/sso/in-02.test.ts`<br>`apps/web/e2e/in-02.spec.ts`<br>`apps/web/src/features/integrations/in-02.test.tsx` |
| IN-03 | Termine aus Outlook und Google | 11 | `apps/api/src/modules/calendar/in-03.test.ts`<br>`apps/web/e2e/in-03.spec.ts`<br>`apps/web/src/features/calendar/in-03.test.tsx` |
| IN-04 | Mails ablegen | 7 | `apps/api/src/modules/mails/in-04.test.ts`<br>`apps/web/e2e/in-04.spec.ts`<br>`apps/web/src/features/activities/in-04.test.tsx` |
| IN-05 | Transkripte aus Teams und Meet | 10 | `apps/api/src/modules/transcripts/in-05.test.ts`<br>`apps/web/e2e/in-05.spec.ts`<br>`apps/web/src/features/meetings/in-05.test.tsx` |
| IN-06 | Benachrichtigungen in Teams und per Mail | 8 | `apps/api/src/modules/notifications/in-06.test.ts`<br>`apps/web/e2e/in-06.spec.ts`<br>`apps/web/src/features/profile/in-06.test.tsx` |
| IN-07 | Import-API | 9 | `apps/api/src/modules/imports/in-07.test.ts`<br>`apps/web/e2e/in-07.spec.ts`<br>`apps/web/src/features/integrations/in-07.test.tsx` |
| JBP-01 | Vorbereitung des Joint Business Planning | 5 | `apps/api/src/modules/jbp/jbp-01.test.ts`<br>`apps/web/src/features/jbp/jbp-01.test.tsx` |
| JBP-02 | Themen beider Seiten | 4 | `apps/api/src/modules/jbp/jbp-02.test.ts`<br>`apps/web/src/features/jbp/jbp-02.test.tsx` |
| JBP-03 | Initiativen und Roadmap | 6 | `apps/api/src/modules/jbp/jbp-03.test.ts`<br>`apps/web/src/features/jbp/jbp-03.test.tsx` |
| JBP-05 | Zusagen | 4 | `apps/api/src/modules/jbp/jbp-05.test.ts`<br>`apps/web/src/features/jbp/jbp-05.test.tsx` |
| JBP-06 | Freigabe und Versionen des Gemeinsamen Plans | 5 | `apps/api/src/modules/jbp/jbp-06.test.ts`<br>`apps/web/src/features/jbp/jbp-06.test.tsx` |
| JBP-07 | Scorecard und Unterschrift | 5 | `apps/api/src/modules/jbp/jbp-07.test.ts`<br>`apps/web/src/features/jbp/jbp-07.test.tsx` |
| JBP-09 | Ist-Werte der Kennzahlen | 5 | `apps/api/src/modules/jbp/jbp-09.test.ts`<br>`apps/web/src/features/jbp/jbp-09.test.tsx` |
| KI-01 | Modell-Gateway und Kontingent | 7 | `apps/api/src/modules/ai-gateway/ki-01.test.ts`<br>`apps/web/e2e/ki-01.spec.ts`<br>`apps/web/src/features/ai-gateway/ki-01.test.tsx` |
| KI-03 | Entwürfe und Quellen | 6 | `apps/api/src/modules/agents/ki-09.test.ts` |
| KI-04 | Agenten und Läufe | 11 | `apps/api/src/modules/agents/ki-04.test.ts`<br>`apps/web/e2e/ki-04.spec.ts` |
| KI-07 | Termin-Briefing | 14 | `apps/api/src/modules/agents/ki-07.test.ts`<br>`apps/web/e2e/ki-07.spec.ts`<br>`apps/web/src/features/meetings/ki-07.test.tsx` |
| KI-09 | Eigene Agenten | 8 | `apps/api/src/modules/agents/ki-09.test.ts`<br>`apps/web/e2e/ki-09.spec.ts`<br>`apps/web/src/features/agents/ki-09.test.tsx` |
| KI-11 | Wertpotenzial-Finder | 12 | `apps/api/src/modules/opportunities/ki-11-calculation.test.ts`<br>`apps/api/src/modules/opportunities/ki-11.test.ts`<br>`apps/web/src/features/opportunities/ki-11.test.tsx` |
| KI-15 | Import und Zuordnung | 11 | `apps/api/src/modules/imports/ki-15.test.ts`<br>`apps/web/e2e/ki-15.spec.ts`<br>`apps/web/src/features/imports/ki-15.test.tsx` |
| KI-16 | Hinweise mit Frühwarnung | 11 | `apps/api/src/modules/hints/ki-16.test.ts`<br>`apps/web/e2e/ki-16.spec.ts`<br>`apps/web/src/features/hints/ki-16.test.tsx` |
| KI-17 | Ergebnisse nach dem Termin | 10 | `apps/api/src/modules/meetings/ki-17.test.ts`<br>`apps/web/e2e/ki-17.spec.ts`<br>`apps/web/src/features/meetings/ki-17.test.tsx` |
| LIF-01 | Lieferanten einladen | 6 | `apps/api/src/modules/invitations/lif-01a.test.ts`<br>`apps/api/src/modules/invitations/lif-01b.test.ts`<br>`apps/web/e2e/lif-01a.spec.ts`<br>`apps/web/src/features/invitations/lif-01a.test.tsx`<br>`packages/db/src/lif-01.test.ts` |
| LIF-02 | Arbeitsbereich des Lieferanten | 5 | `apps/api/src/modules/customers/lif-02.test.ts`<br>`apps/web/e2e/lif-02.spec.ts`<br>`apps/web/src/features/customers/lif-02.test.tsx` |
| LIF-03 | Eigene Sicht des Lieferanten | 3 | `apps/api/src/modules/customers/lif-03.test.ts`<br>`apps/web/src/features/customers/lif-03.test.tsx` |
| LS-01 | Lieferantenliste mit Detailleiste | 11 | `apps/api/src/modules/suppliers/ls-01.test.ts`<br>`apps/web/src/features/suppliers/ls-01.test.tsx` |
| NAV-05 | Start | 6 | `apps/web/e2e/nav-05.spec.ts` |
| NAV-06 | Lieferanten-Arbeitsbereich | 8 | `apps/api/src/modules/overview/nav-06.test.ts`<br>`apps/web/e2e/nav-06.spec.ts`<br>`apps/web/src/features/workspace/nav-06.test.tsx` |
| NAV-10 | Navigation: Übersicht, Mein Tag, Lieferanten, Warengruppen | 15 | `apps/api/src/modules/activities/nav-10.test.ts`<br>`apps/web/src/features/activities/nav-10.test.tsx` |
| NAV-12 | Filter der Lieferantenliste | 5 | `apps/api/src/modules/suppliers/nav-12.test.ts`<br>`apps/web/e2e/nav-12.spec.ts`<br>`apps/web/src/features/suppliers/nav-12.test.tsx` |
| PLB-01 | Kataloge für Spielregeln und Formate | 4 | `apps/api/src/modules/playbook/plb-01.test.ts`<br>`apps/web/e2e/plb-01.spec.ts`<br>`apps/web/src/features/playbook/plb-01.test.tsx`<br>`packages/db/src/plb-01.test.ts` |
| PLB-03 | Spielregeln je Beziehung | 5 | `apps/api/src/modules/playbook/plb-03.test.ts`<br>`apps/web/e2e/plb-03.spec.ts`<br>`apps/web/src/features/playbook/plb-03.test.tsx` |
| PLB-04 | Team beider Seiten | 6 | `apps/api/src/modules/suppliers/plb-04.test.ts`<br>`apps/web/src/features/suppliers/plb-04.test.tsx` |
| PLB-06 | Kontaktpunkte | 5 | `apps/api/src/modules/touchpoints/plb-06.test.ts`<br>`apps/web/src/features/touchpoints/plb-06.test.tsx` |
| PLT-01 | Anmeldung und Abmeldung | 8 | `apps/api/src/modules/auth/plt-01.test.ts`<br>`apps/web/e2e/plt-01.spec.ts`<br>`apps/web/src/features/auth/plt-01.test.tsx` |
| PLT-02 | Organisationen, Nutzer und Mandanten-Session | 8 | `apps/api/src/modules/organizations/plt-02.test.ts`<br>`apps/web/e2e/plt-02.spec.ts`<br>`apps/web/src/features/suppliers/plt-02.test.tsx`<br>`packages/db/src/plt-02.test.ts` |
| PLT-03 | Beziehungen und Lieferantenliste | 10 | `apps/api/src/modules/suppliers/plt-03b.test.ts`<br>`apps/web/e2e/plt-03a.spec.ts`<br>`apps/web/e2e/plt-03b.spec.ts`<br>`apps/web/src/features/suppliers/plt-03b.test.tsx`<br>`packages/db/src/plt-03a.test.ts`<br>`packages/db/src/plt-03b.test.ts` |
| PLT-04 | Drei Datenebenen | 8 | `packages/db/src/layers.test.ts`<br>`packages/db/src/plt-08.test.ts` |
| PLT-05 | Rollen und Rechte | 8 | `apps/api/src/modules/suppliers/plt-05b.test.ts`<br>`apps/web/e2e/plt-05a.spec.ts`<br>`apps/web/e2e/plt-05b.spec.ts`<br>`apps/web/src/features/settings/plt-05a.test.tsx`<br>`apps/web/src/features/suppliers/plt-05b.test.tsx`<br>`packages/db/src/plt-05a.test.ts`<br>`packages/db/src/plt-05b.test.ts` |
| PLT-06 | Business Units und Warengruppen | 7 | `apps/api/src/modules/master-data/plt-06.test.ts`<br>`apps/web/e2e/plt-06.spec.ts`<br>`apps/web/src/features/master-data/plt-06.test.tsx`<br>`packages/db/src/plt-06.test.ts` |
| PLT-07 | Import per Excel und CSV | 11 | `apps/api/src/modules/suppliers/plt-07a.test.ts`<br>`apps/web/e2e/plt-07a.spec.ts`<br>`apps/web/src/features/suppliers/plt-07a.test.tsx`<br>`packages/db/src/plt-07b.test.ts` |
| PLT-08 | Audit-Trail | 7 | `apps/web/e2e/plt-08.spec.ts`<br>`apps/web/src/features/audit/plt-08.test.tsx`<br>`packages/db/src/plt-08.test.ts` |
| PLT-09 | Deutsch und Englisch | 6 | `apps/api/src/modules/me/plt-09.test.ts`<br>`apps/web/e2e/plt-09.spec.ts`<br>`apps/web/src/features/profile/plt-09.test.tsx`<br>`packages/db/src/plt-09.test.ts` |
| PLT-10 | Design und Styleguide | 12 | `apps/web/e2e/plt-10.spec.ts`<br>`apps/web/src/components/ui/plt-10.test.tsx` |
| PLT-11 | App-Rahmen, globale Leiste und Seitenmuster | 9 | `apps/web/e2e/plt-11.spec.ts`<br>`apps/web/src/features/shell/plt-11.test.tsx`<br>`apps/web/src/locales/plt-11.node.test.ts` |
| PLT-12 | Fragen-Seite | 13 | `apps/web/e2e/plt-12.spec.ts`<br>`apps/web/src/features/prompt/plt-12.test.tsx` |
| PLT-13 | Betreiber-Zugang zu Kunden | 8 | `apps/web/e2e/plt-13.spec.ts`<br>`apps/web/src/features/support/plt-13.test.tsx` |
| PNL-01 | Wirkung einrichten und Hebel-Vorlagen | 5 | `apps/api/src/modules/impact/pnl-01.test.ts`<br>`apps/web/src/features/impact/pnl-01.test.tsx` |
| PNL-03 | Baseline und Reifegrade | 4 | `apps/api/src/modules/impact/pnl-03.test.ts` |
| PNL-05 | Monatswerte Plan und Ist | 5 | `apps/api/src/modules/impact/pnl-05-06.test.ts`<br>`apps/web/src/features/impact/pnl-05-06.test.tsx` |
| PNL-06 | Freigabe durch Controlling | 5 | `apps/api/src/modules/impact/pnl-05-06.test.ts`<br>`apps/web/src/features/impact/pnl-05-06.test.tsx` |
| PNL-07 | Teilungsregel, Wirkungsarten und Doppelzählung | 5 | `apps/api/src/modules/impact/pnl-07.test.ts`<br>`apps/web/src/features/impact/pnl-07.test.tsx` |
| PNL-10 | P&L-Brücke und Wirkung im Portfolio | 5 | `apps/api/src/modules/impact/pnl-10.test.ts`<br>`apps/web/src/features/impact/pnl-10.test.tsx` |
| PNL-11 | Excel-Export für das Controlling | 5 | `apps/api/src/modules/impact/pnl-11.test.ts`<br>`apps/web/src/features/impact/pnl-11.test.tsx` |
| PUL-01 | Fragebogen | 4 | `apps/api/src/modules/feedback/pul-01.test.ts`<br>`apps/web/src/features/feedback/pul-01.test.tsx` |
| PUL-02 | Feedback-Welle starten und beantworten | 6 | `apps/api/src/modules/feedback/pul-02a.test.ts`<br>`apps/api/src/modules/feedback/pul-02b.test.ts`<br>`apps/web/src/features/feedback/pul-02a.test.tsx`<br>`apps/web/src/features/feedback/pul-02b.test.tsx` |
| PUL-03 | Auswertung und Wahrnehmungslücken | 6 | `apps/api/src/modules/feedback/pul-03.test.ts`<br>`apps/web/src/features/feedback/pul-03.test.tsx` |
| PUL-06 | Maßnahmen aus Lücken und Verlauf | 3 | `apps/api/src/modules/feedback/pul-06.test.ts`<br>`apps/web/src/features/feedback/pul-06.test.tsx` |
| PUL-08 | KI fasst Freitexte zu Themen zusammen | 3 | `apps/api/src/modules/feedback/pul-08.test.ts`<br>`apps/web/e2e/pul-08.spec.ts`<br>`apps/web/src/features/feedback/pul-08.test.tsx` |
| QBR-01 | Termine | 5 | `apps/api/src/modules/meetings/qbr-01a.test.ts`<br>`apps/api/src/modules/meetings/qbr-01b.test.ts`<br>`apps/web/e2e/qbr-01a.spec.ts`<br>`apps/web/src/features/meetings/qbr-01a.test.tsx`<br>`apps/web/src/features/meetings/qbr-01b.test.tsx` |
| QBR-03 | Maßnahmen | 6 | `apps/api/src/modules/actions/qbr-03.test.ts`<br>`apps/web/src/features/actions/qbr-03.test.tsx` |
| QBR-04 | Erinnerung und Eskalation | 5 | `apps/api/src/modules/actions/qbr-04.test.ts`<br>`apps/web/src/features/settings/qbr-04.test.tsx` |
| QBR-06 | Pre-Read als PDF | 4 | `apps/api/src/modules/meetings/qbr-06.test.ts`<br>`apps/web/src/features/meetings/qbr-06.test.ts` |
| QBR-07 | KI-Entwurf für den Pre-Read | 3 | `apps/api/src/modules/meetings/qbr-07.test.ts`<br>`apps/web/e2e/qbr-07.spec.ts`<br>`apps/web/src/features/meetings/qbr-07.test.tsx` |
| QS-01 | E-Mail-Versand | 6 | `apps/api/src/modules/email/email.mailpit.test.ts`<br>`apps/api/src/modules/email/email.test.ts` |
| QS-02 | Kommentare | 5 | `apps/api/src/modules/comments/qs-02.test.ts`<br>`apps/web/src/features/comments/qs-02.test.tsx` |
| QS-03 | Exporte | 4 | `apps/api/src/modules/data-export/qs-03-export.test.ts`<br>`apps/api/src/modules/pdf-exports/qs-03-pdf.test.ts`<br>`apps/web/src/features/settings/qs-03.test.tsx` |
| QS-05 | Suche | 3 | `apps/api/src/modules/search/qs-05.test.ts`<br>`apps/web/e2e/qs-05.spec.ts`<br>`apps/web/src/features/prompt/qs-05.test.tsx` |
| SEG-01 | Segmentmodell | 6 | `apps/web/e2e/seg-01.spec.ts` |
| SEG-02 | Fokuslieferanten | 5 | `apps/web/e2e/seg-02.spec.ts` |
| SEG-03 | Bewertungsrunde starten | 8 | `apps/web/e2e/seg-03.spec.ts` |
| SEG-04 | Bewertung abgeben | 8 | `apps/web/e2e/seg-04.spec.ts` |
| SEG-05 | Segmentierung je Lieferant mit Abweichungen | 6 | `apps/web/e2e/seg-05.spec.ts` |
| SEG-06 | Konsolidierung | 6 | `apps/web/e2e/seg-06.spec.ts` |
| SEG-07 | Portfolio | 6 | `apps/web/e2e/seg-07.spec.ts` |
| SEG-10 | Beziehungstyp und Spielregeln an den Lieferanten freigeben | 4 | `apps/api/src/modules/playbook/seg-10.test.ts`<br>`apps/web/e2e/seg-10.spec.ts`<br>`apps/web/src/features/playbook/seg-10.test.tsx` |
| SEG-11 | KI erklärt Abweichungen | 4 | `apps/api/src/modules/ratings/seg-11.test.ts`<br>`apps/web/e2e/seg-11.spec.ts`<br>`apps/web/src/features/segmentation/seg-11.test.tsx` |
| SPL-01 | Lieferantenplan und Zielkategorien | 6 | `apps/web/e2e/spl-01.spec.ts` |
| SPL-03 | Beiträge der Funktionen | 5 | `apps/web/e2e/spl-03.spec.ts` |
| SPL-04 | Spend-Entwicklung | 5 | `apps/api/src/modules/suppliers/spl-04.test.ts`<br>`apps/web/src/features/suppliers/spl-04.test.tsx` |
| SPL-05 | Profil und Finanzen | 5 | `apps/api/src/modules/suppliers/spl-05.test.ts`<br>`apps/web/src/features/suppliers/spl-05.test.tsx` |
| SPL-06 | Strategische Themen | 4 | `apps/web/e2e/spl-06.spec.ts` |
| SPL-07 | Freigabe und Versionen des Lieferantenplans | 6 | `apps/api/src/modules/supplier-plans/spl-07.test.ts`<br>`apps/web/src/features/supplier-plan/spl-07.test.tsx` |
| SPL-10 | KI-Entwurf der Strategie-Zusammenfassung | 3 | `apps/api/src/modules/supplier-plans/spl-10.test.ts`<br>`apps/web/e2e/spl-10.spec.ts`<br>`apps/web/src/features/supplier-plan/spl-10.test.tsx` |
| UMB-01 | Betreiber-Zugang nach dem neuen Muster | 6 | `packages/db/src/umb-01.test.ts` |
| UMB-02 | Neu anmelden ohne Fenster und Overlay | 4 | `apps/web/e2e/umb-02.spec.ts`<br>`apps/web/src/lib/umb-02.test.ts` |
| UMB-03 | Bestandsdaten in die neuen Tabellen überführen | 4 | `packages/db/src/umb-03.test.ts` |
| UMB-04 | Specs und Dokumente zusammenführen | 2 | nur Dokumente |
| UMB-05 | Einfachere Oberfläche | 7 | `apps/web/e2e/umb-05.spec.ts` |
| WEB-01 | Website | 7 | `apps/website/e2e/web-01.spec.ts`<br>`apps/website/src/web-01.test.tsx` |
| ZYK-01 | Zyklus und Zyklus-Leiste | 5 | `apps/web/e2e/zyk-01.spec.ts` |
| ZYK-02 | Planung rückwärts vom Joint Business Planning | 5 | `apps/api/src/modules/overview/zyk-02.test.ts`<br>`apps/web/e2e/zyk-02.spec.ts` |
| ZYK-04 | Stand der Zyklen | 4 | `apps/api/src/modules/overview/zyk-04.test.ts`<br>`apps/web/src/features/portfolio/zyk-04.test.tsx` |
| ZYK-05 | Neuer Zyklus | 4 | `apps/api/src/modules/overview/zyk-05.test.ts`<br>`apps/web/src/features/workspace/zyk-05.test.tsx` |

## Später in der Warteschlange

Diese Specs gehören fachlich zum Lieferantenmanagement, setzen aber Warengruppen oder neue
Infrastruktur voraus. Ihr Umfang ist geklärt; sie bleiben in der Reihenfolge des Umsetzungsplans.

| Spec | Titel | Schritt |
|---|---|---|
| KI-08 | Agent Marktanalyse | Schritt 25 (setzt Warengruppen voraus) |
| KI-13 | Strategie-Autor | Schritt 33 (Strategie-Autor, Warengruppen) |
| KI-18 | Dokumente und Fundstellen | Schritt 34 |
| KI-19 | Vertragsleck | Schritt 35 |
| KI-20 | Szenarien | Schritt 36 |
| KI-21 | Verhandlungsvorbereitung | Schritt 37 |
| KI-22 | Quartalsbericht SRM | Schritt 38 |
| KI-23 | Hilfe für Lieferanten | Schritt 39 |
