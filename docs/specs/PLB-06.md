# PLB-06 Kontaktpunkte

Release 0.2 · baut auf PLB-03, PLT-07 (Kontakte)

## Ziel

Als SRO sehe ich, wer bei uns mit wem beim Lieferanten auf welcher Ebene, in welchem Format und wie oft spricht. Lücken zu den vereinbarten Formaten fallen sofort auf.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Team-Mitglieder | Kontaktpunkte anlegen, ändern, als geprüft markieren. |
| Käufer: alle mit Zugriff | Sehen. |
| Lieferant | Sieht Kontaktpunkte nur, wenn der SRO sie teilt. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `touchpoint` | `id`, `relationship_id`, `owner_org_id`, `visibility` (`internal` Standard, `shared`), `buyer_user_id` oder `buyer_name`, `buyer_level`, `supplier_contact_id` oder `supplier_name`, `supplier_level`, `format`, `cadence`, `notes` | `shared` |
| `touchpoint_review` | `relationship_id`, `cycle_id`, `reviewed_by`, `reviewed_at` | `buyer_private` |

- **Ebenen:** Geschäftsleitung, Management, Fachebene.
- `supplier_contact_id` verweist auf die Kontakte aus PLT-07. Diese sind käuferprivat, daher erlaubt nur eine interne Zeile diesen Verweis. Geteilte Zeilen nutzen `supplier_name`.

## Ablauf

1. **Lieferant › Beziehung › Kontaktpunkte** (`/lieferanten/<id>/beziehung/kontaktpunkte`):
   - **Bild:** links unsere Ebenen, rechts die des Lieferanten, Linien für jeden Kontaktpunkt, beschriftet mit Format und Takt.
   - **Liste** darunter.
2. Neu und Bearbeiten öffnen eigene Seiten.
3. **Lücken:** Ein Format aus den Spielregeln (PLB-03) ohne passenden Kontaktpunkt steht oben als Hinweis, z. B. „Strategiedialog der Geschäftsleitungen fehlt“.
4. **Kontaktpunkte geprüft** setzt im Zyklus den Schritt Kontaktpunkte auf erledigt (ZYK-01).
5. **Teilen** setzt einzelne Kontaktpunkte auf geteilt, mit Bestätigung auf der Seite.

## Umsetzung

- `touchpoint` ist geteilt (Standard intern), `touchpoint_review` käuferprivat und nur anfügbar,
  eindeutig je Zyklus. Personen stehen als ID und Name ohne Fremdschlüssel; der Name ist ein
  Schnappschuss, damit eine geteilte Zeile ohne die privaten Tabellen lesbar ist.
- `supplier_contact_id` hat keinen Fremdschlüssel (geteilte Tabelle). Die Prüfung
  `touchpoint_contact_internal` erlaubt ihn nur auf internen Zeilen; der Dienst prüft, dass der
  Kontakt zur Beziehung gehört. **Teilen** setzt die Zeile auf geteilt und entfernt den Verweis, der
  Name bleibt.
- **Lücke:** ein Format der jüngsten freigegebenen oder geteilten Spielregeln, für das kein
  Kontaktpunkt mit gleichem Namen (deutsch oder englisch, ohne Groß- und Kleinschreibung) besteht.
  Das Formular bietet die Formate der Spielregeln an und übernimmt Ebene und Takt als Vorschlag.
- **Bild:** je Kontaktpunkt eine Zeile; die Ebenen sind Spalten (Geschäftsleitung außen), die
  Linie trägt Format und Takt. So überdecken sich Beschriftungen auch bei 20 Kontaktpunkten nie;
  schmal steht die Beschriftung unter der Linie. Bild und Liste haben dieselbe Reihenfolge.
- Bearbeiten: Recht `kontaktpunkte.bearbeiten` (Käufer, Admin oder Team, nie Teamrolle Leser).
  Der Lieferant liest unter `/kunden/<beziehung>/beziehung/kontaktpunkte` nur geteilte.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Bild und Liste zeigen dieselben Kontaktpunkte. Das Bild ist mit 20 Kontaktpunkten lesbar.
- [x] Ein vereinbartes Format ohne Kontaktpunkt erscheint als Lücke.
- [x] Geprüft erledigt den Zyklus-Schritt Kontaktpunkte.
- [x] Interne Kontaktpunkte sieht der Lieferant nie, geteilte nach Aktivierung schon (PLT-04).
- [x] Eine geteilte Zeile kann nicht auf einen käuferprivaten Kontakt verweisen.

## Nicht Teil dieser Funktion

- Kontaktpunkte aus dem Kalender (nach 1.0)
- Hinweis bei verfehltem Takt (FS-01)
