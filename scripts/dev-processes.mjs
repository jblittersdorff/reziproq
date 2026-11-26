// Nur ein `pnpm dev` zur Zeit (26.11.2026): Bausteine für dev-guard.mjs und dev-stop.mjs. Reine
// Funktionen, damit sie sich ohne laufende Prozesse testen lassen (dev-processes.test.ts).

import net from 'node:net';

/** Ports von `pnpm dev`: API, Web-App, Website */
export const devPorts = [3000, 5173, 5180];

/** Lauscht auf dem Port schon ein Server? Versucht IPv4 und IPv6, wie Vite und Nest binden. */
export async function listening(port, timeoutMs = 400) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host });
      const done = (result) => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(timeoutMs, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  return (await tryHost('127.0.0.1')) || (await tryHost('::1'));
}

/** Zeilen aus `ps -Ao pid=,ppid=,command=` */
export function parsePs(output) {
  return output
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, ppid, command]) => ({ pid: Number(pid), ppid: Number(ppid), command }));
}

/** Die Wurzeln und alle ihre Nachfahren, ohne Doppelte */
export function withDescendants(processes, roots) {
  const children = new Map();
  for (const entry of processes) {
    children.set(entry.ppid, [...(children.get(entry.ppid) ?? []), entry.pid]);
  }
  const seen = new Set();
  const stack = [...roots];
  while (stack.length > 0) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    stack.push(...(children.get(pid) ?? []));
  }
  return [...seen];
}

/** Compiler im Watch-Modus, die API mit node --watch und concurrently aus `dev` der API */
const isWatcher = (command) =>
  /\b(tsc|tsgo)\b.*--watch/.test(command) ||
  /node --watch .*dist\/main\.js/.test(command) ||
  /\bconcurrently\b/.test(command);
/** Vite als Dev-Server, nicht vite build und nicht vite preview der E2E-Tests */
const isViteDev = (command) =>
  /(^|[\s/])vite(\.js)?(\s|$)/.test(command) && !/\s(build|preview)(\s|$)/.test(command);
const isPnpmDev = (command) => /^pnpm (dev|--recursive --parallel dev)(\s|$)/.test(command);

/**
 * Wurzeln der Dev-Prozesse dieses Projekts: `pnpm dev` mit Arbeitsordner im Projekt, Watcher und
 * Vite mit Pfad oder Arbeitsordner im Projekt (auch verwaiste) und Prozesse des Projekts, die einen
 * Dev-Port belegen. Nie der eigene Prozess oder seine Vorfahren (self), nie Tests.
 */
export function devRoots(processes, { repoDir, cwdOf, portOwners = [], self = [] }) {
  const inRepo = (text) => typeof text === 'string' && text.startsWith(repoDir);
  const ours = (entry) => entry.command.includes(repoDir) || inRepo(cwdOf(entry.pid));
  // Erst das Muster, dann der Arbeitsordner: cwdOf fragt das System je Prozess
  const roots = processes.filter((entry) => {
    if (self.includes(entry.pid)) return false;
    if (isPnpmDev(entry.command)) return inRepo(cwdOf(entry.pid));
    return (isWatcher(entry.command) || isViteDev(entry.command)) && ours(entry);
  });
  const owners = processes.filter(
    (entry) => portOwners.includes(entry.pid) && !self.includes(entry.pid) && ours(entry),
  );
  return [...new Set([...roots, ...owners].map((entry) => entry.pid))];
}
