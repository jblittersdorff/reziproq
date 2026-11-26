// Feste Vorschau (26.11.2026, Go des Gründers): http://localhost:5173 zeigt den letzten grünen
// Commit, nicht die Arbeitskopie. Dafür gibt es einen eigenen Worktree im Nachbarordner
// `<repo>-vorschau/app` und eine eigene Datenbank `<name>_vorschau`, bei jedem Start frisch aus
// Seed, Demo-Setup und Hollmann. Alles ist gebaut, nicht im Watch-Modus: Änderungen in der
// Arbeitskopie starten die Vorschau nicht neu. Demo-Sitzungen überstehen einen Neustart, weil der
// Schlüssel in `<repo>-vorschau/demo-schluessel` liegt (außerhalb des Repos, nur lesbar für den
// Eigentümer). Die Vorschau belegt die Ports von `pnpm dev` (3000, 5173, 5180).
//
//   pnpm vorschau [commit]   baut den Commit (Standard HEAD) und startet ihn
//   pnpm vorschau:stop       beendet die Vorschau
//   pnpm vorschau:status     zeigt Commit, Adressen und ob sie läuft

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { devPorts, listening } from './dev-processes.mjs';
import { databaseName, isVorschauDatabase, vorschauDir, vorschauUrl } from './vorschau-lib.mjs';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = vorschauDir(repoDir, process.env.VORSCHAU_DIR);
const appDir = path.join(stateDir, 'app');
const logDir = path.join(stateDir, 'logs');
const stateFile = path.join(stateDir, 'stand.json');
const secretFile = path.join(stateDir, 'demo-schluessel');
const appUrl = 'http://localhost:5173';
const websiteUrl = 'http://localhost:5180';

