// Nur ein `pnpm dev` zur Zeit (26.11.2026): Beendet alle Dev-Prozesse dieses Projekts, auch
// verwaiste aus geschlossenen Terminals: `pnpm dev`, Compiler im Watch-Modus, die API mit
// node --watch, Vite und alles, was einen Dev-Port belegt. Erst SIGTERM, nach 5 s SIGKILL.
// Tests (vitest, playwright, vite preview) bleiben unberührt. --dry-run zeigt nur an.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devPorts, devRoots, parsePs, withDescendants } from './dev-processes.mjs';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const run = (command, args) => {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

const processes = parsePs(run('ps', ['-Ao', 'pid=,ppid=,command=']));
const cwds = new Map();
const cwdOf = (pid) => {
  if (!cwds.has(pid)) {
    const line = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
      .split('\n')
      .find((entry) => entry.startsWith('n'));
    cwds.set(pid, line?.slice(1));
  }
  return cwds.get(pid);
};
const portOwners = devPorts.flatMap((port) =>
  run('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'])
    .split('\n')
    .filter(Boolean)
    .map(Number),
);
// Nie sich selbst oder die Shell, aus der der Befehl kommt
const self = [];
for (let pid = process.pid; pid > 1; ) {
  self.push(pid);
  pid = processes.find((entry) => entry.pid === pid)?.ppid ?? 0;
}

const roots = devRoots(processes, { repoDir, cwdOf, portOwners, self });
const targets = withDescendants(processes, roots).filter((pid) => !self.includes(pid));
if (targets.length === 0) {
  console.log('Kein pnpm dev aktiv.');
  process.exit(0);
}
if (dryRun) {
  for (const pid of targets) {
    console.log(`${pid} ${processes.find((entry) => entry.pid === pid)?.command ?? ''}`);
  }
  console.log(`${targets.length} Dev-Prozesse würden beendet.`);
  process.exit(0);
}

const alive = () =>
  targets.filter((pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  });
const send = (pids, signal) => {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // schon beendet
    }
  }
};
send(targets, 'SIGTERM');
for (let round = 0; round < 20 && alive().length > 0; round += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
}
const rest = alive();
send(rest, 'SIGKILL');
console.log(
  `${targets.length} Dev-Prozesse beendet${rest.length > 0 ? `, ${rest.length} davon hart` : ''}.`,
);
