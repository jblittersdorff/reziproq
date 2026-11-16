import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// QBR-06: Druckseiten nutzen dieselben Tokens und Schriften wie die App. Es gibt sie nur an einer
// Stelle (apps/web/src/styles/tokens.css und apps/web/public/fonts); hier werden sie gelesen,
// nicht kopiert. PRINT_ASSETS_DIR zeigt im Betrieb auf eine Kopie von apps/web.

export interface PrintAssets {
  tokensCss: string;
  fontsCss: string;
}

function webRoot(): string {
  const configured = process.env.PRINT_ASSETS_DIR;
  if (configured) return configured;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, 'apps', 'web');
    if (existsSync(join(candidate, 'src', 'styles', 'tokens.css'))) return candidate;
    const sibling = join(dir, 'web');
    if (existsSync(join(sibling, 'src', 'styles', 'tokens.css'))) return sibling;
    dir = dirname(dir);
  }
  throw new Error('tokens.css nicht gefunden; PRINT_ASSETS_DIR setzen.');
}

let cached: PrintAssets | null = null;

export function printAssets(): PrintAssets {
  if (cached) return cached;
  const root = webRoot();
  const tokensCss = readFileSync(join(root, 'src', 'styles', 'tokens.css'), 'utf8');
  const font = (file: string) =>
    `data:font/woff2;base64,${readFileSync(join(root, 'public', 'fonts', file)).toString('base64')}`;
  // Nur der lateinische Teil: genug für Deutsch und Englisch, und das PDF bleibt klein.
  const fontsCss = `
@font-face { font-family: 'Figtree'; font-weight: 300 900; font-style: normal;
  src: url(${font('figtree-latin-wght-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Outfit'; font-weight: 100 900; font-style: normal;
  src: url(${font('outfit-latin-wght-normal.woff2')}) format('woff2'); }
`;
  cached = { tokensCss, fontsCss };
  return cached;
}
