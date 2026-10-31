# PLT-04 Drei Datenebenen

Release 0.1 · baut auf PLT-02 · Grundlage für jede weitere Tabelle

## Ziel

Jedes Objekt in Reziproq ist eindeutig käuferprivat, geteilt oder lieferantenprivat. Die Datenbank selbst verhindert, dass ein Lieferant Internes des Käufers sieht oder Kunde A etwas von Kunde B.

## Wer darf was

| Ebene | Sieht |
|---|---|
| käuferprivat | Nur Nutzer der Käuferorganisation dieser Beziehung |
| lieferantenprivat | Nur Nutzer der Lieferantenorganisation dieser Beziehung |
| geteilt | Die Eigentümer-Organisation immer. Die andere Seite nur, wenn die Zeile freigegeben ist und die Beziehung aktiv ist. |
| global | Stammdaten wie Name und Land einer Organisation, für jede Organisation, die mit ihr in Beziehung steht |

- Ein Lieferantennutzer arbeitet immer im Kontext genau eines Kunden. Listen mischen nie Daten mehrerer Kunden.
- Innerhalb einer Organisation entscheidet `can()` (PLT-05), wer was sieht, z. B. welche BU-Bewertung. Die Datenbank zieht nur die grobe Grenze zwischen Organisationen.

## Daten

- **Register:** Eine Datei im Code ordnet jede Tabelle genau einer Art zu. Neue Tabellen ohne Eintrag lassen die Tests scheitern.
  - `buyer_private`: nur die Käuferseite der Beziehung
  - `supplier_private`: nur die Lieferantenseite der Beziehung
  - `org_private`: jede Zeile nur für die Organisation in `org_id`. Das gilt z. B. für Einstellungen je Seite einer Beziehung, internes Team, Business Units und Warengruppen.
  - `shared`: geteilt nach den Regeln unten
  - `global`: Stammdaten
- **Private Tabellen** sind privat durch Konstruktion: eigene Tabellen ohne Freigabe-Policy, nicht per Flag. Beispiele später: BU-Bewertungen, interner Supplier Plan, rohe Umfrageantworten.
- **Geteilte Tabellen** tragen `relationship_id`, `owner_org_id` und `visibility` (`internal` oder `shared`).
- **Policies:**
  - Geteilte Tabellen erlauben Zeilen der eigenen Organisation. Freigegebene Zeilen aktiver Beziehungen erlauben sie über eine Funktion `app.can_see_relationship(relationship_id)` (`STABLE SECURITY DEFINER`).
  - Eine zusätzliche restriktive Policy beschränkt Lieferantennutzer auf den Kunden in `app.customer_org_id`.
  - Private Tabellen erlauben nur die eigene Seite der Beziehung.
- **Keine Fremdschlüssel von geteilten auf private Tabellen**, weil PostgreSQL bei Schlüsselprüfungen RLS umgeht und so die Existenz privater Zeilen verraten würde. Private Tabellen dürfen auf geteilte verweisen.
- Die Mandanten-Session aus PLT-02 bekommt `app.customer_org_id` dazu. Gesetzt wird es ab LIF-02, bis dahin bleibt es leer.

## Ablauf

Diese Funktion hat keine Oberfläche. Sie liefert:

1. das Register der Ebenen,
2. Hilfsfunktionen, mit denen eine neue Tabelle ihre Policies aus der Ebene bekommt, statt sie jedes Mal von Hand zu schreiben,
3. ein Test-Gerüst, das für **jede** Tabelle im Register automatisch dieselben Prüfungen laufen lässt.

Weil es vor PLT-03 noch keine echten Fachtabellen gibt, legt das Test-Gerüst nur in der Testdatenbank je Ebene eine Probe-Tabelle an. Ab PLT-03 laufen dieselben Prüfungen auf den echten Tabellen.

Testaufbau mit den Organisationen aus PLT-02:

- Test-OEM und Zweit-OEM haben beide eine Beziehung zum Test-Lieferanten.
- Je Ebene gibt es Zeilen von jeder Seite, freigegeben und nicht freigegeben.

## Fertig, wenn

Je Kriterium ein Test. Alle laufen gegen eine echte PostgreSQL-Datenbank, lokal und in der automatischen Prüfung bei jedem Pull Request.

- [ ] Ein Lieferantennutzer sieht von geteilten Tabellen nur freigegebene Zeilen aktiver Beziehungen und nichts aus käuferprivaten Tabellen.
- [ ] Ein Nutzer des Zweit-OEM sieht beim selben Test-Lieferanten nichts vom Test-OEM, in keiner Ebene. Umgekehrt genauso.
- [ ] Der Käufer sieht nichts aus lieferantenprivaten Tabellen.
- [ ] Nach dem Beenden einer Beziehung sieht die andere Seite ihre freigegebenen Zeilen nicht mehr.
- [ ] Ein Lieferantennutzer mit gesetztem `app.customer_org_id` sieht nur Zeilen dieses Kunden.
- [ ] Ein Test scheitert, wenn eine Tabelle nicht im Register steht, kein RLS mit `FORCE` hat oder ein Fremdschlüssel von einer geteilten auf eine private Tabelle zeigt.
- [ ] Schreiben in eine fremde Zeile (anlegen, ändern, löschen) scheitert genauso wie Lesen.
- [ ] Neue Tabellen bekommen ihre Policies über die Hilfsfunktionen, und die Prüfungen laufen für sie ohne zusätzlichen Testcode.

## Nicht Teil dieser Funktion

- Rechte innerhalb einer Organisation (PLT-05)
- Freigabe-Abläufe in der Oberfläche, z. B. „an Lieferanten freigeben“ (SEG-10, JBP-06)
- Kundenwechsler für Lieferanten (LIF-02)
- Feinrechte mit OpenFGA (nach 1.0)
