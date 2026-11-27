import type { AkteHead } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import type { AkteAction } from '@/components/ui/akte-head';
import { buttonVariants } from '@/components/ui/button';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import {
  ApiError,
  agentsQueryOptions,
  briefQueryOptions,
  runValueFinder,
  startAgent,
  valueOpportunitiesQueryOptions,
} from '@/lib/api';
import { useMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { akteMessages } from './akte-messages';
import { oldPage } from './akte-view';

type ValueResult = { found: number } | 'disabled' | 'failed';

/** In Mein Agent ausgeschaltet: Die API antwortet mit 409 und dem Code ki_aufgabe_aus (MA-01) */
function switchedOff(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  const body = error.body as { code?: unknown } | null | undefined;
  return body?.code === 'ki_aufgabe_aus';
}

/**
 * Aktionen von Reziproq im Kopf der Akte (AK-01, K2-c.6, KN-41). Jede startet einen Lauf mit den
 * Rechten der Person:
 * - „Wert finden“ startet den Wertfinder (KI-11) und sagt danach unter dem Kopf, was er fand. Ist
 *   er in Mein Agent aus, sagt die Akte das. Wer ihn nicht starten darf, kommt zu den Wertpotenzialen.
 * - „Briefing …“ startet das Termin-Briefing (KI-07) zum nächsten wichtigen Termin, wenn es fehlt
 *   oder seine Eingaben sich geändert haben, und öffnet es (bis K3 auf der bisherigen Termin-Seite).
 */
export function useAkteActions({
  relationshipId,
  name,
  nextMeeting,
}: {
  relationshipId: string;
  name: string;
  nextMeeting: AkteHead['nextMeeting'];
}): { actions: AkteAction[]; status: ReactNode } {
  const text = useMessages(akteMessages).actions;
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const client = useQueryClient();
  const router = useRouter();
  const opportunities = useQuery({
    ...valueOpportunitiesQueryOptions(accessToken, relationshipId),
    enabled,
  });
  const [valueBusy, setValueBusy] = useState(false);
  const [value, setValue] = useState<ValueResult | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefFailed, setBriefFailed] = useState(false);
  const opportunitiesPage = oldPage(relationshipId, '/wirkung/wertpotenziale');

  const findValue = async () => {
    setValueBusy(true);
    setValue(null);
    setBriefFailed(false);
    try {
      const result = await runValueFinder(accessToken, relationshipId);
      client.setQueryData(
        valueOpportunitiesQueryOptions(accessToken, relationshipId).queryKey,
        result,
      );
      setValue({ found: result.counts.new });
    } catch (error) {
      setValue(switchedOff(error) ? 'disabled' : 'failed');
    } finally {
      setValueBusy(false);
    }
  };

  const openBriefing = async (meetingId: string) => {
    setBriefBusy(true);
    setBriefFailed(false);
    setValue(null);
    try {
      const brief = await client.fetchQuery(
        briefQueryOptions(accessToken, relationshipId, meetingId),
      );
      const { running, runId, unchanged } = brief.freshness;
      if (!running && (runId === null || !unchanged)) {
        const agents = await client.fetchQuery(agentsQueryOptions(accessToken));
        const agent = agents.agents.find((entry) => entry.key === 'meeting_brief');
        if (agent) {
          await startAgent(accessToken, agent.id, { relationshipId, meetingId, isTest: false });
          await client.invalidateQueries({ queryKey: ['termine', meetingId, 'briefing'] });
        }
      }
      await router.navigate({ href: oldPage(relationshipId, `/umsetzung/termine/${meetingId}`) });
    } catch {
      setBriefFailed(true);
      setBriefBusy(false);
    }
  };

  const actions: AkteAction[] = [
    opportunities.data?.canRun
      ? {
          key: 'wert',
          label: text.value,
          onClick: () => void findValue(),
          busy: valueBusy,
        }
      : { key: 'wert', label: text.value, href: opportunitiesPage },
    ...(nextMeeting
      ? [
          {
            key: 'briefing',
            label: text.briefing(nextMeeting.type),
            onClick: () => void openBriefing(nextMeeting.id),
            busy: briefBusy,
          },
        ]
      : []),
  ];

  const link = (href: string, label: string) =>
    routerLink({
      href,
      className: cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'no-underline'),
      children: label,
    });
  const status =
    value === 'disabled' ? (
      <StatusLine
        tone="warning"
        message={text.valueDisabled}
        action={link('/mein-agent', text.agentSettings)}
      />
    ) : value === 'failed' || briefFailed ? (
      <StatusLine tone="warning" message={text.failed} />
    ) : value ? (
      <StatusLine
        message={value.found > 0 ? text.valueFound(value.found, name) : text.valueNone(name)}
        action={link(opportunitiesPage, text.valueOpen)}
      />
    ) : null;
  return { actions, status };
}
