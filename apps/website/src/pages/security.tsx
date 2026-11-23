import { LockIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BrandMark } from '@/components/ui/brand-mark';
import { cn } from '@/lib/utils';
import {
  Actions,
  Body,
  Card,
  CardTitle,
  Eyebrow,
  Heading,
  InkCallout,
  LinkPill,
  NumberCircle,
  PageHero,
  Section,
  SectionHead,
  Wrap,
} from '../components/site';
import { useSite } from '../i18n';

// WEB-01, Seite „Sicherheit und Daten“ nach Vorlage Security: Liste der Unterauftragnehmer,
// Verarbeitung in vier Schritten, Ebenen, Rechte auf Tinte, Nachweise mit Status als Text.

function Subprocessors() {
  const { text } = useSite();
  const where = text.security.where;
  const [, purpose, location, data] = where.columns;
  return (
    <>
      <div className="hidden overflow-hidden rounded-site bg-background md:block">
        <table className="w-full border-collapse text-left text-base">
          <thead>
            <tr className="font-semibold text-chip text-muted-foreground">
              {where.columns.map((column) => (
                <th key={column} scope="col" className="px-5 py-4 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {where.rows.map((row) => (
              <tr key={row[0]} className="border-track border-t bg-card align-top">
                <th scope="row" className="px-5 py-4 font-semibold text-ink">
                  {row[0]}
                </th>
                <td className="px-5 py-4">{row[1]}</td>
                <td className="whitespace-nowrap px-5 py-4">{row[2]}</td>
                <td className="px-5 py-4 text-muted-strong">{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {where.rows.map((row) => (
          <li key={row[0]}>
            <Card className="gap-2 bg-background p-5 shadow-none">
              <CardTitle>{row[0]}</CardTitle>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                {(
                  [
                    [purpose, row[1]],
                    [location, row[2]],
                    [data, row[3]],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export function SecurityPage() {
  const { text, href } = useSite();
  const page = text.security;
  return (
    <>
      <PageHero decor eyebrow={page.eyebrow} title={page.title} lead={page.lead}>
        <Actions>
          <LinkPill href={href('contact')}>{page.package}</LinkPill>
          <LinkPill href="#where" variant="secondary">
            {page.allSubprocessors}
          </LinkPill>
        </Actions>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(60),100%),1fr))] gap-5">
          {page.points.map((point, index) => {
            const ink = index === page.points.length - 1;
            return (
              <Card key={point.title} className={ink ? 'bg-ink shadow-none' : undefined}>
                <CardTitle className={ink ? 'text-on-dark' : undefined}>{point.title}</CardTitle>
                <p className={cn('text-base', ink ? 'text-on-dark-muted' : 'text-muted-strong')}>
                  {point.text}
                </p>
              </Card>
            );
          })}
        </div>
      </PageHero>

      <Section tone="card" id="where">
        <Wrap className="flex flex-col gap-12">
          <SectionHead
            eyebrow={page.where.eyebrow}
            title={page.where.title}
            lead={page.where.lead}
          />
          <Subprocessors />
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-12">
          <SectionHead eyebrow={page.how.eyebrow} title={page.how.title} />
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(60),100%),1fr))] gap-5">
            {page.how.steps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <NumberCircle accent={index === page.how.steps.length - 1}>
                    {index + 1}
                  </NumberCircle>
                  <CardTitle>{step.title}</CardTitle>
                  <Body>{step.text}</Body>
                </Card>
              </li>
            ))}
          </ol>
        </Wrap>
      </Section>

      <Section tone="card">
        <Wrap className="flex flex-col gap-12">
          <SectionHead eyebrow={page.who.eyebrow} title={page.who.title} lead={page.who.lead} />
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(75),100%),1fr))] gap-5">
            {page.who.layers.map((layer, index) => {
              const shared = index === 1;
              return (
                <li
                  key={layer.who}
                  className={cn(
                    'flex flex-col gap-3 rounded-site p-7',
                    shared
                      ? 'bg-mint-soft shadow-inset-mint'
                      : 'border-2 border-line border-dashed bg-background',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center gap-2 font-semibold text-chip',
                      shared ? 'text-petrol-dark' : 'text-muted-foreground',
                    )}
                  >
                    {shared ? <BrandMark /> : <LockIcon aria-hidden className="size-4" />}
                    {layer.who}
                  </span>
                  <CardTitle>{layer.what}</CardTitle>
                </li>
              );
            })}
          </ul>
          <Body>{page.who.tenants}</Body>
        </Wrap>
      </Section>

      <Section tone="ink">
        <Wrap className="flex flex-wrap gap-x-16 gap-y-12">
          <SectionHead
            className="min-w-0 flex-1 basis-85"
            onDark
            eyebrow={page.rights.eyebrow}
            title={page.rights.title}
            lead={page.rights.lead}
          />
          <dl className="flex min-w-0 flex-[1.3] basis-120 flex-col">
            {page.rights.items.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-1 border-dark-2 border-t py-4.5 last:border-b"
              >
                <dt className="font-display font-semibold text-lg text-on-dark">{item.title}</dt>
                <dd className="text-base text-on-dark-muted">{item.text}</dd>
              </div>
            ))}
          </dl>
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-wrap gap-x-16 gap-y-12">
          <div className="flex min-w-0 flex-1 basis-80 flex-col gap-5">
            <Eyebrow>{page.compliance.eyebrow}</Eyebrow>
            <Heading>{page.compliance.title}</Heading>
            <Card className="mt-2">
              <CardTitle>{page.compliance.works}</CardTitle>
              <Body>{page.compliance.worksText}</Body>
            </Card>
          </div>
          <ul className="flex min-w-0 flex-[1.6] basis-130 flex-col">
            {page.compliance.items.map((item, index) => (
              <li
                key={item.name}
                className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-line-soft border-t py-4.5 last:border-b"
              >
                <strong className="min-w-0 basis-56 font-display font-semibold text-ink text-lg">
                  {item.name}
                </strong>
                <span className="min-w-0 flex-1 basis-56 text-base text-muted-strong">
                  {item.text}
                </span>
                <Badge variant={index < 3 ? 'success' : 'warning'}>{item.when}</Badge>
              </li>
            ))}
          </ul>
        </Wrap>
      </Section>

      <InkCallout title={page.cta}>
        <LinkPill href={href('contact')} variant="mint">
          {page.package}
        </LinkPill>
        <LinkPill href={href('pilot')} variant="dark">
          {page.pilotLink}
        </LinkPill>
      </InkCallout>
    </>
  );
}
