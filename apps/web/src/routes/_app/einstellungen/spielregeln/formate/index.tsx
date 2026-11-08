import { createFileRoute } from '@tanstack/react-router';
import { FormatsPage } from '@/features/playbook/formats-pages';

export const Route = createFileRoute('/_app/einstellungen/spielregeln/formate/')({
  component: () => <FormatsPage />,
});
