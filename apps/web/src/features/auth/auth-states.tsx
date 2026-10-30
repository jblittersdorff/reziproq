import { IconAlertTriangle, IconLoader2, IconPlugConnectedX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useMessages } from '@/lib/i18n';
import { authMessages } from './messages';

/** Ladezustand, solange die Sitzung geprüft oder der Login abgeschlossen wird. */
export function AuthChecking() {
  const t = useMessages(authMessages);
  return (
    <p role="status" className="flex items-center gap-2 text-muted-foreground">
      <IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      {t.checking}
    </p>
  );
}

export function AuthFailed({ action }: { action: ReactNode }) {
  const t = useMessages(authMessages);
  return (
    <EmptyState
      icon={<IconAlertTriangle />}
      title={t.failedTitle}
      description={t.failedDescription}
      action={action}
    />
  );
}

export function AuthNotConfigured() {
  const t = useMessages(authMessages);
  return (
    <EmptyState
      icon={<IconPlugConnectedX />}
      title={t.notConfiguredTitle}
      description={t.notConfiguredDescription}
    />
  );
}
