# WG Rechte

Rechte des Warengruppenmanagements. `docs/rechte.md` wird aus `apps/api/src/modules/auth/permissions.ts` erzeugt; jede WG-Spec trägt ihre Aktionen dort ein, diese Tabelle ist die Vorgabe dafür. Die Rollen Lead, Commodity Manager, Einkauf im Team und Funktion im Team gelten je Warengruppe (`category_member.role`).

| Objekt | Admin | Lead | Commodity Manager | Einkauf im Team | Funktion im Team | SRO der Beziehung | Käufer mit Zugriff | Lieferant |
|---|---|---|---|---|---|---|---|---|
| Warengruppe, Produktgruppe, Team | schreiben | Team und Produktgruppen schreiben | lesen | lesen | lesen | lesen | lesen | nie |
| Strategie im Entwurf | lesen | schreiben | schreiben | Schritte 2 bis 9 schreiben | zugewiesene Sichten kommentieren | nur Zeile seines Lieferanten in der Supplier Map | nie | nie |
| Strategie freigegeben | lesen | lesen | lesen | lesen | lesen | lesen | lesen | nie |
| Kostensicht | lesen | schreiben | schreiben | schreiben | nie | nie | nie | nie |
| Bewertungsrunde der Warengruppe | lesen | starten, entscheiden | starten, entscheiden | bewerten | bewerten | lesen | lesen | nie |
| Freigabe | Wege einstellen | vorlegen, unterschreiben | unterschreiben | lesen | lesen | lesen | lesen | nie |
| Zusammenführung, Widersprüche | lesen | Widersprüche seiner Warengruppe lösen | Widersprüche lösen | lesen | nie | Gesamtsegment entscheiden, Widersprüche lösen | lesen | nie |
| KI-Entwurf | Einstellungen | wie Zielobjekt | wie Zielobjekt | wie Zielobjekt | nie | wie Zielobjekt | nie | nie |

Freigebende nach Freigabeweg lesen die ganze Strategie im Entwurf einschließlich Kostensicht und geben frei oder zurück.

Für alle Tabellen des Moduls gilt:

- Art `org_private`, keine Freigabe-Policy.
- Kein Fremdschlüssel von einer geteilten Tabelle auf eine dieser Tabellen.
- Je Tabelle ein Test, dass der Test-Lieferant nichts erhält, und ein Test, dass Kunde A nichts von Kunde B erhält.
