import { createFileRoute } from '@tanstack/react-router';
import { RequireLogin } from '@/features/auth/require-login';
import { EntryPage } from '@/features/start/entry-page';

export const Route = createFileRoute('/')({
  component: () => (
    <RequireLogin>
      <EntryPage />
    </RequireLogin>
  ),
});
