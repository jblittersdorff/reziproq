import {
  allHintRuleKeys,
  defaultHintThresholds,
  earlyWarningRuleKeys,
  type HintRuleSettings,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/features/auth/use-permissions';
import { hintRulesQueryOptions, saveHintRules } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Draft = Pick<HintRuleSettings, 'rules' | 'thresholds'>;

/**
 * Einstellungen KI › Hinweise (KI-16): Regeln an oder aus, Schwellen der Frühwarnung und die
 * Bewertung je Regel. Nur Admins (hinweise.einstellen); speichert getrennt vom Formular darüber.
 */
export function HintRulesSection() {
  const t = useT();
  const text = t.hints;
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const canEdit = useCan('hinweise.einstellen');
  const client = useQueryClient();
  const options = hintRulesQueryOptions(accessToken);
  const query = useQuery({ ...options, enabled: accessToken !== '' && canEdit });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!canEdit) return null;
  const current: Draft | null =
    draft ?? (query.data ? { rules: query.data.rules, thresholds: query.data.thresholds } : null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current) return;
    setBusy(true);
    setSaved(false);
    setFailed(false);
    try {
      client.setQueryData(options.queryKey, await saveHintRules(accessToken, current));
      await client.invalidateQueries({ queryKey: ['hinweise'], exact: true });
      setDraft(null);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const ratings = query.data?.ratings ?? [];
  return (
    <section
      id="hinweise"
      aria-labelledby="ki-hinweise"
      className="flex scroll-mt-32 flex-col gap-3"
    >
      <h2 id="ki-hinweise" className="font-display font-semibold text-section tracking-section">
        {text.rulesTitle}
      </h2>
      <p className="text-muted-foreground text-sm">{text.rulesPurpose}</p>
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !current ? (
        <LoadingState label={text.loading} />
      ) : (
        <form className="flex flex-col gap-5" onSubmit={submit}>
          {saved && <StatusLine message={text.rulesSaved} onHidden={() => setSaved(false)} />}
          {failed && <StatusLine message={text.failedSave} tone="warning" />}
          <SettingsGroup>
            {allHintRuleKeys.map((rule) => {
              const id = `hinweis-regel-${rule}`;
              return (
                <SettingsRow
                  key={rule}
                  label={text.rules[rule]}
                  htmlFor={id}
                  {...(rule === 'public_event' && { description: text.needsResearch })}
                >
                  <Switch
                    id={id}
                    checked={current.rules[rule] !== false}
                    onCheckedChange={(value) =>
                      setDraft({ ...current, rules: { ...current.rules, [rule]: value } })
                    }
                  />
                </SettingsRow>
              );
            })}
          </SettingsGroup>
          <SettingsGroup title={text.threshold}>
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              {earlyWarningRuleKeys.flatMap((rule) =>
                Object.keys(defaultHintThresholds[rule]).map((key) => {
                  const value = current.thresholds[rule]?.[key] ?? '';
                  return (
                    <FormField
                      key={`${rule}.${key}`}
                      label={`${text.rules[rule]}: ${text.thresholdLabels[rule]?.[key] ?? key}`}
                    >
                      {(field) => (
                        <Input
                          {...field}
                          type="number"
                          step="any"
                          min={0}
                          value={value}
                          onChange={(event) =>
                            setDraft({
                              ...current,
                              thresholds: {
                                ...current.thresholds,
                                [rule]: {
                                  ...current.thresholds[rule],
                                  [key]: Number(event.target.value),
                                },
                              },
                            })
                          }
                        />
                      )}
                    </FormField>
                  );
                }),
              )}
            </div>
          </SettingsGroup>
          <Button type="submit" variant="secondary" className="self-start" loading={busy}>
            {text.saveRules}
          </Button>
          <SettingsGroup title={text.ratingsTitle}>
            {ratings.length === 0 ? (
              <p className="px-4 py-3 text-muted-foreground text-sm">{text.ratingsEmpty}</p>
            ) : (
              <dl className="divide-y divide-line-soft">
                {ratings.map((rating) => (
                  <div
                    key={rating.ruleKey}
                    className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <dt>{text.rules[rating.ruleKey]}</dt>
                    <dd className="text-muted-foreground tabular-nums">
                      {text.ratingValue(rating.helpful, rating.notHelpful)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </SettingsGroup>
        </form>
      )}
    </section>
  );
}
