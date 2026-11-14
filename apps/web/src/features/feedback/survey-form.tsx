import { type SurveyDimension, type SurveyQuestion, surveyScale } from '@reziproq/shared';
import { useId } from 'react';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { de } from '@/locales/de';
import { en } from '@/locales/en';

// PUL-01 Vorschau, PUL-02 Beantworten: dieselbe Darstellung für Teilnehmende. Die Sprache folgt
// dem Fragebogen, nicht der Oberfläche, damit die Vorschau beide Sprachen zeigen kann.

export type SurveyLanguage = 'de' | 'en';
/** Ist und Soll je Frage; null heißt „Kann ich nicht beurteilen“, undefined noch offen. */
export type SurveyAnswer = { current?: number | null; target?: number | null };

const messages = { de, en };

function ScaleField({
  legend,
  value,
  onChange,
  language,
}: {
  legend: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  language: SurveyLanguage;
}) {
  const text = messages[language].surveyForm;
  const name = useId();
  const option =
    'relative flex min-h-11 cursor-pointer items-center justify-center rounded-sm px-3 font-medium text-sm text-muted-foreground transition-colors has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50';
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">{legend}</legend>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-5 gap-1 rounded-md bg-secondary p-0.5">
            {surveyScale.map((step) => (
              <label key={step} className={`${option} min-w-11 tabular-nums`}>
                <input
                  type="radio"
                  name={name}
                  value={step}
                  checked={value === step}
                  onChange={() => onChange(step)}
                  className="sr-only"
                />
                {step}
              </label>
            ))}
          </div>
          <p className="flex justify-between text-muted-foreground text-xs" aria-hidden>
            <span>{text.low}</span>
            <span>{text.high}</span>
          </p>
        </div>
        <label className={`${option} bg-secondary`}>
          <input
            type="radio"
            name={name}
            value=""
            checked={value === null}
            onChange={() => onChange(null)}
            className="sr-only"
          />
          {text.cannotJudge}
        </label>
      </div>
    </fieldset>
  );
}

export function SurveyQuestionnaire({
  questions,
  language,
  answers,
  onAnswer,
  comment,
  onComment,
  groupByDimension,
  numbering,
  showComment = true,
  missing = [],
}: {
  questions: SurveyQuestion[];
  language: SurveyLanguage;
  answers: Record<string, SurveyAnswer>;
  onAnswer: (key: string, answer: SurveyAnswer) => void;
  comment: string;
  onComment: (value: string) => void;
  groupByDimension: boolean;
  /** Fragen über mehrere Seiten durchzählen (PUL-02b): Versatz und Gesamtzahl */
  numbering?: { offset: number; total: number };
  showComment?: boolean;
  /** Fragen ohne vollständige Antwort, hervorgehoben */
  missing?: string[];
}) {
  const t = messages[language];
  const active = questions.filter((question) => question.active);
  const groups: { dimension: SurveyDimension | null; questions: SurveyQuestion[] }[] =
    groupByDimension
      ? [...new Set(active.map((question) => question.dimension))].map((dimension) => ({
          dimension,
          questions: active.filter((question) => question.dimension === dimension),
        }))
      : [{ dimension: null, questions: active }];
  let index = numbering?.offset ?? 0;
  const total = numbering?.total ?? active.length;
  return (
    <div lang={language} data-slot="survey-form" className="flex max-w-3xl flex-col gap-8">
      {groups.map((group) => (
        <section
          key={group.dimension ?? 'all'}
          aria-label={group.dimension ? t.settings.survey.dimensions[group.dimension] : undefined}
          className="flex flex-col gap-4"
        >
          {group.dimension && (
            <h2 className="font-bold text-xl tracking-title">
              {t.settings.survey.dimensions[group.dimension]}
            </h2>
          )}
          {group.questions.map((question) => {
            index += 1;
            const answer = answers[question.key] ?? {};
            const text = language === 'de' ? question.textDe : question.textEn;
            return (
              <article
                key={question.key}
                data-question={question.key}
                data-missing={missing.includes(question.key) || undefined}
                className="flex flex-col gap-5 rounded-xl bg-card p-5 data-missing:outline-2 data-missing:outline-destructive"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    {t.surveyForm.question(index, total)}
                  </span>
                  <h3 className="font-semibold text-lg">{text}</h3>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <ScaleField
                    legend={t.surveyForm.current}
                    language={language}
                    value={answer.current}
                    onChange={(value) => onAnswer(question.key, { ...answer, current: value })}
                  />
                  <ScaleField
                    legend={t.surveyForm.target}
                    language={language}
                    value={answer.target}
                    onChange={(value) => onAnswer(question.key, { ...answer, target: value })}
                  />
                </div>
              </article>
            );
          })}
        </section>
      ))}
      {showComment && (
        <FormField label={t.surveyForm.comment}>
          {(field) => (
            <Textarea
              {...field}
              rows={4}
              maxLength={2000}
              value={comment}
              onChange={(event) => onComment(event.target.value)}
            />
          )}
        </FormField>
      )}
    </div>
  );
}
