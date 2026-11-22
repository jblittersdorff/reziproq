import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/portfolio/')({
  component: () => <Navigate to="/lieferanten" search={{ ansicht: 'matrix' }} replace />,
});
