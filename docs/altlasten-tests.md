# Tests mit Altlast

Stand 24.11.2026, geprüft auf `spec/PNL-11` nach K1-a.1. Grundlage: der letzte vollständige `pnpm check` und der Code. Es gibt 276 Testdateien für Unit- und API-Tests (3.786 Tests, 127 s) sowie 66 E2E-Dateien der App (202 Tests, 6,1 min mit 4 Workern) und die Website-Tests (47 Tests, 5 s).

**Aufgeräumt am 24.11.2026:**
- **Unit- und API-Tests: 140 s → 51 s.**
  - Web- und API-Tests teilen sich je Worker die geladenen Module. Ein gemeinsamer Anmeldezustand (`apps/web/src/testing/shared-auth.ts`) macht das möglich.
  - Sechs Dateien mit eigenen Modul-Ersetzungen laufen isoliert in `web-isolated` und `api-isolated`.
  - Datenbanktests kopieren Vorlagen, die einmal je Lauf entstehen (`packages/db/src/testing/global-setup.ts`). Nur die Tests der Migrationen spielen sie selbst ein.
- **E2E der App: 6,0 min → 2,8 min**, gemessen inklusive Bau der App.
  - Der Rundgang „Kommt mit Release“ (4,1 min) ist eine Prüfung der Sprachdateien (`src/locales/umb-05.test.ts`).
  - Der englische Rundgang läuft in acht Teilen parallel.
  - Die Navigation wird von drei statt zehn Seiten geprüft; Playwright nutzt 75 % der Kerne.
  - Ein eigener Wartehelfer statt `networkidle` war schneller, blieb aber unter voller Last hängen; der Rundgang wartet deshalb weiter mit `networkidle`.
- **`pnpm check` gesamt: rund 9 min → 4 min 16 s** (3814 Unit- und API-Tests, 3 Zeitmessungen, 208 + 47 E2E-Tests).
- **Unbenutzte Bausteine entfernt:** `Label`, `FlowBar`, `LayerPanel`, `GlobalBar` samt ihren Beispielen und Tests. `Range` bleibt: Die Website nutzt ihn.
- **Offen:** Die drei Testseiten für Bausteine (`/design`, `/styleguide`, `/bausteine`) werden zu `/bausteine` zusammengelegt. Dann ziehen die Prüfungen aus PLT-10 dorthin um. Das steht nicht im Paket K1-d. Es kommt als eigener kleiner Schritt K1-d.3, sobald der Gründer ihn freigibt.

**Regel:** Ein Test fällt nur zusammen mit dem Code, den er schützt. Solange eine Seite oder ein Dienst läuft, bleibt sein Test. Fällt eine Seite weg, tritt an die Stelle ihres E2E-Tests der Inventar-Test (`docs/inventar.md`) und der Test der Weiterleitung. Prüfungen für Rechte, Datenräume und Mandanten (RLS, Cross-Tenant, Leitplanken) werden nie abgeschwächt.

## 1. Sofort entfernbar: toter Code samt Test

| Was                   | Fundstelle                             | Warum                                                                           | Test, der mitgeht                                      |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Baustein `Label`      | `apps/web/src/components/ui/label.tsx` | nirgends benutzt                                                                | –                                                      |
| Baustein `Range`      | `apps/web/src/components/ui/range.tsx` | nirgends benutzt                                                                | –                                                      |
| Baustein `FlowBar`    | `components/ui/flow-bar.tsx`           | nur noch auf `/bausteine`; entfällt laut UX-20 2.1                              | Abschnitt auf `/bausteine`, Teile von `ux-20.test.tsx` |
| Baustein `LayerPanel` | `components/ui/layer-panel.tsx`        | nur noch auf `/design`                                                          | Abschnitt auf `/design`                                |
| Baustein `GlobalBar`  | `components/ui/global-bar.tsx`         | nur noch auf `/design` und `/styleguide`; die App nutzt seit Phase 2 `AppShell` | Teile von `components/ui/plt-10.test.tsx`              |

## 2. Zusammenlegen: dieselbe Prüfung mehrfach, teuer

| Was                                      | Fundstelle                                                                                                                                                                     | Befund                                                                                                                            | Empfehlung                                                                                                                                                                                                                    | Ersparnis                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Rundgang über alle Routen, dreimal       | `e2e/umb-05.spec.ts` („Keine Route zeigt ‚Kommt mit Release‘“), `e2e/plt-09.spec.ts` („jede Route auf Englisch“), `e2e/plt-11.spec.ts` („Jede Route lässt sich direkt öffnen“) | Der Rundgang in UMB-05 allein dauert 4,1 min und wartet auf jeder Route auf `networkidle`; er bestimmt die Laufzeit der E2E-Tests | ein Rundgang je Sprache, der je Route alles prüft: Titel, kein roher Schlüssel, kein „Kommt mit …“, kein waagerechter Bildlauf bei 390 px. Das ist zugleich die Grundlage für den 390-px- und den Sackgassen-Test aus Paket Z | etwa 4 min der E2E-Laufzeit   |
| Navigation von jeder Seite zu jedem Ziel | `e2e/plt-11.spec.ts` („Jedes Ziel der globalen Leiste …“), 39 s                                                                                                                | 10 Seiten × 6 Ziele mit neuem Seitenaufruf; die Leiste ist auf jeder Seite derselbe Baustein                                      | drei Seiten (Start, Lieferant, Einstellungen) reichen; `ux-20-phase-2.spec.ts` prüft Seitenleiste und Tab-Leiste schon                                                                                                        | etwa 30 s                     |
| Drei Testseiten für Bausteine            | `/design` (PLT-10), `/styleguide` (PLT-10), `/bausteine` (UX-20); `e2e/design.spec.ts` (6 Tests), `e2e/plt-10.spec.ts` (10 Tests), `components/ui/plt-10.test.tsx`             | dieselben Bausteine auf drei Seiten mit je eigenen Tests                                                                          | `/bausteine` als einzige Seite; die Prüfungen aus PLT-10 (Tastatur, Fokus, 44 px, 390 px, Diagramm-Tokens, „Bewegung reduzieren“) ziehen dorthin. Der Skill `ui-design` nennt dann `/bausteine` statt `/design`               | etwa 25 s E2E, weniger Pflege |

