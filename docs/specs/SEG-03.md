# SEG-03 Bewertungsrunde starten

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: BZ-01. Die Runde entsteht als Entwurf, Bewertungen kommen in Kurz prüfen, die Konsolidierung wird die Segment-Mappe, das Portfolio die Linse Segmente. Die Regeln gelten wörtlich weiter. Offen: Größe der Matrix (C-02 in `docs/entscheidungen.md`). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.1 · baut auf SEG-01, QS-01, PLT-06

## Ziel

Als Admin starte ich in einem geführten Ablauf eine Bewertungsrunde: welche Lieferanten, von wem je Business Unit, Warengruppe und Funktion, bis wann. Alle Bewertenden werden automatisch eingeladen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin | Runden anlegen, starten, verlängern, schließen. |
| Käufer: SRO einer Beziehung | Die Runde für seine Lieferanten sehen und Bewertende nachnominieren. |
| Käufer: Nutzer, Leser | Nur die eigenen Einladungen sehen. |
| Lieferant | Nichts. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `segmentation_round` | `id`, `org_id`, `name`, `due_date`, `status` (`draft`, `open`, `closed`), `model_version`, `created_by` | `org_private` |
| `rating_assignment` | `id`, `round_id`, `relationship_id`, `business_unit_id`, `material_group_id` (optional), `function`, `rater_user_id`, `status` (`open`, `in_progress`, `submitted`) | `buyer_private` |

- Bewertet wird nur, was zugeordnet ist: eine BU und eine Warengruppe des Lieferanten (PLT-06).
- **Vorschlag für Bewertende:** Mitglieder des internen Teams (PLT-05) mit passender Funktion, sonst Nutzer mit dieser Standardfunktion.

## Ablauf

1. **Portfolio › Bewertungsrunden** (`/portfolio/runden`): Liste der Runden mit Status, Frist und Fortschritt („18 von 30 abgegeben“).
2. **Neue Runde** ist ein Ablauf in vier Schritten, jeder mit eigener Adresse:
   1. Name und Frist
   2. Lieferanten wählen: Liste mit Filter nach BU und Warengruppe, Mehrfachauswahl
   3. Bewertende zuordnen: je Lieferant, BU, Warengruppe und Funktion eine Zeile mit vorgeschlagener Person, änderbar
   4. Prüfen und starten: Zusammenfassung, Knopf **Runde starten**
3. Beim Start erhält jede bewertende Person eine Mail (QS-01) mit Titel und Link zu ihren Bewertungen.
4. **Seite der Runde** (`/portfolio/runden/<id>`):
   - Fortschritt je Lieferant
   - Bewertende nachnominieren auf eigener Seite
   - Frist verlängern
   - Runde schließen, mit Bestätigung auf der Seite

## Fertig, wenn

Je Kriterium ein Test.

- [x] Eine Runde für zehn Lieferanten lässt sich in einem Ablauf starten.
- [x] Jeder Schritt hat eine eigene Adresse. Zurück behält die Eingaben.
- [x] Die Vorschläge kommen aus Team und Standardfunktion und lassen sich ändern.
- [x] Beim Start gibt es genau eine Mail je bewertender Person, nur mit Titel und Link.
- [x] Die Runde speichert die beim Start aktive Version des Segmentmodells; spätere Aktivierungen
      ändern die Version einer laufenden Runde nicht.
- [x] Eine geschlossene Runde nimmt keine Bewertungen mehr an.
- [x] Nur Admins starten Runden. Ein SRO nominiert nur für seine Lieferanten nach.
- [x] Der Zweit-OEM sieht keine Runde des Test-OEM (PLT-04).

## Nicht Teil dieser Funktion

- Bewertung abgeben (SEG-04)
- Erinnerungen vor der Frist (ZYK-06)
- Bewertung durch den Lieferanten (das ist Feedback, PUL)
