import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { sql } from '@reziproq/db';
import { AppModule } from './app.module.js';
import { AccountStore, TenantDatabase } from './common/database.module.js';
import { AgentRunner } from './modules/agents/agent-runner.js';
import { AgentsService } from './modules/agents/agents.service.js';
import { QbrPrepWorker } from './modules/agents/qbr-prep.worker.js';
import type { AuthContext } from './modules/auth/auth.guard.js';
import { HintsService } from './modules/hints/hints.service.js';
import { OpportunitiesService } from './modules/opportunities/opportunities.service.js';

// pnpm demo:setup, zweiter Teil: Über der Demo-Geschichte laufen die echten Dienste einmal, wie
// es auch die Person in der App täte – Agent einschalten, Wertpotenzial-Finder je Fokuslieferant,
// QBR-Vorbereitung für den Termin in sieben Tagen, Hinweise mit Frühwarnung. Nur lokal; mit dem
// Testanbieter, ohne Netzwerk.

// ID des Test-OEM aus packages/db/src/seed.ts (seedBuyers.testOem)
const testOem = 'de300000-0000-7000-8000-000000000001';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Nur für die lokale Entwicklung.');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    // Wie alle Fachmodule nur über die Mandanten-Session des Test-OEM (PLT-02)
    const tenant = app.get(TenantDatabase);
    const session = { userId: 'system:demo', organizationId: testOem };
    const [account] = await tenant.run(
      session,
      async (tx) =>
        (
          await tx.execute<{ id: string }>(sql`
            select id from app_user where organization_id = ${testOem} and id not like 'demo-%'
            order by last_login_at desc nulls last limit 1`)
        ).rows,
      { readOnly: true },
    );
    if (!account) {
      console.log(
        'Kein echtes Käuferkonto im Test-OEM. Einmal anmelden, dann pnpm demo:setup erneut.',
      );
      return;
    }
    const focus = await tenant.run(
      session,
      async (tx) =>
        (
          await tx.execute<{ id: string; name: string }>(sql`
            select r.id, coalesce(s.display_name, o.name) as name from relationship r
            join relationship_side s on s.relationship_id = r.id and s.org_id = ${testOem} and s.is_focus
            join organization o on o.id = r.supplier_org_id
            where r.buyer_org_id = ${testOem} and r.status = 'active' order by o.name`)
        ).rows,
      { readOnly: true },
    );

    const membership = await app.get(AccountStore).membershipOf(account.id);
    if (!membership) throw new Error('Konto ohne Organisation.');
    const auth: AuthContext = {
      userId: account.id,
      organization: membership.organization,
      orgRole: membership.orgRole,
      isControlling: membership.isControlling,
      isOperator: false,
      accessToken: '',
      tokenRoles: [],
    };

    // 1. QBR-Vorbereitung einschalten
    const agents = app.get(AgentsService);
    const list = await agents.list(auth);
    const agent = list.agents[0];
    if (agent && !agent.enabled) await agents.setEnabled(auth, agent.id, true);
    console.log('Agent QBR-Vorbereitung ist eingeschaltet.');

    // 2. Wertpotenzial-Finder je Fokuslieferant
    for (const entry of focus) {
      try {
        const result = await app.get(OpportunitiesService).run(auth, entry.id);
        console.log(
          `Wertpotenziale ${entry.name}: ${result.opportunities.length} Potenziale, ${result.dataGaps.length} Datenlücken, ${result.signals.length} Marktsignale.`,
        );
      } catch (error) {
        console.log(
          `Wertpotenziale ${entry.name}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    // 3. QBR-Vorbereitung für Termine in sieben Tagen, wie der Tagesjob, und gleich ausführen
    const started = await app.get(QbrPrepWorker).runDaily([testOem]);
    const runs = await tenant.run(
      { userId: account.id, organizationId: testOem },
      async (tx) =>
        (
          await tx.execute<{
            id: string;
            org_id: string;
            acting_user_id: string;
            job_ticket: string;
          }>(sql`
            select id, org_id, acting_user_id, job_ticket from agent_run
            where org_id = ${testOem} and trigger = 'schedule' and status in ('queued', 'running')`)
        ).rows,
      { readOnly: true },
    );
    for (const run of runs) {
      await app.get(AgentRunner).process({
        orgId: run.org_id,
        userId: run.acting_user_id,
        runId: run.id,
        ticket: run.job_ticket,
      });
    }
    console.log(
      started > 0
        ? `QBR-Vorbereitung: ${started} Lauf gestartet und ausgeführt, Aufgabe im Mein Tag.`
        : 'QBR-Vorbereitung: kein neuer Lauf (schon vorbereitet oder kein QBR in sieben Tagen).',
    );

    // 4. Hinweise mit Frühwarnung (KI-16): Regeln prüfen und Begründungen schreiben, wie der Tagesjob
    const hints = app.get(HintsService);
    const result = await tenant.run({ userId: account.id, organizationId: testOem }, async (tx) => {
      await hints.refresh(tx, testOem);
      const written = await hints.explain(tx, testOem);
      const [open] = (
        await tx.execute<{ count: string }>(sql`
          select count(*)::text as count from hint
          where org_id = ${testOem} and status in ('open', 'in_progress')`)
      ).rows;
      return { written, open: Number(open?.count ?? 0) };
    });
    console.log(
      `Hinweise: ${result.open} offen, ${result.written} neue Begründungen. Zu sehen unter Mein Tag und /hinweise.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
