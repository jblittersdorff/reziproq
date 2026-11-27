import { hollmann, hollmannPeople, sql } from '@reziproq/db';
import { doneListSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hollmannTimeout, seedHollmannExclusive } from '../../testing/hollmann.js';
import { startTestApp } from '../../testing/test-app.js';
import { CommitmentFollowupService } from './commitment-followup.service.js';

// ZQ-01 Regel 5 (K2-b.6), T2-ZQ3 im Demo-Mandanten Hollmann (Mo 23.11.2026, Demo-Uhr): Der 8D-Bericht
// Charge 4711 von Rheintal ist seit 05.11. überfällig. „Zusagen nachhalten“ erinnert Nils Ott daran,
// als Nachricht von Reziproq im Auftrag von Hollmann, und Jan-Luka (SRO) sieht es in Erledigt. Sonst
// ist am 23.11. keine Zusage eines Lieferanten fällig (Seed: Fristen nach dem 07.12.).

describe('T2-ZQ3 im Demo-Mandanten Hollmann', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let release: (() => Promise<void>) | undefined;

  async function call(path: string, subject: string = hollmannPeople.janLuka.id) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      headers: { authorization: `Bearer ${await app.signToken({ subject })}` },
    });
    return { status: response.status, body: (await response.json()) as unknown };
  }

  beforeAll(async () => {
    app = await startTestApp();
    release = await seedHollmannExclusive(app.adminDb);
  }, hollmannTimeout);

  afterAll(async () => {
    try {
      await release?.();
    } finally {
      await app.close();
    }
  });

  it('erinnert Nils Ott an den 8D-Bericht; Jan-Luka sieht es in Erledigt, gekennzeichnet als Nachricht von Reziproq', async () => {
    const followup = app.app.get(CommitmentFollowupService);
    expect(await followup.runDaily([hollmann.org.id])).toBe(1);
    // Am selben Tag nicht noch einmal
    expect(await followup.runDaily([hollmann.org.id])).toBe(0);

    const mails = await app.adminDb.execute<{
      email_title: string;
      email_recipient: string;
      email_sender: string | null;
      email_template: string;
    }>(sql`
      select email_title, email_recipient, email_sender, email_template from outbox_event
      where event_type = 'email.followup'
        and org_id in (select app_demo_orgs_von(${hollmann.org.id}::uuid))`);
    expect(mails.rows).toEqual([
      {
        email_title: '8D-Bericht Charge 4711',
        email_recipient: 'nils-ott@rheintal.example',
        email_sender: 'Hollmann Antriebe',
        email_template: 'commitment_followup',
      },
    ]);

    const done = doneListSchema.parse((await call('/erledigt')).body);
    const reminders = done.rows.filter((row) => row.action === 'commitment_remind');
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({
      taskName: 'Zusagen nachhalten',
      subject: '8D-Bericht Charge 4711',
      recipient: 'Nils Ott',
      counterpart: 'Rheintal Elektronik',
      undo: { possible: false, blocker: 'ohne' },
    });
  });
});
