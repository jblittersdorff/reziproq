# Reziproq

Kollaborationsplattform für strategische Lieferantenbeziehungen. Käufer und Lieferanten
arbeiten in derselben App; Daten sind strikt nach Organisation und Beziehung getrennt.

## Befehle

- pnpm dev: alles lokal starten
- pnpm check: vor jedem Commit alles, was die CI prüft (Typprüfung, Lint, Migration, Rollen, Unit-,
  RLS- und Cross-Tenant-Tests, E2E); alles muss grün sein. Einzeln: pnpm typecheck, pnpm lint,
  pnpm test, pnpm test:e2e
- pnpm --filter @reziproq/db db:generate / db:migrate: Migrationen
- pnpm db:seed: Beispieldaten; richtet sie danach mit pnpm demo:setup auf die echten Konten ein
  (Käufer OEM 1 mit allen Rechten, Lieferant Lieferant 1), ohne erfundene Personen
- Automatische Tests schreiben nie in die Entwicklungsdatenbank, sondern in reziproq_test

## Lokaler Betrieb

Bis der Gründer es ausdrücklich aufhebt, läuft alles lokal (GitHub-Actions-Minuten aufgebraucht).

- Kein `git push`, in keiner Schreibweise (auch nicht `git -C … push`).
- Kein `gh`, keine Pull Requests, keine Issues, keine Releases, keine Aufrufe der GitHub-API.
- Kein `git pull` und kein `git fetch`, außer der Gründer bittet darum.
- Remotes nicht ändern und nicht entfernen.
- Commits nur lokal, klein und mit klarer Nachricht, auf dem aktuellen Branch.
- Alles, was bisher die CI geprüft hat, läuft lokal vor jedem Commit: `pnpm check` (Typprüfung,
  Lint, Unit-Tests, RLS- und Cross-Tenant-Tests, E2E-Tests). Ein Commit entsteht nur, wenn alles
  grün ist.
- Wenn ein Schritt GitHub bräuchte: anhalten und den Gründer fragen.

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
- Sobald für eine gemeinsame Initiative Wirkung eingerichtet ist, trägt sie ihre GuV-Wirkung:
  Hebel, GuV-Zeile, Wirkungsart, eingefrorene Baseline, Reifegrad R1-R5; realisiert erst nach
  Freigabe durch Controlling
- EBIT-Wirkung nie mit Kostenvermeidung, Cash oder strategischem Wert addieren
- Geldbeträge als Ganzzahl in Cent mit Währung, nie als Gleitkommazahl
- Keine `WG`-Spec (Warengruppenmanagement, Release 1.1) anfangen, solange eine Spec des
  Lieferantenmanagements offen ist; auch nichts dafür vorbauen. Ausnahme nur auf ausdrückliche
  Anweisung des Gründers (docs/umsetzungsplan.md, Abschnitt 9)

## Oberfläche: Designsprache „Zwei Kreise“

`docs/design/designsprache.md` ist die verbindliche Vorgabe für jede Oberfläche
von Reziproq: Käuferseite, Lieferantenseite, Seiten ohne Anmeldung, Mails,
Fehlerseiten, leere Zustände. Die Dateien in `docs/design/referenz/` sind
Vorlagen für Aufbau und exakte Werte, kein Code zum Übernehmen.

Gilt für jede Änderung an der Oberfläche:

1. Farben, Schriften, Radien und Schatten nur über die Tokens. Keine Hex-Werte,
   keine Schriftnamen, keine Einzelwerte in Komponenten.
2. Erst einen Baustein aus dem UI-Paket nehmen. Gibt es keinen passenden, den
   Baustein im UI-Paket anlegen, nicht in der Seite.
3. Gibt es für eine Seite eine Vorlage in `docs/design/referenz/`, folgt die
   Seite ihr. Gibt es keine, gelten Regeln und Bausteine der Designsprache und
   die ähnlichste Vorlage.
4. Die dreizehn Regeln der Designsprache gelten auf jeder Seite, besonders: Titel
   nennt die Aufgabe. Höchstens eine Hauptaktion in der Tinte-Karte. Parteien,
   Termine und Schritte sind Kreise. Klickbares ist eine Pille. Privat grau
   gestrichelt mit Schloss, geteilt Mint mit Doppelring, KI-Entwurf gestrichelt
   Petrol mit Quellen. Status immer als Text.
5. Jede Seite funktioniert auf Telefonbreite und mit Tastatur. Text hat
   mindestens 4,5:1 Kontrast. Die Seite scrollt nie seitwärts.
6. Eine Spec beschreibt Inhalt und Verhalten, die Designsprache das Aussehen.
   Widersprechen sich beide im Aussehen, gilt die Designsprache. Melde mir den
   Widerspruch.
7. Weicht eine Seite bewusst ab, steht der Grund als Kommentar im Code und
   in deiner Abschlussmeldung.

Bevor eine Aufgabe mit Oberfläche als fertig gilt: Fundstellen von Hex-Werten
und alter Schrift in den geänderten Dateien prüfen, Seite auf Telefonbreite
ansehen, in der Abschlussmeldung sagen, ob die Seite „nach Vorlage“ oder
„nach Regeln“ gebaut ist.
