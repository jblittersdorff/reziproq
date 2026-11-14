import type { PublicSurvey, SubmitSurvey, SurveyDimension, SurveyQuestion } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarXIcon, CircleCheckIcon, LinkIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StepActions, StepProgress } from '@/components/ui/step-progress';
import { PageHeader } from '@/features/shell/page-header';
import { ApiError, publicSurveyQueryOptions, submitSurvey } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { de } from '@/locales/de';
import { en } from '@/locales/en';
import { type SurveyAnswer, type SurveyLanguage, SurveyQuestionnaire } from './survey-form';

// PUL-02b: Beantworten über /umfrage/<token> ohne Anmeldung. Je Dimension eine Seite mit
// Fortschritt; am Ende Freitext und Absenden. Der Zwischenstand bleibt nur auf diesem Gerät, damit
// nirgends Antworten mit einer Person verbunden gespeichert sind.

const messages = { de, en };

interface Draft {
  answers: Record<string, SurveyAnswer>;
  comment: string;
  page: number;
}

const draftKey = (token: string) => `reziproq:umfrage:${token}`;

function readDraft(token: string): Draft {
  const empty: Draft = { answers: {}, comment: '', page: 0 };
  try {
    const stored = localStorage.getItem(draftKey(token));
    return stored ? { ...empty, ...(JSON.parse(stored) as Partial<Draft>) } : empty;
  } catch {
    return empty;
  }
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <main id="inhalt" className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:py-16">
      <p className="font-semibold">{de.app.name}</p>
      {children}
    </main>
  );
}

/** Seiten: beim Puls eine, beim Jahres-Feedback eine je Dimension. */
function pagesOf(survey: PublicSurvey): SurveyQuestion[][] {
  if (survey.kind === 'pulse') return [survey.questions];
  const dimensions = [...new Set(survey.questions.map((question) => question.dimension))];
  return dimensions.map((dimension: SurveyDimension) =>
    survey.questions.filter((question) => question.dimension === dimension),
  );
}

export function AnswerPage({ token }: { token: string }) {
  const { locale } = useLocale();
  // Folgt der Sprache des Browsers, bis jemand selbst umschaltet.
  const [chosen, setLanguage] = useState<SurveyLanguage | null>(null);
  const language: SurveyLanguage = chosen ?? (locale === 'en' ? 'en' : 'de');
  const text = messages[language].surveyAnswer;
  const query = useQuery(publicSurveyQueryOptions(token));

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Frame>
        <PageHeader title={text.title} />
        {notFound ? (
          <EmptyState
            size="lg"
            icon={<LinkIcon aria-hidden />}
            title={text.notFoundTitle}
            description={text.notFoundDescription}
          />
        ) : (
          <ErrorState title={text.failed} />
        )}
      </Frame>
    );
  }
  if (!query.data) {
    return (
      <Frame>
        <PageHeader title={text.title} />
        <LoadingState label={text.loading} />
      </Frame>
    );
  }
  const survey = query.data;
  const title = `${survey.buyer} · ${survey.supplier}`;
  if (survey.status !== 'open') {
    const used = survey.status === 'used';
    return (
      <Frame>
        <PageHeader title={title} />
        <EmptyState
          size="lg"
          icon={used ? <CircleCheckIcon aria-hidden /> : <CalendarXIcon aria-hidden />}
          title={used ? text.usedTitle : text.expiredTitle}
          description={used ? text.usedDescription : text.expiredDescription}
        />
      </Frame>
    );
  }
  return (
    <Frame>
      <OpenSurvey
        token={token}
        survey={survey}
        title={title}
        language={language}
        onLanguage={setLanguage}
      />
    </Frame>
  );
}

