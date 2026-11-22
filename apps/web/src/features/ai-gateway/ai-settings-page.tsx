import {
  type AiSettings,
  aiCustomAgentRoleValues,
  aiFeatureValues,
  aiSettingsSchema,
  aiSourceKindValues,
  type OpportunityTemplateKey,
  templateAssumptionDefaults,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { CheckboxGroup, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ListCard, ListCardHeader } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { MeterBar } from '@/components/ui/meter-bar';
import { NativeSelect } from '@/components/ui/native-select';
import { RowsEditor } from '@/components/ui/rows-editor';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCan } from '@/features/auth/use-permissions';
import { useToken as useAccessToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { aiSettingsQueryOptions, aiUsageQueryOptions, saveAiSettings } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

/** Euro-Betrag als Text für das Eingabefeld: Monatsbudget 15000 → „150“, je Lauf 200 → „2,00“ */
const euroText = (cents: number, locale: string, cents2 = false) =>
  (cents / 100).toLocaleString(locale, {
    minimumFractionDigits: cents2 || cents % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  });

/** Eingabe in Euro → Cent; „2,50“ und „2.50“ gelten beide */
const centsOf = (value: string) => {
  const number = Number(value.trim().replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(number) ? Math.round(number * 100) : Number.NaN;
};

type Draft = {
  publicResearch: boolean;
  sourceKinds: AiSettings['sourceKinds'];
  budgetMonth: string;
  budgetRun: string;
  maxSteps: string;
  customAgentRoles: AiSettings['customAgentRoles'];
  customAgentApproval: boolean;
  overrides: Record<string, string>[];
  valueFinderSegments: string[];
  /** Annahmen der Hebel-Vorlagen in Prozent, Schlüssel „vorlage.feld“ */
  assumptions: Record<string, { low: string; high: string }>;
};

/** Alle Annahmen der Vorlagen mit Startwert */
const assumptionEntries = Object.entries(templateAssumptionDefaults).flatMap(
  ([templateKey, fields]) =>
    Object.entries(fields ?? {}).map(([field, range]) => ({
      key: `${templateKey}.${field}`,
      templateKey: templateKey as OpportunityTemplateKey,
      field,
      range,
    })),
);
const percentText = (value: string) => String(Math.round(Number(value) * 1000) / 10);
const rateOf = (value: string) => {
  const number = Number(value.trim().replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(number)
    ? String(Math.round(number * 1000) / 100000)
    : 'x';
};

const draftOf = (settings: AiSettings, locale: string): Draft => ({
  publicResearch: settings.publicResearch,
  sourceKinds: settings.sourceKinds,
  budgetMonth: euroText(settings.budgetMonthCents, locale),
  budgetRun: euroText(settings.budgetRunCents, locale, true),
  maxSteps: String(settings.maxSteps),
  customAgentRoles: settings.customAgentRoles,
  customAgentApproval: settings.customAgentApproval,
  overrides: settings.agentBudgetOverrides.map((entry) => ({
    agentKey: entry.agentKey,
    budget: euroText(entry.budgetRunCents, locale, true),
  })),
  valueFinderSegments: settings.valueFinderSegments,
  assumptions: Object.fromEntries(
    assumptionEntries.map((entry) => {
      const own = settings.valueAssumptions.find(
        (item) => item.templateKey === entry.templateKey && item.field === entry.field,
      );
      const range = own ?? entry.range;
      return [entry.key, { low: percentText(range.low), high: percentText(range.high) }];
    }),
  ),
});

const settingsOf = (draft: Draft) =>
  aiSettingsSchema.safeParse({
    publicResearch: draft.publicResearch,
    sourceKinds: draft.sourceKinds,
    budgetMonthCents: centsOf(draft.budgetMonth),
    budgetRunCents: centsOf(draft.budgetRun),
    maxSteps: Number(draft.maxSteps),
    customAgentRoles: draft.customAgentRoles,
    customAgentApproval: draft.customAgentApproval,
    agentBudgetOverrides: draft.overrides
      .filter((row) => row.agentKey)
      .map((row) => ({ agentKey: row.agentKey, budgetRunCents: centsOf(row.budget ?? '') })),
    valueFinderSegments: draft.valueFinderSegments,
    valueAssumptions: assumptionEntries.flatMap((entry) => {
      const value = draft.assumptions[entry.key];
      if (!value) return [];
      const low = rateOf(value.low);
      const high = rateOf(value.high);
      return low === entry.range.low && high === entry.range.high
        ? []
        : [{ templateKey: entry.templateKey, field: entry.field, low, high }];
    }),
  });

/** Kontingent des Monats: Balken mit Text, darunter je Funktion Aufrufe und Kosten (nur Admins). */
export function UsageCard() {
  const text = useT().aiSettings;
  const { locale } = useLocale();
  const accessToken = useAccessToken();
  const query = useQuery({ ...aiUsageQueryOptions(accessToken), enabled: accessToken !== '' });
  const money = (cents: number) => formatMoney({ amountCents: cents, currency: 'EUR' }, locale);
  const data = query.data;
  const month = data
    ? new Date(`${data.month}-01T12:00:00Z`).toLocaleDateString(locale, { month: 'long' })
    : '';
  return (
    <ListCard aria-labelledby="ki-verbrauch">
      <ListCardHeader id="ki-verbrauch" title={text.usageTitle(month)} />
      {query.isError ? (
        <ErrorState title={text.usageFailed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex flex-col gap-4 px-5.5 pb-5.5">
          <div className="flex flex-col gap-2">
            <p className="font-display font-semibold text-section tabular-nums">
              {text.usageOf(money(data.usedCents), money(data.budgetMonthCents))}
            </p>
            <MeterBar
              value={data.budgetMonthCents > 0 ? data.usedCents / data.budgetMonthCents : 1}
              label={text.usageMeter(money(data.usedCents), money(data.budgetMonthCents))}
            />
          </div>
          {data.byFeature &&
            (data.byFeature.length === 0 ? (
              <p className="text-muted-foreground text-sm">{text.usageEmpty}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{text.feature}</TableHead>
                    <TableHead className="text-right">{text.calls}</TableHead>
                    <TableHead className="text-right">{text.cost}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byFeature.map((entry) => (
                    <TableRow key={entry.feature}>
                      <TableCell>{text.features[entry.feature] ?? entry.feature}</TableCell>
                      <TableCell className="text-right tabular-nums">{entry.calls}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(entry.costCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">{text.total}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {data.calls}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {money(data.usedCents)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ))}
        </div>
      )}
    </ListCard>
  );
}

/**
 * Einstellungen KI (KI-01), nach Vorlage E-KI: links Daten und Recherche, Kosten, eigene Agenten;
 * rechts der Verbrauch des Monats. Bewusst ohne Freigabe-Karte und Protokoll: Agenten, Läufe und
 * Freigaben kommen mit KI-04 und KI-09. Bis dahin stehen die Funktionen mit Modellaufruf als Agenten.
 */
export function AiSettingsPage() {
  const t = useT();
  const text = t.aiSettings;
  const { locale } = useLocale();
  const accessToken = useAccessToken();
  const canManage = useCan('einstellungen.verwalten');
  const client = useQueryClient();
  const options = aiSettingsQueryOptions(accessToken);
  const query = useQuery({ ...options, enabled: accessToken !== '' && canManage });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = draft ?? (query.data ? draftOf(query.data.settings, locale) : null);
  const update = (patch: Partial<Draft>) => current && setDraft({ ...current, ...patch });
  const readOnly = !query.data?.canEdit;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current) return;
    setSaved(false);
    const parsed = settingsOf(current);
    if (!parsed.success) {
      setFailed(true);
      return;
    }
    setBusy(true);
    try {
      client.setQueryData(options.queryKey, await saveAiSettings(accessToken, parsed.data));
      await client.invalidateQueries({ queryKey: ['ki', 'kontingent'] });
      setDraft(null);
      setFailed(false);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={text.navTitle}
      />
      <PageHeader title={text.title} purpose={text.purpose} />
      <Link
        to="/einstellungen/ki/agenten"
        className="inline-flex min-h-11 items-center self-start font-medium underline"
      >
        {t.agents.title}
      </Link>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {!canManage ? (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
              {t.settings.adminOnly}
            </p>
          ) : query.isError ? (
            <ErrorState title={text.failed} />
          ) : !current ? (
            <LoadingState label={text.loading} />
          ) : (
            <form className="flex flex-col gap-5" onSubmit={submit}>
              {saved && <StatusLine message={text.saved} onHidden={() => setSaved(false)} />}
              {failed && <StatusLine message={text.saveFailed} tone="warning" />}
              <SettingsGroup title={text.dataTitle}>
                <SettingsRow label={text.euOnly} description={text.euOnlyHint} htmlFor="ki-eu">
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">{text.alwaysOn}</span>
                    <Switch id="ki-eu" checked disabled aria-readonly />
                  </span>
                </SettingsRow>
                <SettingsRow
                  label={text.publicResearch}
                  description={text.publicResearchHint}
                  htmlFor="ki-recherche"
                >
                  <Switch
                    id="ki-recherche"
                    checked={current.publicResearch}
                    disabled={readOnly}
                    onCheckedChange={(value) => update({ publicResearch: value })}
                  />
                </SettingsRow>
                <div className="px-4 py-3">
                  <CheckboxGroup
                    legend={text.sources}
                    options={aiSourceKindValues.map((value) => ({
                      value,
                      label: text.sourceKinds[value] ?? value,
                    }))}
                    value={current.sourceKinds}
                    onChange={(value) => update({ sourceKinds: value })}
                  />
                </div>
              </SettingsGroup>
              <SettingsGroup title={text.costsTitle}>
                <div className="grid gap-4 px-4 py-4 sm:grid-cols-3">
                  <FormField label={text.budgetMonth} hint={text.budgetMonthHint}>
                    {(field) => (
                      <Input
                        {...field}
                        inputMode="decimal"
                        value={current.budgetMonth}
                        readOnly={readOnly}
                        onChange={(e) => update({ budgetMonth: e.target.value })}
                      />
                    )}
                  </FormField>
                  <FormField label={text.budgetRun} hint={text.budgetRunHint}>
                    {(field) => (
                      <Input
                        {...field}
                        inputMode="decimal"
                        value={current.budgetRun}
                        readOnly={readOnly}
                        onChange={(e) => update({ budgetRun: e.target.value })}
                      />
                    )}
                  </FormField>
                  <FormField label={text.maxSteps} hint={text.maxStepsHint}>
                    {(field) => (
                      <Input
                        {...field}
                        inputMode="numeric"
                        value={current.maxSteps}
                        readOnly={readOnly}
                        onChange={(e) => update({ maxSteps: e.target.value })}
                      />
                    )}
                  </FormField>
                </div>
                <div className="px-4 py-4">
                  <RowsEditor
                    legend={text.overrides}
                    columns={[
                      {
                        key: 'agentKey',
                        label: text.overrideAgent,
                        type: 'select',
                        span: 3,
                        options: aiFeatureValues.map((value) => ({
                          value,
                          label: text.features[value] ?? value,
                        })),
                      },
                      { key: 'budget', label: text.overrideBudget, type: 'text', span: 2 },
                    ]}
                    rows={current.overrides}
                    onChange={(rows) => update({ overrides: rows })}
                    addLabel={text.addOverride}
                    removeLabel={text.removeOverride}
                    max={aiFeatureValues.length}
                  />
                </div>
              </SettingsGroup>
              {(query.data?.segmentTypes?.length ?? 0) > 0 && (
                <SettingsGroup title={text.valueFinderTitle}>
                  <div className="flex flex-col gap-2 px-4 py-3">
                    <CheckboxGroup
                      legend={text.valueFinderSegments}
                      options={(query.data?.segmentTypes ?? []).map((type) => ({
                        value: type.key,
                        label: type.name,
                      }))}
                      value={current.valueFinderSegments}
                      onChange={(value) => update({ valueFinderSegments: value })}
                    />
                    <p className="text-muted-foreground text-sm">{text.valueFinderHint}</p>
                  </div>
                </SettingsGroup>
              )}
              <SettingsGroup title={text.assumptionsTitle}>
                <div className="flex flex-col gap-3 px-4 py-4">
                  <p className="text-muted-foreground text-sm">{text.assumptionsHint}</p>
                  {assumptionEntries.map((entry) => {
                    const value = current.assumptions[entry.key] ?? { low: '', high: '' };
                    const label = `${t.opportunities.templates[entry.templateKey]}: ${
                      t.opportunities.fields[entry.field] ?? entry.field
                    }`;
                    const set = (patch: Partial<typeof value>) =>
                      update({
                        assumptions: {
                          ...current.assumptions,
                          [entry.key]: { ...value, ...patch },
                        },
                      });
                    return (
                      <div key={entry.key} className="grid gap-2 sm:grid-cols-2">
                        <FormField label={text.assumptionLow(label)}>
                          {(field) => (
                            <Input
                              {...field}
                              inputMode="decimal"
                              value={value.low}
                              readOnly={readOnly}
                              onChange={(e) => set({ low: e.target.value })}
                            />
                          )}
                        </FormField>
                        <FormField label={text.assumptionHigh(label)}>
                          {(field) => (
                            <Input
                              {...field}
                              inputMode="decimal"
                              value={value.high}
                              readOnly={readOnly}
                              onChange={(e) => set({ high: e.target.value })}
                            />
                          )}
                        </FormField>
                      </div>
                    );
                  })}
                </div>
              </SettingsGroup>
              <SettingsGroup title={text.customTitle}>
                <SettingsRow label={text.customRoles} htmlFor="ki-anlegen">
                  <NativeSelect
                    id="ki-anlegen"
                    value={current.customAgentRoles}
                    disabled={readOnly}
                    onChange={(e) =>
                      update({
                        customAgentRoles: e.target.value as AiSettings['customAgentRoles'],
                      })
                    }
                  >
                    {aiCustomAgentRoleValues.map((value) => (
                      <option key={value} value={value}>
                        {text.customRoleOptions[value]}
                      </option>
                    ))}
                  </NativeSelect>
                </SettingsRow>
                <SettingsRow
                  label={text.customApproval}
                  description={text.customApprovalHint}
                  htmlFor="ki-freigabe"
                >
                  <Switch
                    id="ki-freigabe"
                    checked={current.customAgentApproval}
                    disabled={readOnly}
                    onCheckedChange={(value) => update({ customAgentApproval: value })}
                  />
                </SettingsRow>
              </SettingsGroup>
              {!readOnly && (
                <Button type="submit" className="self-start" loading={busy}>
                  {text.save}
                </Button>
              )}
            </form>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <UsageCard />
        </div>
      </div>
    </>
  );
}
