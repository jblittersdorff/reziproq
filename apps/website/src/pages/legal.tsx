import { PageTitle, Wrap } from '../components/site';
import { useSite } from '../i18n';

// WEB-01, Seite „Rechtliches“ nach Vorlage Legal: Impressum und Datenschutz als Gerüst. Die
// Platzhalter in eckigen Klammern bleiben sichtbar, bis eine Anwältin oder ein Anwalt die
// Texte geprüft hat; der Hinweis oben sagt das.

export function LegalPage() {
  const { text, href } = useSite();
  const page = text.legal;
  return (
    <>
      <section className="py-site-section">
        <Wrap className="flex flex-col gap-7">
          <p
            role="note"
            className="rounded-lg bg-warning-soft px-4.5 py-3.5 font-semibold text-sm text-warning-soft-foreground"
          >
            {page.draft}
          </p>
          <PageTitle>{page.notice}</PageTitle>
          <dl className="flex flex-col">
            {page.rows.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-1 gap-1 border-track border-t py-4 last:border-b sm:grid-cols-[minmax(0,--spacing(64))_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-text">{value}</dd>
              </div>
            ))}
          </dl>
        </Wrap>
      </section>
      <section id="privacy" className="scroll-mt-24 pb-site-section">
        <Wrap className="flex flex-col gap-7">
          <h2 className="text-balance font-display font-semibold text-ink text-site-hero tracking-site-hero">
            {page.privacy}
          </h2>
          <div className="flex flex-col">
            {page.sections.map((section, index) => (
              <div
                key={section.title}
                className="flex flex-col gap-2 border-track border-t py-5 last:border-b"
              >
                <h3 className="font-display font-semibold text-ink text-section tracking-section-sm">
                  {section.title}
                </h3>
                <p className="max-w-3xl text-base text-muted-strong">
                  {section.text}
                  {index === 4 && (
                    <>
                      {' '}
                      <a
                        href={href('security', 'where')}
                        className="font-semibold text-petrol underline underline-offset-2"
                      >
                        {text.footer.subprocessors}
                      </a>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>
    </>
  );
}
