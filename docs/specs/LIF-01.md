# LIF-01 Lieferanten einladen

Release 0.2 · baut auf PLT-02, PLT-03, QS-01 · deckt ab LIF-01, LIF-05

## Ziel

Als SRO lade ich den Key Account Manager des Lieferanten ein. Er ist in wenigen Minuten drin, ohne Formulare: nur Name und Rolle, alles andere ist vorbelegt.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Personen des Lieferanten einladen, Einladung zurückziehen. |
| Eingeladene Person | Einladung annehmen, Passkey einrichten, Name und Rolle angeben. |
| Admin des Lieferanten | Weitere eigene Kolleginnen und Kollegen einladen (ab LIF-02). |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `invitation` | `id`, `relationship_id`, `inviting_org_id`, `email`, `role` (`admin`, `member`), `token_hash`, `expires_at`, `accepted_at` | `org_private` der einladenden Organisation |

- **Beim Annehmen:**
  - Hat die Lieferantenorganisation noch keine Zitadel-Organisation, legt die API sie über die Zitadel-Verwaltungsschnittstelle an und verknüpft sie.
  - Die Person wird dort angelegt und ist danach `app_user` der Lieferantenorganisation.
  - Die erste Person wird Admin.
- Die Zugangsdaten des Zitadel-Dienstkontos liegen nur in der Umgebung bzw. im Secrets Manager, nie im Code.
- Mit der ersten Annahme wechselt die Beziehung von `draft` auf `active`.
- Ein Link ist sieben Tage gültig.

## Teilung

Zwei Pull Requests:

- **LIF-01a:** Einladung und Annahme mit nachgebautem Zitadel.
- **LIF-01b:** Anlage der Zitadel-Organisation über die Verwaltungsschnittstelle.

## Ablauf

1. **Lieferant › Beziehung › Team** zeigt den Knopf **Lieferant einladen**. Er öffnet `/…/team/einladen`:
   - E-Mail, vorgeschlagen aus den Kontakten
   - kurze persönliche Nachricht
   - Knopf **Einladen**
2. Die Mail (QS-01) nennt Kunde und SRO und enthält den Link.
3. **Einladung annehmen** (`/einladung/<token>`) in drei Schritten:
   1. Begrüßung mit Kunde, SRO und dem, was den Lieferanten erwartet
   2. Name und Rolle
   3. Passkey einrichten über Zitadel
4. Danach landet die Person auf ihrer Startseite (LIF-02).
5. Auf der Team-Seite des Käufers erscheint sie als „aktiv“.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Vom Klick auf den Link bis zur ersten Aktion vergehen unter fünf Minuten (von Hand gemessen, im Pull Request notiert).
- [ ] Die erste Annahme legt die Zitadel-Organisation an, verknüpft sie und setzt die Beziehung auf `active`.
- [ ] Ein abgelaufener oder schon benutzter Link zeigt einen klaren Hinweis.
- [ ] Die eingeladene Person gibt nur Name und Rolle ein.
- [ ] Ein Lieferant mit zwei Kunden hat danach eine Organisation und zwei aktive Beziehungen.
- [ ] Der Test mit nachgebautem Zitadel läuft ohne Internet.

## Nicht Teil dieser Funktion

- Arbeitsbereich des Lieferanten (LIF-02)
- Firmen-Login des Lieferanten (nach 1.0)
