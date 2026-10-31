# JBP-03 Initiativen und Roadmap

Release 0.3 · baut auf JBP-02 · deckt ab JBP-03, JBP-04

## Ziel

Beide Seiten legen gemeinsame Initiativen mit Ziel, Nutzen für beide, Verantwortlichen und Meilensteinen fest und sehen sie auf einer mehrjährigen Zeitachse.

## Wer darf was

| Rolle | Darf |
|---|---|
| Team-Mitglieder beider Seiten | Initiativen anlegen und bearbeiten, solange der Plan nicht freigegeben ist. |
| Nach der Freigabe (JBP-06) | Nur noch Status und Meilensteine ändern. Inhalte nur über eine neue Version. |
| Leser | Sehen. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `initiative` | `id`, `relationship_id`, `jbp_id`, `title`, `goal`, `benefit_buyer`, `benefit_supplier`, `owner_buyer_user_id`, `owner_supplier_user_id` oder `owner_supplier_name`, `starts_on`, `ends_on`, `status` (`planned`, `running`, `done`, `stopped`) | `shared`, mit Verlauf |
| `initiative_topic` | `initiative_id`, `jbp_topic_id` | `shared` |
| `initiative_milestone` | `initiative_id`, `title`, `due_on`, `done_on` | `shared` |

- PNL-01 erweitert die Initiative später um Hebel und Wirkung.
- Die Initiative zeigt den Betrag nur als Kennzahl mit Verweis (JBP-10).

## Ablauf

1. **Initiativen** (`/…/plan/initiativen`) hat zwei Ansichten, umschaltbar in der Adresse:
   - **Liste:** Titel, Verantwortliche beider Seiten, Zeitraum, Status
   - **Roadmap:** Zeitachse über mehrere Jahre, je Initiative ein Balken, Meilensteine als Rauten
2. **Initiative** (`/…/plan/initiativen/<id>`):
   - Ziel, Nutzen für beide Seiten, Verantwortliche, Meilensteine
   - Herkunfts-Themen
   - Verlauf
   - ab PNL-01 die Kachel Wirkung
3. Neu und Bearbeiten auf eigenen Seiten. Nutzen für beide Seiten ist Pflicht.
4. **Zu Initiative zusammenführen** (`/…/plan/themen/zusammenfuehren`, aus JBP-02 hierher verschoben):
   - Themen beider Seiten auswählen
   - Weiter zur neuen Initiative, vorbefüllt
   - Die Themen stehen danach auf `merged` und sind über `initiative_topic` mit der Initiative verknüpft.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ohne Nutzen für beide Seiten lässt sich keine Initiative speichern.
- [ ] Die Roadmap zeigt alle Initiativen mit richtigen Zeiträumen und Meilensteinen. Ein Klick öffnet die Initiative.
- [ ] Nach der Freigabe sind nur Status und Meilensteine änderbar.
- [ ] Jede Änderung steht im Verlauf, für beide Seiten sichtbar.
- [ ] Die Roadmap ist mit 15 Initiativen über drei Jahre lesbar.
- [ ] Zusammenführen setzt die Themen auf `merged` und verknüpft sie über `initiative_topic` mit der Initiative.

## Nicht Teil dieser Funktion

- Wirkung (PNL-01)
- Scorecard-Kennzahlen (JBP-07)
