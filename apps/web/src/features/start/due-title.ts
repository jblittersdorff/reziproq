import type { DueItem } from '@reziproq/shared';
import type { useT } from '@/lib/i18n';

/** Titel einer fälligen Aufgabe je Art (NAV-05, NAV-10); Grundlage für Mein Tag, Aufgaben und Übersicht */
export function dueTitle(t: ReturnType<typeof useT>, item: DueItem) {
  if (item.kind === 'ai_budget') return t.start.kind.ai_budget;
  if (item.kind === 'agent_approval') return t.start.kind.agent_approval;
  if (item.kind === 'category_review') return t.start.dueCategoryReview(item.supplier);
  if (item.kind === 'category_approval') return t.start.dueCategoryApproval(item.supplier);
  if (item.kind === 'category_conflict') return t.start.dueCategoryConflict(item.supplier);
  if (item.kind === 'overall_segment_check') return t.start.dueOverallSegment(item.supplier);
  if (item.kind === 'view_assignment') {
    const views = t.analysis.views as Record<string, string>;
    return t.start.dueViewAssignment((item.detail && views[item.detail]) ?? item.detail ?? '');
  }
  if (item.kind === 'member_review') return `${t.start.kind.member_review}: ${item.detail ?? ''}`;
  if (item.kind === 'connection_renew') {
    const names = t.integrations.names;
    return `${t.start.kind.connection_renew}: ${(item.detail && names[item.detail]) ?? item.detail ?? ''}`;
  }
  if (item.kind === 'hint_rule_review' || item.kind === 'hint') {
    const rules = t.hints.rules;
    const rule =
      item.detail && Object.hasOwn(rules, item.detail)
        ? rules[item.detail as keyof typeof rules]
        : (item.detail ?? '');
    return `${t.start.kind[item.kind]}: ${rule}`;
  }
  if (item.kind === 'cycle') {
    const steps = t.workspace.cycle.steps;
    const step =
      item.detail && Object.hasOwn(steps, item.detail)
        ? steps[item.detail as keyof typeof steps]
        : (item.detail ?? '');
    return t.start.dueCycle(step);
  }
  if (item.kind === 'contribution') return t.start.dueContribution(item.detail);
  if (item.kind === 'action') return t.start.dueAction(item.detail);
  if (item.kind === 'approval') return t.start.dueApproval(item.supplier);
  if (item.kind === 'commitment') return t.start.dueCommitment(item.detail);
  if (item.kind === 'milestone') return t.start.dueMilestone(item.detail);
  if (item.kind === 'review') return t.start.dueReview(item.supplier);
  if (item.kind === 'signature') return t.start.dueSignature(item.supplier);
  if (item.kind === 'validation') return t.start.dueValidation(item.detail);
  if (item.kind === 'mention') return t.start.dueMention(item.detail);
  if (item.kind === 'feedback') return t.start.dueFeedback(item.supplier);
  if (item.kind === 'strategy') {
    const step = Number(item.detail);
    return t.start.dueStrategy(t.strategy.stepName(step));
  }
  return t.start.dueRating(item.detail);
}

export function formatDate(locale: string, date: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(`${date}T00:00:00`),
  );
}
