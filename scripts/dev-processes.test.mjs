import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { devRoots, listening, parsePs, withDescendants } from './dev-processes.mjs';

// Nur ein `pnpm dev` zur Zeit (26.11.2026): Erkennen eines laufenden Servers (dev-guard.mjs) und
// Auswahl der Prozesse, die `pnpm dev:stop` beendet. Nachgestellt ist der Fall vom 26.11.: mehrere
// `pnpm dev` aus geschlossenen Terminals, verwaiste Watcher und die API hinter node --watch.

const repoDir = '/Users/jvb/Code/reziproq';

describe('Nur ein pnpm dev zur Zeit', () => {
  it('erkennt einen lauschenden Server und einen freien Port', async () => {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    expect(await listening(port)).toBe(true);
    await new Promise((resolve) => server.close(() => resolve(undefined)));
    expect(await listening(port)).toBe(false);
  });

  it('liest pid, ppid und Befehl aus ps', () => {
    expect(parsePs('  12     1 pnpm dev\n 13 12 node --watch dist/main.js\n\nkaputt')).toEqual([
      { pid: 12, ppid: 1, command: 'pnpm dev' },
      { pid: 13, ppid: 12, command: 'node --watch dist/main.js' },
    ]);
  });

  it('beendet alle Dev-Prozesse des Projekts, auch verwaiste, aber nie Tests, Fremdes oder sich selbst', () => {
    const processes = parsePs(`
      100     1 pnpm dev
      101   100 sh -c pnpm --filter "./packages/*" build && pnpm --recursive --parallel dev
      102   101 pnpm --recursive --parallel dev
      103   102 sh -c trap 'x' INT; vite
      104   103 node ${repoDir}/apps/web/node_modules/.bin/../vite/bin/vite.js
      105   102 sh -c trap 'x' INT; tsc -p tsconfig.build.json --watch --preserveWatchOutput
      106   105 ${repoDir}/node_modules/.pnpm/typescript/lib/tsc -p tsconfig.build.json --watch
      200     1 pnpm dev
      201   200 node ${repoDir}/apps/api/node_modules/.bin/concurrently --raw --kill-others
      202   201 node --watch --enable-source-maps dist/main.js
      203   202 node --enable-source-maps dist/main.js
      210     1 ${repoDir}/node_modules/.pnpm/typescript/lib/tsc -p tsconfig.build.json --watch
      300     1 node ${repoDir}/node_modules/vitest/vitest.mjs run
      301     1 node ${repoDir}/node_modules/vite/bin/vite.js preview --port 5174
      302     1 node ${repoDir}/node_modules/vite/bin/vite.js build --outDir dist/e2e
      400     1 pnpm dev
      401   400 node /Users/jvb/Code/anderes/node_modules/vite/bin/vite.js
      500     1 /usr/local/bin/fremder-server --port 3000
      600     1 -zsh
      601   600 node ${repoDir}/scripts/dev-stop.mjs
    `);
    const cwds = {
      100: repoDir,
      200: `${repoDir}/apps/api`,
      202: `${repoDir}/apps/api`,
      203: `${repoDir}/apps/api`,
      400: '/Users/jvb/Code/anderes',
      500: '/usr/local',
    };
    const roots = devRoots(processes, {
      repoDir,
      cwdOf: (pid) => cwds[pid],
      portOwners: [203, 500],
      self: [601, 600],
    });
    expect(withDescendants(processes, roots).sort((a, b) => a - b)).toEqual([
      100, 101, 102, 103, 104, 105, 106, 200, 201, 202, 203, 210,
    ]);
  });
});
