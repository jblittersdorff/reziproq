# PLT-01 Anmeldung und Abmeldung

Release 0.1 · Reihenfolge 3 · Login über Zitadel, Access Token und `/me` mit Userinfo laufen bereits. Diese Spec macht die Anmeldung vollständig.

## Ziel

Als Nutzer melde ich mich sicher mit E-Mail und Passkey an, bleibe angemeldet, solange ich arbeite, und bin nach dem Abmelden wirklich draußen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Jeder Nutzer mit Konto in Zitadel | Sich anmelden, einen Passkey einrichten, sich abmelden. |
| Ohne Anmeldung | Nur `GET /health`. Jede andere Adresse der API antwortet mit 401. |
| Lieferant | Gleicher Weg. Die Einladung per Magic Link kommt mit LIF-01 (0.2). |

## Daten

- In Reziproq werden keine Passwörter und keine Passkeys gespeichert. Das übernimmt Zitadel.
- Tabelle `app_user` (besteht): `id` (= sub), `name`, `given_name`, `email`, `created_at`, `updated_at`.
- Neu: `last_login_at`. Die App meldet jede abgeschlossene Anmeldung über `POST /api/me/anmeldung`; ein normaler Aufruf von `GET /api/me` ändert den Wert nicht.
- Access Token als JWT, geprüft über JWKS, Issuer und Audience (besteht). Für die Person zählt aus dem Token nur `sub`; die Rollen liest die API seit PLT-13 ebenfalls aus dem Token. Name und E-Mail kommen über Userinfo (besteht).
- Das Token liegt nur im Speicher des Browsers, nie in localStorage oder sessionStorage. Ein Refresh Token (Scope `offline_access`) erneuert es.
- `GET /api/me` nennt zusätzlich die Rollen aus dem Token (`roles`). Nur zur Anzeige; entschieden wird weiter allein über `can()`.

## Ablauf

**Einmalig in Zitadel (von Hand, Schritt für Schritt in die Spec-PR schreiben):**

1. In den Login-Einstellungen Passkeys erlauben und nach dem ersten Login das Einrichten eines Passkeys anbieten.
2. In der App `web` den Grant Type „Refresh Token“ aktivieren.
3. In der App `web` den Access-Token-Typ **JWT** wählen.
4. Im Projekt „Rollen bei Authentifizierung mitgeben“ einschalten und jedem Nutzer unter Berechtigungen eine Rolle zuweisen.

**In der App:**

1. Ein nicht angemeldeter Nutzer öffnet irgendeine Seite und wird ohne Klick zur Zitadel-Anmeldung geleitet. Danach landet er genau auf der Seite, die er öffnen wollte. Weil das Token nur im Speicher liegt, gilt das auch nach dem Neuladen; solange die Sitzung bei Zitadel aktiv ist, fragt Zitadel dabei nicht nach Zugangsdaten.
2. Beim ersten Login bietet Zitadel an, einen Passkey einzurichten. Ab dann reicht Face ID, Touch ID oder der Passkey im 1Password.
3. Läuft das Access Token ab, erneuert die App es im Hintergrund. Der Nutzer merkt nichts.
4. Scheitert die Erneuerung, erscheint ein Hinweis „Bitte melde dich neu an“ mit Knopf. Der Knopf öffnet Zitadel in einem kleinen Fenster (Popup); sperrt der Browser es, folgt eine normale Weiterleitung. Nichts von dem, was er gerade eingegeben hat, geht dabei verloren.
5. Ein Klick auf **Abmelden** beendet die Sitzung in Reziproq und in Zitadel. Danach erscheint die Startseite mit „Anmelden“.
6. Während der Anmeldung zeigt die App einen ruhigen Ladezustand, nie kurz geschützte Inhalte.
7. In den Einstellungen steht unter „Konto“, welche Rollen im Token ankommen. Ohne Rolle sagt ein Hinweis, was in Zitadel zu prüfen ist.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ein Test geht automatisch alle Routen der API durch. Jede außer `GET /health` antwortet ohne Token mit 401.
- [ ] Ein Token mit falschem Issuer, falscher Audience, falscher Signatur oder abgelaufenem Datum gibt 401.
- [ ] Nach dem Login landet der Nutzer auf der ursprünglich angefragten Seite.
- [ ] Beim ersten Login wird `app_user` angelegt, bei jedem Login `last_login_at` aktualisiert.
- [ ] Die App erneuert ein abgelaufenes Token ohne Neuanmeldung (Test mit nachgebautem Zitadel).
- [ ] Scheitert die Erneuerung, erscheint „Bitte melde dich neu an“; Eingaben bleiben erhalten, auch nach dem Neu-Anmelden.
- [ ] Das Token liegt nach dem Login nirgends im dauerhaften Speicher des Browsers.
- [ ] Nach dem Abmelden liegt kein Token mehr im Browser, die App zeigt die Startseite mit „Anmelden“, und die nächste Anmeldung fragt Zitadel erneut nach den Zugangsdaten.
- [ ] Geschützte Seiten zeigen vor abgeschlossener Anmeldung keine Inhalte.
- [ ] Anmelden mit Passkey funktioniert lokal (Prüfung von Hand, im Pull Request dokumentiert).
- [ ] Die Einstellungen zeigen die Rollen aus dem Token, ohne Rolle mit Hinweis.

## Nicht Teil dieser Funktion

- Firmen-Login der Kunden über Entra ID oder Okta (nach 1.0)
- Magic Link und Einladungen für Lieferanten (LIF-01)
- Zuordnung zur Organisation (PLT-02)
- Rollen vergeben und Rechte je Rolle (PLT-05). PLT-01 zeigt nur an, welche Rollen ankommen.
- Eigene Login-Seite im Reziproq-Design. Die Zitadel-Seite bekommt nur Logo und Farben, wenn Zeit bleibt.
