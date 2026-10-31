import { useNavigate, useRouter } from '@tanstack/react-router';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useT } from '@/lib/i18n';
import { routerLink } from './navigation';

/**
 * Pfad mit Zurück-Pfeil unter der Leiste (NAV-03), auf jeder Seite unterhalb der Hauptebene.
 * Der Pfeil führt eine Ebene nach oben, wie der Zurück-Knopf des Browsers.
 */
export function PagePath({
  trail,
  current,
}: {
  trail: { label: string; href: string }[];
  current: string;
}) {
  const t = useT();
  const back = trail.at(-1);
  return (
    <Breadcrumb
      label={t.app.path}
      backLabel={t.app.backTo(back?.label ?? '')}
      trail={trail}
      current={current}
      renderLink={routerLink}
      className="-mt-4 -ml-3"
    />
  );
}

/**
 * Speichern und Abbrechen führen zur vorigen Seite (PLT-11). Kam man von außen direkt auf das
 * Formular, gibt es keine vorige Seite in der App; dann geht es eine Ebene nach oben.
 */
export function useGoBack(fallback: string) {
  const router = useRouter();
  const navigate = useNavigate();
  return () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: fallback, replace: true });
  };
}
