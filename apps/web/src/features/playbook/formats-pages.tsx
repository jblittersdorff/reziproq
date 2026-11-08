import {
  type FormatItem,
  formatCadences,
  formatLevels,
  type SaveFormatItem,
  saveFormatItemSchema,
} from '@reziproq/shared';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { CheckboxGroup, FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
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
import { saveFormatItem } from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { settingsTrail } from './playbook-page';
import { playbookPath, useLocalized, usePlaybook, useRefreshPlaybook } from './use-playbook';

const formatsPath = `${playbookPath}/formate`;

/** Für welche Typen ein Format gilt, als kurzer Satz. */
export function useAppliesTo() {
  const text = useT().playbook;
  return (format: FormatItem) => {
    const impact = text.fromImpactValue(text.impactLevels[format.minImpactLevel - 1] as string);
    const quality =
      format.forQualityLevels.length === 0
        ? text.allQualities
        : text.onlyQualities(
            format.forQualityLevels.map((level) => text.qualityLevels[level - 1]).join(', '),
          );
    return `Impact ${impact} · ${quality}`;
  };
}

/** Formate mit Ebene, Takt und den Typen, für die sie gelten (PLB-01). */
export function FormatsPage() {
  const t = useT();
  const text = t.playbook;
  const localized = useLocalized();
  const appliesTo = useAppliesTo();
  const query = usePlaybook();
  const [message, hideMessage] = useFlash();

  return (
    <>
      <PagePath
        trail={[...settingsTrail(t), { label: text.title, href: playbookPath }]}
        current={text.formatsTitle}
      />
      <PageHeader title={text.formatsTitle} purpose={text.formatsPurpose} />
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
                <Link to={`${formatsPath}/neu`}>
                  <PlusIcon />
                  {text.new}
                </Link>
              </Button>
            </div>
          )}
          <Table>
            <caption className="sr-only">{text.formatsTitle}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{text.formatsTitle}</TableHead>
                <TableHead className="hidden sm:table-cell">{text.level}</TableHead>
                <TableHead className="hidden sm:table-cell">{text.cadence}</TableHead>
                <TableHead className="hidden md:table-cell">{text.appliesTo}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.formats.map((format) => (
                <TableRow key={format.id}>
                  <TableCell className="whitespace-normal">
                    <Link
                      to="/einstellungen/spielregeln/formate/$id"
                      params={{ id: format.id }}
                      className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {localized(format.name)}
                    </Link>
                    <span className="block text-muted-foreground text-sm sm:hidden">
                      {text.levels[format.level]} · {text.cadences[format.cadence]}
                    </span>
                    <span className="block text-muted-foreground text-sm md:hidden">
                      {appliesTo(format)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {text.levels[format.level]}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {text.cadences[format.cadence]}
                  </TableCell>
                  <TableCell className="hidden whitespace-normal text-muted-foreground md:table-cell">
                    {appliesTo(format)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </>
  );
}

/** Neu (id leer) oder Bearbeiten eines Formats, auf eigener Seite. */
export function FormatFormPage({ id }: { id?: string }) {
  const t = useT();
  const text = t.playbook;
  const query = usePlaybook();
  const title = id ? text.editFormat : text.newFormat;
  const existing = id ? query.data?.formats.find((format) => format.id === id) : undefined;
  return (
    <>
      <PagePath
        trail={[
          ...settingsTrail(t),
          { label: text.title, href: playbookPath },
          { label: text.formatsTitle, href: formatsPath },
        ]}
        current={title}
      />
      <PageHeader title={title} purpose={text.formPurpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : id && !existing ? (
        <EmptyState size="lg" title={text.notFound} description={t.notFound.description} />
      ) : !query.data.canManage ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.adminOnly}
        </p>
      ) : (
        <FormatForm existing={existing} accessToken={query.accessToken} />
      )}
    </>
  );
}

const emptyText = { de: '', en: '' };

function FormatForm({
  existing,
  accessToken,
}: {
  existing: FormatItem | undefined;
  accessToken: string;
}) {
  const text = useT().playbook;
  const refresh = useRefreshPlaybook();
  const goBack = useGoBack(formatsPath);
  const [form, setForm] = useState<SaveFormatItem>(
    existing
      ? {
          name: existing.name,
          purpose: existing.purpose,
          level: existing.level,
          cadence: existing.cadence,
          minImpactLevel: existing.minImpactLevel,
          forQualityLevels: existing.forQualityLevels,
        }
      : {
          name: emptyText,
          purpose: emptyText,
          level: 'management',
          cadence: 'quarterly',
          minImpactLevel: 1,
          forQualityLevels: [],
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const setText = (field: 'name' | 'purpose', language: 'de' | 'en', value: string) =>
    setForm({ ...form, [field]: { ...form[field], [language]: value } });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const parsed = saveFormatItemSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] = text.required;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveFormatItem(accessToken, existing?.id ?? null, parsed.data);
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
      {(['de', 'en'] as const).map((language) => (
        <FormField
          key={`name-${language}`}
          label={language === 'de' ? text.nameDe : text.nameEn}
          error={errors[`name.${language}`]}
        >
          {(field) => (
            <Input
              {...field}
              maxLength={200}
              value={form.name[language]}
              onChange={(event) => setText('name', language, event.target.value)}
            />
          )}
        </FormField>
      ))}
      {(['de', 'en'] as const).map((language) => (
        <FormField
          key={`purpose-${language}`}
          label={language === 'de' ? text.purposeDe : text.purposeEn}
          error={errors[`purpose.${language}`]}
        >
          {(field) => (
            <Textarea
              {...field}
              rows={3}
              maxLength={1000}
              value={form.purpose[language]}
              onChange={(event) => setText('purpose', language, event.target.value)}
            />
          )}
        </FormField>
      ))}
      <FormField label={text.level}>
        {(field) => (
          <NativeSelect
            {...field}
            value={form.level}
            onChange={(event) =>
              setForm({ ...form, level: event.target.value as SaveFormatItem['level'] })
            }
          >
            {formatLevels.map((level) => (
              <option key={level} value={level}>
                {text.levels[level]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={text.cadence}>
        {(field) => (
          <NativeSelect
            {...field}
            value={form.cadence}
            onChange={(event) =>
              setForm({ ...form, cadence: event.target.value as SaveFormatItem['cadence'] })
            }
          >
            {formatCadences.map((cadence) => (
              <option key={cadence} value={cadence}>
                {text.cadences[cadence]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
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
      <div className="flex flex-col gap-1">
        <CheckboxGroup
          legend={text.qualities}
          options={[1, 2, 3].map((level) => ({
            value: String(level),
            label: text.qualityLevels[level - 1] as string,
          }))}
          value={form.forQualityLevels.map(String)}
          onChange={(values) => setForm({ ...form, forQualityLevels: values.map(Number).sort() })}
        />
        <p className="text-muted-foreground text-sm">{text.qualitiesHint}</p>
      </div>
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
