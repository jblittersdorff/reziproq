import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { helloQueryOptions } from '@/lib/api';
import { defineMessages, useMessages } from '@/lib/i18n';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const messages = defineMessages({
  de: {
    loading: 'Lade …',
    error: 'Die API ist nicht erreichbar.',
    reload: 'Neu laden',
    styleguide: 'Zum Styleguide',
  },
  en: {
    loading: 'Loading …',
    error: 'The API is not reachable.',
    reload: 'Reload',
    styleguide: 'Open the style guide',
  },
});

function HomePage() {
  const t = useMessages(messages);
  const hello = useQuery(helloQueryOptions());

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="font-semibold text-xl">reziproq</h1>
      <p className="text-muted-foreground">
        {hello.isPending && t.loading}
        {hello.isError && t.error}
        {hello.isSuccess && hello.data.message}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => hello.refetch()} disabled={hello.isFetching}>
          <IconRefresh />
          {t.reload}
        </Button>
        <Button variant="link" asChild>
          <Link to="/styleguide">{t.styleguide}</Link>
        </Button>
      </div>
    </main>
  );
}
