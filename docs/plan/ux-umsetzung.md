# Prompts für Claude Code, je Phase einer

> **Status 24.11.2026: abgelöst** durch `docs/umsetzungsplan.md` (Umbau KI-nativ, Pakete K0 bis Z; E-K0-24). Phase 1 bleibt Voraussetzung, die Phasen 2 bis 10 werden nicht mehr gebaut. Phase 2 und 3 sind gebaut; was davon bleibt, steht in `docs/k0-abweichungen.md` (B-12).

Immer in einer neuen Sitzung starten. Am Ende jeder Phase: Tests grün, Screenshots bei 390 und 1440 px unter `docs/plan/screens/phase-<n>/`, ein lokaler Commit, offene Fragen in `docs/plan/fragen.md`.

## Phase 0 · Prüfen

> Lies `CLAUDE.md`, `docs/specs/NAV-10.md`, `docs/specs/UX-20.md`, `docs/design/designsprache.md`, `docs/plan/ux-umsetzung.md` und sieh dir die Vorlagen in `docs/design/referenz/` an. Vergleiche mit dem Code: Was gibt es schon, was weicht ab, was fehlt? Schreibe `docs/plan/ux-abweichungen.md` mit einer Tabelle je Phase (Seite oder Baustein, Stand im Code, Aufwand S/M/L) und offene Fragen nach `docs/plan/fragen.md`. Ändere keinen Code. Claims, Risiko und Vertrag sind nicht Teil der Umsetzung.

## Phase 1 · Grundlagen

> Setze Phase 1 aus `docs/plan/ux-umsetzung.md` um: Tabelle `org_module` mit Migration und Zeilensicherheit, Standard `claims`, `risk`, `contract` = aus; Design-Tokens aus `docs/design/designsprache.md`; `AppShell` mit Seitenleiste und Tab-Leiste; die Bausteine aus UX-20 (`NextCard`, `SoWhat`, `ChartCard`, `ProcessChain`, `RowGroup`, `Collapsible`, `FormPage`, Köpfe, Ablauf-Leiste). Für jeden Baustein eine Testseite mit den Texten aus den Vorlagen. Tests: Komponenten, 390 px ohne seitliches Scrollen, `NextCard` ohne Ziel wirft einen Fehler, Zeile ohne Ziel hat keinen Pfeil.

## Phase 2 · Navigation und Start

> Setze NAV-10 Version 1.1 für Navigation, Weiterleitungen, Übersicht (Lagebild mit Terminschiene und Diagrammkarten), Mein Tag, Aufgaben und Hinweise um, mit den Sichten `next_action` und `timeline_item`. Beide filtern nach `org_module`: keine Claims, keine Risiken, keine Vertragsfristen. Die Diagrammkarten Risiko und Claims der Übersicht erscheinen nur bei aktivem Modul. Vorlagen: `Uebersicht`, `Main`, `Aufgaben`, `Hinweise`, `A-Uebersicht`, `A-MeinTag`. Jedes Kriterium aus NAV-10 unter „Fertig, wenn“ bekommt einen Test.

## Phase 3 · Lieferanten

> Setze Liste, Überblick und Profil des Lieferanten nach NAV-10 und UX-20 um, mit dem Lieferantenkopf. Im Überblick entfällt die Zeile „Claims und Risiken“, solange die Module aus sind. Vorlagen: `Lieferanten`, `L-Ueberblick`, `L-Profil`, `SupplierBar`, `A-Lieferant`, `A-Lieferant-Desktop`.

## Phase 4 · Beziehung

> Setze UX-20 Ablauf 5 um: Team mit Einladen, Spielregeln mit Teilen, Beziehungsnetz mit Person, Feedback von Art bis Maßnahme inklusive der Umfrage für Befragte. Vorlagen: alle `B-*`, `O-Einladung`, `O-Anmeldung`, `O-Umfrage`. E2E-Test: Feedback von „Art“ bis „Maßnahme“ nur über Hauptknöpfe.

## Phase 5 · Segmentierung

> Setze UX-20 Ablauf 3 um: Runde starten, bewerten, Rücklauf, konsolidieren, entscheiden, Portfolio. Konsolidieren ist Pflicht ab einer Spanne von 2, Begründung Pflicht. Vorlagen: `PF-*`, `L-Segmentierung`. E2E-Test über die ganze Kette.

## Phase 6 · Termine, Aktivitäten, Maßnahmen

> Setze UX-20 Ablauf 6 um. Vorlagen: `U-Termine`, `Aktivitaeten`, `L-Notizen`, `O-Outlook`, `U-Massnahme`, `U-Massnahmen`. In `U-Massnahme` entfällt der Verweis auf die Krise, solange `risk` aus ist.

## Phase 7 · JBP-Termin

> Setze UX-20 Ablauf 7 um, von Briefing bis Protokoll, plus die Lieferantenseite `K-*`. Vorlagen: `Termin-Briefing`, `J-*`, `Termin-Ergebnisse`, `Termin-Protokoll`, `K-*`. E2E-Test vom Briefing bis zum geteilten Protokoll, auch aus Sicht des Lieferanten (Beitrag schreiben, Präsentation sehen).

## Phase 8 · Plan und Ergebnis

> Setze UX-20 Abläufe 4, 8 und 9 um: Lieferantenplan mit neuer Version, Gemeinsamer Plan von Vorbereitung bis Kennzahl, Ergebnis bis zur Freigabe durch das Controlling, Wertpotenziale bis zum JBP-Thema. Vorlagen: `L-Warengruppen`, `L-Plan-Neu`, `L-Lieferantenplan`, `P-*`, `W-*`, `KI-Wert*`. Wirkungsarten werden nie addiert.

## Phase 9 · Warengruppen

> Setze UX-20 Ablauf 10 um: Liste, Überblick, die zehn Schritte, Warengruppenkopf und Ablauf-Leiste, Strategie-Entwurf durch Reziproq. Vorlagen: `WG-*`, `GroupBar`, `Flow`, `KI-Autor-Start`, `KI-Autor`, `A-Warengruppen`, `A-Warengruppe`, `A-Warengruppe-Desktop`.

## Phase 10 · Abnahme

> Prüfe alle Kriterien aus NAV-10 und UX-20. Schreibe E2E-Tests für jeden Ablauf aus UX-20, einen Test gegen Sackgassen (jeder Hauptknopf hat ein gültiges Ziel) und einen Test, der jede Seite bei 390 px auf seitliches Scrollen und verdeckten Inhalt prüft. Liste alle Abweichungen von den Vorlagen mit Screenshot in `docs/plan/abnahme.md`. Keine neuen Funktionen.
