# PLT-07 Import per Excel und CSV

Release 0.1 · baut auf PLT-03, PLT-05, PLT-06

## Ziel

Als Einkäufer lade ich meine Lieferanten, BUs, Kontakte und Spend aus einer Excel- oder CSV-Datei hoch. Vor dem Import sehe ich, was passiert und welche Zeilen fehlerhaft sind, statt alles von Hand einzutippen.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin | Alle vier Importarten, auch BUs. |
| Käufer: Nutzer | Lieferanten, Kontakte und Spend importieren. BUs nicht, die pflegt nur der Admin. |
| Käufer: Leser | Vorlagen herunterladen, nichts importieren. |
| Lieferant | Nicht Teil. |

## Daten

**Importarten und Spalten** (Pflicht fett):

| Art | Spalten | Schlüssel für „schon vorhanden“ |
|---|---|---|
| Lieferanten | **Name**, **Land**, USt-IdNr., D-U-N-S, eigene Lieferantennummer, Business Units (durch Semikolon getrennt), Warengruppen (durch Semikolon getrennt, erste = Haupt-Warengruppe) | eigene Lieferantennummer, sonst USt-IdNr. oder D-U-N-S |
| Business Units | **Name**, Code | Code, sonst Name |
| Kontakte | **eigene Lieferantennummer**, **Name**, **E-Mail**, Funktion, Position | E-Mail je Lieferant |
| Spend | **eigene Lieferantennummer**, **Jahr**, **Betrag**, Währung (Standard EUR) | Lieferant und Jahr |

- Neue Tabelle `supplier_contact`: `relationship_id`, `name`, `email`, `function`, `position`, `created_at`. Ebene `buyer_private`. Nur geschäftliche Kontaktdaten. Kontakte dürfen gelöscht werden (Datenschutz), anders als Beziehungen.
- Lieferanten aus dem Import folgen denselben Regeln wie in PLT-03: eine Organisation je USt-IdNr. oder D-U-N-S, keine Namensvorschläge über Kunden hinweg.
- Beträge in deutschem und englischem Format („1.234.567,89“ und „1,234,567.89“) werden zu ganzen Cent. Unklare Formate sind ein Fehler, keine Vermutung.
- Unbekannte BUs oder Warengruppen in der Lieferantendatei sind ein Fehler je Zeile. Sie werden nicht automatisch angelegt.
- Dateien: `.xlsx` und `.csv` (UTF-8, Komma oder Semikolon). Höchstens 10 MB und 5.000 Zeilen je Datei.
- Die hochgeladene Datei wird nach dem Import verworfen und nicht gespeichert.
- Bibliotheken mit erlaubter Lizenz, z. B. ExcelJS und Papa Parse (beide MIT). Version fest gepinnt.

## Teilung

Zwei Pull Requests:

- **PLT-07a:** Baustein Import (Upload, Vorschau, Fehlerdatei), Lieferanten und Spend.
- **PLT-07b:** Business Units und Kontakte, `docs/demo/lieferanten-50.xlsx`. Die 50 Lieferanten lädt zusätzlich `pnpm db:seed --viele`.

## Ablauf

1. Der Nutzer öffnet **Lieferanten → Importieren** oder den Import-Knopf im leeren Zustand.
2. Er wählt die Art in vier großen Kacheln: Lieferanten, Business Units, Kontakte, Spend. Jede Kachel bietet die Vorlage als Excel und CSV zum Herunterladen. Die Vorlage enthält eine Beispielzeile und eine Erklärung je Spalte.
3. Er zieht die Datei in ein großes Ablagefeld oder wählt sie aus.
4. Die **Vorschau** zeigt alle Zeilen mit Status:
   - **neu**
   - **wird geändert** (mit alt und neu)
   - **unverändert**
   - **fehlerhaft**, mit der Zelle rot markiert und einem Satz, was falsch ist
5. Oben steht die Zusammenfassung, z. B. „42 neu · 5 geändert · 3 fehlerhaft“.
6. **Importieren** übernimmt alle gültigen Zeilen in einer Transaktion. Fehlerhafte Zeilen bleiben draußen und lassen sich als Fehlerdatei mit einer Spalte „Fehler“ herunterladen, korrigieren und erneut hochladen.
7. Danach erscheint eine Bestätigung mit Zahlen und dem Knopf „Zu den Lieferanten“.
8. Ein erneuter Import derselben Datei erzeugt keine Duplikate. Er ändert nur, was sich geändert hat.

### Beispieldaten

Ein Skript erzeugt `docs/demo/lieferanten-50.xlsx` mit 50 erfundenen Lieferanten, alle mit der Endung „(Demo)“. Dazu kommen drei absichtlich fehlerhafte Zeilen: fehlendes Land, falsches USt-IdNr.-Format, unbekannte Warengruppe.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ein Playwright-Test importiert `lieferanten-50.xlsx` über die Oberfläche. 50 Lieferanten sind danach da, die drei fehlerhaften Zeilen sind markiert und nicht importiert.
- [ ] Von Hand geprüft und im Pull Request notiert: Ein Gründer schafft den Import der 50 Lieferanten samt Korrektur der Fehler in unter fünf Minuten.
- [ ] Alle vier Vorlagen lassen sich als Excel und CSV herunterladen und unverändert wieder importieren.
- [ ] Ein zweiter Import derselben Datei erzeugt keine Duplikate und meldet „unverändert“.
- [ ] Beträge in deutschem und englischem Format werden richtig in Cent umgerechnet. Unklare Formate sind Fehler.
- [ ] Die Fehlerdatei enthält genau die fehlerhaften Zeilen mit Fehlertext.
- [ ] Rechte nach der Tabelle oben: Leser bekommt 403, Nutzer darf keine BUs importieren.
- [ ] Zu große Dateien, falsche Dateitypen und mehr als 5.000 Zeilen werden mit klarer Meldung abgelehnt.
- [ ] Der Import erzeugt dieselben Verlaufseinträge wie das Anlegen von Hand (PLT-08).
- [ ] Kontakte und Spend sind für den Zweit-OEM und den Test-Lieferanten unsichtbar (Prüfungen aus PLT-04).
- [ ] Die hochgeladene Datei liegt nach dem Import nirgends mehr.

## Nicht Teil dieser Funktion

- Import von Bewertungen (SEG-02), KPI-Werten (JBP-02) und Monatswerten (PNL-05). Diese Specs nutzen denselben Import-Baustein.
- Anbindung an SAP, Coupa oder Ariba (nach 1.0)
- Automatischer Abgleich doppelter Organisationen ohne Nummer
- Warengruppen-Import. Kommt dazu, wenn Kunden ihn brauchen. Bis dahin pflegt der Admin sie in PLT-06.
