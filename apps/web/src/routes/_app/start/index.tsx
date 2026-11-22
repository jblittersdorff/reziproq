import { createFileRoute } from '@tanstack/react-router';
import { EntryPage } from '@/features/start/entry-page';

export const Route = createFileRoute('/_app/start/')({
  component: () => <EntryPage bookmark />,
});
