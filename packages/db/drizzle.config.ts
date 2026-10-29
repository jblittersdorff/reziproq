import { defineConfig } from 'drizzle-kit';
import { databaseUrl } from './src/env.ts';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl() },
});
