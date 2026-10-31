# QBR-01 Termine

Release 0.3 · baut auf PLB-03, LIF-02, NAV-05 · deckt ab QBR-01, QBR-02

## Ziel

Beide Seiten bereiten Termine wie Quartalsreview oder Strategiedialog komplett in Reziproq vor, sehen dort den aktuellen Stand und halten Protokoll und Beschlüsse fest.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Key Account Manager, Team-Mitglieder | Termine anlegen, Agenda bearbeiten, Protokoll und Beschlüsse schreiben. |
| Beide Seiten | Geteilte Termine sehen, Agendapunkte vorschlagen. |
| Jede Seite | Interne Notizen zum Termin, die nur sie sieht. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `meeting` | `id`, `relationship_id`, `owner_org_id`, `type` (`jbp`, `quarterly_review`, `strategy_dialogue`, weitere Formate aus den Spielregeln), `title`, `starts_at`, `location`, `status` (`planned`, `held`, `closed`), `protocol` | `shared` |
| `meeting_participant` | `meeting_id`, `side`, `user_id` oder `name` | `shared` |
| `meeting_agenda_item` | `meeting_id`, `position`, `title`, `owner_side`, `linked_object_type`, `linked_object_id` | `shared` |
| `meeting_decision` | `meeting_id`, `text`, `position` | `shared` |
| `meeting_snapshot` | `meeting_id`, `frozen_at`, `content` (JSON mit dem Stand der Live-Abschnitte) | `shared` |
| `meeting_note` | `meeting_id`, `org_id`, `text` | `org_private` |

- **Live-Abschnitte:** Scorecard, Initiativen, Zusagen und offene Maßnahmen werden aus ihrem Ort gelesen, nie kopiert. Jeder Abschnitt erscheint, sobald seine Spec da ist.
- **Beim Abschließen** friert `meeting_snapshot` den Stand ein. Er ist ein Archiv, kein zweiter Ort.
- **Termin-Quelle** für Start (NAV-05) und für den Kopf des Lieferanten (NAV-06).

## Teilung

Zwei Pull Requests:

- **QBR-01a:** Termine mit Agenda, Teilnehmenden, Protokoll und Beschlüssen.
- **QBR-01b:** Live-Abschnitte, Abschließen mit Einfrieren, Termin-Quelle.

## Ablauf

1. **Lieferant › Umsetzung › Termine** (`/lieferanten/<id>/umsetzung/termine`): kommende und vergangene Termine.
2. **Neuer Termin** auf eigener Seite:
   - Art aus den Formaten der Spielregeln, Datum, Ort oder Link, Teilnehmende
   - Die Agenda-Vorlage ergibt sich aus der Art.
3. **Termin-Seite** (`/…/termine/<id>`) hat vier Abschnitte:
   - Agenda
   - Live-Abschnitte
   - Protokoll und Beschlüsse
   - interne Notizen mit Kennzeichen „Intern“

   Bearbeitet wird je Abschnitt auf eigener Seite.
4. **Termin abschließen**, mit Bestätigung auf der Seite: Protokoll und Beschlüsse werden gesperrt, und der Stand wird eingefroren.
5. Beim Lieferanten liegen die Termine unter `/kunden/<beziehung>/umsetzung/termine`.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ein Termin lässt sich ohne andere Werkzeuge vorbereiten und protokollieren.
- [ ] Die Live-Abschnitte zeigen den aktuellen Stand aus ihrem Ort. Ein Test ändert eine Maßnahme und prüft den Termin.
- [ ] Nach dem Abschließen sind Protokoll und Beschlüsse gesperrt, und der eingefrorene Stand ändert sich nicht mehr.
- [ ] Interne Notizen sieht die andere Seite nie (PLT-04).
- [ ] Der nächste Termin erscheint im Kopf des Lieferanten und auf Start beider Seiten.

## Nicht Teil dieser Funktion

- Kalendereinladungen
- Pre-Read als PDF (QBR-06)
- Vorbereitung des Joint Business Planning (JBP-01)
