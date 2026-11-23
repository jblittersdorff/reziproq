import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { schema, sql } from '@reziproq/db';
import { AppModule } from './app.module.js';
import { AccountStore, TenantDatabase } from './common/database.module.js';
import { env } from './config/env.js';
import { agendaEnd, agendaStart, replaceAgendaBlock } from './modules/calendar/calendar-rules.js';
import { GRAPH_CLIENT, type GraphClient } from './modules/integrations/graph-client.js';
import { IntegrationsService } from './modules/integrations/integrations.service.js';
import { MicrosoftGraphClient } from './modules/integrations/microsoft-provider.js';

// Durchstich, Teil 2 (docs/betrieb/durchstich.md): pnpm durchstich:graph <E-Mail>
// Schreibt über die eigene Verbindung der Person eine Beispiel-Agenda in ihren nächsten Termin
// „Reziproq Durchstich“. Sucht die Person je Käufer in dessen Mandanten-Session.

async function main(email: string) {
  if (process.env.NODE_ENV === 'production') throw new Error('Nur für die lokale Entwicklung.');
  if (env.MICROSOFT_PROVIDER !== 'live') {
    throw new Error('Teil 2 braucht MICROSOFT_PROVIDER=live in der .env.');
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const tenant = app.get(TenantDatabase);
    let person: { id: string; orgId: string } | null = null;
    for (const customer of await app.get(AccountStore).customers()) {
      const [row] = await tenant.run(
        { userId: 'system:durchstich', organizationId: customer.id },
        (tx) =>
          tx
            .select({ id: schema.appUser.id })
            .from(schema.appUser)
            .where(sql`lower(${schema.appUser.email}) = ${email.toLowerCase()}`),
        { readOnly: true },
      );
      if (row) {
        person = { id: row.id, orgId: customer.id };
        break;
      }
    }
    if (!person) throw new Error(`Keine Person mit der E-Mail „${email}“ bei einem Käufer.`);
    const client = app.get<GraphClient>(GRAPH_CLIENT);
    if (!(client instanceof MicrosoftGraphClient))
      throw new Error('Graph läuft noch mit dem Nachbau.');
    const done = await app
      .get(IntegrationsService)
      .withUserToken(person.orgId, person.id, 'microsoft365', async (token) => {
        const event = await client.findEvent(token, 'Reziproq Durchstich');
        if (!event) return 'Kein Termin mit „Reziproq Durchstich“ in den nächsten 30 Tagen.';
        const before = (await client.getEventBody(token, event.id)) ?? '';
        const after = replaceAgendaBlock(
          before,
          [
            { title: '10:00 Begrüßung und Ziele', detail: '10 Min.' },
            { title: '10:10 Lieferplan und Qualität', detail: '30 Min.' },
            { title: '10:40 Nächste Schritte', detail: '20 Min.' },
          ],
          'Agenda (Durchstich)',
        );
        await client.updateEventBody(token, event.id, after);
        const how = before.includes(agendaStart) ? 'ersetzt' : 'angefügt';
        return `Agenda in „${event.subject}“ ${how}. Block: ${agendaStart} … ${agendaEnd}`;
      });
    console.log(done ?? 'Keine aktive Verbindung zu Microsoft 365 (Profil › Meine Verbindungen).');
  } finally {
    await app.close();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Aufruf: pnpm durchstich:graph <E-Mail>');
  process.exitCode = 1;
} else {
  try {
    await main(email);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
