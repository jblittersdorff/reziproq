# LIF-03 Eigene Sicht des Lieferanten

Release 0.2 · baut auf LIF-02

## Ziel

Als Key Account Manager halte ich für jeden Kunden fest, wie ich die Beziehung sehe und was wir erreichen wollen. Der Kunde sieht davon nichts.

## Wer darf was

| Rolle | Darf |
|---|---|
| Nutzer des Lieferanten | Eigene Sicht lesen und bearbeiten. |
| Käufer | Nie, nicht einmal, dass es Einträge gibt. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `supplier_account_plan` | `relationship_id`, `summary`, `own_view_of_customer` (Text), `customer_importance` (1 bis 5), `updated_at` | `supplier_private` |
| `supplier_account_objective` | `relationship_id`, `text`, `owner_user_id`, `target_year` | `supplier_private` |

- Den eigenen Nutzen aus Initiativen ergänzt PNL-07 als `supplier_benefit`.

## Ablauf

1. **Eigene Sicht** (`/kunden/<beziehung>/eigene-sicht`):
   - Kennzeichen „Nur für Sie sichtbar“
   - Abschnitte Zusammenfassung, Sicht auf den Kunden, eigene Ziele
2. Bearbeiten auf eigenen Seiten je Abschnitt.

## Umsetzung

- `supplier_account_plan` und `supplier_account_objective` sind die ersten Tabellen der Ebene
  `supplier_private`. Der Plan hat keine Eindeutigkeit je Beziehung (die Layer-Tests legen mehrere
  Zeilen an); der Dienst liest und ändert die jüngste.
- Endpunkte nur unter `/kunden/<beziehung>/eigene-sicht`, im Kontext des Kunden; Käufer bekommen
  403, und ihre Mandanten-Session sieht weder Zeilen noch Anzahlen. Der Verlauf ist intern.
- Lesen mit `kunden.sehen`, Bearbeiten mit dem neuen Recht `eigene_sicht.bearbeiten` (Admin und
  Nutzer). Die Rechte-Matrix prüft es nicht mit Käufern; `lif-03.test.ts` prüft es mit
  Lieferanten-Nutzern.
- Ziele lassen sich ändern und löschen; verantwortlich ist optional eine Person der eigenen
  Organisation.

## Fertig, wenn

Je Kriterium ein Test.

- [x] Der Käufer bekommt auf allen Endpunkten der eigenen Sicht keine Zeile und keine Anzahl (PLT-04).
- [x] Zwei Lieferanten-Nutzer derselben Organisation sehen dieselbe eigene Sicht.
- [x] Jede Seite trägt das Kennzeichen „Nur für Sie sichtbar“.

## Nicht Teil dieser Funktion

- Nutzen aus Initiativen (PNL-07)
- Export (QS-03)
