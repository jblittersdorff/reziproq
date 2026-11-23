# Zitadel: Firmenanmeldung (IN-02)

Stand 23.11.2026. Lokal läuft alles mit dem Nachbau (`IDENTITY_PROVIDER=fake`). Für den Betrieb
fehlen noch zwei Dinge in Zitadel; beide sind gegen ein echtes Zitadel zu prüfen, bevor ein Kunde
SSO einschaltet.

## 1. App-Registrierungen

- Microsoft Entra ID: eine App-Registrierung von Reziproq (mehrinstanzenfähig). Zitadel legt je
  Kunde einen Anbieter mit dem festen Mandanten des Kunden an, nie „common“.
- Google: ein OAuth-Client von Reziproq.
- Werte nur in der Umgebung der API: `SSO_ENTRA_CLIENT_ID`, `SSO_ENTRA_CLIENT_SECRET`,
  `SSO_GOOGLE_CLIENT_ID`, `SSO_GOOGLE_CLIENT_SECRET` (siehe `.env.example`).

## 2. Action für den Claim `urn:reziproq:idp`

Reziproq prüft beim Anmelden Anbieter, Subject, Entra-Mandant (`tid`) bzw. Google-`hd`. Diese Werte
kennt nur Zitadel. Zwei Actions geben sie weiter (Zitadel Actions v1):

- Flow „External Authentication“, Trigger „Post Authentication“: aus den Claims des Anbieters
  `provider` (`entra` oder `google`), `subject` (`oid` bzw. `sub`), `tenant` (`tid`) bzw. `hd` als
  Metadaten `reziproq_idp` an der Person speichern.
- Flow „Complement Token“, Trigger „Pre Userinfo creation“: die Metadaten `reziproq_idp` als Claim
  `urn:reziproq:idp` ausgeben. Fehlt der Claim, gilt die Anmeldung als Passkey oder Passwort.

Ohne diese Actions lehnt Reziproq jede Anmeldung über Microsoft oder Google ab (kein Claim:
Passwort-Regel greift) und legt niemanden an.
