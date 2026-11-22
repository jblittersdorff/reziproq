import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, eq, schema } from '@reziproq/db';
import { z } from 'zod';
import { TenantDatabase } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import { ActivitiesService } from '../activities/activities.service.js';
import { readAiSettings } from '../ai-gateway/ai-settings.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { WavesService } from '../feedback/waves.service.js';
import { PreReadDraftService } from '../meetings/pre-read-draft.service.js';
import { RatingsService } from '../ratings/ratings.service.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { qbrContextSchema, qbrFactsSchema, supplierContextSchema } from './system-agents.js';

const researchKeys = ['web_search', 'fetch_source'] as const;
type ResearchKey = (typeof researchKeys)[number];
const querySchema = z.string().trim().min(1).max(300);
const sourceKeySchema = z.literal('fake-reference');
const fakeReference = {
  reference: 'fake-reference',
  title: 'Beispielquelle',
  excerpt: 'Fester Inhalt des lokalen Testanbieters.',
} as const;

@Injectable()
export class AgentTools {
  constructor(
    @Inject(PreReadDraftService) private readonly preReads: PreReadDraftService,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(SuppliersService) private readonly suppliers: SuppliersService,
    @Inject(RatingsService) private readonly ratings: RatingsService,
    @Inject(ActivitiesService) private readonly activities: ActivitiesService,
    @Inject(WavesService) private readonly waves: WavesService,
  ) {}

  private buyer(auth: AuthContext) {
    if (!auth.organization?.buyer || !can(auth, 'lieferanten.sehen') || auth.supportOrganization) {
      throw new ForbiddenException();
    }
    return auth.organization;
  }

  assertContext(auth: AuthContext, input: unknown) {
    this.buyer(auth);
    if (!can(auth, 'termine.sehen')) throw new ForbiddenException();
    const { relationshipId, meetingId } = qbrContextSchema.parse(input);
    return this.preReads.assertAgentContext(auth, relationshipId, meetingId);
  }

  /** Zahlen und Termintag aus dem Domänendienst. Lieferantenfreitext bleibt an der Quelle. */
  readonly qbrFacts = {
    key: 'qbr_facts',
    area: 'meetings',
    outbound: false,
    input: qbrContextSchema,
    output: qbrFactsSchema,
    read: async (auth: AuthContext, input: unknown) => {
      this.buyer(auth);
      if (!can(auth, 'termine.sehen')) throw new ForbiddenException();
      const { relationshipId, meetingId } = qbrContextSchema.parse(input);
      return qbrFactsSchema.parse(await this.preReads.agentFacts(auth, relationshipId, meetingId));
    },
  };

  readonly supplierContext = {
    key: 'supplier_context',
    area: 'suppliers',
    outbound: false,
    input: qbrContextSchema,
    output: supplierContextSchema,
    read: async (auth: AuthContext, input: unknown) => {
      await this.assertContext(auth, input);
      const { relationshipId } = qbrContextSchema.parse(input);
      const supplier = await this.suppliers.detail(auth, relationshipId);
      const rating = can(auth, 'bewertungen.sehen')
        ? await this.ratings.segmentation(auth, relationshipId)
        : null;
      const notes = can(auth, 'aktivitaeten.sehen')
        ? await this.activities.feed(auth, relationshipId, 'notizen')
        : null;
      const feedback = can(auth, 'feedback.sehen')
        ? await this.waves.buyer(auth, relationshipId, (scope) => this.waves.list(scope))
        : null;
      return supplierContextSchema.parse({
        relationshipStatus: supplier.status,
        actualSpend: supplier.spend.slice(0, 3),
        submittedRatings: rating ? (rating.segmentation?.overall.count ?? 0) : null,
        teamNotes: notes ? notes.items.filter((note) => note.visibility === 'team').length : null,
        publishedFeedback: feedback
          ? feedback.waves.filter((wave) => wave.revealedAt !== null).length
          : null,
      });
    },
  };

  /** Werkzeug-Schlüssel aus dem Code. Agentenversionen können keine neuen Werkzeuge definieren. */
  keys() {
    return [this.qbrFacts.key, this.supplierContext.key, ...researchKeys];
  }

  /**
   * Die Recherchegrenze gilt beim Aufruf. Erst nach Freigabe und Protokollierung wird das
   * Werkzeug ausgeführt. Der lokale Anbieter arbeitet mit einer festen Antwort.
   */
  async research(
    auth: AuthContext,
    key: ResearchKey,
    runId: string,
    stepId: string,
    input: unknown,
  ) {
    const org = this.buyer(auth);
    const text = (key === 'web_search' ? querySchema : sourceKeySchema).parse(input);
    const { agentRun, agentVersion, agentStep, agentOutboundQuery } = schema;

    await this.tenant.run({ organizationId: org.id, userId: auth.userId }, async (tx) => {
      if (!(await readAiSettings(tx, org.id)).publicResearch)
        throw new ForbiddenException({
          statusCode: 403,
          code: 'ki_recherche_ausgeschaltet',
        });
      if (env.NODE_ENV === 'production')
        throw new ConflictException({
          statusCode: 409,
          code: 'ki_recherche_kein_anbieter',
        });
      const [planned] = await tx
        .select({ tools: agentVersion.tools })
        .from(agentStep)
        .innerJoin(
          agentRun,
          and(eq(agentRun.orgId, agentStep.orgId), eq(agentRun.id, agentStep.runId)),
        )
        .innerJoin(
          agentVersion,
          and(eq(agentVersion.orgId, agentRun.orgId), eq(agentVersion.id, agentRun.agentVersionId)),
        )
        .where(
          and(
            eq(agentStep.orgId, org.id),
            eq(agentStep.runId, runId),
            eq(agentStep.id, stepId),
            eq(agentStep.kind, 'search'),
            eq(agentStep.toolKey, key),
            eq(agentStep.status, 'running'),
            eq(agentRun.actingUserId, auth.userId),
            eq(agentRun.status, 'running'),
          ),
        );
      if (!planned?.tools.includes(key)) throw new ForbiddenException();
      await tx
        .insert(agentOutboundQuery)
        .values({ orgId: org.id, runId, stepId, text, provider: 'fake' });
    });

    return key === 'web_search' ? { sources: [fakeReference] } : fakeReference;
  }
}
