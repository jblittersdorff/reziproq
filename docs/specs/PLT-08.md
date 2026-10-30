# PLT-08 Audit-Trail

Release 0.1 · Reihenfolge 6 · baut auf PLT-04 · steht vor PLT-03, damit Beziehungen vom ersten Tag an im Verlauf landen

## Ziel

Bei jedem geteilten Objekt sehen beide Seiten, wer wann was geändert hat. Niemand kann diesen Verlauf ändern oder löschen, auch kein Admin.

## Wer darf was

| Rolle | Darf |
|---|---|
| Wer ein Objekt sehen darf | Dessen Verlauf sehen, mit denselben Ebenen wie das Objekt selbst (PLT-04). |
| Alle, auch Admins und die API selbst | Einträge nur anlegen, nie ändern oder löschen. |
| Lieferant | Sieht den Verlauf geteilter Objekte, sobald er Zugang hat (0.2). |

## Daten

- Tabelle `audit_event`, Ebene `shared` mit `owner_org_id` und `visibility`. Die Sichtbarkeit folgt dem Objekt:
  - Einträge zu geteilten Objekten sehen beide Seiten (`shared`).
  - Einträge zu internen Objekten wie Rollen oder internem Team sieht nur die eigene Organisation (`internal`).
- Felder: `id`, `occurred_at`, `actor_user_id`, `actor_org_id`, `relationship_id` (wenn vorhanden), `object_type`, `object_id`, `action` (`created`, `updated`, `ended`, `shared`, `approved`), `changes` (je Feld alter und neuer Wert).
- Der Verlauf geteilter Objekte enthält nur geteilte Felder. Private Werte landen nie in einem geteilten Verlaufseintrag.
- Der Eintrag entsteht in derselben Transaktion wie die Änderung. Scheitert einer von beiden, scheitern beide.
- Die Datenbankrolle der API hat auf `audit_event` nur `INSERT` und `SELECT`. Ein Trigger blockiert zusätzlich `UPDATE` und `DELETE`.
- **Outbox:** In derselben Transaktion entsteht ein Eintrag in `outbox_event` (Typ, Objekt, Zeitpunkt, verarbeitet ja/nein). Noch liest ihn niemand. Später verschicken E-Mails (QS-01) und Erinnerungen von hier aus.
- Personen erscheinen im Verlauf mit Namen, weil Nachvollziehbarkeit das verlangt. Es gibt keine Auswertung je Person (NF-03).

## Ablauf

1. Ein Entwickler markiert ein Objekt in der API als „mit Verlauf“. Ab dann schreibt jede Änderung über den Dienst automatisch Verlauf und Outbox.
2. `GET /audit?object_type=…&object_id=…` liefert den Verlauf, neueste zuerst, mit denselben Sichtrechten wie das Objekt.
3. Ein wiederverwendbarer Baustein **Verlauf** zeigt die Einträge als ruhige Liste: Datum und Uhrzeit, Name, Organisation, was geändert wurde (z. B. „Status: angelegt → aktiv“).
4. Der Baustein steht im Styleguide (PLT-10) mit Beispieleinträgen. Erster echter Einsatz ist das Detail-Panel einer Beziehung (PLT-03).

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Jede Änderung an einem Objekt mit Verlauf erzeugt genau einen Eintrag mit Person, Organisation, Zeit, Aktion und alten und neuen Werten.
- [ ] `UPDATE` und `DELETE` auf `audit_event` scheitern, auch mit der Rolle der API.
- [ ] Scheitert die Änderung, entsteht kein Eintrag. Scheitert der Eintrag, wird die Änderung zurückgerollt.
- [ ] Ein Nutzer des Zweit-OEM sieht keinen Verlaufseintrag des Test-OEM (Test-Gerüst aus PLT-04).
- [ ] Ein geteilter Verlaufseintrag enthält keine Felder aus privaten Tabellen.
- [ ] Zu jedem Verlaufseintrag gibt es einen Outbox-Eintrag.
- [ ] Der Baustein „Verlauf“ steht im Styleguide und zeigt Einträge, leeren Zustand und Ladezustand.

## Nicht Teil dieser Funktion

- Verarbeitung der Outbox (E-Mails mit QS-01, Erinnerungen mit QBR-02)
- Versionen ganzer Dokumente (JBP-04) und Stände der Segmentierung (SEG-05)
- Export des Verlaufs (QS-03)
- Verlauf für käuferprivate Fachwerte wie Spend. Ob sie einen internen Verlauf bekommen, entscheidet die jeweilige Spec.
