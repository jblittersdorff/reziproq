import {
  Body,
  Card,
  CardTitle,
  InkCallout,
  LinkPill,
  PageHero,
  Section,
  SectionHead,
  Wrap,
} from '../components/site';
import { useSite } from '../i18n';

// WEB-01, Seite „Unternehmen“ nach Vorlage Company. Bewusste Abweichung: Der Abschnitt „Team“
// der Vorlage fehlt, solange es nur Platzhalter gibt (Namen, Rollen, Beirat). Er kommt, sobald
// der Gründer die Angaben freigibt.

export function CompanyPage() {
  const { text, href } = useSite();
  const page = text.company;
  return (
    <>
      <PageHero decor eyebrow={page.eyebrow} title={page.title} lead={page.lead} />

      <Section tone="card">
        <Wrap className="flex flex-wrap gap-x-16 gap-y-10">
          <SectionHead
            className="min-w-0 flex-1 basis-80"
            eyebrow={page.why.eyebrow}
            title={page.why.title}
          />
          <div className="flex min-w-0 flex-[1.5] basis-130 flex-col gap-5.5">
            {page.why.paragraphs.map((paragraph) => (
              <Body key={paragraph} className="text-lg">
                {paragraph}
              </Body>
            ))}
          </div>
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-12">
          <SectionHead eyebrow={page.beliefs.eyebrow} title={page.beliefs.title} />
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(62),100%),1fr))] gap-5">
            {page.beliefs.items.map((item) => (
              <li key={item.title}>
                <Card className="h-full">
                  <CardTitle>{item.title}</CardTitle>
                  <Body>{item.text}</Body>
                </Card>
              </li>
            ))}
          </ul>
        </Wrap>
      </Section>

      <InkCallout title={page.cta} lead={page.ctaLead}>
        <LinkPill href={href('contact')} variant="mint">
          {page.touch}
        </LinkPill>
        <LinkPill href={href('platform')} variant="dark">
          {text.common.seePlatform}
        </LinkPill>
      </InkCallout>
    </>
  );
}
