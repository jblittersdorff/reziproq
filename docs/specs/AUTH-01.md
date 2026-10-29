# AUTH-01 Login und erste Kette aus Datenbank, API und Web

## Ziel: Ich melde mich mit meinem Firmenkonto über Zitadel an und sehe, dass die App mich kennt und die API erreichbar ist.

## Wer darf was: Käufer, Lieferant, Rolle (SRO, Sponsor, Mitglied, Leser, Controlling)

- Jede Person mit gültigem Zitadel-Access-Token des Projekts darf GET /api/me aufrufen.
- GET /api/health ist öffentlich.
- Alle anderen Routen sind ohne gültiges Token gesperrt (401). Ausnahmen nur ausdrücklich mit @Public().
- Rollen und Organisationszugehörigkeit folgen in einer eigenen Anforderung.

## Daten: welche Felder; was ist käuferprivat, geteilt oder lieferantenprivat

- Tabelle organization: id (UUID, uuidv7()), name, created_at.
- Die Organisation ist der Mandant selbst, also weder käuferprivat noch geteilt oder lieferantenprivat.
- Row-Level Security kommt mit der Mandanten-Session; bis dahin liest und schreibt keine Route die Tabelle.
- Name und E-Mail werden nicht gespeichert, nur aus dem Token gelesen.

## Ablauf: Schritte aus Nutzersicht

1. Die Startseite zeigt ohne Login den Knopf „Anmelden“.
2. Die App leitet zu Zitadel weiter (Authorization Code mit PKCE, Bibliothek oidc-client-ts).
3. Zitadel leitet zurück nach /auth/callback; die App tauscht den Code gegen Tokens.
4. Die Startseite zeigt Name und E-Mail aus GET /api/me und „API: ok“, wenn GET /api/health antwortet.
5. „Abmelden“ beendet die Sitzung bei Zitadel und kehrt zur Startseite zurück.

Voraussetzungen in Zitadel:

- Die App ist vom Typ „User Agent“ mit PKCE.
- Der Token-Typ ist JWT.
- Die Redirect-URI ist <Adresse>/auth/callback, die Post-Logout-URI ist <Adresse>.
- Zitadel schreibt Name und E-Mail nicht von sich aus ins Access Token. Eine Action am Auslöser
  „Complement Token / Pre access token creation“ ergänzt die Claims name und email.

## Fertig, wenn: prüfbare Kriterien, je Kriterium ein Test

- GET /api/health ohne Login gibt 200 und {"status":"ok"}. Test: apps/api/src/modules/health/health.test.ts
- GET /api/me ohne Token gibt 401. Test: apps/api/src/modules/me/me.test.ts
- GET /api/me mit gültigem Token gibt Name und E-Mail. Test: me.test.ts
- Diese Tokens geben 401 (Test: me.test.ts):
  - falscher Issuer
  - falsche Audience
  - abgelaufenes Token
  - fremde Signatur
  - kaputtes Token
  - Token ohne Name oder E-Mail
- Die Tests laufen ohne Zitadel und ohne .env. Dafür stellen sie Tokens mit einem eigenen Schlüsselpaar aus.
- Die Tabelle organization hat die drei Spalten. Test: packages/db/src/schema/organization.test.ts
- Login mit PKCE, Anzeige von Name und „API: ok“ sowie Abmelden. Test: apps/web/e2e/home.spec.ts (Zitadel simuliert)

## Nicht Teil dieser Funktion

- Rollen, Rechteprüfung mit can(), Mandanten-Session und Row-Level Security
- Anlegen von Organisationen und Zuordnung von Personen zu Organisationen
- Login im Betrieb auf AWS (infra/)
