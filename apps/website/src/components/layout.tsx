import type * as React from 'react';
import { Logo } from '@/components/ui/brand-mark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSite } from '../i18n';
import { type PageKey, pathOf } from '../site';
import { Wrap } from './site';

const navPages: PageKey[] = ['howItWorks', 'platform', 'suppliers', 'security', 'pricing'];

/** Kopf: Logo, Navigation als Pillen, Sprache, Anmelden, Demo buchen */
export function SiteHeader() {
  const { text, locale, page, href } = useSite();
  const labels: Record<string, string> = {
    howItWorks: text.nav.howItWorks,
    platform: text.nav.platform,
    suppliers: text.nav.suppliers,
    security: text.nav.security,
    pricing: text.nav.pricing,
  };
  return (
    <header className="border-line border-b bg-background">
      <Wrap className="flex min-h-21 flex-wrap items-center gap-x-6 gap-y-3 py-3.5">
        <a href={href('home')} aria-label={text.nav.home} className="text-ink no-underline">
          <Logo name="Reziproq" />
        </a>
        <nav
          aria-label={text.nav.main}
          className="order-3 flex w-full flex-wrap gap-0.5 rounded-full bg-line-soft p-1 lg:order-none lg:mx-auto lg:w-auto"
        >
          {navPages.map((target) => (
            <a
              key={target}
              href={href(target)}
              aria-current={target === page ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full px-4 text-base no-underline',
                target === page
                  ? 'bg-card font-semibold text-ink shadow-toggle'
                  : 'font-medium text-muted-strong hover:text-ink',
              )}
            >
              {labels[target]}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2 lg:ml-0">
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
      </Wrap>
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
