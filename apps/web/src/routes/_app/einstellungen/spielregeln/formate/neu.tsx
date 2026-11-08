import { createFileRoute } from '@tanstack/react-router';
import { FormatFormPage } from '@/features/playbook/formats-pages';

export const Route = createFileRoute('/_app/einstellungen/spielregeln/formate/neu')({
  component: () => <FormatFormPage />,
});
