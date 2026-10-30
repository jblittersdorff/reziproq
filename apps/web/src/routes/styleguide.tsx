import { createFileRoute } from '@tanstack/react-router';
import { RequireLogin } from '@/features/auth/require-login';
import { StyleguidePage } from '@/features/styleguide/styleguide-page';

// Nur mit Login, aber ohne Seitenleiste und nicht in der Navigation verlinkt (PLT-10).
export const Route = createFileRoute('/styleguide')({
  component: () => (
    <RequireLogin>
      <StyleguidePage />
    </RequireLogin>
  ),
});
