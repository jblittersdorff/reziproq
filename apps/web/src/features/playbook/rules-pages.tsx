import {
  type RuleItem,
  type RuleKind,
  ruleGroups,
  ruleKinds,
  type SaveRuleItem,
  saveRuleItemSchema,
} from '@reziproq/shared';
import { Link } from '@tanstack/react-router';
import { PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import { saveRuleItem } from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { settingsTrail } from './playbook-page';
import { playbookPath, useLocalized, usePlaybook, useRefreshPlaybook } from './use-playbook';

const rulesPath = `${playbookPath}/rechte`;

/** Rechte und Pflichten nach Gruppe; jedes Recht steht neben seiner Gegenpflicht (PLB-01). */
export function RulesPage() {
  const t = useT();
  const text = t.playbook;
  const localized = useLocalized();
  const query = usePlaybook();
  const [message, hideMessage] = useFlash();
  const trail = [...settingsTrail(t), { label: text.title, href: playbookPath }];

  const title = (rule: RuleItem) => (
    <Link
      to="/einstellungen/spielregeln/rechte/$id"
      params={{ id: rule.id }}
      className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {localized(rule.title)}
    </Link>
  );

  return (
    <>
      <PagePath trail={trail} current={text.rulesTitle} />
      <PageHeader title={text.rulesTitle} purpose={text.rulesPurpose} />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <>
          {query.data.canManage && (
            <div>
              <Button asChild>
                <Link to={`${rulesPath}/neu`}>
                  <PlusIcon />
                  {text.new}
                </Link>
              </Button>
            </div>
          )}
          {ruleGroups.map((group) => {
            const rules = query.data.rules.filter((rule) => rule.group === group);
            const byId = new Map(query.data.rules.map((rule) => [rule.id, rule]));
            const rights = rules.filter((rule) => rule.kind === 'right');
            const pairedObligations = new Set(
              rights.map((rule) => rule.counterpartId).filter(Boolean),
            );
            const loose = rules.filter(
              (rule) => rule.kind === 'obligation' && !pairedObligations.has(rule.id),
            );
            return (
              <section
                key={group}
                aria-labelledby={`gruppe-${group}`}
                className="flex flex-col gap-3"
              >
                <h2 id={`gruppe-${group}`} className="font-semibold text-lg">
                  {text.groups[group]}
                </h2>
                {rules.length === 0 ? (
                  <p className="text-muted-foreground">{text.emptyRules}</p>
                ) : (
                  <Table>
                    <caption className="sr-only">{text.groups[group]}</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{text.right}</TableHead>
                        <TableHead>{text.obligation}</TableHead>
                        <TableHead className="hidden sm:table-cell">{text.fromImpact}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rights.map((rule) => {
                        const partner = rule.counterpartId
                          ? byId.get(rule.counterpartId)
                          : undefined;
                        return (
                          <TableRow key={rule.id}>
                            <TableCell className="whitespace-normal font-medium">
                              {title(rule)}
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              {partner ? (
                                title(partner)
                              ) : (
                                <Badge variant="warning">
                                  <TriangleAlertIcon aria-hidden />
                                  {text.noCounterpart}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">
                              {text.impactLevels[rule.minImpactLevel - 1]}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {loose.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="whitespace-normal text-muted-foreground">
                            {text.noRight}
                          </TableCell>
                          <TableCell className="whitespace-normal">{title(rule)}</TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {text.impactLevels[rule.minImpactLevel - 1]}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

/** Neu (id leer) oder Bearbeiten eines Rechts oder einer Pflicht, auf eigener Seite. */
export function RuleFormPage({ id }: { id?: string }) {
  const t = useT();
  const text = t.playbook;
  const query = usePlaybook();
  const title = id ? text.editRule : text.newRule;
  const trail = [
    ...settingsTrail(t),
    { label: text.title, href: playbookPath },
    { label: text.rulesTitle, href: rulesPath },
  ];
  const existing = id ? query.data?.rules.find((rule) => rule.id === id) : undefined;

  return (
    <>
      <PagePath trail={trail} current={title} />
      <PageHeader title={title} purpose={text.formPurpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : id && !existing ? (
        <EmptyState size="lg" title={text.notFound} description={t.notFound.description} />
      ) : !query.data.canManage ? (
        <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
          {text.adminOnly}
        </p>
      ) : (
        <RuleForm rules={query.data.rules} existing={existing} accessToken={query.accessToken} />
      )}
    </>
  );
}

const emptyText = { de: '', en: '' };

function RuleForm({
  rules,
  existing,
  accessToken,
}: {
  rules: RuleItem[];
  existing: RuleItem | undefined;
  accessToken: string;
}) {
  const text = useT().playbook;
  const localized = useLocalized();
  const refresh = useRefreshPlaybook();
  const goBack = useGoBack(rulesPath);
  const [form, setForm] = useState<SaveRuleItem>(
    existing
      ? {
          kind: existing.kind,
          group: existing.group,
          title: existing.title,
          description: existing.description,
          counterpartId: existing.counterpartId,
          minImpactLevel: existing.minImpactLevel,
        }
      : {
          kind: 'right',
          group: 'cost',
          title: emptyText,
          description: emptyText,
          counterpartId: null,
          minImpactLevel: 1,
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const opposite: RuleKind = form.kind === 'right' ? 'obligation' : 'right';
  const candidates = rules.filter((rule) => rule.kind === opposite && rule.id !== existing?.id);
  const setText = (field: 'title' | 'description', language: 'de' | 'en', value: string) =>
    setForm({ ...form, [field]: { ...form[field], [language]: value } });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const parsed = saveRuleItemSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] = text.required;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveRuleItem(accessToken, existing?.id ?? null, parsed.data);
      await refresh();
      flash.set(text.saved);
      goBack();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <span aria-hidden className="font-medium">
          {text.kind}
        </span>
        <SegmentedControl
          label={text.kind}
          value={form.kind}
          options={ruleKinds.map((kind) => ({ value: kind, label: text.kinds[kind] }))}
          onChange={(kind) =>
            setForm({
              ...form,
              kind,
              counterpartId: kind === form.kind ? form.counterpartId : null,
            })
          }
        />
      </div>
      <FormField label={text.group}>
        {(field) => (
          <NativeSelect
            {...field}
            value={form.group}
            onChange={(event) =>
              setForm({ ...form, group: event.target.value as SaveRuleItem['group'] })
            }
          >
            {ruleGroups.map((group) => (
              <option key={group} value={group}>
                {text.groups[group]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {(['de', 'en'] as const).map((language) => (
        <FormField
          key={`title-${language}`}
          label={language === 'de' ? text.titleDe : text.titleEn}
          error={errors[`title.${language}`]}
        >
          {(field) => (
            <Input
              {...field}
              maxLength={200}
              value={form.title[language]}
              onChange={(event) => setText('title', language, event.target.value)}
            />
          )}
        </FormField>
      ))}
      {(['de', 'en'] as const).map((language) => (
        <FormField
          key={`description-${language}`}
          label={language === 'de' ? text.descriptionDe : text.descriptionEn}
          error={errors[`description.${language}`]}
        >
          {(field) => (
            <Textarea
              {...field}
              rows={3}
              maxLength={1000}
              value={form.description[language]}
              onChange={(event) => setText('description', language, event.target.value)}
            />
          )}
        </FormField>
      ))}
      <FormField label={text.counterpart} hint={text.counterpartHint}>
        {(field) => (
          <NativeSelect
            {...field}
            value={form.counterpartId ?? ''}
            onChange={(event) => setForm({ ...form, counterpartId: event.target.value || null })}
          >
            <option value="">{text.none}</option>
            {candidates.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {`${text.groups[rule.group]} · ${localized(rule.title)}`}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {form.kind === 'right' && !form.counterpartId && (
        <StatusLine message={text.noCounterpartWarning} tone="warning" />
      )}
      <FormField label={text.minImpact} hint={text.minImpactHint}>
        {(field) => (
          <NativeSelect
            {...field}
            value={String(form.minImpactLevel)}
            onChange={(event) => setForm({ ...form, minImpactLevel: Number(event.target.value) })}
          >
            {[1, 2, 3].map((level) => (
              <option key={level} value={level}>
                {text.impactLevels[level - 1]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.save}
        </Button>
      </FormActions>
    </form>
  );
}
