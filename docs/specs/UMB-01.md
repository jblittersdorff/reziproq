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

- [x] Es gibt keinen Dialog mehr; die Prüfung aus PLT-10 läuft grün.
- [x] `/betreiber/kunden` ist über die Adresse erreichbar; ohne `is_operator` antwortet die API mit 403, auch für Admins.
- [x] Jeder Zugriff in einem Kunden und jeder Abruf der Kundenliste steht in `support_access_log`; die API-Rolle kann das Protokoll nicht lesen.
- [x] Die Umbenennung verliert keine Einträge (Migrationstest).
- [x] Ein Betreiber im Kunden B sieht genau die Daten von B (Tests aus PLT-13 laufen weiter).
- [x] `pnpm operator:set` setzt und entfernt das Flag; die Zitadel-Rolle `betreiber` hat keine Wirkung mehr.

## Umgesetzt mit

- Das Flag `is_operator` setzt nur `pnpm operator:set <email>` (bzw. `--remove`); weder API noch Oberfläche können es ändern. Die API liest es über die Datenbankfunktion `app_ist_betreiber`, die nur `reziproq_api` ausführen darf.
- Migration `0015_betreiber_flag` benennt Tabelle, Spalten, Schlüssel und Policy um, statt neu anzulegen; die Funktion `app_betreiber_protokoll` schreibt nun in `support_access_log`. Im Register der Datenebenen steht die Tabelle als `global` mit Vermerk „nur Betrieb“.
- Die Zitadel-Rollen kennt die API nur noch als `admin`, `nutzer`, `leser`, `controlling` (Übernahme aus PLT-05a); `betreiber` im Token wird ignoriert.
- `/betreiber/kunden` ist eine eigene Seite im Pfad unter Profil. Ohne `is_operator` zeigt sie nur einen Hinweis; die Kundenliste kommt von der API, die mit 403 antwortet.
- Dialog und Baustein `dialog.tsx` sind entfernt; die Erlaubnisliste der Prüfung aus PLT-10 ist leer.
- Auf `/profil` steht bei Betreibern ohne Organisation kein Hinweis „Ändern kann sie ein Admin“ mehr, denn das Flag ändert nur das Skript.

## Nicht Teil dieser Funktion

- Schreibrechte für Betreiber
- Freigabe des Zugangs durch den Kunden
- Betreiber-Zugang für Lieferanten-Organisationen
