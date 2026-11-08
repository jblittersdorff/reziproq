import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { schema, sql } from '@reziproq/db';
import type { ConsolidateRequest, DecisionHistory } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { ownRelationship, sroOf } from '../suppliers/team.service.js';
import { readDecisions } from './consolidation.js';
import { RatingsService } from './ratings.service.js';

/** SEG-06: Der SRO (oder Admin) legt die Unternehmenssicht fest; jede Festlegung ist eine neue Version. */
@Injectable()
export class ConsolidationService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(RatingsService) private readonly ratings: RatingsService,
  ) {}

  private organization(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return organization;
  }

  history(auth: AuthContext, relationshipId: string): Promise<DecisionHistory> {
    const organization = this.organization(auth);
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        await ownRelationship(tx, organization, relationshipId);
        const sro = await sroOf(tx, organization, relationshipId);
        return {
          versions: await readDecisions(tx, organization.id, relationshipId),
          canConsolidate: auth.orgRole === 'admin' || sro?.userId === auth.userId,
        };
      },
      { readOnly: true },
    );
  }

  consolidate(
    auth: AuthContext,
    relationshipId: string,
    input: ConsolidateRequest,
  ): Promise<DecisionHistory> {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      const sro = await sroOf(tx, organization, relationshipId);
      if (auth.orgRole !== 'admin' && sro?.userId !== auth.userId) {
        throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
      }

      const { segmentation } = await this.ratings.segmentationIn(
        tx,
        auth,
        organization.id,
        relationshipId,
      );
      if (!segmentation) {
        throw new ConflictException({
          statusCode: 409,
          code: 'keine_bewertungen',
          message: 'Ohne abgegebene Bewertung lässt sich nichts festlegen.',
        });
      }
      // Jede Gruppe der Bewertungen braucht genau eine Entscheidung.
      const key = (unit: string, group: string | null) => `${unit}:${group ?? ''}`;
      const expected = new Set(
        segmentation.groups.map((group) =>
          key(group.businessUnit.id, group.materialGroup?.id ?? null),
        ),
      );
      const given = input.entries.map((entry) => key(entry.businessUnitId, entry.materialGroupId));
      if (
        given.length !== expected.size ||
        new Set(given).size !== given.length ||
        given.some((entry) => !expected.has(entry))
      ) {
        throw new BadRequestException({ code: 'unvollstaendig', message: 'Ungültige Eingabe' });
      }

      const [latest] = await tx
        .select({ version: sql<number>`coalesce(max(${schema.segmentDecision.version}), 0)::int` })
        .from(schema.segmentDecision)
        .where(sql`${schema.segmentDecision.relationshipId} = ${relationshipId}`);
      const version = (latest?.version ?? 0) + 1;
      const base = {
        relationshipId,
        modelVersion: segmentation.model.version,
        decidedBy: auth.userId,
        version,
      };
      const levels = (
        ist: { impactLevel: number; qualityLevel: number },
        soll: { impactLevel: number; qualityLevel: number },
      ) => ({
        istImpactLevel: ist.impactLevel,
        istQualityLevel: ist.qualityLevel,
        sollImpactLevel: soll.impactLevel,
        sollQualityLevel: soll.qualityLevel,
      });
      await tx.insert(schema.segmentDecision).values([
        {
          ...base,
          scope: 'total' as const,
          reason: input.total.reason,
          ...levels(input.total.ist, input.total.soll),
        },
        ...input.entries.map((entry) => ({
          ...base,
          scope: 'bu_mg' as const,
          businessUnitId: entry.businessUnitId,
          materialGroupId: entry.materialGroupId,
          reason: entry.reason,
          ...levels(entry.ist, entry.soll),
        })),
      ]);
      return {
        versions: await readDecisions(tx, organization.id, relationshipId),
        canConsolidate: true,
      };
    });
  }
}
