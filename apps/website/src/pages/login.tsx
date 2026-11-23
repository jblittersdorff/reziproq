import { ArrowRightIcon } from 'lucide-react';
import { Chip, LinkPill, Wrap } from '../components/site';
import { useSite } from '../i18n';
import { appUrl } from '../site';

// WEB-01, Seite „Anmelden“ nach Vorlage Login: links Unternehmen, rechts Lieferanten auf Tinte.
// Bewusste Abweichung: Die Website meldet nicht selbst an. Die Knöpfe der Vorlage (Microsoft,
// Google, SSO, Mail) stehen als Text, die eine Hauptaktion führt zur Anmeldung der App, die
// diese Wege anbietet (IN-02). Lieferanten nutzen den Link aus ihrer Einladung; einen
// Anmeldelink per Mail gibt es erst mit dem Maildienst (Block C).

export function LoginPage() {
  const { text, href } = useSite();
  const page = text.login;
  return (
    <section className="py-site-section">
      <Wrap className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(96),100%),1fr))] gap-5">
        <div className="flex flex-col gap-6 rounded-site-lg bg-card p-8 shadow-card sm:p-12">
          <Chip>{page.companies}</Chip>
          <h1 className="font-display font-semibold text-ink text-site-title tracking-title-lg">
            {page.title}
          </h1>
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-muted-foreground text-sm">{page.methodsLabel}</span>
            <ul className="flex flex-wrap gap-2">
              {page.methods.map((method) => (
                <li key={method}>
                  <Chip tone="neutral">{method}</Chip>
                </li>
              ))}
            </ul>
          </div>
          <LinkPill href={appUrl} className="self-start">
            {page.signIn}
            <ArrowRightIcon aria-hidden />
          </LinkPill>
          <p className="text-muted-foreground text-sm">{page.admin}</p>
        </div>
        <div className="flex flex-col gap-6 rounded-site-lg bg-ink p-8 text-on-dark sm:p-12">
          <Chip tone="mintStrong">{page.suppliersEyebrow}</Chip>
          <h2 className="font-display font-semibold text-on-dark text-site-title tracking-title-lg">
            {page.portal}
          </h2>
          <p className="text-lg text-on-dark-muted">{page.portalText}</p>
          <p className="text-on-dark-muted text-sm">{page.portalNote}</p>
          <LinkPill href={href('suppliers')} variant="dark" className="self-start">
            {page.whatSuppliersGet}
            <ArrowRightIcon aria-hidden />
          </LinkPill>
        </div>
      </Wrap>
    </section>
  );
}
