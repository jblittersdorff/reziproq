import { createFileRoute } from '@tanstack/react-router';
import { RequireLogin } from '@/features/auth/require-login';
import { DesignPage } from '@/features/design/design-page';

// Bausteine der Designsprache: nur mit Login, ohne Seitenleiste, nicht in der Navigation verlinkt.
export const Route = createFileRoute('/design')({
  component: () => (
    <RequireLogin>
      <DesignPage />
    </RequireLogin>
  ),
});
