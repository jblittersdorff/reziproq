import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'db',
    env: {
      // Die CI setzt DATABASE_URL selbst; lokal die Datenbank aus docker-compose.yml.
      // Tests legen darauf eigene Datenbanken an und löschen sie wieder.
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://reziproq:reziproq_local@localhost:5433/reziproq',
    },
  },
});
