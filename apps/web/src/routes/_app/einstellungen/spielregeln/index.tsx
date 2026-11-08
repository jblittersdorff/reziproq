import { createFileRoute } from '@tanstack/react-router';
import { PlaybookPage } from '@/features/playbook/playbook-page';

export const Route = createFileRoute('/_app/einstellungen/spielregeln/')({
  component: () => <PlaybookPage />,
});
