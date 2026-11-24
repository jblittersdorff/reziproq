# SEG-01 Segmentmodell

> **Status 24.11.2026 (Umbau KI-nativ): gilt weiter, mit Änderungen.** Maßgeblich: BZ-01. Gewicht je Segmenttyp für die Triage (E-K0-17). Offen: Größe der Matrix (C-02 in `docs/entscheidungen.md`). Bei Widerspruch gelten `docs/entscheidungen.md` und die genannten Specs; Begriffe nach NAV-10 (Heute, Beziehungen, Wert, Mein Agent, Verlauf, Zusage).

Release 0.1 · baut auf PLT-05, PLT-06

## Ziel

Als Admin lege ich fest, nach welchen Kriterien wir Lieferanten einordnen und wie die neun Beziehungstypen heißen. Alle Bewertungen nutzen dasselbe Modell.

## Wer darf was

| Rolle | Darf |
|---|---|
| Käufer: Admin | Modell ansehen, Kriterien, Gewichte, Grenzen und Typen ändern, neue Version aktivieren. |
| Käufer: Nutzer, Leser | Modell ansehen. |
| Lieferant | Sieht nur den Namen und die Beschreibung seines freigegebenen Soll-Typs (SEG-10). |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `segment_model` | `id`, `org_id`, `version`, `status` (`draft`, `active`, `retired`), `low_max`, `mid_max` (Grenzen auf der Skala 0 bis 100), `created_at` | `org_private` |
| `segment_criterion` | `model_id`, `axis` (`impact`, `quality`), `key`, `name`, `description`, `weight` (Prozent, je Achse Summe 100), `position` | `org_private` |
| `segment_type` | `model_id`, `impact_level` (1 bis 3), `quality_level` (1 bis 3), `name`, `description` | `org_private` |

**Standardmodell**, angelegt für jede Organisation mit Feature `buyer`:

- **Achse Business Impact:** Spend, Wirkung beim Endkunden, Einzigartigkeit, Produktleistung, Innovationsbeitrag, Zugang zu Technologie
- **Achse Beziehungsqualität:** Vertrauen, Wirksamkeit der Zusammenarbeit, Integration, Transparenz
- **Gewichte:** zunächst gleich verteilt
- **Grenzen:** 33 und 66
- **Typen:** neun beschreibende Namen aus den Stufen, z. B. „Hoher Impact · starke Beziehung“, jeder mit einem Satz Beschreibung, den der Kunde ändern kann

**Rechnung:**

- Der Achsenwert ist der gewichtete Mittelwert der Kriterien von 0 bis 100.
- Die Stufe ergibt sich aus den Grenzen.
- Der Typ ergibt sich aus Impact-Stufe und Qualitäts-Stufe.
- Grundsatz: Ein Typ beschreibt Passung, keinen Rang.

## Ablauf

1. **Einstellungen › Segmentmodell** (`/einstellungen/segmentmodell`):
   - beide Achsen mit ihren Kriterien und Gewichten
   - die Grenzen
   - die 3×3-Matrix mit den Namen der Typen
   - oben der Status: „Aktiv seit …“
2. **Ändern legt immer einen Entwurf an.** Jede Bearbeitung hat ihre eigene Seite:
   - Kriterium: `/…/kriterium/<key>`
   - Gewichte: `/…/gewichte`
   - Grenzen: `/…/grenzen`
   - Typ: `/…/typ/<impact>-<quality>`
3. **Entwurf aktivieren:** mit Bestätigung auf der Seite. Die alte Version wird `retired`.
4. **Hinweis vor dem Aktivieren:** „Laufende Bewertungen behalten ihre Version. Neue Bewertungen nutzen die neue.“

## Fertig, wenn

Je Kriterium ein Test.

- [x] Jede Organisation mit Feature `buyer` hat nach dem Seed ein aktives Standardmodell.
- [x] Gewichte je Achse ergeben 100, sonst lässt sich nicht speichern.
- [x] Die Rechnung von Achsenwert, Stufe und Typ stimmt für Grenzfälle (33, 34, 66, 67).
- [x] Ein aktiviertes Modell erhöht die Version und retired die alte.
- [x] Nur Admins ändern. Alle anderen bekommen 403.
- [x] Der Zweit-OEM sieht das Modell des Test-OEM nicht (PLT-04).

Die unveränderliche Modellversion einer laufenden Bewertungsrunde wird beim Anlegen der Runde
gespeichert und in SEG-03 getestet.

## Nicht Teil dieser Funktion

- Mehr oder weniger als drei Stufen je Achse
- Andere Achsen als Business Impact und Beziehungsqualität
- Bewertungen (SEG-03, SEG-04)
