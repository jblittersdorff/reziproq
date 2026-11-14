import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, auditedChange, desc, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  defaultSurveyQuestions,
  type SaveSurveyQuestion,
  type SurveyDetail,
  type SurveyKind,
  type SurveyQuestion,
  type Surveys,
  surveyDetailSchema,
  surveyKinds,
  surveysSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { surveyAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const invalid = (code: string) => new BadRequestException({ statusCode: 400, code });

type TemplateRow = typeof schema.surveyTemplate.$inferSelect;

const versionOf = (row: TemplateRow) => ({
  id: row.id,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  createdByName: row.createdByName,
  note: row.note,
});

/**
 * PUL-01: Fragebogen der Käuferorganisation. Version 1 entsteht beim ersten Lesen aus dem Standard
 * von Reziproq; jede Änderung legt eine neue Version mit allen Fragen an. Laufende Wellen (PUL-02)
 * zeigen auf ihre Version und bleiben deshalb unverändert.
 */
@Injectable()
export class SurveyService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(auth: AuthContext, work: (tx: TenantTransaction, orgId: string) => Promise<T>) {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'einstellungen.verwalten')) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization.id),
    );
  }

  /** Jüngste Version je Art; legt fehlende Standard-Fragebögen an. Auch für PUL-02. */
  async ensureTemplates(tx: TenantTransaction, orgId: string) {
    await tx
      .insert(schema.surveyTemplate)
      .values(
        surveyKinds.map((kind) => ({
          orgId,
          kind,
          version: 1,
          questions: defaultSurveyQuestions[kind].map((question) => ({
            ...question,
            active: true,
            custom: false,
          })),
        })),
      )
      .onConflictDoNothing();
    const latest = {} as Record<SurveyKind, TemplateRow>;
    for (const kind of surveyKinds) {
      const [row] = await tx
        .select()
        .from(schema.surveyTemplate)
        .where(and(eq(schema.surveyTemplate.orgId, orgId), eq(schema.surveyTemplate.kind, kind)))
        .orderBy(desc(schema.surveyTemplate.version))
        .limit(1);
      if (row) latest[kind] = row;
    }
    return latest;
  }

  list(auth: AuthContext): Promise<Surveys> {
    return this.run(auth, async (tx, orgId) => {
      const latest = await this.ensureTemplates(tx, orgId);
      return surveysSchema.parse({
        templates: surveyKinds.map((kind) => {
          const questions = latest[kind].questions as SurveyQuestion[];
          return {
            ...versionOf(latest[kind]),
            kind,
            active: questions.filter((question) => question.active).length,
            total: questions.length,
          };
        }),
        canManage: true,
      });
    });
  }

  private async load(tx: TenantTransaction, orgId: string, kind: SurveyKind, version?: number) {
    const latest = await this.ensureTemplates(tx, orgId);
    const rows = await tx
      .select()
      .from(schema.surveyTemplate)
      .where(and(eq(schema.surveyTemplate.orgId, orgId), eq(schema.surveyTemplate.kind, kind)))
      .orderBy(desc(schema.surveyTemplate.version));
    const row = version === undefined ? latest[kind] : rows.find((r) => r.version === version);
    if (!row) throw notFound();
    return surveyDetailSchema.parse({
      template: {
        ...versionOf(row),
        kind,
        questions: row.questions,
      },
      versions: rows.map(versionOf),
      canManage: true,
    });
  }

  detail(auth: AuthContext, kind: SurveyKind, version?: number): Promise<SurveyDetail> {
    return this.run(auth, (tx, orgId) => this.load(tx, orgId, kind, version));
  }

  /** Frage ändern (key) oder ergänzen (null); immer als neue Version. */
  saveQuestion(
    auth: AuthContext,
    kind: SurveyKind,
    key: string | null,
    input: SaveSurveyQuestion,
  ): Promise<SurveyDetail> {
    return this.run(auth, async (tx, orgId) => {
      const latest = (await this.ensureTemplates(tx, orgId))[kind];
      const questions = [...(latest.questions as SurveyQuestion[])];
      const index = key === null ? -1 : questions.findIndex((question) => question.key === key);
      if (key !== null && index < 0) throw notFound();
      const before = index >= 0 ? questions[index] : undefined;
      // Standardfragen behalten ihre Dimension, damit die Auswertung vergleichbar bleibt.
      if (before && !before.custom && before.dimension !== input.dimension) {
        throw invalid('dimension_fest');
      }
      const next: SurveyQuestion = {
        key: before?.key ?? `eigene_${randomUUID().slice(0, 8)}`,
        dimension: input.dimension,
        textDe: input.textDe,
        textEn: input.textEn,
        active: input.active,
        custom: before?.custom ?? true,
      };
      if (
        before &&
        before.textDe === next.textDe &&
        before.textEn === next.textEn &&
        before.active === next.active &&
        before.dimension === next.dimension
      ) {
        return this.load(tx, orgId, kind);
      }
      if (before) questions[index] = next;
      else {
        // Neue Frage am Ende ihrer Dimension.
        const last = questions.findLastIndex((question) => question.dimension === next.dimension);
        questions.splice(last < 0 ? questions.length : last + 1, 0, next);
      }
      const actor = await actorOf(tx, auth, orgId);
      const version = latest.version + 1;
      await auditedChange(tx, actor, surveyAudit, async () => {
        try {
          await tx.insert(schema.surveyTemplate).values({
            orgId,
            kind,
            version,
            questions,
            createdBy: auth.userId,
            createdByName: actor.name,
            note: before ? null : 'Frage ergänzt',
          });
        } catch (error) {
          // Zwei gleichzeitige Änderungen: Die zweite muss neu laden.
          if ((error as { code?: string }).code === '23505') {
            throw new ConflictException({ statusCode: 409, code: 'version_veraltet' });
          }
          throw error;
        }
        return {
          objectId: orgId,
          relationshipId: null,
          action: before ? ('updated' as const) : ('created' as const),
          before: before
            ? {
                kind,
                version: latest.version,
                question: before.key,
                text_de: before.textDe,
                text_en: before.textEn,
                active: before.active,
              }
            : null,
          after: {
            kind,
            version,
            question: next.key,
            text_de: next.textDe,
            text_en: next.textEn,
            active: next.active,
          },
          result: undefined,
        };
      });
      return this.load(tx, orgId, kind);
    });
  }
}
