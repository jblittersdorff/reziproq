import { Link } from '@tanstack/react-router';
import { ArrowUpIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { SupplierCard } from '@/features/suppliers/supplier-card';
import { useT } from '@/lib/i18n';
import { type PromptTurn, usePromptConversation } from './use-prompt-conversation';

/**
 * Fragen an Reziproq als eigene Seite (PLT-11, PLT-12): ein großes Feld, Vorschläge oder das
 * Gespräch, ein Hinweis. Cmd+K führt von jeder Seite hierher.
 */
export function QuestionsPage({ initialQuestion }: { initialQuestion?: string | undefined }) {
  const t = useT();
  const [question, setQuestion] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const submittedQuestion = useRef<string | null>(null);

  const { turns, ask, reset, busy } = usePromptConversation();

  useEffect(() => {
    const text = initialQuestion?.trim();
    if (!text) {
      submittedQuestion.current = null;
      return;
    }
    if (submittedQuestion.current === text) return;
    // StrictMode runs effects twice in development; defer until its cleanup replay has finished.
    const timer = window.setTimeout(() => {
      submittedQuestion.current = text;
      void ask(text);
    });
    return () => window.clearTimeout(timer);
  }, [ask, initialQuestion]);

  // Neue Antworten bleiben sichtbar, auch wenn das Gespräch länger wird.
  const lastAnswer = turns.at(-1)?.answer;
  useEffect(() => {
    if (lastAnswer !== undefined) end.current?.scrollIntoView?.({ block: 'end' });
  }, [lastAnswer]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    setQuestion('');
    void ask(text);
  };

  const suggestions = [
    t.prompt.suggestionTopSpend,
    t.prompt.suggestionMaterialGroup,
    t.prompt.suggestionSupplierSpend,
  ];

  return (
    // Vorlage Fragen.dc.html: schmale Spalte, Frage als Tinte-Blase, Antwort als Karte mit Logo.
    <div className="mx-auto flex w-full max-w-200 flex-col gap-6">
      <PagePath trail={[{ label: t.app.name, href: '/start' }]} current={t.prompt.title} />
      <PageHeader size="list" title={t.prompt.title} purpose={t.prompt.disclaimer} />
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-lg bg-card py-2.5 pr-3.5 pl-4 shadow-ask focus-within:ring-3 focus-within:ring-ring/50"
      >
        <BrandMark className="ml-1" />
        <Input
          ref={input}
          autoFocus
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-label={t.prompt.question}
          placeholder={t.prompt.placeholder}
          className="h-12 flex-1 border-0 bg-transparent text-lg shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          size="icon"
          className="bg-ink text-mint hover:bg-ink/90"
          aria-label={t.prompt.send}
          disabled={!question.trim() || busy}
        >
          <ArrowUpIcon />
        </Button>
      </form>

      <div>
        {turns.length === 0 ? (
          <section aria-labelledby="prompt-vorschlaege" className="flex flex-wrap gap-2">
            <h2
              id="prompt-vorschlaege"
              className="w-full pb-1 font-sans font-semibold text-muted-foreground text-sm"
            >
              {t.prompt.suggestions}
            </h2>
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="secondary"
                onClick={() => {
                  setQuestion(suggestion);
                  input.current?.focus();
                }}
                className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left font-medium"
              >
                {suggestion}
              </Button>
            ))}
          </section>
        ) : (
          <ol className="flex flex-col gap-6">
            {turns.map((turn) => (
              <Turn key={turn.id} turn={turn} />
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>

      {turns.length > 0 && (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              input.current?.focus();
            }}
          >
            <RefreshCwIcon />
            {t.prompt.restart}
          </Button>
        </div>
      )}
    </div>
  );
}

function Turn({ turn }: { turn: PromptTurn }) {
  const t = useT();
  return (
    <li className="flex flex-col gap-4">
      <p className="max-w-4/5 self-end rounded-t-lg rounded-br-sm rounded-bl-lg bg-ink px-5 py-3.5 text-base text-on-dark">
        {turn.question}
      </p>

      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card shadow-card">
          <BrandMark className="h-4.5 w-6.5" />
        </span>
        <div
          aria-live="polite"
          aria-busy={turn.status === 'answering'}
          className="flex min-w-0 flex-1 flex-col gap-3.5 rounded-tl-sm rounded-r-lg rounded-bl-lg bg-card px-6 py-5.5 text-base leading-relaxed shadow-card"
        >
          {turn.answer ? (
            <p className="whitespace-pre-wrap text-base">{turn.answer}</p>
          ) : (
            turn.status === 'answering' && <AnsweringDots />
          )}

          {turn.suppliers?.length === 0 && (
            <p className="text-muted-foreground">{t.prompt.noHits}</p>
          )}
          {turn.suppliers && turn.suppliers.length > 0 && (
            <ul aria-label={t.prompt.hits} className="grid gap-3 sm:grid-cols-2">
              {turn.suppliers.map((supplier) => (
                <SupplierCard key={supplier.relationshipId} supplier={supplier} headingLevel={3} />
              ))}
            </ul>
          )}

          {turn.destination?.type === 'area' && (
            <Button asChild variant="secondary" className="w-fit">
              <Link to={turn.destination.path}>{t.prompt.openArea}</Link>
            </Button>
          )}
          {turn.destination?.type === 'supplierSpend' && (
            <Button asChild variant="secondary" className="w-fit">
              <Link
                to="/lieferanten/$id/strategie/spend"
                params={{ id: turn.destination.relationshipId }}
              >
                {t.prompt.openSpend}
              </Link>
            </Button>
          )}

          {turn.status === 'failed' && (
            <p role="alert" className="text-destructive">
              {t.prompt.failed}
            </p>
          )}
          {turn.status === 'rateLimited' && (
            <p role="alert" className="text-muted-foreground">
              {t.prompt.rateLimited}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/** Ruhiger Ladezustand: drei pulsierende Punkte. */
function AnsweringDots() {
  const t = useT();
  return (
    <p role="status" className="flex items-center gap-1 py-2">
      <span className="sr-only">{t.prompt.answering}</span>
      {['0', '1', '2'].map((step) => (
        <span
          key={step}
          aria-hidden
          className="size-2 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
          style={{ animationDelay: `calc(var(--motion-duration) * ${step} * 2)` }}
        />
      ))}
    </p>
  );
}
