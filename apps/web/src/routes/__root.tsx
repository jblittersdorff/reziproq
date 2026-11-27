import { movedTo } from '@reziproq/shared';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // NAV-10 TN-07: Alte Adressen leiten auch in der App auf die neuen weiter (der Server antwortet
  // mit 301); Tabelle in packages/shared/src/route-moves.ts. Der Suchteil bleibt erhalten. Eine
  // Sprungmarke des Ziels (K2-c.7: `#verlauf`) geht vor die der alten Adresse.
  beforeLoad: ({ location }) => {
    const target = movedTo(location.pathname, location.searchStr);
    if (target)
      throw redirect({
        href: target.includes('#') || !location.hash ? target : `${target}#${location.hash}`,
        replace: true,
      });
  },
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Outlet />
    </div>
  );
}