function OpenSurvey({
  token,
  survey,
  title,
  language,
  onLanguage,
}: {
  token: string;
  survey: PublicSurvey;
  title: string;
  language: SurveyLanguage;
  onLanguage: (language: SurveyLanguage) => void;
}) {
  const text = messages[language].surveyAnswer;
  const format = useFormat();
  const queryClient = useQueryClient();
  const pages = pagesOf(survey);
  const [draft, setDraft] = useState<Draft>(() => readDraft(token));
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const page = Math.min(draft.page, pages.length - 1);
  const questions = pages[page] ?? [];
  const last = page === pages.length - 1;
  const offset = pages.slice(0, page).reduce((sum, entry) => sum + entry.length, 0);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(token), JSON.stringify(draft));
    } catch {
      // Ohne Speicher bleibt der Zwischenstand nur bis zum Schließen der Seite.
    }
  }, [draft, token]);

  const incomplete = (list: SurveyQuestion[]) =>
    list
      .filter((question) => {
        const answer = draft.answers[question.key];
        return answer?.current === undefined || answer?.target === undefined;
      })
      .map((question) => question.key);

  const go = (next: number) => {
    if (next > page) {
      const open = incomplete(questions);
      setMissing(open);
      if (open.length > 0) {
        setError(text.missing);
        return;
      }
    }
    setError(null);
    setMissing([]);
    setDraft({ ...draft, page: next });
    window.scrollTo?.({ top: 0 });
  };

  const send = async () => {
    const open = incomplete(survey.questions);
    setMissing(open);
    if (open.length > 0) {
      setError(text.missing);
      return;
    }
    setSending(true);
    setError(null);
    const answers: SubmitSurvey['answers'] = {};
    for (const question of survey.questions) {
      const answer = draft.answers[question.key];
      answers[question.key] = {
        current: (answer?.current ?? null) as SubmitSurvey['answers'][string]['current'],
        target: (answer?.target ?? null) as SubmitSurvey['answers'][string]['target'],
      };
    }
    try {
      const result = await submitSurvey(token, {
        answers,
        comment: draft.comment.trim() || null,
      });
      try {
        localStorage.removeItem(draftKey(token));
      } catch {
        // siehe oben
      }
      queryClient.setQueryData(['umfrage', token], result);
    } catch (failure) {
      if (failure instanceof ApiError && (failure.status === 409 || failure.status === 410)) {
        await queryClient.invalidateQueries({ queryKey: ['umfrage', token] });
        return;
      }
      setError(text.submitFailed);
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader title={title} purpose={text.purpose} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">{text.due(format.date(survey.dueDate))}</p>
        <SegmentedControl
          label={text.language}
          value={language}
          options={[
            { value: 'de', label: messages.de.surveyAnswer.languageName },
            { value: 'en', label: messages.en.surveyAnswer.languageName },
          ]}
          onChange={onLanguage}
        />
      </div>
      {pages.length > 1 && (
        <StepProgress
          current={page + 1}
          total={pages.length}
          label={text.page}
          stepTitle={
            messages[language].settings.survey.dimensions[questions[0]?.dimension ?? ''] ??
            text.allQuestions
          }
        />
      )}
      <SurveyQuestionnaire
        questions={questions}
        language={language}
        answers={draft.answers}
        onAnswer={(key, answer) =>
          setDraft((current) => ({ ...current, answers: { ...current.answers, [key]: answer } }))
        }
        comment={draft.comment}
        onComment={(comment) => setDraft((current) => ({ ...current, comment }))}
        groupByDimension={false}
        numbering={{ offset, total: survey.questions.length }}
        showComment={last}
        missing={missing}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <StepActions
        back={
          page > 0 ? (
            <Button variant="secondary" onClick={() => go(page - 1)}>
              {text.back}
            </Button>
          ) : undefined
        }
        next={
          last ? (
            <Button loading={sending} onClick={() => void send()}>
              {text.submit}
            </Button>
          ) : (
            <Button onClick={() => go(page + 1)}>{text.next}</Button>
          )
        }
      />
      <p className="text-muted-foreground text-sm">{text.saved}</p>
    </>
  );
}
