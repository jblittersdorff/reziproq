# SPL-06 Strategische Themen

Release 0.2 · baut auf SPL-01

## Ziel

Als SRO verdichte ich die Ziele zu drei bis fünf strategischen Themen, die wir mit dem Lieferanten besprechen wollen. Sie sind der interne Beitrag zum Joint Business Planning.

## Wer darf was

| Rolle | Darf |
|---|---|
| SRO, Admin | Themen anlegen, ordnen, ändern. |
| Käufer: alle mit Zugriff | Sehen. |
| Lieferant | Nie in dieser Form. Übernommene Themen sieht er im Gemeinsamen Plan (JBP-02). |

## Daten

| Tabelle | Felder | Art |
|---|---|---|
| `strategic_topic` | `id`, `plan_id`, `title`, `reason`, `priority` | `buyer_private` |
| `strategic_topic_objective` | `topic_id`, `objective_id` | `buyer_private` |

## Ablauf

1. Im Lieferantenplan steht der Abschnitt **Strategische Themen**: nummerierte Liste mit Titel, Begründung und verknüpften Zielen.
2. Neu und Bearbeiten auf eigenen Seiten. Ziele werden aus dem Plan ausgewählt.
3. Die Reihenfolge lässt sich mit Pfeilen nach oben und unten ändern, per Tastatur bedienbar.
4. Ab dem sechsten Thema zeigt die Seite: „Mehr als fünf Themen verwässern den Fokus.“ Speichern bleibt möglich.

## Fertig, wenn

Je Kriterium ein Test.

- [ ] Jedes Thema hat Titel, Begründung und mindestens ein verknüpftes Ziel.
- [ ] Die Reihenfolge bleibt nach dem Neuladen erhalten.
- [ ] Ab sechs Themen erscheint der Hinweis.
- [ ] Der Test-Lieferant sieht keine Themen (PLT-04).

## Nicht Teil dieser Funktion

- Übernahme in den Gemeinsamen Plan (JBP-02)
- KI-Vorschläge für Themen
