import { createHash } from 'node:crypto';
import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabase, jobsDatabaseUrl, sql } from '@reziproq/db';
import { env } from '../../config/env.js';
import { emailDeliverySchema } from './email.schema.js';
import type { EmailOutboxStore } from './email.types.js';

@Injectable()
export class PostgresEmailOutboxStore implements EmailOutboxStore, OnApplicationShutdown {
  private readonly connection = env.NODE_ENV === 'test' ? null : createDatabase(jobsDatabaseUrl());

  async reminderOrganizations(): Promise<string[]> {
    // Outbox records only expose the organization ids needed to enter tenant sessions below.
    const result = await this.db.execute<{ org_id: string }>(sql`
      SELECT DISTINCT org_id
      FROM outbox_event
      WHERE object_type = 'cycle' AND event_type = 'cycle.updated'
      ORDER BY org_id
    `);
    return result.rows.map(({ org_id }) => org_id);
  }

  async claimNext() {
    return this.db.transaction(async (tx) => {
      const result = await tx.execute<{
        id: string;
        email_template: string;
        email_locale: string;
        email_recipient: string;
        email_first_name: string | null;
        email_title: string;
        email_deadline: string | null;
        email_link: string;
        email_sender: string | null;
        email_message: string | null;
      }>(sql`
        SELECT o.id, o.email_template, o.email_locale, o.email_recipient,
          o.email_first_name, o.email_title, o.email_deadline, o.email_link,
          o.email_sender, o.email_message
        FROM outbox_event o
        LEFT JOIN email_log l ON l.outbox_event_id = o.id
        WHERE o.processed_at IS NULL
          AND o.email_template IS NOT NULL
          AND (
            l.id IS NULL
            OR (l.status = 'failed' AND l.next_attempt_at <= app_system_now())
            OR (l.status = 'sending' AND l.attempt_count < 8
              AND l.updated_at < app_system_now() - interval '5 minutes')
          )
        ORDER BY o.occurred_at, o.id
        FOR UPDATE OF o SKIP LOCKED
        LIMIT 1
      `);
      const row = result.rows[0];
      if (!row) return null;

      const delivery = emailDeliverySchema.parse({
        id: row.id,
        template: row.email_template,
        locale: row.email_locale,
        recipient: row.email_recipient,
        ...(row.email_first_name ? { firstName: row.email_first_name } : {}),
        title: row.email_title,
        ...(row.email_deadline ? { deadline: row.email_deadline } : {}),
        link: row.email_link,
        ...(row.email_sender ? { sender: row.email_sender } : {}),
        ...(row.email_message ? { message: row.email_message } : {}),
      });
      const recipientHash = createHash('sha256')
        .update(delivery.recipient.toLowerCase())
        .digest('hex');
      await tx.execute(sql`
        INSERT INTO email_log (
          outbox_event_id, template, status, recipient_hash, attempt_count, updated_at
        )
        VALUES (${delivery.id}, ${delivery.template}, 'sending', ${recipientHash}, 1, app_system_now())
        ON CONFLICT (outbox_event_id) DO UPDATE
          SET status = 'sending',
              attempt_count = email_log.attempt_count + 1,
              updated_at = app_system_now(),
              next_attempt_at = NULL
      `);
      return delivery;
    });
  }

  async markSent(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const log = await tx.execute(sql`
        UPDATE email_log
        SET status = 'sent', sent_at = app_system_now(), updated_at = app_system_now(), next_attempt_at = NULL
        WHERE outbox_event_id = ${id} AND status = 'sending'
        RETURNING id
      `);
      if (log.rows.length !== 1) throw new Error(`E-Mail-Protokoll für ${id} nicht gefunden.`);

      const event = await tx.execute(sql`
        UPDATE outbox_event
        SET processed_at = app_system_now(),
            email_template = NULL,
            email_locale = NULL,
            email_recipient = NULL,
            email_first_name = NULL,
            email_title = NULL,
            email_deadline = NULL,
            email_link = NULL,
            email_sender = NULL,
            email_message = NULL
        WHERE id = ${id} AND processed_at IS NULL
        RETURNING id
      `);
      if (event.rows.length !== 1) throw new Error(`Outbox-Ereignis ${id} nicht gefunden.`);
    });
  }

  async markFailed(id: string): Promise<void> {
    const result = await this.db.execute(sql`
      UPDATE email_log
      SET status = 'failed',
          updated_at = app_system_now(),
          next_attempt_at = CASE
            WHEN attempt_count < 8 THEN app_system_now() + make_interval(
              secs => least(3600, (30 * power(2, least(attempt_count - 1, 7)))::int)
            )
            ELSE NULL
          END
      WHERE outbox_event_id = ${id} AND status = 'sending'
      RETURNING id
    `);
    if (result.rows.length !== 1) throw new Error(`E-Mail-Protokoll für ${id} nicht gefunden.`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection?.pool.end();
  }

  private get db() {
    if (!this.connection) throw new Error('Der E-Mail-Job ist in Tests nicht verfügbar.');
    return this.connection.db;
  }
}
