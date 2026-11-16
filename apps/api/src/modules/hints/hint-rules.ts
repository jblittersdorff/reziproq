import { and, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  defaultMaxFocusPerSro,
  type HintDetail,
  type HintRuleKey,
  minFocusReasonLength,
} from '@reziproq/shared';

// FS-01: die zehn Regeln. Jede liest nur, was der Käufer in seiner Mandanten-Session sieht, und
// meldet Funde mit einem fingerprint, der die Lage beschreibt. Ändert sich die Lage, ändert sich
// der fingerprint; ein verworfener Hinweis kommt dann wieder, sonst nicht.

export interface HintFinding {
  ruleKey: HintRuleKey;
  relationshipId: string | null;
  /** Unterscheidet mehrere Funde derselben Regel und Beziehung, z. B. je SRO oder je Format */
  subject?: string;
  fingerprint: string;
  detail: HintDetail;
}

const day = 86_400_000;
const isoDaysAgo = (today: string, days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - days * day).toISOString().slice(0, 10);

/** Tage je Takt eines Formats aus den Spielregeln (PLB-03) */
const cadenceDays: Record<string, number> = {
  monthly: 31,
  quarterly: 92,
  semiannual: 183,
  annual: 366,
};

export interface RuleContext {
  tx: TenantTransaction;
  orgId: string;
  today: string;
  maxFocusPerSro: number;
  /** SEG-07: Lieferanten mit ungeklärter Abweichung, aus dem Portfolio */
  deviations: { relationshipId: string; deviation: number | null; threshold: number }[];
}

