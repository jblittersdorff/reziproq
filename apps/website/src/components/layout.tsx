import { MenuIcon, XIcon } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui/brand-mark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSite } from '../i18n';
import { type PageKey, pathOf } from '../site';
import { Wrap } from './site';

const navPages: PageKey[] = ['howItWorks', 'platform', 'suppliers', 'security', 'pricing'];

/**
 * Kopf: Logo, Navigation als Pillen, Sprache, Anmelden, Demo buchen. Unter 1280 px ein Knopf
 * „Menü“, der die Seiten untereinander aufklappt (im Seitenfluss, kein Popup). Nach einem
 * Seitenwechsel und mit Esc schließt das Menü.
 */
export function SiteHeader() {
  const { text, locale, page, href } = useSite();
  const [open, setOpen] = useState(false);
  const labels: Record<string, string> = {
    howItWorks: text.nav.howItWorks,
    platform: text.nav.platform,
    suppliers: text.nav.suppliers,
    security: text.nav.security,
    pricing: text.nav.pricing,
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: schließt bei jedem Seitenwechsel
  useEffect(() => setOpen(false), [page, locale]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pageLink = (target: PageKey, stacked = false) => (
    <a
      key={target}
      href={href(target)}
      aria-current={target === page ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-base no-underline',
        stacked && 'w-full',
        target === page
          ? 'bg-card font-semibold text-ink shadow-toggle'
          : 'font-medium text-muted-strong hover:text-ink',
      )}
    >
      {labels[target]}
    </a>
  );
  const languages = (
    <nav aria-label={text.nav.language} className="flex items-center font-semibold text-sm">
      <a
        href={pathOf(page, 'en')}
        lang="en"
        aria-current={locale === 'en' ? 'true' : undefined}
        className={cn(
          'inline-flex min-h-11 items-center px-2 no-underline',
          locale === 'en' ? 'text-ink' : 'text-muted-foreground',
        )}
      >
        EN
      </a>
      <span aria-hidden className="text-ring-open">
        /
      </span>
      <a
        href={pathOf(page, 'de')}
        lang="de"
        aria-current={locale === 'de' ? 'true' : undefined}
        className={cn(
          'inline-flex min-h-11 items-center px-2 no-underline',
          locale === 'de' ? 'text-ink' : 'text-muted-foreground',
        )}
      >
        DE
      </a>
    </nav>
  );
  return (
    <header className="border-line border-b bg-background">
      <Wrap className="flex min-h-21 items-center gap-x-6 py-3.5">
        <a href={href('home')} aria-label={text.nav.home} className="text-ink no-underline">
          <Logo name="Reziproq" />
        </a>
        <nav
          aria-label={text.nav.main}
          className="mx-auto hidden gap-0.5 rounded-full bg-line-soft p-1 xl:flex"
        >
          {navPages.map((target) => pageLink(target))}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          {languages}
          <a
            href={href('login')}
            className={cn(buttonVariants({ variant: 'ghost' }), 'text-base no-underline')}
          >
            {text.nav.login}
          </a>
          <a href={href('contact')} className={cn(buttonVariants(), 'text-base no-underline')}>
            {text.nav.demo}
          </a>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="website-menu"
          onClick={() => setOpen((value) => !value)}
          className={cn(buttonVariants({ variant: 'secondary' }), 'ml-auto text-base xl:hidden')}
        >
          {open ? <XIcon aria-hidden /> : <MenuIcon aria-hidden />}
          {open ? text.nav.closeMenu : text.nav.menu}
        </button>
      </Wrap>
      {open && (
        <div id="website-menu" className="border-line border-t xl:hidden">
          <Wrap className="flex flex-col gap-4 py-4">
            <nav aria-label={text.nav.menu} className="flex flex-col gap-1">
              {navPages.map((target) => pageLink(target, true))}
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              {languages}
              <a
                href={href('login')}
                className={cn(buttonVariants({ variant: 'secondary' }), 'text-base no-underline')}
              >
                {text.nav.login}
              </a>
              <a href={href('contact')} className={cn(buttonVariants(), 'text-base no-underline')}>
                {text.nav.demo}
              </a>
            </div>
          </Wrap>
        </div>
      )}
    </header>
  );
}

function FooterLinks({ label, links }: { label: string; links: [string, string][] }) {
  return (
    <nav aria-label={label} className="flex flex-1 basis-40 flex-col gap-0.5">
      <span className="pb-1.5 font-semibold text-muted-foreground text-sm">{label}</span>
      {links.map(([title, target]) => (
        <a
          key={title}
          href={target}
          className="flex min-h-9 items-center text-base text-text no-underline hover:underline"
        >
          {title}
        </a>
      ))}
    </nav>
  );
}

/** Fuß: Marke, Produkt, Unternehmen, Rechtliches */
export function SiteFooter() {
  const { text, href } = useSite();
  return (
    <footer className="border-line border-t bg-card">
      <Wrap className="flex flex-col gap-12 pt-16 pb-8">
        <div className="flex flex-wrap gap-x-16 gap-y-10">
          <div className="flex min-w-0 flex-[1.4] basis-72 flex-col gap-4">
            <a
              href={href('home')}
              aria-label={text.nav.home}
              className="self-start text-ink no-underline"
            >
              <Logo name="Reziproq" />
            </a>
            <p className="max-w-80 text-base text-muted-strong">{text.footer.claim}</p>
            <div className="flex flex-wrap gap-2">
              <a href={href('contact')} className={cn(buttonVariants(), 'no-underline')}>
                {text.nav.demo}
              </a>
              <a
                href={href('login')}
                className={cn(buttonVariants({ variant: 'secondary' }), 'no-underline')}
              >
                {text.nav.login}
              </a>
            </div>
          </div>
          <FooterLinks
            label={text.footer.product}
            links={[
              [text.nav.howItWorks, href('howItWorks')],
              [text.nav.platform, href('platform')],
              [text.nav.suppliers, href('suppliers')],
              [text.footer.securityLong, href('security')],
              [text.nav.pricing, href('pricing')],
              [text.footer.pilot, href('pilot')],
            ]}
          />
          <FooterLinks
            label={text.footer.company}
            links={[
              [text.footer.about, href('company')],
              [text.footer.contact, href('contact')],
            ]}
          />
          <FooterLinks
            label={text.footer.legal}
            links={[
              [text.footer.legalNotice, href('legal')],
              [text.footer.privacy, href('legal', 'privacy')],
              [text.footer.subprocessors, href('security', 'where')],
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-line-soft border-t pt-6 text-muted-foreground text-sm">
          <span>{text.footer.copyright}</span>
          <span>{text.footer.hosted}</span>
        </div>
      </Wrap>
    </footer>
  );
}

/** Rahmen jeder Seite: Sprung zum Inhalt, Kopf, Inhalt, Fuß */
export function SiteLayout({ children }: { children: React.ReactNode }) {
  const { text } = useSite();
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-background font-sans text-text">
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-3 focus:shadow-md"
      >
        {text.nav.skip}
      </a>
      <SiteHeader />
      <main id="inhalt" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