## 3. Entfällt mit dem Paket, das den Code ersetzt

Hier ist nichts sofort zu löschen: Der Code läuft noch. Mit dem genannten Paket gehen Seite und Test, und der Inventar-Test kommt dazu.

| Paket                    | Seiten und Code, die entfallen                                                       | Tests, die dann entfallen oder umziehen                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1-d (Rahmen)            | Seite `/fragen` wird Überlagerung; Seitenleiste mit neuen Hauptpunkten               | `e2e/plt-12.spec.ts` (Seite), Teile von `e2e/ux-20-phase-2.spec.ts` und `e2e/plt-11.spec.ts` (alte Hauptpunkte)                                                                                          |
| K1-e (Heute)             | Mein Tag, Start, Alle Aufgaben, Hinweise, Neu eingegangen                            | `e2e/nav-05.spec.ts`, `e2e/fs-01.spec.ts`, Teile von `e2e/ki-16.spec.ts` und `e2e/in-03.spec.ts`, `features/start/*.test.tsx` (Seiten); die Dienste für Hinweise und Fristen bleiben mit ihren API-Tests |
| K1-f (Mein Agent)        | Seite Agenten, eigene Agenten (KI-09, E-K0-13)                                       | `e2e/ki-04.spec.ts` (Seite), `e2e/ki-09.spec.ts`, `apps/api/src/modules/agents/ki-09.test.ts`, `features/agents/*.test.tsx`                                                                              |
| K2-b, K2-e (Beziehungen) | Lieferantenliste mit Gruppen und Detailleiste, Portfolio, Seiten der Bewertungsrunde | `e2e/nav-12.spec.ts`, `e2e/seg-03.spec.ts` bis `e2e/seg-07.spec.ts` (Seiten), Teile von `e2e/ux-20-phase-3.spec.ts`; die Regeln der Segmentierung bleiben mit ihren API-Tests                            |
| K2-c (Akte)              | Arbeitsbereich mit vier Bereichen und Unterseiten (NAV-06, NAV-10 1.1)               | `e2e/nav-06.spec.ts`, `e2e/umb-05.spec.ts` (Rest), `e2e/ux-20-phase-3.spec.ts`, `e2e/spl-01.spec.ts`, `e2e/spl-03.spec.ts`, `e2e/spl-06.spec.ts`, `e2e/plb-03.spec.ts`, `e2e/zyk-01.spec.ts` (Seiten)    |
| K3 (Termin)              | Termin-Seiten mit Reitern                                                            | `e2e/qbr-01a.spec.ts`, `e2e/ki-07.spec.ts`, `e2e/ki-17.spec.ts`, `e2e/qbr-07.spec.ts` (Seiten)                                                                                                           |
| K4 (Wert, Plan)          | Übersicht, Seiten der Wirkung, Seiten des Gemeinsamen Plans mit Ablauf-Leiste        | `e2e/aw-01.spec.ts` (Seiten), JBP- und PNL-Seitentests im Web; die Rechenwege bleiben mit ihren API-Tests                                                                                                |
| K5-b (Lieferantenseite)  | Arbeitsbereich des Lieferanten (LIF-02)                                              | `e2e/lif-02.spec.ts`                                                                                                                                                                                     |
| K6 (Warengruppen)        | Strategie in zehn Schritten                                                          | `e2e/wg-04.spec.ts` (31 s, zwei Rundgänge über alle Schritte), `e2e/wg-01.spec.ts`, `e2e/wg-20.spec.ts` (Seiten)                                                                                         |

## 4. Bleibt

Alle Tests für Datenebenen und Mandanten (`layers.test.ts`, `rls.test.ts`, `za-01.test.ts`, Cross-Tenant-Tests), Rechte (`permissions.test.ts`), Migrationen, Zeitmessung LS-01, Website und alle API-Tests der Fachlogik, die mit dem Umbau weiterlaufen (Rechenwege der Wirkung, Segmentregeln, Import, Briefing, Transkripte, Anbindungen).

## 5. Wackelige Tests

- **`layers.test.ts` (behoben am 27.11.2026, K2-a.6):** Testzeilen von `relationship_ebit_target` und `material_group_strategy` bekamen ein zufälliges Jahr zwischen 2000 und 2099. Lagen mehrere auf derselben Beziehung bzw. Warengruppe, kollidierten sie gelegentlich mit dem eindeutigen Index, und der Aufbau des Tests scheiterte (rund 1 bis 6 % der Läufe). Jetzt gibt es ein fortlaufendes Jahr je Testzeile (`nextProbeYear` in `layers.ts`).

## Vorschlag

Abschnitte 1 und 2 als eigener kleiner Schritt nach K1-a. Er spart etwa 4,5 Minuten je `pnpm check` und entfernt fünf Bausteine und zwei Testseiten. Abschnitt 3 läuft mit den Paketen.
