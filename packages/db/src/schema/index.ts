// Hier werden die Tabellen definiert, z. B.:
//
//   import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
//   export const users = pgTable('users', {
//     id: uuid().primaryKey().defaultRandom(),
//     name: text().notNull(),
//   });
//
// Danach mit `pnpm db:generate` eine Migration in drizzle/ erzeugen.
export {};
