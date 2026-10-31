# PLT-13 Betreiber-Zugang zu Kunden

Release 0.1 · baut auf PLT-02 (Datentrennung), PLT-11 (Rahmen) und PLT-12 (Prompt-Fenster) auf · umgesetzt mit PR #7 · **UMB-01 passt sie an die Specs für 1.0 an:** eigene Seite statt Fenster, Flag `is_operator` statt Zitadel-Rolle, Protokoll `support_access_log`, Header `x-reziproq-support-org`

## Ziel

Als Mitarbeiter von Reziproq wechsle ich in einen Kunden und sehe die App genau so wie er, um ihm zu helfen. Jeder Zugriff wird protokolliert.

## Wer darf was

| Rolle                                          | Darf                                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Betreiber (`betreiber`, nur Team von Reziproq) | Liste der Käufer-Organisationen sehen, in einen Kunden wechseln und dort alles sehen, was eine Käufer-Rolle sieht. Nur lesen, solange es nur lesende Funktionen gibt. |
| Käufer: Admin, Nutzer, Leser, Controlling      | Unverändert. Niemals Daten anderer Kunden, auch nicht als Admin des eigenen Kunden.                                                                                   |
| Lieferant                                      | Nicht Teil dieser Funktion.                                                                                                                                           |

Die Rolle `betreiber` wird nur im Projekt von Reziproq vergeben, nie über eine Projektfreigabe an Kunden.

## Daten

| Tabelle                   | Felder                                                                                                                                | Ebene                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `betreiber_zugriff` (neu) | `id`, `nutzer_id`, `organization_id` (leer bei der Kundenliste), `aktion` (Methode und Pfad, z. B. `GET /api/suppliers`), `zeitpunkt` | Betrieb, für keinen Kunden lesbar |

- Der gewählte Kunde reist mit jeder Anfrage im Header `x-reziproq-kunde`. Ohne die Rolle `betreiber` lehnt die API diesen Header mit 403 ab.
- Row-Level Security bleibt aktiv: Die API setzt den gewählten Kunden in der Mandanten-Session. Innerhalb eines Kunden ist alles getrennt wie für dessen eigene Nutzer.
- Die Kundenliste zeigt nur Name und Land der Käufer-Organisationen.

## Ablauf

1. Ein Betreiber öffnet das Nutzer-Menü und wählt „Kunde wechseln“.
2. Ein Fenster zeigt die Käufer-Organisationen. Ein Klick wechselt in den Kunden und öffnet dessen Übersicht.
3. Oben steht auf jeder Seite „Betreiber-Ansicht: <Kunde>. Alle Zugriffe werden protokolliert.“ mit dem Knopf „Verlassen“.
4. Lieferanten, Kacheln und Prompt-Fenster zeigen die Daten dieses Kunden.
5. „Verlassen“ beendet die Betreiber-Ansicht. Der Wechsel gilt nur im aktuellen Browser-Tab.

Voraussetzung in Zitadel: Projektrollen `admin`, `nutzer`, `leser`, `controlling`, `betreiber`. Die Web-App fordert die Rollen beim Login mit dem Scope `urn:zitadel:iam:org:projects:roles` an.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Nur `betreiber` sieht „Kunde wechseln“ und die Kundenliste; alle anderen bekommen 403, auch `admin`.
- [ ] Ein Betreiber im Kunden B sieht genau die Lieferanten und Werte von B, nie die eines anderen Kunden.
- [ ] Der Header `x-reziproq-kunde` ohne Rolle `betreiber` gibt 403; ein unbekannter Kunde oder ein Lieferant 404; eine ungültige ID 400.
- [ ] Jeder Zugriff in einem Kunden und jeder Abruf der Kundenliste steht in `betreiber_zugriff`; normale Zugriffe nicht.
- [ ] `/me` und die Kachel „Lieferanten“ zeigen in der Betreiber-Ansicht den gewählten Kunden.
- [ ] Das Prompt-Fenster antwortet in der Betreiber-Ansicht mit den Daten des gewählten Kunden.
- [ ] Die Hinweisleiste steht auf jeder Seite der Betreiber-Ansicht; „Verlassen“ beendet sie.
- [ ] Die Migration legt `betreiber_zugriff` an; die Rolle `reziproq_app` kann sie nicht lesen.

## Nicht Teil dieser Funktion

- Freigabe des Betreiber-Zugangs durch den Kunden, auch befristet (später möglich)
- Ansicht des Protokolls in der Oberfläche
- Ändern von Daten in der Betreiber-Ansicht
- Betreiber-Zugang für Lieferanten-Organisationen
