import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
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
    // Im Entwicklungsmodus gehen API-Aufrufe an den NestJS-Server.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
