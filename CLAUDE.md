# Reziproq

Kollaborationsplattform für strategische Lieferantenbeziehungen. Käufer und Lieferanten
arbeiten in derselben App; Daten sind strikt nach Organisation und Beziehung getrennt.

## Befehle

- pnpm dev: alles lokal starten
- pnpm typecheck, pnpm lint, pnpm test: vor jedem Commit, alle müssen grün sein
- pnpm --filter @reziproq/db db:generate / db:migrate: Migrationen

## Aufbau

- apps/web: React 19, Vite 8, TanStack Router und Query, shadcn/ui; alle Texte Deutsch und Englisch
- apps/api: NestJS 12 (ESM) mit zod, ein Modul je Fachbereich unter src/modules/, Jobs mit pg-boss
- packages/db: Drizzle-Schema, SQL-Migrationen, Row-Level-Security-Policies
- packages/shared: zod-Schemas und Typen für web und api
- docs/specs: eine Spec je Anforderung, ID im Dateinamen (z. B. SEG-02.md)

## Regeln

- Jede Beziehung hat drei Ebenen: käuferprivat, geteilt, lieferantenprivat
- Datenzugriff nur über die Mandanten-Session; Row-Level Security nie umgehen
- Keine Fremdschlüssel von geteilten auf private Tabellen
- Rechte immer über can() im Backend prüfen, nie nur im Frontend
- Keine Bewertung einzelner Personen, nur Organisationen, Funktionen und Beziehungen
- Keine Zugangsdaten im Code, nur über Umgebungsvariablen
- Neue Abhängigkeiten nur mit MIT-, Apache-, BSD- oder ISC-Lizenz, Version fest gepinnt
- Jede Änderung mit Test; vor dem Bauen die Spec in docs/specs/ lesen
- Für jede Arbeit an der Oberfläche gilt der Skill ui-design
- Alles in AWS entsteht über infra/ mit OpenTofu, nie per Hand in der Konsole
- Ein Ordner je Fachbereich: apps/api/src/modules/<bereich>, apps/web/src/features/<bereich>
- Add-ons werden je Kunde über eine Freischalt-Tabelle aktiviert
- Die Werkstoff- bzw. Warengruppe je Lieferant gehört zum Kern-Datenmodell
- Jede gemeinsame Initiative trägt ihre GuV-Wirkung: Hebel, GuV-Zeile, Wirkungsart,
  eingefrorene Baseline, Reifegrad R1-R5; realisiert erst nach Freigabe durch Controlling
- EBIT-Wirkung nie mit Kostenvermeidung, Cash oder strategischem Wert addieren
- Geldbeträge als Ganzzahl in Cent mit Währung, nie als Gleitkommazahl
