import {
  type SurveyDetail,
  type SurveyDimension,
  type SurveyKind,
  type SurveyQuestion,
  surveyDimensions,
  surveyKinds,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ActivityIcon, CalendarCheckIcon, EyeIcon, PlusIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tile, TileIcon, TileMetric, TileText, TileTitle } from '@/components/ui/tile';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { ApiError, saveSurveyQuestion, surveyQueryOptions, surveysQueryOptions } from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { type SurveyAnswer, type SurveyLanguage, SurveyQuestionnaire } from './survey-form';

// PUL-01: Einstellungen › Fragebogen. Zwei Kacheln (Puls, Jahres-Feedback), je Fragebogen die
// Fragen nach Dimension mit Schalter, Bearbeiten auf eigener Seite, Vorschau wie für Teilnehmende.

const basePath = '/einstellungen/fragebogen';
const kindIcons = {
  pulse: <ActivityIcon aria-hidden />,
  annual: <CalendarCheckIcon aria-hidden />,
};

export const isSurveyKind = (value: string): value is SurveyKind =>
  (surveyKinds as readonly string[]).includes(value);

function useTrail(extra: { label: string; href: string }[] = []) {
  const t = useT();
  return [
    { label: t.profile.title, href: '/profil' },
    { label: t.settings.title, href: '/einstellungen' },
    ...extra,
  ];
}

const textOf = (question: SurveyQuestion, locale: string) =>
  (locale.startsWith('en') ? question.textEn : question.textDe) ||
  question.textDe ||
  question.textEn;

export function SurveysPage() {
  const t = useT();
  const text = t.settings.survey;
  const accessToken = useToken();
  const format = useFormat();
  const query = useQuery({ ...surveysQueryOptions(accessToken), enabled: accessToken !== '' });
  return (
    <>
      <PagePath trail={useTrail()} current={text.title} />
      <PageHeader title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {query.data.templates.map((template) => (
            <Tile key={template.kind} asChild interactive size="lg">
              <Link to="/einstellungen/fragebogen/$kind" params={{ kind: template.kind }}>
                <TileIcon>{kindIcons[template.kind]}</TileIcon>
                <TileTitle>{text.kinds[template.kind]}</TileTitle>
                <TileText>{text.kindHints[template.kind]}</TileText>
                <TileMetric
                  value={`${template.active} / ${template.total}`}
                  label={text.activeQuestions}
                />
                <TileText className="text-sm">
                  {text.versionBy(
                    template.version,
                    template.createdByName,
                    format.date(template.createdAt),
                  )}
                </TileText>
              </Link>
            </Tile>
          ))}
        </div>
      )}
    </>
  );
}

function useSurvey(kind: SurveyKind) {
  const accessToken = useToken();
  const query = useQuery({
    ...surveyQueryOptions(accessToken, kind),
    enabled: accessToken !== '',
  });
  return { query, accessToken };
}

export function SurveyPage({ kind }: { kind: string }) {
  const t = useT();
  const text = t.settings.survey;
  const trail = useTrail([{ label: text.title, href: basePath }]);
  if (!isSurveyKind(kind)) {
    return (
      <>
        <PagePath trail={trail} current={text.notFound} />
        <PageHeader title={text.notFound} />
        <EmptyState size="lg" title={text.notFound} description={t.notFound.description} />
      </>
    );
  }
  return <SurveyQuestions kind={kind} trail={trail} />;
}

