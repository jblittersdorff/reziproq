import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { helloQueryOptions } from '@/lib/api';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const hello = useQuery(helloQueryOptions());

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="font-semibold text-3xl tracking-tight">reziproq</h1>
      <p className="text-muted-foreground">
        {hello.isPending && 'Lade …'}
        {hello.isError && 'Die API ist nicht erreichbar.'}
        {hello.isSuccess && hello.data.message}
      </p>
      <div>
        <Button variant="outline" onClick={() => hello.refetch()} disabled={hello.isFetching}>
          <IconRefresh />
          Neu laden
        </Button>
      </div>
    </main>
  );
}
