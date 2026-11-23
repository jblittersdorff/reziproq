import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// WEB-01: Die Website nutzt Tokens, Schriften und Bausteine der App (apps/web). „@“ zeigt deshalb
// auf apps/web/src, damit deren Bausteine ihre eigenen Importe finden; „@site“ auf diese App.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Schriften (fonts/) aus der App, ohne Kopie
  publicDir: fileURLToPath(new URL('../web/public', import.meta.url)),
  resolve: {
    alias: {
      '@site': fileURLToPath(new URL('./src', import.meta.url)),
      '@': fileURLToPath(new URL('../web/src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  // Für das Vorrendern alles in eine Datei bündeln
  ssr: { noExternal: true },
  server: { port: 5180 },
});
