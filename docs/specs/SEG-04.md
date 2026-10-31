# SEG-04 Bewertung abgeben

Release 0.1 · baut auf SEG-03

## Ziel

Als Fachfunktion bewerte ich einen Lieferanten für meine Business Unit und Warengruppe, heute (Ist) und gewünscht (Soll). Ein geführter Ablauf erlaubt Pausen. Vor der Konsolidierung sehe ich nur die Bewertungen meiner BU.

## Wer darf was

| Rolle | Darf |
|---|---|
| Bewertende Person | Eigene Einladungen öffnen, bewerten, Entwurf speichern, abgeben. Nach Abgabe bis Rundenende ändern. |
| Nutzer derselben BU | Vor der Konsolidierung die Bewertungen ihrer BU sehen. |
| SRO der Beziehung, Admin | Alle Bewertungen der Beziehung sehen. |
| Nach Konsolidierung (SEG-06) | Alle Käufer-Nutzer mit Zugriff auf den Lieferanten sehen alle Bewertungen. |
| Lieferant | Nie. |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `rating` | `assignment_id`, `relationship_id`, `criterion_key`, `model_version`, `ist` (0 bis 100), `soll` (0 bis 100), `comment`, `updated_at`, `submitted_at` | `buyer_private` |

- Die Sichtbarkeit innerhalb der Organisation regelt `can()` nach der Tabelle oben.
- Gezeigt werden BU, Warengruppe und Funktion. Den Namen der bewertenden Person sehen nur SRO und Admin (NF-03).

## Ablauf

1. **Meine Bewertungen** (`/bewertungen`): Liste der eigenen Einladungen mit Lieferant, BU, Warengruppe, Frist und Status. Auf Start erscheinen sie unter „Fällig bei mir“ (NAV-05).
2. **Bewertung** (`/bewertungen/<id>`) ist ein Ablauf in drei Schritten:
   1. **Business Impact:** je Kriterium zwei Regler, Ist und Soll, je 0 bis 100. Darüber steht die Beschreibung des Kriteriums, darunter ein optionaler Satz Begründung.
   2. **Beziehungsqualität:** gleich aufgebaut.
   3. **Zusammenfassung:**
      - Achsenwerte und Typ für Ist und Soll, nach SEG-01 berechnet
      - Punkt in der 3×3-Matrix mit Pfeil von Ist zu Soll
      - Knopf **Abgeben**
3. Jede Eingabe wird automatisch als Entwurf gespeichert. **Später fortsetzen** führt zur Liste.
4. Nach der Abgabe erscheint eine Rückmeldezeile. Die Einladung steht auf „abgegeben“.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Ein Nutzer der BU A sieht vor der Konsolidierung keine Bewertung der BU B. SRO und Admin sehen beide.
- [ ] Nach der Konsolidierung sehen alle Käufer-Nutzer mit Zugriff alle Bewertungen.
- [ ] Der Entwurf überlebt Abmelden und Neuladen.
- [ ] Ohne Werte für alle Kriterien lässt sich nicht abgeben. Die Seite nennt die fehlenden.
- [ ] Achsenwerte und Typ in der Zusammenfassung stimmen mit der Rechnung aus SEG-01 überein.
- [ ] Nach dem Schließen der Runde ist nichts mehr änderbar.
- [ ] Der Test-Lieferant sieht keine Bewertung (PLT-04).
- [ ] Der Ablauf ist per Tastatur bedienbar, auch die Regler.

## Nicht Teil dieser Funktion

- Abweichungen und Seite je Lieferant (SEG-05)
- Konsolidierung (SEG-06)
- Import von Bewertungen
