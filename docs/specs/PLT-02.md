# PLT-02 Organisationen, Nutzer und Mandanten-Session

Release 0.1 · Reihenfolge 4 · baut auf PLT-01 · ersetzt die Fassung vom 29.10.2026 (Lieferantenliste ist jetzt in PLT-03)

## Ziel

Jede Firma ist in Reziproq eine Organisation, und jeder Nutzer gehört zu genau einer. Bei jeder Anfrage weiß die Datenbank, für wen sie arbeitet, und gibt nur dessen Daten heraus.

## Wer darf was

| Rolle | Darf |
|---|---|
| Nutzer einer Organisation | Den Namen der eigenen Organisation und deren Mitglieder (Name, E-Mail) in den Einstellungen sehen. |
| Admin der Organisation | Wie oben. Rollen ändern kommt mit PLT-05. Bis dahin gilt jeder Nutzer als Admin. |
| Nutzer ohne Organisation | Sieht nur den Hinweis „Deine Organisation ist noch nicht freigeschaltet. Wende dich an deinen Ansprechpartner.“ Die API liefert ihm nur `/me` und `/health`. |
| Reziproq-Team (ihr) | Legt Organisationen über ein Skript an und verknüpft sie mit Zitadel. Eine Oberfläche dafür gibt es nicht. |

## Daten

| Tabelle | Felder | Ebene |
|---|---|---|
| `organization` (erweitern) | `id`, `name`, `country` (ISO-Code), `vat_id` (USt-IdNr., optional, eindeutig), `duns` (optional, eindeutig), `zitadel_org_id` (optional, eindeutig), `created_at` | global: Name und Land darf jeder sehen, der mit der Organisation in Beziehung steht |
| `organization_feature` (neu) | `organization_id`, `feature`, `enabled_at` | Freischalt-Tabelle. Erster Eintrag: `buyer` (Käuferfunktionen). Später Add-ons. |
| `app_user` (erweitern) | `organization_id` (darf leer sein) | Jeder Nutzer gehört zu höchstens einer Organisation |

- Eine Organisation hat **keinen festen Typ**. Ob sie Käufer oder Lieferant ist, ergibt sich aus der jeweiligen Beziehung (PLT-03). Ob sie Käuferfunktionen nutzen darf, steht in `organization_feature`. So funktionieren Firmen, die zugleich Kunde und Lieferant sind, ohne Sonderfall.
- **Zuordnung beim Login:** Jede Kundenfirma ist in Zitadel eine eigene Organisation. Die Web-App fordert zusätzlich den Scope `urn:zitadel:iam:user:resourceowner` an. Die API liest daraus die Zitadel-Organisation des Nutzers und setzt `app_user.organization_id` auf die passende `organization`. Gibt es keine passende, bleibt das Feld leer.
- **Mandanten-Session:** Jede Anfrage der API läuft in einer Datenbank-Transaktion, die zuerst `app.user_id` und `app.org_id` per `SET LOCAL` setzt. Alle Tabellen mit Mandantendaten haben Row-Level Security mit `FORCE ROW LEVEL SECURITY`. Die API verbindet sich mit einer Datenbankrolle, die nicht Eigentümer der Tabellen ist. Migrationen laufen mit einer eigenen Rolle.
- Datenzugriff gibt es nur über diese Session. Es gibt keinen Weg an ihr vorbei, auch nicht in Jobs und Skripten (dort mit ausdrücklich gesetzter Organisation).

### Beispieldaten (nur lokal)

`pnpm db:seed` legt an, idempotent und mit Abbruch bei `NODE_ENV=production`:

- „Test-OEM (Demo)“ mit Feature `buyer`
- „Zweit-OEM (Demo)“ mit Feature `buyer`
- „Test-Lieferant (Demo)“ ohne Feature `buyer`
- Für Tests je Organisation zwei Nutzer mit erfundenen IDs.

Skript `pnpm org:link "<Name>" <zitadel-org-id>` verknüpft eine Organisation mit Zitadel.

## Ablauf

**Einmalig in Zitadel (von Hand):**

1. Zwei Organisationen anlegen: „Test-OEM (Demo)“ und „Test-Lieferant (Demo)“.
2. In jeder zwei Testnutzer anlegen (Gmail-Plus-Adressen). Eure bisherigen Testnutzer kommen in den Test-OEM.
3. Die Resource ID jeder Organisation kopieren und lokal mit `pnpm org:link` verknüpfen.
4. Lehnt Zitadel die Anmeldung eines Nutzers aus einer anderen Organisation ab, im Projekt „Reziproq Plattform“ einen Project Grant für diese Organisation anlegen.

**In der App:**

1. Ein Nutzer des Test-OEM meldet sich an. Im Nutzer-Menü steht „Test-OEM (Demo)“.
2. Unter Einstellungen → Organisation sieht er Name und Land der Organisation sowie die Mitglieder mit Name und E-Mail.
3. Ein Nutzer, dessen Zitadel-Organisation nicht verknüpft ist, sieht nur den Hinweis.
4. Ein Nutzer des Test-Lieferanten sieht in 0.1 einen Hinweis „Der Lieferantenzugang kommt bald.“ Ihm fehlt das Feature `buyer`, und die Lieferantenansicht kommt mit 0.2.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] `pnpm db:seed` legt Test-OEM, Zweit-OEM und Test-Lieferant mit je zwei Nutzern an. Ein zweiter Lauf erzeugt keine Duplikate. Bei `NODE_ENV=production` bricht er ab.
- [ ] Beim Login wird `organization_id` aus der Zitadel-Organisation gesetzt. Bei unbekannter Organisation bleibt das Feld leer.
- [ ] Ein Nutzer ohne Organisation bekommt von jeder Route außer `/me` und `/health` 403 und sieht den Hinweis.
- [ ] Jede Anfrage setzt `app.user_id` und `app.org_id`. Ein Test ruft eine Tabelle ohne gesetzte Session ab und bekommt keine Zeilen.
- [ ] Die API-Datenbankrolle ist nicht Eigentümer der Tabellen. Ein Test prüft, dass RLS mit `FORCE` auf jeder Mandantentabelle aktiv ist.
- [ ] Ein Nutzer des Test-OEM sieht in der Mitgliederliste nur Mitglieder des Test-OEM.
- [ ] Ein Nutzer ohne Feature `buyer` sieht die Käuferbereiche nicht.
- [ ] `vat_id`, `duns` und `zitadel_org_id` sind jeweils eindeutig, wenn gesetzt.

## Nicht Teil dieser Funktion

- Rollen und Rechte (PLT-05)
- Beziehungen und Lieferantenliste (PLT-03)
- Organisationen in der Oberfläche anlegen oder einladen
- Nutzer einladen. Bis Release 0.2 legt ihr sie in Zitadel an.
- Lieferantenansicht und Kundenwechsler (LIF-02)
