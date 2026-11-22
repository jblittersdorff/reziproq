# Ergänzungen zu glossar.md, rechte.md, umsetzungsplan.md

## glossar.md

| Begriff | Bedeutung |
|---|---|
| Anbindung | Verbindung von Reziproq zu einem System des Kunden (Microsoft 365, Google Workspace, Import-API …). Technisch: `connection`. |
| Eingangsadresse | `termine@<kunde>.reziproq.de` und `notizen@<kunde>.reziproq.de`. Einladungen und weitergeleitete Mails landen darüber in Reziproq. |
| Outlook-Add-in | Erweiterung in Outlook. Speichert Termine als Aktivität und legt Mails beim Lieferanten ab. |
| Neu eingegangen | Liste in Mein Tag mit Terminen und Mails, die Reziproq nicht eindeutig zuordnen konnte. |
| Transkript | Text einer Besprechung aus Teams, Meet oder Upload. Nie Audio oder Video. Rohtext wird nach der Aufbewahrungsfrist gelöscht. |
| Betriebsvereinbarung | Bestätigung des Kunden, dass die Übernahme von Transkripten mit dem Betriebsrat geregelt ist. Voraussetzung für Transkripte. |
| Datenmodell Einkauf | Einheitliche Objektarten für Datei-Import und Import-API: Lieferant, Warengruppen-Zuordnung, Spend, Bestellzeile, Wareneingang, Gutschrift, Vertrag, Qualitätsmeldung. |

## rechte.md

| Recht | Admin | SRO | Commodity Manager | Käufer | Lieferant |
|---|---|---|---|---|---|
| `integration.manage` | ✓ | – | – | – | – |
| `integration.connect_own` (Kalender, Add-in) | ✓ | ✓ | ✓ | ✓ | – |
| `inbound.assign` (eigene Eingänge) | ✓ | ✓ | ✓ | ✓ | – |
| `inbound.assign_relationship` (Eingänge zu eigenen Lieferanten) | ✓ | ✓ | – | – | – |
| `mail.file` | ✓ | ✓ | ✓ | ✓ | – |
| `transcript.settings` | ✓ | – | – | – | – |
| `transcript.opt_in` (je Termin) | – | ✓ | – | Organisator | – |
| `transcript.read_raw` | – | ✓ | – | nach Freigabe | – |
| `api_key.manage` | ✓ | – | – | – | – |

Regeln: Daten aus Anbindungen sind immer `org_private`. Der Lieferant sieht nur, was ein Mensch teilt.

## umsetzungsplan.md

Neuer Abschnitt **Release I1 Anbindungen**, nach Lieferantenmanagement und vor dem Warengruppenmanagement:

| Schritt | Spec | Hängt ab von |
|---|---|---|
| I1.1 | IN-01 Integrationsschicht | 1.0 |
| I1.2 | IN-07 Import-API | IN-01, KI-15 |
| I1.3 | IN-02 Anmeldung Microsoft und Google | IN-01 |
| I1.4 | IN-03 Termine aus Outlook und Google | IN-01, IN-02, KI-07 |
| I1.5 | IN-04 Mails ablegen | IN-03 |
| I1.6 | IN-06 Benachrichtigungen | IN-01, KI-16 |
| I1.7 | IN-05 Transkripte | IN-03, KI-17 |

Begründung der Reihenfolge: Import-API zuerst, weil Pilotkunden Daten brauchen, bevor Termine Wert stiften. Transkripte zuletzt, weil Betriebsrat und Mandantenfreigabe am längsten dauern.

Stufe 2 (eigene Specs später): Slack, Zoom, Gmail-Add-on, SharePoint und Drive, SFTP, SAP S/4HANA, Qualitätsdaten, SCIM, lesende API und Webhooks.
