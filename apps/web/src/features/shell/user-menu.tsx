import { IconLogout, IconSelector, IconSettings } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useAuth } from 'react-oidc-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMe } from '@/features/auth/use-me';
import { useT } from '@/lib/i18n';

/** Unten in der Seitenleiste: wer angemeldet ist, dazu Einstellungen und Abmelden. */
export function UserMenu({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const t = useT();
  const auth = useAuth();
  const me = useMe();

  const name = me.data?.name ?? (me.isError ? t.user.failed : t.user.loading);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-accent"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-sm">{name}</span>
            {me.data && (
              <span className="truncate text-muted-foreground text-sm">{me.data.email}</span>
            )}
          </span>
          <IconSelector className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        aria-label={t.user.menu}
        className="w-(--radix-dropdown-menu-trigger-width)"
      >
        {me.data && (
          <>
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate font-medium text-sm">{me.data.name}</span>
              <span className="truncate text-muted-foreground text-sm">{me.data.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/einstellungen" onClick={onNavigate}>
            <IconSettings />
            {t.user.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void auth.signoutRedirect()}>
          <IconLogout />
          {t.user.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
