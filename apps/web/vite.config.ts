import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

// Nur diese Werte aus der gemeinsamen .env gelangen in den Browser; sie sind nicht geheim.
// Alles andere (z. B. DATABASE_URL) bleibt auf dem Server.
const publicEnv = ['ZITADEL_ISSUER', 'ZITADEL_CLIENT_ID'] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, 'ZITADEL_');
  return {
    define: Object.fromEntries(
      publicEnv.map((name) => [`import.meta.env.${name}`, JSON.stringify(env[name] ?? '')]),
    ),
    plugins: [
      // Muss vor dem React-Plugin stehen, damit die Routen zuerst erzeugt werden.
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      // Gemeinsame Pakete direkt aus dem TypeScript-Quellcode laden (schnelles Neuladen).
      // Vites Standardbedingungen bleiben erhalten.
      conditions: ['@reziproq/source', 'module', 'browser', 'development|production'],
    },
    server: {
      port: 5173,
      // Nur ein `pnpm dev` zur Zeit: belegt, dann Abbruch statt still auf einen anderen Port
      strictPort: true,
      // Im Entwicklungsmodus gehen API-Aufrufe an den NestJS-Server.
      proxy: { '/api': 'http://localhost:3000' },
    },
  };
});
