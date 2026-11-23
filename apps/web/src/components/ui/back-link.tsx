import { ChevronLeftIcon } from 'lucide-react';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Zurück-Link (NAV-10 Seitenregel 1, Designsprache 2): Pfeil und Name der Ebene darüber, Petrol
 * 15 / 600, mindestens 32 px hoch. Die Startseiten der vier Hauptpunkte haben keinen.
 */
function BackLink({
  label,
  href,
  renderLink = defaultRenderLink,
}: {
  label: string;
  href: string;
  renderLink?: RenderLink;
}) {
  return renderLink({
    href,
    className:
      'inline-flex min-h-11 items-center gap-1 self-start font-semibold text-base text-petrol no-underline hover:text-petrol-dark focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4',
    children: (
      <>
        <ChevronLeftIcon aria-hidden />
        {label}
      </>
    ),
  });
}

export { BackLink };