export async function evaluateRules(context: RuleContext): Promise<HintFinding[]> {
  const { tx, orgId, today } = context;
  const relationships = await tx
    .select({
      id: schema.relationship.id,
      createdAt: schema.relationship.createdAt,
      isFocus: schema.relationshipSide.isFocus,
      focusReason: schema.relationshipSide.focusReason,
    })
    .from(schema.relationship)
    .leftJoin(
      schema.relationshipSide,
      and(
        eq(schema.relationshipSide.relationshipId, schema.relationship.id),
        eq(schema.relationshipSide.orgId, orgId),
      ),
    )
    .where(
      and(eq(schema.relationship.buyerOrgId, orgId), eq(schema.relationship.status, 'active')),
    );
  const ids = relationships.map((row) => row.id);
  if (ids.length === 0) return [];
  const focus = relationships.filter((row) => row.isFocus);
  const findings: HintFinding[] = [];

  // 1 Segment nur aus Spend: konsolidiert, aber kein anderes Kriterium bewertet
  const decisions = await tx
    .select({
      relationshipId: schema.segmentDecision.relationshipId,
      version: schema.segmentDecision.version,
    })
    .from(schema.segmentDecision)
    .where(inArray(schema.segmentDecision.relationshipId, ids))
    .orderBy(desc(schema.segmentDecision.version));
  const decided = new Map<string, number>();
  for (const row of decisions)
    if (!decided.has(row.relationshipId)) decided.set(row.relationshipId, row.version);
  if (decided.size > 0) {
    const rated = await tx
      .select({
        relationshipId: schema.ratingAssignment.relationshipId,
        criterionKey: schema.rating.criterionKey,
      })
      .from(schema.rating)
      .innerJoin(
        schema.ratingAssignment,
        eq(schema.ratingAssignment.id, schema.rating.assignmentId),
      )
      .where(
        and(
          inArray(schema.ratingAssignment.relationshipId, [...decided.keys()]),
          sql`${schema.rating.ist} is not null`,
        ),
      );
    for (const [relationshipId, version] of decided) {
      const keys = new Set(
        rated.filter((row) => row.relationshipId === relationshipId).map((row) => row.criterionKey),
      );
      if ([...keys].every((key) => key === 'spend')) {
        findings.push({
          ruleKey: 'segment_spend_only',
          relationshipId,
          fingerprint: `entscheidung-${version}`,
          detail: {},
        });
      }
    }
  }

  // 2 Großlieferant automatisch Fokus: Begründung zu kurz oder nur „Spend“
  for (const row of focus) {
    const reason = (row.focusReason ?? '').trim();
    if (reason.length < minFocusReasonLength || reason.toLocaleLowerCase('de') === 'spend') {
      findings.push({
        ruleKey: 'weak_focus',
        relationshipId: row.id,
        fingerprint: reason || 'leer',
        detail: {},
      });
    }
  }

  // 3 Ungeklärte Abweichung (SEG-07)
  for (const entry of context.deviations) {
    if (!ids.includes(entry.relationshipId)) continue;
    findings.push({
      ruleKey: 'unexplained_deviation',
      relationshipId: entry.relationshipId,
      fingerprint: String(entry.deviation),
      detail: { deviation: entry.deviation ?? 0, threshold: entry.threshold },
    });
  }

  // 4 Zu viele Fokuslieferanten je SRO
  const members = await tx
    .select({
      relationshipId: schema.relationshipMember.relationshipId,
      userId: schema.relationshipMember.userId,
      teamRole: schema.relationshipMember.teamRole,
      function: schema.relationshipMember.function,
      name: schema.appUser.name,
    })
    .from(schema.relationshipMember)
    .leftJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
    .where(
      and(
        inArray(schema.relationshipMember.relationshipId, ids),
        eq(schema.relationshipMember.orgId, orgId),
      ),
    );
  const focusIds = new Set(focus.map((row) => row.id));
  const perSro = new Map<string, { name: string; count: number }>();
  for (const member of members) {
    if (member.teamRole !== 'sro' || !focusIds.has(member.relationshipId)) continue;
    const entry = perSro.get(member.userId) ?? { name: member.name ?? member.userId, count: 0 };
    entry.count += 1;
    perSro.set(member.userId, entry);
  }
  for (const [userId, entry] of perSro) {
    if (entry.count <= context.maxFocusPerSro) continue;
    findings.push({
      ruleKey: 'too_many_focus',
      relationshipId: null,
      subject: userId,
      fingerprint: `${entry.count}>${context.maxFocusPerSro}`,
      detail: { person: entry.name, count: entry.count, limit: context.maxFocusPerSro },
    });
  }

  // 5 Keine operative Funktion im Team: nur Einkauf
  for (const id of ids) {
    const team = members.filter((member) => member.relationshipId === id);
    if (team.length > 0 && team.every((member) => member.function === 'purchasing')) {
      findings.push({
        ruleKey: 'no_operational_function',
        relationshipId: id,
        fingerprint: team
          .map((member) => member.userId)
          .sort()
          .join(','),
        detail: { count: team.length },
      });
    }
  }

  // 6 Takt verfehlt: vereinbartes Format länger als sein Takt ohne Termin
  const targets = await tx
    .select({
      relationshipId: schema.relationshipTarget.relationshipId,
      ruleSetId: schema.relationshipTarget.ruleSetId,
      sharedAt: schema.relationshipTarget.sharedAt,
    })
    .from(schema.relationshipTarget)
    .where(inArray(schema.relationshipTarget.relationshipId, ids));
  if (targets.length > 0) {
    const formats = await tx
      .select({
        id: schema.ruleSetItem.id,
        ruleSetId: schema.ruleSetItem.ruleSetId,
        cadence: schema.ruleSetItem.cadence,
        title: schema.ruleSetItem.title,
      })
      .from(schema.ruleSetItem)
      .where(
        and(
          inArray(
            schema.ruleSetItem.ruleSetId,
            targets.map((target) => target.ruleSetId),
          ),
          eq(schema.ruleSetItem.kind, 'format'),
        ),
      );
    const meetings = formats.length
      ? await tx
          .select({
            ruleSetItemId: schema.meeting.ruleSetItemId,
            startsAt: schema.meeting.startsAt,
          })
          .from(schema.meeting)
          .where(
            inArray(
              schema.meeting.ruleSetItemId,
              formats.map((format) => format.id),
            ),
          )
      : [];
    const now = new Date(`${today}T12:00:00Z`);
    for (const target of targets) {
      for (const format of formats.filter((entry) => entry.ruleSetId === target.ruleSetId)) {
        const days = format.cadence ? cadenceDays[format.cadence] : undefined;
        if (!days) continue;
        const own = meetings.filter((meeting) => meeting.ruleSetItemId === format.id);
        if (own.some((meeting) => meeting.startsAt > now)) continue;
        const last = own
          .map((meeting) => meeting.startsAt)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const since = last ?? target.sharedAt;
        if (now.getTime() - since.getTime() <= days * day) continue;
        const title = format.title as { de?: string; en?: string };
        findings.push({
          ruleKey: 'cadence_missed',
          relationshipId: target.relationshipId,
          subject: format.id,
          fingerprint: last ? last.toISOString().slice(0, 10) : 'kein-termin',
          detail: {
            format: title.de ?? '',
            formatEn: title.en ?? title.de ?? '',
            since: since.toISOString().slice(0, 10),
          },
        });
      }
    }
  }

  // 7 Kein Feedback: Fokuslieferanten ohne aufgedeckte Welle seit zwölf Monaten
  const yearAgo = isoDaysAgo(today, 365);
  const established = focus.filter((row) => row.createdAt.toISOString().slice(0, 10) <= yearAgo);
  if (established.length > 0) {
    const revealed = await tx
      .select({
        relationshipId: schema.surveyWave.relationshipId,
        revealedAt: schema.surveyWave.revealedAt,
      })
      .from(schema.surveyWave)
      .where(
        and(
          inArray(
            schema.surveyWave.relationshipId,
            established.map((row) => row.id),
          ),
          sql`${schema.surveyWave.revealedAt} is not null`,
        ),
      );
    for (const row of established) {
      const latest = revealed
        .filter((wave) => wave.relationshipId === row.id)
        .map((wave) => wave.revealedAt as Date)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (latest && latest.toISOString().slice(0, 10) > yearAgo) continue;
      findings.push({
        ruleKey: 'no_feedback',
        relationshipId: row.id,
        fingerprint: latest ? latest.toISOString().slice(0, 10) : 'nie',
        detail: latest ? { since: latest.toISOString().slice(0, 10) } : {},
      });
    }
  }

  // 8 Lieferantenplan fehlt: zwei Wochen vor dem JBP nicht freigegeben
  const cycles = await tx
    .select({
      id: schema.cycle.id,
      relationshipId: schema.cycle.relationshipId,
      jbpDate: schema.cycle.jbpDate,
    })
    .from(schema.cycle)
    .where(and(inArray(schema.cycle.relationshipId, ids), eq(schema.cycle.status, 'active')));
  for (const cycle of cycles) {
    if (!cycle.jbpDate) continue;
    if (today < isoDaysAgo(cycle.jbpDate, 14)) continue;
    const [approved] = await tx
      .select({ id: schema.supplierPlan.id })
      .from(schema.supplierPlan)
      .where(
        and(
          eq(schema.supplierPlan.cycleId, cycle.id),
          inArray(schema.supplierPlan.status, ['approved', 'superseded']),
        ),
      )
      .limit(1);
    if (approved) continue;
    findings.push({
      ruleKey: 'plan_missing',
      relationshipId: cycle.relationshipId,
      fingerprint: `${cycle.id}#${cycle.jbpDate}`,
      detail: { jbpDate: cycle.jbpDate },
    });
  }

  // 9 Recht ohne Pflicht in freigegebenen Spielregeln
  const ruleSets = await tx
    .select({
      id: schema.ruleSet.id,
      relationshipId: schema.ruleSet.relationshipId,
      version: schema.ruleSet.version,
    })
    .from(schema.ruleSet)
    .where(
      and(
        inArray(schema.ruleSet.relationshipId, ids),
        inArray(schema.ruleSet.status, ['approved', 'shared']),
      ),
    )
    .orderBy(desc(schema.ruleSet.version));
  const latestSet = new Map<string, string>();
  for (const set of ruleSets)
    if (!latestSet.has(set.relationshipId)) latestSet.set(set.relationshipId, set.id);
  if (latestSet.size > 0) {
    const items = await tx
      .select({
        ruleSetId: schema.ruleSetItem.ruleSetId,
        kind: schema.ruleSetItem.kind,
        group: schema.ruleSetItem.group,
      })
      .from(schema.ruleSetItem)
      .where(inArray(schema.ruleSetItem.ruleSetId, [...latestSet.values()]));
    for (const [relationshipId, ruleSetId] of latestSet) {
      const own = items.filter((item) => item.ruleSetId === ruleSetId && item.group);
      const groups = [
        ...new Set(
          own
            .filter((item) => item.kind === 'right')
            .map((item) => item.group as string)
            .filter(
              (group) => !own.some((item) => item.kind === 'obligation' && item.group === group),
            ),
        ),
      ].sort();
      if (groups.length === 0) continue;
      findings.push({
        ruleKey: 'right_without_obligation',
        relationshipId,
        fingerprint: `${ruleSetId}#${groups.join(',')}`,
        detail: { groups },
      });
    }
  }

  // 10 Zusagen des Käufers überfällig: mindestens eine
  const overdue = await tx
    .select({
      id: schema.commitment.id,
      relationshipId: schema.commitment.relationshipId,
    })
    .from(schema.commitment)
    .where(
      and(
        inArray(schema.commitment.relationshipId, ids),
        eq(schema.commitment.side, 'buyer'),
        eq(schema.commitment.status, 'open'),
        sql`${schema.commitment.dueOn} < ${today}`,
      ),
    );
  for (const id of ids) {
    const own = overdue.filter((row) => row.relationshipId === id);
    if (own.length === 0) continue;
    findings.push({
      ruleKey: 'buyer_commitments_overdue',
      relationshipId: id,
      fingerprint: own
        .map((row) => row.id)
        .sort()
        .join(','),
      detail: { count: own.length },
    });
  }

  return findings;
}

/** Standardwert, wenn die Organisation nichts eingestellt hat. */
export function maxFocusPerSroOf(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : defaultMaxFocusPerSro;
}