function SurveyQuestions({
  kind,
  trail,
}: {
  kind: SurveyKind;
  trail: { label: string; href: string }[];
}) {
  const t = useT();
  const text = t.settings.survey;
  const { locale } = useLocale();
  const format = useFormat();
  const queryClient = useQueryClient();
  const { query, accessToken } = useSurvey(kind);
  const [message, hideMessage] = useFlash();
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const title = text.kinds[kind] ?? text.title;
  const toggle = async (question: SurveyQuestion, active: boolean) => {
    setFailure(null);
    setPending(question.key);
    try {
      const next = await saveSurveyQuestion(accessToken, kind, question.key, {
        dimension: question.dimension,
        textDe: question.textDe,
        textEn: question.textEn,
        active,
      });
      queryClient.setQueryData(['surveys', kind], next);
      await queryClient.invalidateQueries({ queryKey: ['surveys'], exact: true });
    } catch (error) {
      setFailure(error instanceof ApiError && error.status === 409 ? text.stale : text.saveFailed);
    } finally {
      setPending(null);
    }
  };
  const data = query.data;
  const dimensions = surveyDimensions.filter((dimension) =>
    data?.template.questions.some((question) => question.dimension === dimension),
  );
  return (
    <>
      <PagePath trail={trail} current={title} />
      <PageHeader
        title={title}
        purpose={
          data
            ? `${text.version(data.template.version)} · ${text.activeCount(
                data.template.questions.filter((question) => question.active).length,
                data.template.questions.length,
              )}`
            : (text.kindHints[kind] ?? '')
        }
      />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {failure && <StatusLine message={failure} tone="warning" />}
      <div className="flex flex-wrap justify-end gap-3">
        {routerLink({
          href: `${basePath}/${kind}/vorschau`,
          className: buttonVariants({ variant: 'outline' }),
          children: (
            <>
              <EyeIcon aria-hidden />
              {text.preview}
            </>
          ),
        })}
        {routerLink({
          href: `${basePath}/${kind}/neu`,
          className: buttonVariants(),
          children: (
            <>
              <PlusIcon aria-hidden />
              {text.add}
            </>
          ),
        })}
      </div>
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex flex-col gap-8">
          {dimensions.map((dimension) => (
            <section
              key={dimension}
              aria-labelledby={`dimension-${dimension}`}
              className="flex flex-col gap-3"
            >
              <h2 id={`dimension-${dimension}`} className="font-display font-semibold text-xl tracking-title">
                {text.dimensions[dimension]}
              </h2>
              <ul className="overflow-hidden rounded-lg bg-card shadow-card">
                {data.template.questions
                  .filter((question) => question.dimension === dimension)
                  .map((question) => {
                    const label = textOf(question, locale);
                    const complete = question.textDe !== '' && question.textEn !== '';
                    return (
                      <li
                        key={question.key}
                        data-question={question.key}
                        className="flex items-center gap-4 border-line-soft border-b px-5 py-3 last:border-b-0"
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          {routerLink({
                            href: `${basePath}/${kind}/${encodeURIComponent(question.key)}`,
                            'aria-label': text.edit(label),
                            className: `inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${question.active ? '' : 'text-muted-foreground'}`,
                            children: label,
                          })}
                          {(question.custom || !complete) && (
                            <span className="flex flex-wrap gap-2">
                              {question.custom && <Badge>{text.own}</Badge>}
                              {!complete && <Badge variant="warning">{text.missingLanguage}</Badge>}
                            </span>
                          )}
                        </span>
                        <Switch
                          aria-label={text.activeLabel(label)}
                          checked={question.active}
                          disabled={pending !== null || (!question.active && !complete)}
                          onCheckedChange={(checked) => void toggle(question, checked)}
                        />
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
          <section aria-labelledby="fragebogen-versionen" className="flex flex-col gap-3">
            <h2 id="fragebogen-versionen" className="font-display font-semibold text-xl tracking-title">
              {text.versions}
            </h2>
            <ol className="flex flex-col gap-1 text-muted-foreground text-sm">
              {data.versions.map((version) => (
                <li key={version.id}>
                  {text.versionBy(
                    version.version,
                    version.createdByName,
                    format.dateTime(version.createdAt),
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}

export function SurveyQuestionPage({ kind, questionKey }: { kind: string; questionKey?: string }) {
  const t = useT();
  const text = t.settings.survey;
  const { locale } = useLocale();
  const validKind = isSurveyKind(kind) ? kind : null;
  const accessToken = useToken();
  const query = useQuery({
    ...surveyQueryOptions(accessToken, validKind ?? 'pulse'),
    enabled: accessToken !== '' && validKind !== null,
  });
  const trail = useTrail([
    { label: text.title, href: basePath },
    ...(validKind
      ? [{ label: text.kinds[validKind] ?? '', href: `${basePath}/${validKind}` }]
      : []),
  ]);
  const question = questionKey
    ? query.data?.template.questions.find((entry) => entry.key === questionKey)
    : undefined;
  const title = questionKey ? text.editTitle : text.newTitle;
  if (!validKind || (query.data && questionKey && !question)) {
    return (
      <>
        <PagePath trail={trail} current={text.notFound} />
        <PageHeader title={text.notFound} />
        <EmptyState size="lg" title={text.notFound} description={t.notFound.description} />
      </>
    );
  }
  return (
    <>
      <PagePath trail={trail} current={question ? textOf(question, locale) : title} />
      <PageHeader title={title} purpose={questionKey ? text.editPurpose : text.newPurpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <QuestionForm
          kind={validKind}
          question={question}
          accessToken={accessToken}
          key={query.data.template.version}
        />
      )}
    </>
  );
}

function QuestionForm({
  kind,
  question,
  accessToken,
}: {
  kind: SurveyKind;
  question: SurveyQuestion | undefined;
  accessToken: string;
}) {
  const text = useT().settings.survey;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    dimension: question?.dimension ?? ('trust' as SurveyDimension),
    textDe: question?.textDe ?? '',
    textEn: question?.textEn ?? '',
    active: question?.active ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const back = `${basePath}/${kind}`;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const request = { ...form, textDe: form.textDe.trim(), textEn: form.textEn.trim() };
    const next: Record<string, string> = {};
    if (!request.textDe && !request.textEn) next.textDe = text.required;
    if (request.active && !request.textDe) next.textDe = text.bothLanguages;
    if (request.active && !request.textEn) next.textEn = text.bothLanguages;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    setFailure(null);
    try {
      const saved = await saveSurveyQuestion(accessToken, kind, question?.key ?? null, request);
      queryClient.setQueryData(['surveys', kind], saved satisfies SurveyDetail);
      await queryClient.invalidateQueries({ queryKey: ['surveys'], exact: true });
      flash.set(text.saved);
      await navigate({ to: back });
    } catch (error) {
      setFailure(error instanceof ApiError && error.status === 409 ? text.stale : text.saveFailed);
      setSaving(false);
    }
  };
  const lockedDimension = question !== undefined && !question.custom;
  return (
    <>
      {failure && <StatusLine message={failure} tone="warning" />}
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex max-w-2xl flex-col gap-6"
      >
        <FormField label={text.dimension} hint={lockedDimension ? text.dimensionFixed : undefined}>
          {(field) => (
            <NativeSelect
              {...field}
              disabled={lockedDimension}
              value={form.dimension}
              onChange={(event) =>
                setForm({ ...form, dimension: event.target.value as SurveyDimension })
              }
            >
              {surveyDimensions.map((dimension) => (
                <option key={dimension} value={dimension}>
                  {text.dimensions[dimension]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.textDe} error={errors.textDe}>
          {(field) => (
            <Textarea
              {...field}
              lang="de"
              rows={2}
              maxLength={300}
              value={form.textDe}
              onChange={(event) => setForm({ ...form, textDe: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={text.textEn} error={errors.textEn}>
          {(field) => (
            <Textarea
              {...field}
              lang="en"
              rows={2}
              maxLength={300}
              value={form.textEn}
              onChange={(event) => setForm({ ...form, textEn: event.target.value })}
            />
          )}
        </FormField>
        <div className="flex flex-col gap-1">
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox
              id="question-active"
              checked={form.active}
              onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
            />
            <label htmlFor="question-active">{text.active}</label>
          </div>
          <p className="text-muted-foreground text-sm">{text.activeHint}</p>
        </div>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => void navigate({ to: back })}>
            {text.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {text.save}
          </Button>
        </FormActions>
      </form>
    </>
  );
}

export function SurveyPreviewPage({ kind }: { kind: string }) {
  const t = useT();
  const text = t.settings.survey;
  const { locale } = useLocale();
  const validKind = isSurveyKind(kind) ? kind : null;
  const accessToken = useToken();
  const query = useQuery({
    ...surveyQueryOptions(accessToken, validKind ?? 'pulse'),
    enabled: accessToken !== '' && validKind !== null,
  });
  // Folgt der Sprache der Oberfläche, bis jemand selbst umschaltet (das Profil lädt später).
  const [chosen, setLanguage] = useState<SurveyLanguage | null>(null);
  const language: SurveyLanguage = chosen ?? (locale === 'en' ? 'en' : 'de');
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [comment, setComment] = useState('');
  const trail = useTrail([
    { label: text.title, href: basePath },
    ...(validKind
      ? [{ label: text.kinds[validKind] ?? '', href: `${basePath}/${validKind}` }]
      : []),
  ]);
  if (!validKind) {
    return (
      <>
        <PagePath trail={trail} current={text.notFound} />
        <PageHeader title={text.notFound} />
        <EmptyState size="lg" title={text.notFound} description={t.notFound.description} />
      </>
    );
  }
  return (
    <>
      <PagePath trail={trail} current={text.preview} />
      <PageHeader
        title={`${text.preview}: ${text.kinds[validKind]}`}
        purpose={text.previewPurpose}
      />
      <SegmentedControl
        className="self-start"
        label={text.previewLanguage}
        value={language}
        options={(['de', 'en'] as const).map((value) => ({
          value,
          label: text.languages[value] ?? value,
        }))}
        onChange={setLanguage}
      />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <SurveyQuestionnaire
          questions={query.data.template.questions}
          language={language}
          answers={answers}
          onAnswer={(key, answer) => setAnswers((current) => ({ ...current, [key]: answer }))}
          comment={comment}
          onComment={setComment}
          groupByDimension={validKind === 'annual'}
        />
      )}
    </>
  );
}
