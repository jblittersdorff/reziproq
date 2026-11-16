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

**PUL-02b (Beantworten ohne Anmeldung):**

- `survey_response` ist `org_private` der antwortenden Seite und nur anfügbar. Eine Zeile je
  Antwortbogen statt je Frage: `answers` (JSON je Frage mit Ist und Soll, `null` für „Kann ich
  nicht beurteilen“) und `comment`. Kein Verweis auf die Person, **keine Zeitstempel** und eine
  zufällige ID (uuid v4), damit sich der Bogen nicht über die Zeit mit `completed_at` verbinden
  lässt. Ein Test prüft Spalten, Typen und Fremdschlüssel.
- Lesen und Absenden laufen über `app_umfrage_lesen` und `app_umfrage_absenden` als Rolle
  `reziproq_umfrage` (ausführbar nur für `reziproq_api`), wie die Annahme der Einladung. Die
  Funktion verlangt für jede aktive Frage Ist und Soll und setzt `completed_at` in derselben
  Transaktion; ein zweites Absenden scheitert.
- Der Link gilt bis einschließlich Frist und nur, solange die eigene Seite nicht abgeschlossen hat.
- **Zwischenstand nur auf dem Gerät** (localStorage), nicht auf dem Server: Ein gespeicherter
  Zwischenstand müsste mit dem Link und damit mit der Person verbunden sein. Wer das Gerät
  wechselt, beginnt neu.
- Je Dimension eine Seite mit Fortschritt (Puls: eine Seite). Die Sprache folgt dem Browser und
  lässt sich umschalten; alle Texte der Seite wechseln mit.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Eine Welle für zehn Teilnehmende ist in unter zwei Minuten gestartet (von Hand gemessen, im Pull Request notiert).
- [x] Ein Link funktioniert genau einmal zum Absenden und nach der Frist nicht mehr.
- [x] Keine Antwort lässt sich einer Person zuordnen. Ein Test prüft das Schema.
- [x] Der Rücklauf je Seite zeigt nur Anzahlen.
- [x] Antworten einer Seite sind für die andere Seite vor der Aufdeckung unsichtbar (PLT-04).
- [x] Das Beantworten funktioniert auf dem Smartphone bei 390 px.

## Änderung: Feedback in der App (16.11.2026, Vorgabe des Gründers)

Feedback wird direkt in Reziproq abgegeben, auf Käufer- und Lieferantenseite, nicht über einen
Umweg per E-Mail.

- Wer zu einer Welle eingeladen ist und ein Konto hat (gleiche E-Mail, eigene Organisation auf der
  eingeladenen Seite), sieht den Fragebogen als Aufgabe „Feedback geben“ auf Start, unter
  `/feedback` und als Hinweis auf den Feedback-Seiten der Beziehung, und beantwortet ihn
  angemeldet unter `/feedback/<einladung>`.
- Der Bogen ist derselbe wie beim Link: je Dimension eine Seite, Ist und Soll, Freitext, einmal
  absenden. Die Antwort bleibt anonym: `survey_response` hat weiterhin keinen Verweis auf Person
  oder Einladung, nur `completed_at` an der Einladung.
- Weil die Einladungen intern der einladenden Seite bleiben, finden drei enge Funktionen als
  `reziproq_umfrage` nur die Einladungen der angemeldeten Person (`app_umfrage_meine`,
  `app_umfrage_teilnahme_lesen`, `app_umfrage_teilnahme_absenden`, Migration 0079) und schreiben
  über dieselben Prüfungen wie der Link.
- Der persönliche Link bleibt für Eingeladene ohne Konto. Die Einladungsmail geht weiterhin an
  alle; wer ein Konto hat, kann sie ignorieren und in der App antworten.
- Tests: `apps/api/src/modules/feedback/feedback-in-app.test.ts`,
  `apps/web/src/features/feedback/feedback-in-app.test.tsx`, `apps/web/e2e/feedback-in-app.spec.ts`.

## Nicht Teil dieser Funktion

- Auswertung und Aufdeckung (PUL-03)
- Erinnerungen vor der Frist (Erweiterung über ZYK-02)
