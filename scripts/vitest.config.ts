import { defineProject } from 'vitest/config';

// Tests der Hilfsskripte im Hauptordner (z. B. „Nur ein pnpm dev zur Zeit“)
export default defineProject({
  test: { name: 'scripts', include: ['*.test.mjs'], environment: 'node' },
});
