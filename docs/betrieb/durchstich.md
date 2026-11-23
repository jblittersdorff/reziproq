# Durchstich: Zitadel und Microsoft 365 echt verbinden

Stand 23.11.2026 · Schritt D der Warteschlange ([umsetzungsplan.md](../umsetzungsplan.md)), nach
Schritt 20. Noch ohne AWS: Reziproq läuft lokal (`pnpm dev`), nur Zitadel und Microsoft sind echt.

Ziel: einmal prüfen, ob die Schnittstellen stimmen, die bisher nur gegen Nachbauten getestet sind.

1. **Firmenanmeldung (IN-02):** Eine Person aus dem Microsoft-Testmandanten meldet sich über
   Zitadel an, wird angelegt und wartet auf Freigabe.
2. **Microsoft Graph (IN-03):** Eine Person verbindet ihren Kalender. Reziproq schreibt die Agenda
   in den markierten Block eines Termins.

Dauer: etwa ein Tag, davon das meiste Einrichten bei Microsoft und Zitadel.

## Was du brauchst

| Was                                                | Wofür                                  | Woher                                                                                      |
| -------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Microsoft-365-Testmandant mit zwei Testkonten      | Anmeldung, Kalender                    | Microsoft 365 Developer Program oder eine Testversion von Microsoft 365 Business Basic     |
| Zugang zur Zitadel-Console als Admin der Instanz   | Testorganisation, Dienstkonto, Actions | deine Zitadel-Instanz                                                                      |
| Eine Domain, deren DNS du ändern kannst (optional) | echte Domain-Bestätigung               | z. B. `durchstich.reziproq.de`; ohne sie die Bestätigung in Zitadel abschalten (Schritt 3) |

Die Zugangsdaten kommen nur in die `.env`, nie ins Repository.

## 1. Microsoft: Testmandant

1. Testmandant anlegen. Notiere die **Mandanten-ID** (Entra ID › Übersicht › Tenant ID) und die
   Domain (z. B. `contoso-dev.onmicrosoft.com`).
2. Zwei Testkonten anlegen, z. B. `einkauf1@…` und `einkauf2@…`.
3. Für Teil 2: Bei `einkauf1` in Outlook im Web einen Termin anlegen, Betreff
   **„Reziproq Durchstich“**, morgen, mit einem externen Teilnehmer.

## 2. Microsoft: App-Registrierung

Entra ID › App-Registrierungen › Neue Registrierung:

- Name: `Reziproq (Durchstich)`
- Kontotypen: **Konten in einem beliebigen Organisationsverzeichnis** (mehrinstanzenfähig)
- Umleitungs-URIs (Web), beide eintragen:
  - die Callback-Adresse, die Zitadel beim Anlegen des Anbieters anzeigt (Schritt 4),
  - `http://localhost:3000/api/anbindungen/oauth/microsoft/callback` (Teil 2, lokale API)
- Zertifikate und Geheimnisse › Neuer geheimer Clientschlüssel: **Wert** sofort kopieren.
- API-Berechtigungen (delegiert, Microsoft Graph): `openid`, `profile`, `email`, `offline_access`,
  `User.Read`, `Calendars.ReadWrite`. Im Testmandanten **Administratorzustimmung erteilen**.

Notiere **Anwendungs-ID (Client-ID)** und **geheimen Clientschlüssel**.

## 3. Zitadel: Testorganisation und Dienstkonto

1. Neue Organisation `Reziproq Durchstich OEM` anlegen. Ihre **Resource ID** notieren.
2. Domain-Bestätigung:
   - mit eigener Domain: nichts tun, Reziproq zeigt später den TXT-Eintrag;
   - nur mit `…onmicrosoft.com`: in den Einstellungen der Instanz (Domain-Einstellungen)
     „Org-Domains validieren“ für den Durchstich ausschalten. Reziproq liest den Stand dann aus
     Zitadel.
3. Dienstkonto (Service User) `reziproq-api` mit der Rolle **Org Owner** in dieser Organisation
   (oder IAM Owner) anlegen, ein **Personal Access Token** erzeugen und kopieren.
4. Das Projekt der Web-App von Reziproq muss für diese Organisation freigegeben sein (Projekt-Grant),
   sonst kommt nach der Anmeldung keine Rolle an (Token-Einstellung „Rollen ins Token“ der App web
   wie bei den bisherigen Organisationen).

