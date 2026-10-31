# JBP-01 Vorbereitung des Joint Business Planning

Release 0.3 · baut auf QBR-01, ZYK-02, SPL-07, PUL-03, SEG-10

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

- [ ] Anlegen erzeugt Plan, Termin der Art `jbp` und Agenda nach Vorlage in einem Schritt.
- [ ] Feedback-Ergebnis und Spielregeln erscheinen nur, wenn sie aufgedeckt bzw. geteilt sind.
- [ ] Jede Seite bearbeitet nur ihr eigenes Geschäftsupdate.
- [ ] Der Hinweis zum Lieferantenplan ist für den Lieferanten unsichtbar.
- [ ] Eine Vorbereitung ist in unter einer Stunde vorbefüllt (von Hand geprüft, im Pull Request notiert).

## Nicht Teil dieser Funktion

- Themen (JBP-02)
- Initiativen (JBP-03)
- Freigabe (JBP-06)
