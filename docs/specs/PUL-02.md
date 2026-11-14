# PUL-02 Feedback-Welle starten und beantworten

Release 0.2 · baut auf PUL-01, QS-01, PLT-07 (Kontakte)

## Ziel

Als SRO starte ich in zwei Minuten eine Feedback-Welle mit Teilnehmenden beider Seiten. Jede teilnehmende Person antwortet über einen persönlichen Link, ohne Konto, und bleibt anonym.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Welle starten, Teilnehmende auf beiden Seiten einladen, Frist verlängern, die eigene Seite abschließen. |
| Lieferant (ab LIF-02) | Weitere eigene Teilnehmende einladen, die eigene Seite abschließen. |
| Teilnehmende | Über den Link einmal antworten, Zwischenstand speichern. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `survey_wave` | `id`, `relationship_id`, `template_id`, `template_version`, `kind`, `due_date`, `buyer_closed_at`, `supplier_closed_at`, `revealed_at` | `shared` |
| `survey_participant` | `id`, `wave_id`, `relationship_id`, `owner_org_id` (einladende Seite), `visibility` (`internal`), `side` (`buyer`, `supplier`), `email`, `function`, `token_hash`, `invited_at`, `completed_at` | `shared`, immer `internal`: nur die einladende Seite sieht ihre Einladungen |
| `survey_response` | `wave_id`, `org_id` (antwortende Seite), `side` (`buyer`, `supplier`), `function`, `question_id`, `ist`, `soll`, `free_text` | `org_private` der antwortenden Seite |

- **Anonym durch Bauart:** `survey_response` hat keinen Verweis auf die teilnehmende Person. Nur `completed_at` am Teilnehmenden zeigt, dass jemand geantwortet hat.
- **Der Link** trägt ein einmaliges Token. Gespeichert ist nur sein Hash. Er gilt bis zur Frist.
- **Antworten ohne Anmeldung** laufen nicht über die Mandanten-Session, sondern über eine eng gefasste Datenbankfunktion, die das Token prüft und genau eine Antwort der richtigen Seite schreibt (wie die Anmeldefunktionen aus PLT-02).
- **Teilnehmende des Lieferanten:** Vor LIF-02 lädt der Käufer sie aus den Kontakten (PLT-07) ein.

## Teilung

Zwei Pull Requests:

- **PUL-02a:** Welle anlegen und einladen.
- **PUL-02b:** Beantworten über `/umfrage/<token>` ohne Anmeldung.

## Ablauf

1. **Lieferant › Beziehung › Feedback** (`/lieferanten/<id>/beziehung/feedback`): Liste der Wellen mit Art, Frist, Rücklauf je Seite und Status.
2. **Neue Welle** ist ein Ablauf in drei Schritten:
   1. Art (Puls oder Jahres-Feedback) und Frist
   2. Teilnehmende beider Seiten mit Funktion. Vorschlag aus Team und Kontakten.
   3. Prüfen und **Starten**
3. Alle Teilnehmenden bekommen eine Mail mit persönlichem Link (QS-01).
4. **Beantworten** (`/umfrage/<token>`, ohne Anmeldung):
   - je Dimension eine Seite mit Fortschritt
   - Ist und Soll als Auswahl von 1 bis 5
   - am Ende Freitext und **Absenden**
   - Zwischenstand wird gespeichert, ein zweites Absenden ist nicht möglich.
5. Jede Seite schließt ihre Teilnahme ab, oder sie endet mit der Frist.

## Umsetzung

**PUL-02a (Welle anlegen und einladen):**

- `survey_wave` (geteilt, vom Käufer angelegt) merkt sich `template_id` und `template_version`
  ohne Fremdschlüssel, weil die Vorlage käuferprivat ist (keine Verweise von geteilt auf privat).
- `survey_participant` steht auf der geteilten Ebene, der Dienst schreibt aber immer `internal`:
  Nur die einladende Seite sieht ihre Einladungen. Eine Prüfung in der Datenbank gibt es dafür
  nicht, weil die Layer-Tests beide Sichtbarkeiten anlegen. Zusätzlich gibt es eine Spalte `name`
  (optional), damit die eigene Liste lesbar bleibt.
- Den Rücklauf beider Seiten zählt `app_survey_turnout` (nur Anzahlen), den Abschluss der eigenen
  Seite setzt `app_survey_close`. Beide laufen als Rolle `reziproq_feedback` ohne BYPASSRLS.
- Je Art läuft höchstens eine offene Welle je Beziehung. Die Frist verlängert nur der Käufer (SRO
  oder Admin); die Links gelten bis zur Frist (geprüft in PUL-02b).
- Die Mail nutzt die neue Vorlage `survey`; gespeichert ist nur der SHA-256 des Tokens, der Link
  steht nur in der Outbox, wie bei der Einladung des Lieferanten (LIF-01a).
- Neue Welle: drei Schritte mit eigener Adresse (`?schritt=1…3`), der Entwurf bleibt im Tab
  erhalten. Vorschläge aus Team (Käufer) und Kontakten (Lieferant) sind vorausgewählt; die
  Funktion ist Pflicht (Liste `surveyFunctions`, ergänzt um Vertrieb, Geschäftsleitung, Andere).
- Rechte: `feedback.sehen` und `feedback.verwalten` (Starten beim Käufer nur SRO oder Admin).

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Eine Welle für zehn Teilnehmende ist in unter zwei Minuten gestartet (von Hand gemessen, im Pull Request notiert).
- [ ] Ein Link funktioniert genau einmal zum Absenden und nach der Frist nicht mehr.
- [ ] Keine Antwort lässt sich einer Person zuordnen. Ein Test prüft das Schema.
- [x] Der Rücklauf je Seite zeigt nur Anzahlen.
- [ ] Antworten einer Seite sind für die andere Seite vor der Aufdeckung unsichtbar (PLT-04).
- [ ] Das Beantworten funktioniert auf dem Smartphone bei 390 px.

## Nicht Teil dieser Funktion

- Auswertung und Aufdeckung (PUL-03)
- Erinnerungen vor der Frist (Erweiterung über ZYK-02)
