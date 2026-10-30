# AUTH-01 Login und erste Kette aus Datenbank, API und Web

## Ziel: Ich melde mich mit meinem Firmenkonto über Zitadel an und sehe, dass die App mich kennt und die API erreichbar ist.

## Wer darf was: Käufer, Lieferant, Rolle (SRO, Sponsor, Mitglied, Leser, Controlling)

- Jede Person mit gültigem Zitadel-Access-Token des Projekts darf GET /api/me aufrufen.
- GET /api/health ist öffentlich.
- Alle anderen Routen sind ohne gültiges Token gesperrt (401). Ausnahmen nur ausdrücklich mit @Public().
- Rollen und Organisationszugehörigkeit folgen in einer eigenen Anforderung.

## Daten: welche Felder; was ist käuferprivat, geteilt oder lieferantenprivat

- Tabelle organization: id (UUID, uuidv7()), name, created_at.
- Tabelle app_user: id (sub aus dem Token), name, email, created_at, updated_at.
  - Name und E-Mail kommen vom Userinfo-Endpunkt des Issuers.
  - Dessen Adresse und die der Schlüssel (jwks_uri) liest die API aus
    ZITADEL_ISSUER/.well-known/openid-configuration.
  - Jeder Aufruf von /api/me aktualisiert sie.
  - Personen gehören keiner einzelnen Beziehung. Die Zuordnung zu Organisationen und Row-Level
    Security folgen mit der Mandanten-Session.
- Die Organisation ist der Mandant selbst, also weder käuferprivat noch geteilt oder lieferantenprivat.
- Row-Level Security kommt mit der Mandanten-Session; bis dahin liest und schreibt keine Route die Tabelle organization.

## Ablauf: Schritte aus Nutzersicht

1. Die Startseite zeigt ohne Login den Knopf „Anmelden“.
2. Die App leitet zu Zitadel weiter: Authorization Code mit PKCE über die Bibliothek oidc-client-ts,
   Scopes openid profile email.
3. Zitadel leitet zurück nach /auth/callback; die App tauscht den Code gegen Tokens.
4. GET /api/me ruft mit demselben Token den Userinfo-Endpunkt auf und speichert Name und E-Mail in
   app_user. Die Startseite zeigt die gespeicherten Werte und „API: ok“, wenn GET /api/health antwortet.
5. „Abmelden“ beendet die Sitzung bei Zitadel und kehrt zur Startseite zurück.

Voraussetzungen in Zitadel:

- Die App ist vom Typ „User Agent“ mit PKCE.
- Der Token-Typ ist JWT.
- Die Redirect-URI ist <Adresse>/auth/callback, die Post-Logout-URI ist <Adresse>.
- Die Projekt-ID steht ohne weiteren Scope in der Audience, weil Zitadel sie von sich aus einträgt.

## Fertig, wenn: prüfbare Kriterien, je Kriterium ein Test

- GET /api/health ohne Login gibt 200 und {"status":"ok"}. Test: apps/api/src/modules/health/health.test.ts
- GET /api/me ohne Token gibt 401. Test: apps/api/src/modules/me/me.test.ts
- GET /api/me mit gültigem Token holt Name und E-Mail mit demselben Token vom Userinfo-Endpunkt,
  speichert sie in app_user und liefert sie aus der Datenbank. Test: me.test.ts
- Ein zweiter Aufruf aktualisiert Name und E-Mail; created_at bleibt. Test: me.test.ts
- 401 gibt es bei (Test: me.test.ts):
  - falschem Issuer
  - falscher Audience
  - abgelaufenem Token
  - fremder Signatur
  - kaputtem Token
  - Token ohne sub
  - Ablehnung durch den Userinfo-Endpunkt
  - Userinfo zu einer anderen Person
- 502 gibt es in diesen Fällen (Test: me.test.ts):
  - Userinfo liefert keinen Namen oder keine E-Mail.
  - Zitadel meldet einen Fehler.
  - Das Discovery-Dokument gehört zu einem anderen Issuer.
- Die Tests brauchen keine Verbindung zu Zitadel und keine .env.
  - Sie stellen Tokens mit einem eigenen Schlüsselpaar aus.
  - Discovery, Schlüssel und Userinfo bilden sie als lokalen Server nach.
  - Sie brauchen die Datenbank mit angewendeten Migrationen.
- Die Tabellen organization und app_user haben ihre Spalten. Test: packages/db/src/schema/*.test.ts
- Login mit PKCE, Anzeige von Name und „API: ok“ sowie Abmelden. Test: apps/web/e2e/home.spec.ts (Zitadel simuliert)

## Nicht Teil dieser Funktion

- Rollen, Rechteprüfung mit can(), Mandanten-Session und Row-Level Security
- Anlegen von Organisationen und Zuordnung von Personen zu Organisationen
- Login im Betrieb auf AWS (infra/)
