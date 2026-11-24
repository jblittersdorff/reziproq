# LIF-02 Arbeitsbereich des Lieferanten

> **Status 24.11.2026 (Umbau KI-nativ): abgelöst.** Maßgeblich: LP-01. Heute, Kunden und die gespiegelte Akte mit drei Sichten ersetzen den Arbeitsbereich des Lieferanten. Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.2 · baut auf LIF-01, NAV-06, NAV-05

## Ziel

Als Key Account Manager arbeite ich mit jedem meiner Kunden in einem eigenen Bereich. Er ist genauso aufgebaut wie beim Käufer, zeigt aber nur, was geteilt ist. Daten verschiedener Kunden mischen sich nie.

## Wer darf was

| Rolle | Darf |
|---|---|
| Nutzer des Lieferanten | Eigene Startseite, Kundenliste, Arbeitsbereich je Kunde mit geteilten Inhalten. |
| Admin des Lieferanten | Zusätzlich Kolleginnen und Kollegen einladen. |

## Daten

- Keine neuen Fachtabellen.
- **Kundenkontext:** Jede Anfrage im Arbeitsbereich eines Kunden setzt `app.customer_org_id`. Die restriktive Policy aus PLT-04 lässt dann nur Zeilen dieses Kunden durch.
- **Startseite:** Die Aufgaben-Quellen (NAV-05) liefern auch für Lieferanten-Nutzer, über alle Kunden. Jeder Eintrag nennt den Kunden.

## Ablauf

1. **Globale Leiste des Lieferanten:** Start, Kunden, Fragen (ab QS-05), Profil.
2. **Kunden** (`/kunden`): Karten aller aktiven Kunden mit Name und nächstem gemeinsamem Termin.
3. **Arbeitsbereich** (`/kunden/<beziehung>/…`):
   - lokale Leiste mit Kundenname und den Bereichen Überblick, Beziehung, Gemeinsamer Plan, Umsetzung, Wirkung und Eigene Sicht (LIF-03)
   - kein Bereich Strategie
4. **Kundenwechsler:** Der Kundenname in der lokalen Leiste führt zur Seite `/kunden`. Ein Wechsel öffnet denselben Bereich beim anderen Kunden.
5. Der Überblick zeigt den Kopf mit dem freigegebenen Beziehungstyp (ab SEG-10) und dem nächsten Termin, dazu Kacheln nur für geteilte Bereiche.
6. Leere Bereiche erklären, was der Kunde noch teilen wird.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ein Lieferant mit zwei Käufern sieht im Bereich des einen Kunden nie Daten des anderen. Getestet wird jede geteilte Tabelle.
- [ ] Der Lieferant sieht keine Strategie-Seiten und bekommt auf deren Adressen 403.
- [ ] Interne Objekte des Käufers erscheinen nirgends, auch nicht als Anzahl.
- [ ] Der Kundenwechsel behält den Bereich.
- [ ] Die Startseite zeigt Aufgaben aller Kunden, jeweils mit Kundennamen.

## Nicht Teil dieser Funktion

- Eigene Sicht (LIF-03)
- Export als PDF (QS-03)
