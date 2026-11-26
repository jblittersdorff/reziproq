// Nur ein `pnpm dev` zur Zeit (26.11.2026): Bricht ab, wenn auf einem Dev-Port schon ein Server
// lauscht. Ohne Argumente prüft es alle Ports von `pnpm dev`, sonst nur die genannten (z. B. 3000
// in `dev` der API, damit auch ein Start im Ordner apps/api keinen zweiten Server anlegt).

import { devPorts, listening } from './dev-processes.mjs';

const ports = process.argv.length > 2 ? process.argv.slice(2).map(Number) : devPorts;
const busy = [];
for (const port of ports) {
  if (await listening(port)) busy.push(port);
}
if (busy.length > 0) {
  console.error(
    `pnpm dev läuft schon: ${busy.length === 1 ? 'Port' : 'Ports'} ${busy.join(', ')} ` +
      `${busy.length === 1 ? 'ist' : 'sind'} belegt.\n` +
      'Erst den laufenden beenden: pnpm dev:stop (beendet auch verwaiste Dev-Prozesse).',
  );
  process.exit(1);
}
