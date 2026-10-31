# UMB-01 Betreiber-Zugang nach dem neuen Muster

Release 1.0 (Kernpfad) · baut auf PLT-11, PLT-05a · passt PLT-13 an die Regeln für 1.0 an: keine Fenster, Rollen in der Datenbank

## Ziel

Als Mitarbeiter von Reziproq wechsle ich auf einer eigenen Seite in einen Kunden und sehe die App wie er. Jeder Zugriff ist protokolliert.

## Wer darf was

| Rolle | Darf |
|---|---|
| Betreiber (`is_operator`) | Kundenliste sehen, in einen Kunden wechseln, die Ansicht verlassen. Nur lesen. |
| Käufer: alle Rollen | Nichts davon, auch nicht als Admin. |
| Lieferant | Nicht Teil. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `app_user` (erweitern) | `is_operator` (Standard `false`) | Teil der Organisation; gesetzt nur per Skript |
| `support_access_log` (umbenannt aus `betreiber_zugriff`) | `id`, `user_id`, `organization_id`, `action`, `occurred_at` | `global`, nur Betrieb; die API-Rolle schreibt über eine Datenbankfunktion und liest nie |

- `pnpm operator:set <email>` bzw. `--remove` setzt das Flag. Die Zitadel-Rolle `betreiber` wird nicht mehr gelesen.
- Der gewählte Kunde reist im Header `x-reziproq-support-org`; der Speicherschlüssel im Browser heißt entsprechend. So bleibt „Kunde“ frei für den Kundenkontext der Lieferanten (`app.customer_org_id`, LIF-02).
- Die bestehenden Protokolleinträge werden übernommen.

## Ablauf

1. `/profil` zeigt Betreibern den Weg „In einen Kunden wechseln“. Er führt zu `/betreiber/kunden`.
2. Die Seite zeigt die Organisationen mit Feature `buyer` als Kacheln mit Name und Land. Ein Klick wechselt und führt zu `/start`.
3. Die Hinweisleiste „Betreiber-Ansicht: <Kunde>. Alle Zugriffe werden protokolliert.“ steht oben im Seitenfluss, mit dem Knopf „Verlassen“.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Es gibt keinen Dialog mehr; die Prüfung aus PLT-10 läuft grün.
- [ ] `/betreiber/kunden` ist über die Adresse erreichbar; ohne `is_operator` antwortet die API mit 403, auch für Admins.
- [ ] Jeder Zugriff in einem Kunden und jeder Abruf der Kundenliste steht in `support_access_log`; die API-Rolle kann das Protokoll nicht lesen.
- [ ] Die Umbenennung verliert keine Einträge (Migrationstest).
- [ ] Ein Betreiber im Kunden B sieht genau die Daten von B (Tests aus PLT-13 laufen weiter).
- [ ] `pnpm operator:set` setzt und entfernt das Flag; die Zitadel-Rolle `betreiber` hat keine Wirkung mehr.

## Nicht Teil dieser Funktion

- Schreibrechte für Betreiber
- Freigabe des Zugangs durch den Kunden
- Betreiber-Zugang für Lieferanten-Organisationen
