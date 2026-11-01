# Rechte

Erzeugt aus `apps/api/src/modules/auth/permissions.ts` mit `pnpm rechte`. Nicht von Hand ändern.

Jeder Nutzer hat genau eine Rolle in seiner Organisation (PLT-05). Die Zusatzrolle Controlling
gibt später GuV-Wirkungen frei (PNL-06). Entschieden wird allein im Backend über `can()`.

| Aktion | Was | Admin | Nutzer | Leser | Betreiber |
| --- | --- | --- | --- | --- | --- |
| `organisation.sehen` | Organisation und Mitglieder sehen | ja | ja | ja | ja |
| `rollen.aendern` | Rollen, Controlling und Standardfunktion ändern | ja | nein | nein | nein |
| `einstellungen.verwalten` | Alle Einstellungen der Organisation öffnen | ja | nein | nein | nein |
| `lieferanten.sehen` | Lieferanten und Spend sehen | ja | ja | ja | ja |
| `lieferanten.bearbeiten` | Lieferant anlegen, ändern, beenden, Spend erfassen (nicht mit Teamrolle Leser) | ja | ja | nein | nein |
| `team.festlegen` | Team einer Beziehung festlegen | ja | nein | nein | nein |
| `verlauf.sehen` | Verlauf sehen | ja | ja | ja | ja |
| `prompt.nutzen` | Fragen an Reziproq stellen | ja | ja | ja | ja |
| `kunden.wechseln` | Als Betreiber in einen Kunden wechseln | nein | nein | nein | ja |
| `stammdaten.verwalten` | Business Units und Warengruppen anlegen, umbenennen, deaktivieren, löschen | ja | nein | nein | nein |
| `zuordnung.bearbeiten` | Lieferanten Business Units und Warengruppen zuordnen (nicht mit Teamrolle Leser) | ja | ja | nein | nein |
