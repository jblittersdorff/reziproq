# Anbindungen – Specs für Claude Code

Inhalt:
- IN-01 Integrationsschicht und Einstellungen Anbindungen
- IN-02 Anmeldung über Microsoft und Google
- IN-03 Termine aus Outlook und Google (Add-in, Eingangsadresse, Kalender)
- IN-04 Mails ablegen
- IN-05 Transkripte aus Teams und Meet
- IN-06 Benachrichtigungen in Teams und per Mail
- IN-07 Import-API
- `ergaenzungen-anbindungen.md` für glossar.md, rechte.md, umsetzungsplan.md
- `referenz/` mit den Seiten vom Canvas

## Ablage im Repository

- `IN-*.md` → `docs/specs/`
- Ergänzungen in die drei Dateien übernehmen
- `referenz/*` → `docs/design/referenz/`

## Prompt für Claude Code

```
Lies docs/specs/IN-01.md bis IN-07.md, glossar.md, rechte.md und umsetzungsplan.md.
Setze Release I1 in der Reihenfolge aus umsetzungsplan.md um, eine Spec pro Durchgang.
Regeln:
- Nur lokal: kein git push, kein gh, keine GitHub Actions.
- Jede Anbindung bekommt einen Anbieter `fake`. Alle Tests laufen ohne Netzwerk.
- Keine Zugangsdaten, Mandanten-IDs oder Schlüssel im Repository. Nur Umgebungsvariablen, Beispielwerte in .env.example.
- Schreiben nur über Domänendienste und can().
- Daten aus Anbindungen sind org_private. Der Test-Lieferant sieht nichts davon.
- Für jedes Kriterium unter "Fertig, wenn" ein Test.
Nach jeder Spec: Tests grün, kurze Zusammenfassung, dann nächste Spec.
```

## Annahmen, die vor dem Bau zu prüfen sind

- Teams: ob die App die Transkription automatisch starten kann. Sonst bleibt die Erinnerung an den Organisator.
- Teams-Weg `meeting` setzt voraus, dass der Kunde die Reziproq-App in Teams zulässt.
- Der Maildienst für Eingangsadressen und Versand muss in der EU laufen; Anbieter ist noch offen.
- Echte Anbindungen an Microsoft und Google brauchen eine registrierte App je Umgebung. Das macht der Admin außerhalb des Repositorys.
