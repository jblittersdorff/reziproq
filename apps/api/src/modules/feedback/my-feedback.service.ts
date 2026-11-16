import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql, type TenantTransaction } from '@reziproq/db';
import {
  type DueItem,
  type MyFeedback,
  myFeedbackSchema,
  type PublicSurvey,
  publicSurveySchema,
  type SubmitSurvey,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

const submitErrors: Record<string, () => Error> = {
  survey_not_found: notFound,
  survey_used: () => new ConflictException({ statusCode: 409, code: 'schon_beantwortet' }),
  survey_expired: () => new GoneException({ statusCode: 410, code: 'abgelaufen' }),
  survey_answers_invalid: () =>
    new BadRequestException({ statusCode: 400, code: 'antworten_ungueltig' }),
};

interface InvitationRow extends Record<string, unknown> {
  participant_id: string;
  wave_id: string;
  relationship_id: string;
  side: 'buyer' | 'supplier';
  kind: 'pulse' | 'annual';
  due_date: string;
  status: 'open' | 'used' | 'expired';
  buyer: string;
  supplier: string;
}

/**
 * Feedback in der App (Änderung zu PUL-02b): Wer zu einer Welle eingeladen ist und ein Konto hat,
 * beantwortet den Fragebogen angemeldet. Die Datenbank findet nur die eigenen Einladungen
 * (app_umfrage_meine) und schreibt den Bogen wie beim Link: anonym, genau einmal.
 */
@Injectable()
export class MyFeedbackService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(auth: AuthContext, work: (tx: TenantTransaction) => Promise<T>) {
    const organization = auth.organization;
    if (!organization)
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, work);
  }

  private async rows(tx: TenantTransaction) {
    const result = await tx.execute<InvitationRow>(sql`
      select participant_id, wave_id, relationship_id, side, kind, due_date::text as due_date,
        status, buyer, supplier
      from app_umfrage_meine()
    `);
    return result.rows;
  }

  list(auth: AuthContext): Promise<MyFeedback> {
    return this.run(auth, async (tx) =>
      myFeedbackSchema.parse({
        invitations: (await this.rows(tx)).map((row) => ({
          id: row.participant_id,
          waveId: row.wave_id,
          relationshipId: row.relationship_id,
          side: row.side,
          kind: row.kind,
          dueDate: row.due_date,
          status: row.status,
          counterpart: row.side === 'buyer' ? row.supplier : row.buyer,
        })),
      }),
    );
  }

  private async readIn(tx: TenantTransaction, participantId: string): Promise<PublicSurvey> {
    const result = await tx.execute<Record<string, unknown>>(sql`
      select status, kind, due_date::text as due_date, side, buyer, supplier, questions
      from app_umfrage_teilnahme_lesen(${participantId}::uuid)
    `);
    const row = result.rows[0];
    if (!row) throw notFound();
    return publicSurveySchema.parse({
      status: row.status,
      kind: row.kind,
      dueDate: row.due_date,
      side: row.side,
      buyer: row.buyer,
      supplier: row.supplier,
      questions: row.status === 'open' ? row.questions : [],
    });
  }

  read(auth: AuthContext, participantId: string): Promise<PublicSurvey> {
    return this.run(auth, (tx) => this.readIn(tx, participantId));
  }

  async submit(auth: AuthContext, participantId: string, input: SubmitSurvey) {
    try {
      await this.run(auth, (tx) =>
        tx.execute(sql`
          select app_umfrage_teilnahme_absenden(
            ${participantId}::uuid, ${JSON.stringify(input.answers)}::jsonb, ${input.comment || null}
          )
        `),
      );
    } catch (error) {
      const message =
        (error as { cause?: { message?: string } }).cause?.message ??
        (error as { message?: string }).message ??
        '';
      const translated = Object.entries(submitErrors).find(([code]) => message.includes(code));
      if (translated) throw translated[1]();
      throw error;
    }
    return this.read(auth, participantId);
  }

  /** Start: offene Fragebögen der Person, beide Seiten */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    if (!auth.organization || !can(auth, 'feedback.sehen')) return [];
    const rows = await this.run(auth, (tx) => this.rows(tx));
    return rows
      .filter((row) => row.status === 'open')
      .map((row) => ({
        id: row.participant_id,
        kind: 'feedback' as const,
        supplier: row.side === 'buyer' ? row.supplier : row.buyer,
        detail: null,
        dueDate: row.due_date,
        href: `/feedback/${row.participant_id}`,
      }));
  }
}
