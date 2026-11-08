import type { FormatItem, RuleItem } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { SearchXIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { playbookPreviewQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useAppliesTo } from './formats-pages';
import { settingsTrail, useTypeName } from './playbook-page';
import { playbookPath, useLocalized } from './use-playbook';

/** „3-1“ → Impact 3, Qualität 1; alles andere ist ungültig. */
export function parseType(value: string): { impact: number; quality: number } | null {
  const match = /^([1-3])-([1-3])$/.exec(value);
  return match ? { impact: Number(match[1]), quality: Number(match[2]) } : null;
}

/** Vorschau je Typ (PLB-01): was ein Lieferant dieses Typs bekäme. */
export function PreviewPage({ type }: { type: string }) {
  const t = useT();
  const text = t.playbook;
  const parsed = parseType(type);
  const typeName = useTypeName();
  const trail = [...settingsTrail(t), { label: text.title, href: playbookPath }];
  if (!parsed) {
    return (
      <>
        <PagePath trail={trail} current={text.previewTitle} />
        <PageHeader title={text.previewTitle} />
        <EmptyState
          size="lg"
          icon={<SearchXIcon aria-hidden />}
          title={t.notFound.title}
          description={t.notFound.description}
        />
      </>
    );
  }
  const title = typeName(parsed.impact, parsed.quality);
  return (
    <>
      <PagePath trail={trail} current={title} />
      <PageHeader title={title} purpose={text.previewPurpose} />
      <PreviewContent impact={parsed.impact} quality={parsed.quality} />
    </>
  );
}

function PreviewContent({ impact, quality }: { impact: number; quality: number }) {
  const text = useT().playbook;
  const localized = useLocalized();
  const appliesTo = useAppliesTo();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...playbookPreviewQueryOptions(accessToken, impact, quality),
    enabled: accessToken !== '',
  });
  if (query.isError) return <ErrorState title={text.previewFailed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const { rules, formats } = query.data;
  if (rules.length === 0 && formats.length === 0) {
    return <p className="text-muted-foreground">{text.previewEmpty}</p>;
  }
  const section = (id: string, heading: string, items: (RuleItem | FormatItem)[]) =>
    items.length > 0 && (
      <section aria-labelledby={id} className="flex flex-col gap-3">
        <h2 id={id} className="font-semibold text-lg">
          {heading}
        </h2>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-0.5">
              <span className="font-medium">
                {'title' in item ? localized(item.title) : localized(item.name)}
              </span>
              <span className="text-muted-foreground">
                {'title' in item
                  ? `${text.groups[item.group]} · ${localized(item.description)}`
                  : `${text.levels[item.level]} · ${text.cadences[item.cadence]} · ${appliesTo(item)}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div className="flex flex-col gap-8">
      {section(
        'rechte',
        text.rights,
        rules.filter((rule) => rule.kind === 'right'),
      )}
      {section(
        'pflichten',
        text.obligations,
        rules.filter((rule) => rule.kind === 'obligation'),
      )}
      {section('formate', text.formatsTitle, formats)}
    </div>
  );
}
