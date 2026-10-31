# QBR-04 Erinnerung und Eskalation

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

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Die Eskalation kommt genau am Tag nach der Frist, einmal.
- [ ] Die Erinnerung kommt genau einmal, an den eingestellten Tagen vorher.
- [ ] Erledigte und abgebrochene Maßnahmen lösen nichts aus.
- [ ] Interne Maßnahmen lösen nur Mails an die eigene Seite aus.
- [ ] Ein Test läuft mit vorgegebenem Datum und ohne echte Wartezeit.

## Nicht Teil dieser Funktion

- Eskalation an Sponsoren
- Zusammenfassungen per Mail