const say = (text) => console.log(text);
const fail = (text) => {
  console.error(text);
  process.exit(1);
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

function readState() {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

/** Ein Schritt mit Ausgabe ins Log; bricht beim ersten Fehler ab */
function step(label, command, args, { cwd = appDir, env = process.env, log = 'bauen.log' } = {}) {
  say(`  ${label} …`);
  const file = path.join(logDir, log);
  const fd = openSync(file, 'a');
  try {
    const result = spawnSync(command, args, { cwd, env, stdio: ['ignore', fd, fd] });
    if (result.status !== 0) fail(`${label} ist fehlgeschlagen. Log: ${file}`);
  } finally {
    closeSync(fd);
  }
}

/** Beendet die Prozessgruppen der laufenden Vorschau: erst SIGTERM, nach 5 s SIGKILL */
async function stop() {
  const state = readState();
  const pids = Object.values(state?.pids ?? {}).filter(alive);
  const signal = (pid, name) => {
    try {
      process.kill(-pid, name);
    } catch {
      try {
        process.kill(pid, name);
      } catch {
        // schon beendet
      }
    }
  };
  for (const pid of pids) signal(pid, 'SIGTERM');
  for (let wait = 0; wait < 50 && pids.some(alive); wait += 1) await pause(100);
  for (const pid of pids.filter(alive)) signal(pid, 'SIGKILL');
  if (state) writeFileSync(stateFile, `${JSON.stringify({ ...state, pids: {} }, null, 2)}\n`);
  return pids.length;
}

/** Datenbank-Adressen der Vorschau aus der .env des Repos; gelesen, nie ausgegeben */
function databaseUrls() {
  const file = path.join(repoDir, '.env');
  if (!existsSync(file)) fail('Die .env im Hauptordner fehlt (Vorlage: .env.example).');
  // Wie in den Apps: Gesetzte Umgebungsvariablen gehen vor die Datei
  const values = { ...parseEnv(readFileSync(file, 'utf8')), ...process.env };
  const urls = {};
  for (const name of ['DATABASE_URL', 'API_DATABASE_URL', 'JOBS_DATABASE_URL']) {
    if (!values[name]) fail(`${name} fehlt in der .env.`);
    urls[name] = vorschauUrl(values[name]);
  }
  return urls;
}

/** Löscht die Datenbank der Vorschau und legt sie leer neu an; keine andere */
async function resetDatabase(url) {
  const name = databaseName(url);
  if (!isVorschauDatabase(name)) fail('Die Vorschau legt nur ihre eigene Datenbank neu an.');
  const require = createRequire(path.join(repoDir, 'packages/db/package.json'));
  const { Pool } = require('pg');
  const server = new URL(url);
  server.pathname = '/postgres';
  const admin = new Pool({ connectionString: server.toString(), max: 1 });
  try {
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }
}

/** Fester Schlüssel für Demo-Sitzungen der Vorschau; entsteht einmal, wird nie ausgegeben */
function demoSessionSecret() {
  if (!existsSync(secretFile)) {
    writeFileSync(secretFile, randomBytes(32).toString('base64url'), { mode: 0o600 });
  }
  return readFileSync(secretFile, 'utf8').trim();
}

function checkout(sha) {
  if (!existsSync(path.join(appDir, '.git'))) {
    if (existsSync(appDir)) {
      fail(`${appDir} ist kein Worktree. Bitte prüfen und den Ordner selbst entfernen.`);
    }
    spawnSync('git', ['-C', repoDir, 'worktree', 'prune']);
    step('Worktree anlegen', 'git', ['-C', repoDir, 'worktree', 'add', '--detach', appDir, sha], {
      cwd: repoDir,
    });
  } else {
    step('Commit auschecken', 'git', ['-C', appDir, 'checkout', '--detach', '--force', sha]);
    // Alte Bauergebnisse weg; node_modules und der Verweis auf die .env bleiben
    step('Aufräumen', 'git', ['-C', appDir, 'clean', '-fdx', '-e', 'node_modules', '-e', '.env']);
  }
  const envLink = path.join(appDir, '.env');
  let linked = false;
  try {
    linked = lstatSync(envLink).isSymbolicLink();
  } catch {
    linked = false;
  }
  if (!linked) symlinkSync(path.join(repoDir, '.env'), envLink);
}

function launch(name, args, cwd, env) {
  const fd = openSync(path.join(logDir, `${name}.log`), 'a');
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  child.unref();
  closeSync(fd);
  return child.pid;
}

async function ready(url, seconds) {
  for (let attempt = 0; attempt < seconds * 2; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // noch nicht bereit
    }
    await pause(500);
  }
  return false;
}

async function start(ref) {
  const resolved = spawnSync('git', ['-C', repoDir, 'rev-parse', '--verify', `${ref}^{commit}`], {
    encoding: 'utf8',
  });
  if (resolved.status !== 0) fail(`Unbekannter Commit: ${ref}`);
  const sha = resolved.stdout.trim();
  const subject = spawnSync('git', ['-C', repoDir, 'log', '-1', '--format=%s', sha], {
    encoding: 'utf8',
  }).stdout.trim();
  mkdirSync(logDir, { recursive: true });
  say(`Vorschau für ${sha.slice(0, 7)} ${subject}`);

  const stopped = await stop();
  if (stopped > 0) say('  laufende Vorschau beendet');
  const busy = [];
  for (const port of devPorts) {
    if (await listening(port)) busy.push(port);
  }
  if (busy.length > 0) {
    fail(
      `Port ${busy.join(', ')} ist belegt, wohl von pnpm dev der Arbeitskopie. ` +
        'Erst pnpm dev:stop, dann pnpm vorschau.',
    );
  }

  checkout(sha);
  step('Abhängigkeiten installieren', 'pnpm', ['install', '--frozen-lockfile', '--prefer-offline']);
  step('Pakete bauen', 'pnpm', ['--filter', './packages/*', 'build']);
  step('API bauen', 'pnpm', ['--filter', '@reziproq/api', 'build']);
  step('App bauen', 'pnpm', ['--filter', '@reziproq/web', 'build'], {
    // Der Bau braucht mehr als den Standard-Speicher von Node (wie in playwright.config.ts)
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
  });
  step('Website bauen', 'pnpm', ['--filter', '@reziproq/website', 'build']);

  const urls = databaseUrls();
  const dataEnv = { ...process.env, ...urls };
  say('  Datenbank der Vorschau neu anlegen …');
  await resetDatabase(urls.DATABASE_URL);
  step('Migrationen', 'pnpm', ['db:migrate'], { env: dataEnv, log: 'daten.log' });
  step('Rollen', 'pnpm', ['db:roles'], { env: dataEnv, log: 'daten.log' });
  step('Beispieldaten', 'pnpm', ['db:seed'], { env: dataEnv, log: 'daten.log' });
  // Das Demo-Setup ruft Dienste mit KI auf: in der Vorschau immer mit dem Testanbieter, ohne Kosten
  step('Konten einrichten', 'pnpm', ['demo:setup'], {
    env: { ...dataEnv, AI_PROVIDER: 'test' },
    log: 'daten.log',
  });
  step('Demo-Mandant Hollmann', 'pnpm', ['demo:hollmann'], { env: dataEnv, log: 'daten.log' });

  const vite = (app) => path.join(appDir, app, 'node_modules/vite/bin/vite.js');
  const pids = {
    api: launch('api', ['--enable-source-maps', 'dist/main.js'], path.join(appDir, 'apps/api'), {
      ...dataEnv,
      DEMO_SESSION_SECRET: demoSessionSecret(),
    }),
    app: launch(
      'app',
      [vite('apps/web'), 'preview', '--port', '5173', '--strictPort'],
      path.join(appDir, 'apps/web'),
      process.env,
    ),
    website: launch(
      'website',
      [
        vite('apps/website'),
        'preview',
        '--outDir',
        'dist/client',
        '--port',
        '5180',
        '--strictPort',
      ],
      path.join(appDir, 'apps/website'),
      process.env,
    ),
  };
  writeFileSync(
    stateFile,
    `${JSON.stringify({ commit: sha, subject, startedAt: new Date().toISOString(), pids }, null, 2)}\n`,
  );
  say('  starten …');
  const up = (await ready(`${appUrl}/api/health`, 90)) && (await ready(websiteUrl, 30));
  if (!up) {
    await stop();
    fail(`Die Vorschau ist nicht hochgekommen. Logs: ${logDir}`);
  }
  say(
    [
      '',
      `Vorschau läuft: ${appUrl}  (Commit ${sha.slice(0, 7)})`,
      `Demo ohne Zitadel: ${appUrl}/demo/als/hollmann-jan-luka`,
      `Website: ${websiteUrl}`,
      `Logs: ${logDir}`,
    ].join('\n'),
  );
}

function status() {
  const state = readState();
  const running = Object.values(state?.pids ?? {}).filter(alive).length;
  if (!state || running === 0) {
    say('Die Vorschau läuft nicht. Starten: pnpm vorschau');
    return;
  }
  say(
    [
      `Vorschau läuft: ${appUrl}  (Commit ${state.commit.slice(0, 7)} ${state.subject})`,
      `Gestartet: ${state.startedAt}`,
      `Prozesse: ${running} von ${Object.keys(state.pids).length}`,
      `Logs: ${logDir}`,
    ].join('\n'),
  );
}

const [command = 'HEAD'] = process.argv.slice(2);
if (command === 'stop') {
  const stopped = await stop();
  say(stopped > 0 ? 'Vorschau beendet.' : 'Die Vorschau lief nicht.');
} else if (command === 'status') {
  status();
} else {
  await start(command);
}
