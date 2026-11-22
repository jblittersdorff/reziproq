import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/agenten')({
  component: () => <Navigate to="/einstellungen/ki/agenten" replace />,
});