## 4. Zitadel: Actions

Unter Actions zwei Actions anlegen, Inhalt aus [zitadel-actions/](zitadel-actions/):

| Action              | Flow                    | Trigger               |
| ------------------- | ----------------------- | --------------------- |
| `reziproqIdpMerken` | External Authentication | Post Authentication   |
| `reziproqIdpClaim`  | Complement Token        | Pre Userinfo creation |

Den Microsoft-Anbieter legt Reziproq in Schritt 6 selbst an; die Callback-Adresse für Schritt 2
zeigt Zitadel danach unter Organisation › Identity Providers › Microsoft (Firmenkonto). Trag sie in
der App-Registrierung nach, falls noch nicht geschehen.

## 5. Reziproq: `.env` und Organisation

In die `.env` der API (nicht ins Repository):

```
IDENTITY_PROVIDER=zitadel
ZITADEL_SERVICE_TOKEN=<Personal Access Token aus 3.3>
SSO_ENTRA_CLIENT_ID=<Client-ID aus 2>
SSO_ENTRA_CLIENT_SECRET=<Clientschlüssel aus 2>
MICROSOFT_PROVIDER=live
CONNECTION_SECRET_KEY=<mindestens 16 zufällige Zeichen>
```

Dann:

1. Eine Käufer-Organisation in Reziproq mit dem Namen der Zitadel-Organisation anlegen (oder eine
   bestehende Testorganisation verwenden) und verknüpfen:
   `pnpm org:link "Reziproq Durchstich OEM" <Resource ID aus 3.1>`
2. API neu starten (`pnpm dev`).
3. Prüfen: `pnpm durchstich:pruefen`. Es meldet je Punkt „ok“ oder was fehlt, ohne Geheimnisse
   anzuzeigen.

## 6. Teil 1: Firmenanmeldung

1. Als Admin dieser Organisation in Reziproq anmelden (mit Passkey wie bisher).
2. Einstellungen › Anbindungen › **Microsoft 365** › Verbinden › Verwalten › **Anmeldung über das
   Firmenkonto**: Mandanten-ID, Domain, Standardrolle **Leser**, speichern.
3. **Domain bestätigen** (mit eigener Domain vorher den TXT-Eintrag setzen).
4. Abmelden. Auf der Anmeldeseite `einkauf1@…` eingeben, **Weiter**: Es geht direkt zu Microsoft.
5. Nach der Anmeldung erscheint „Ein Admin prüft gerade deinen Zugang“.
6. Als Admin: Mein Tag › Aufgabe „Neue Person prüfen“ › **Freigeben**.

Gegenproben:

- Ein privates Microsoft-Konto oder ein Konto aus einem anderen Mandanten wird abgelehnt.
- Mit „Nur noch über Microsoft anmelden“ scheitert die Anmeldung mit Passkey für Mails der Domain.

Kommt Reziproq mit „Anmeldung über diesen Anbieter ist nicht eingerichtet“ zurück, fehlt der Claim
`urn:reziproq:idp`: Actions (Schritt 4) und deren Flows prüfen.

## 7. Teil 2: Kalender und Agenda

1. Als `einkauf1` (freigegeben) unter Profil › **Meine Verbindungen** › Microsoft 365 **Verbinden**.
   Es geht zu Microsoft, danach zurück ins Profil mit Stand „verbunden“.
2. `pnpm durchstich:graph einkauf1@…`: sucht den nächsten Termin mit dem Betreff
   „Reziproq Durchstich“ und schreibt eine Beispiel-Agenda in den markierten Block.
3. In Outlook prüfen: Text vor und nach dem Block ist unverändert, die Agenda steht im Block.
   Ein zweiter Aufruf ersetzt nur den Block.

## Ergebnis festhalten

Was funktionierte und was nicht, kommt in diese Datei unter „Ergebnis“, abweichende Aufrufe der
Schnittstellen direkt in den Code (`sso-provisioner.ts`, `microsoft-provider.ts`) mit Test.

## Zurücksetzen

- In Reziproq die Anbindung **Trennen** (löscht die Zugangsdaten sofort).
- In der `.env` `IDENTITY_PROVIDER=fake` und `MICROSOFT_PROVIDER=fake`, API neu starten.
- Bei Microsoft den geheimen Clientschlüssel löschen, in Zitadel das Token des Dienstkontos.
