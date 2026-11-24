# QBR-04 Erinnerung und Eskalation

> **Status 24.11.2026 (Umbau KI-nativ): Oberfläche abgelöst, Regeln und Daten gelten weiter.** Maßgeblich: ZQ-01. Die Aufgabe „Zusagen nachhalten“ erinnert; an Zusagen des Lieferanten auf Stufe Erledigen, gekennzeichnet als Nachricht von Reziproq (E-K1-5). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.3 · baut auf QBR-03, QS-01

## Ziel

Niemand muss Fristen hinterherlaufen. Verantwortliche werden vor der Frist erinnert, und am Tag nach der Frist erfährt der SRO bzw. der Key Account Manager von jeder überfälligen Maßnahme.

## Wer darf was

| Rolle | Darf |
|---|---|
| Admin beider Seiten | Erinnerungstage für die eigene Organisation einstellen. |
| System | Erinnerungen und Eskalationen verschicken. |

## Daten

- Neue Tabelle `org_setting` (`org_private`): `org_id`, `key`, `value`. Erster Eintrag `action_reminder_days` (Standard: 3). Sie gilt für Käufer und Lieferanten; `cycle_settings` bleibt beim Zyklus des Käufers.
- `action_notification` (`org_private`): `action_id`, `kind` (`reminder`, `escalation`), `sent_at`. Verhindert doppelte Mails.

## Ablauf

1. Ein täglicher Job prüft alle offenen Maßnahmen.
2. **Erinnerung:** `action_reminder_days` Tage vor der Frist geht eine Mail an die verantwortliche Person, sofern sie ein Konto hat.
3. **Eskalation:** Am Tag nach der Frist gehen Mails an:
   - den SRO, bei Maßnahmen der Käuferseite
   - den Key Account Manager, bei Maßnahmen der Lieferantenseite
   - der verantwortlichen Person in Kopie
4. Jede Mail enthält nur Titel, Frist und Link (QS-01).

## Umsetzung

- Der Job (`reziproq-action-reminders`, täglich 7:15) fragt `app_action_due_orgs` (Rolle
  `reziproq_action_jobs`, nur Organisations-IDs) und öffnet dann je Seite eine Mandanten-Session,
  der Lieferant im Kontext seines Kunden. Er schreibt nur an Personen der eigenen Organisation;
  interne Maßnahmen der anderen Seite sieht RLS gar nicht.
- Maßgeblich ist die verantwortliche Seite (`owner_side`): Eine geteilte Maßnahme des Käufers für
  den Lieferanten erinnert und eskaliert beim Lieferanten.
- `action_notification` trägt zusätzlich die Frist: Wird sie verschoben, gibt es für die neue Frist
  wieder eine Erinnerung und Eskalation. Die Tabelle ist nur anfügbar.
- Die Kopie an die verantwortliche Person ist eine eigene Mail; ist sie selbst SRO bzw. Key Account
  Manager, kommt nur eine. Jede Mail steht im Verlauf (intern) und geht über die Outbox (QS-01).
- Einstellung unter Einstellungen › Erinnerungen (`/massnahmen/einstellungen`), 1 bis 30 Tage, mit
  Verlauf.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Die Eskalation kommt genau am Tag nach der Frist, einmal.
- [x] Die Erinnerung kommt genau einmal, an den eingestellten Tagen vorher.
- [x] Erledigte und abgebrochene Maßnahmen lösen nichts aus.
- [x] Interne Maßnahmen lösen nur Mails an die eigene Seite aus.
- [x] Ein Test läuft mit vorgegebenem Datum und ohne echte Wartezeit.

## Nicht Teil dieser Funktion

- Eskalation an Sponsoren
- Zusammenfassungen per Mail
