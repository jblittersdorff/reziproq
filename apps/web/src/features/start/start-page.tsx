import { HouseIcon } from 'lucide-react';
import { useEffect } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useMe } from '@/features/auth/use-me';
import { PromptTrigger } from '@/features/prompt/prompt-trigger';
import { useT } from '@/lib/i18n';
import { dayTime } from './greeting';

/**
 * Start nach dem Login (PLT-11): Begrüßung und Fragefeld. Was fällig ist, füllt NAV-05; bis dahin
 * steht hier der leere Zustand.
 */
export function StartPage() {
  const t = useT();
  const me = useMe();

  useEffect(() => {
    document.title = `${t.start.title} – ${t.app.name}`;
  }, [t]);

  const greeting = {
    morning: t.start.greetingMorning,
    day: t.start.greetingDay,
    evening: t.start.greetingEvening,
  }[dayTime(new Date())];

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-semibold text-xl">
        {me.data ? greeting(me.data.firstName) : t.start.greetingWithoutName}
      </h1>

      <PromptTrigger />

      <EmptyState
        size="lg"
        icon={<HouseIcon aria-hidden />}
        title={t.start.emptyTitle}
        description={t.start.emptyDescription}
      />
    </div>
  );
}
