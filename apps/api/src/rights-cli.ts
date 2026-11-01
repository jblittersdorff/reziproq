import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderRightsDoc } from './modules/auth/rights-doc.js';

// pnpm rechte: schreibt docs/rechte.md aus der Rechte-Matrix (PLT-05).
const target = fileURLToPath(new URL('../../../docs/rechte.md', import.meta.url));
writeFileSync(target, renderRightsDoc());
console.log('docs/rechte.md ist neu erzeugt.');
