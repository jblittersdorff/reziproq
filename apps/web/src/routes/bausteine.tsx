import { createFileRoute } from '@tanstack/react-router';
import { RequireLogin } from '@/features/auth/require-login';
import { BlocksPage } from '@/features/design/blocks-page';

// UX-20 Phase 1: Testseite der Bausteine im neuen Rahmen; nur mit Login, nicht verlinkt.
export const Route = createFileRoute('/bausteine')({
  component: () => (
    <RequireLogin>
      <BlocksPage />
    </RequireLogin>
  ),
});
