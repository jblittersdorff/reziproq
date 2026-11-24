# JBP-01 Vorbereitung des Joint Business Planning

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: TE-01, BE-01. Die Vorbereitung wird die Phase Vorbereiten am Termin. Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.3 · baut auf QBR-01, ZYK-02, SPL-07, SEG-10 · PUL-03 nur weich: Der Feedback-Abschnitt entfällt, bis Block F gebaut ist (Testlauf-Pfad, 8.11.2026)

## Ziel

Als SRO bereite ich das Joint Business Planning mit dem Lieferanten in unter einer Stunde vor. Agenda, Geschäftsupdates beider Seiten und alle freigegebenen Ergebnisse stehen auf einer Seite.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Gemeinsamen Plan anlegen, Termin festlegen, Agenda anpassen. |
| Key Account Manager | Geschäftsupdate des Lieferanten schreiben, Agendapunkte vorschlagen. |
| Beide Teams | Vorbereitung sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `jbp` | `id`, `relationship_id`, `meeting_id` (Termin der Art `jbp`), `version`, `status` (`draft`, `in_review`, `approved`), `created_at` | `shared` |
| `jbp_cycle_link` | `jbp_id`, `cycle_id` | `buyer_private`. Der Zyklus ist privat, daher hängt der Verweis auf der Käuferseite. |
| `jbp_business_update` | `jbp_id`, `side`, `text`, `updated_at` | `shared` |

**Agenda-Vorlage:**

1. Geschäftsupdate Käufer
2. Geschäftsupdate Lieferant
3. Feedback-Ergebnis, nur wenn aufgedeckt
4. Beziehungstyp und Spielregeln, nur wenn geteilt
5. Themen beider Seiten
6. Initiativen und Roadmap
7. Zusagen
8. Scorecard

Punkte 3 und 4 erscheinen live aus ihrem Ort.

## Ablauf

1. **Lieferant › Gemeinsamer Plan** (`/lieferanten/<id>/plan`) zeigt sechs Kacheln:
   - Vorbereitung
   - Themen
   - Initiativen
   - Zusagen
   - Scorecard
   - Freigabe
2. Ohne Plan: **Gemeinsamen Plan anlegen**. Er übernimmt den Termin aus dem Zyklus (ZYK-02) oder fragt ihn ab und legt Termin und Agenda an.
3. **Vorbereitung** (`/…/plan/vorbereitung`):
   - Termin und Teilnehmende
   - Agenda mit Stand je Punkt: bereit oder fehlt
   - beide Geschäftsupdates, jede Seite schreibt ihres auf eigener Seite
4. Ist der Lieferantenplan noch nicht freigegeben, zeigt die Vorbereitung einen Hinweis. Er ist nur für den Käufer sichtbar.
5. Beim Lieferanten liegt die Vorbereitung unter `/kunden/<beziehung>/plan/vorbereitung`.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Anlegen erzeugt Plan, Termin der Art `jbp` und Agenda nach Vorlage in einem Schritt.
- [x] Feedback-Ergebnis und Spielregeln erscheinen nur, wenn sie aufgedeckt bzw. geteilt sind.
- [x] Jede Seite bearbeitet nur ihr eigenes Geschäftsupdate.
- [x] Der Hinweis zum Lieferantenplan ist für den Lieferanten unsichtbar.
- [ ] Eine Vorbereitung ist in unter einer Stunde vorbefüllt (von Hand geprüft, im Pull Request notiert).

## Umgesetzt mit (PR zu JBP-01)

- **Darstellung (UMB-05):** Statt sechs Kacheln erscheint der Gemeinsame Plan als Abschnitt auf dem Überblick, mit einer Zeile je gebauter Seite. Heute ist das „Vorbereitung“; Themen, Initiativen, Zusagen, Scorecard und Freigabe kommen mit JBP-02 bis JBP-07.
- **Agenda:** Die Vorlage hat sechs Punkte (Geschäftsupdates, Themen, Initiativen und Roadmap, Zusagen, Scorecard).
  - Jeder Punkt trägt seinen Abschnitt als `linked_object_type` = `jbp:<abschnitt>`.
  - Bereit oder fehlt ergibt sich daraus. Bis zu ihren Specs gelten Themen, Initiativen, Zusagen und Scorecard als „fehlt“.
- **Live aus ihrem Ort:** „Beziehungstyp und Spielregeln“ erscheint, sobald sie geteilt sind (SEG-10). Das Feedback-Ergebnis folgt mit Block F (Testlauf-Pfad).
- **Termin:** Der Vorschlag ist der JBP-Termin des Zyklus, die Uhrzeit wählbar. Termin und Agenda gehören dem Käufer; der Lieferant ergänzt eigene Agendapunkte wie bei jedem Termin (QBR-01).
- **Zweites Anlegen** legt nichts doppelt an.
- **Vorbefüllt in unter einer Stunde:** Anlegen ist ein Schritt, das Geschäftsupdate je Seite ein Formular. Im Testlauf von Hand zu prüfen.

## Nicht Teil dieser Funktion

- Themen (JBP-02)
- Initiativen (JBP-03)
- Freigabe (JBP-06)
