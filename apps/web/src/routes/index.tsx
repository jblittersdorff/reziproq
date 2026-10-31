import { createFileRoute, redirect } from '@tanstack/react-router';

// Nach dem Login und auf der Wurzel landet man auf Start (PLT-11).
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/start', replace: true });
  },
});
