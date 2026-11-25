import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, schema, sql, type TenantSession } from '@reziproq/db';
import { type FocusMap, focusMapSchema, type WhyView, whyViewSchema } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { HintsService } from '../hints/hints.service.js';
import { visibleRelationships } from '../start/my-day-data.js';
import { TriageService } from './triage.service.js';

// HE-01 Warum und Fokus-Mappe (K1-e.4). Warum nimmt die ID eines Fokus-Themas, eines Hinweises oder
// eines Laufs von Reziproq und liefert die passende Herleitung; die Mappe zeigt ein Fokus-Thema als
// Entscheidung. Beides nur für die eigene Person.

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

@Injectable()
export class WhyService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(TriageService) private readonly triage: TriageService,
    @Inject(HintsService) private readonly hints: HintsService,
  ) {}

  private session(auth: AuthContext): TenantSession | null {
    return auth.organization ? { userId: auth.userId, organizationId: auth.organization.id } : null;
  }

  async why(auth: AuthContext, id: string): Promise<WhyView> {
    const session = this.session(auth);
    if (!session) throw notFound();
    const topic = await this.triage.topicFor(auth, id);
    if (topic) {
      if (topic.sourceType === 'hint') return { kind: 'hint', hintId: topic.sourceId };
      if (topic.sourceType === 'agent_run') return this.run(auth, topic.sourceId);
      return whyViewSchema.parse({
        kind: 'topic',
        topic: topic.topic,
        rank: topic.rank,
        sources: factSources(topic.topic.facts),
      });
    }
    if (auth.organization?.buyer && (await this.visibleHint(auth, id))) {
      return { kind: 'hint', hintId: id };
    }
    return this.run(auth, id);
  }

  async map(auth: AuthContext, id: string): Promise<FocusMap> {
    const found = await this.triage.topicFor(auth, id);
    if (found?.topic.level !== 'focus') throw notFound();
    const hint =
      found.sourceType === 'hint' && auth.organization?.buyer
        ? await this.hints.get(auth, found.sourceId).catch(() => null)
        : null;
    return focusMapSchema.parse({
      topic: found.topic,
      state: found.state,
      since: found.createdAt.toISOString(),
      rank: found.rank,
      hintId: found.sourceType === 'hint' ? found.sourceId : null,
      // Höchstens eine Empfehlung und nur mit Grundlage: der Vorschlag der Regel eines Hinweises
      recommendation: hint?.suggestedAction ?? null,
      sources: factSources(found.topic.facts),
    });
  }

  private async visibleHint(auth: AuthContext, id: string): Promise<boolean> {
    try {
      await this.hints.get(auth, id);
      return true;
    } catch {
      return false;
    }
  }

  /** Lauf der Person: Aufgabe, Zeit, Schritte, Kosten, Rechte, Aussagen und Quellen */
  private async run(auth: AuthContext, id: string): Promise<WhyView> {
    const session = this.session(auth);
    const organization = auth.organization;
    if (!session || !organization) throw notFound();
    return this.tenant.run(
      session,
      async (tx) => {
        const [run] = (
          await tx.execute<{
            id: string;
            status: string;
            trigger: 'manual' | 'schedule' | 'event';
            created_at: Date | string;
            finished_at: Date | string | null;
            steps_used: number;
            cost_microcents: string | number;
            context_relationship_id: string | null;
            undone_at: Date | string | null;
            task: string;
            task_name: string;
            tools: string[] | null;
          }>(sql`
            select r.id, r.status, r.trigger, r.created_at, r.finished_at, r.steps_used,
              r.cost_microcents, r.context_relationship_id, r.undone_at,
              a.key as task, a.name as task_name, v.tools
            from agent_run r
            join agent_version v on v.org_id = r.org_id and v.id = r.agent_version_id
            join agent a on a.org_id = v.org_id and a.id = v.agent_id
            where r.org_id = ${organization.id} and r.id = ${id}
              and r.acting_user_id = ${auth.userId} and not r.is_test`)
        ).rows;
        if (!run) throw notFound();
        const steps = await tx
          .select({
            seq: schema.agentStep.seq,
            title: schema.agentStep.title,
            kind: schema.agentStep.kind,
            status: schema.agentStep.status,
          })
          .from(schema.agentStep)
          .where(and(eq(schema.agentStep.orgId, organization.id), eq(schema.agentStep.runId, id)))
          .orderBy(schema.agentStep.seq);
        const drafts = await tx.execute<{
          id: string;
          claims: { key: string; text: string }[] | null;
        }>(
          sql`select id, claims from ai_draft where org_id = ${organization.id} and run_id = ${id}`,
        );
        const draftIds = drafts.rows.map((row) => row.id);
        const sources = draftIds.length
          ? (
              await tx.execute<{ draft_id: string; claim_key: string | null; title: string }>(sql`
                select draft_id, claim_key, title from ai_source
                where draft_id = any(${sql`${`{${draftIds.join(',')}}`}::uuid[]`})
                order by title`)
            ).rows
          : [];
        const names = organization.buyer
          ? await visibleRelationships(tx, {
              orgId: organization.id,
              userId: auth.userId,
              admin: auth.orgRole === 'admin',
            })
          : new Map<string, string>();
        return whyViewSchema.parse({
          kind: 'run',
          run: {
            id: run.id,
            task: run.task,
            taskName: run.task_name,
            status: run.status,
            trigger: run.trigger,
            at: new Date(run.finished_at ?? run.created_at).toISOString(),
            steps: run.steps_used,
            costMicrocents: Number(run.cost_microcents),
            tools: run.tools ?? [],
            counterpart: run.context_relationship_id
              ? (names.get(run.context_relationship_id) ?? null)
              : null,
            relationshipId: run.context_relationship_id,
            undone: run.undone_at !== null,
          },
          steps,
          statements: drafts.rows.flatMap((draft) =>
            (draft.claims ?? []).map((claim) => ({
              text: claim.text,
              sources: [
                ...new Set(
                  sources
                    .filter(
                      (source) => source.draft_id === draft.id && source.claim_key === claim.key,
                    )
                    .map((source) => source.title),
                ),
              ],
            })),
          ),
          sources: [...new Set(sources.map((source) => source.title))].map((title) => ({
            title,
            href: null,
          })),
        });
      },
      { readOnly: true },
    );
  }
}

/** Quellen aus den Fakten eines Satzes, ohne Doppel */
function factSources(facts: { source: { label: string } }[]) {
  return [...new Set(facts.map((fact) => fact.source.label).filter(Boolean))].map((title) => ({
    title,
    href: null,
  }));
}
