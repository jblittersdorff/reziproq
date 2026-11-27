import { minSearchLength } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowUpIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { useMe } from '@/features/auth/use-me';
import { routerLink } from '@/features/shell/navigation';
import { useToken } from '@/features/ratings/use-rating';
import { SupplierCard } from '@/features/suppliers/supplier-card';
import { customerListQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { SearchHits } from './search-hits';
import { type PromptTurn, usePromptConversation } from './use-prompt-conversation';

/**
 * Inhalt von Frag Reziproq (NAV-10 2.0, PLT-12, Vorlage `Fragen.dc.html`): ein großes Feld,
 * Vorschläge oder das Gespräch, darunter der Hinweis auf die Daten. Steht in der Überlagerung
 * (components/ui/ask-overlay.tsx); ⌘K öffnet sie von jeder Seite.
 */
export function AskPanel({
  initialQuestion,
  customer,
  supplier,
}: {
  initialQuestion?: string | undefined;
  /** NAV-10: Beziehung, auf deren Seite die Frage gestellt wurde */
  supplier?: string | undefined;
  /** QS-05: Lieferanten-Nutzer, Beziehung des aktuellen Kunden */
  customer?: string | undefined;
}) {
  const me = useMe();
  const t = useT();
  // Erst wenn feststeht, welche Seite die Person hat, erscheint ein Feld: Die Lieferantenseite
  // sieht nie die KI-Fragen des Käufers, auch nicht kurz.
  if (!me.data) return <LoadingState label={t.user.loading} />;
  // Lieferantenseite (LIF-02, QS-05): Suche im aktuellen Kunden, ohne KI-Fragen.
  if (!me.data.permissions.viewBuyerAreas && me.data.permissions.viewCustomers) {
    return <SupplierSearch customer={customer} />;
  }
  return <BuyerQuestions initialQuestion={initialQuestion} supplier={supplier} />;
}

function BuyerQuestions({
  initialQuestion,
  supplier,
}: {
  initialQuestion?: string | undefined;
  supplier?: string | undefined;
}) {
  const t = useT();
  const [question, setQuestion] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const submittedQuestion = useRef<string | null>(null);

  const { turns, ask, reset, busy } = usePromptConversation(supplier);

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
    // Vorlage Fragen.dc.html: Frage als Tinte-Blase, Antwort als Karte mit Logo, Feld mit Hinweis.
    <div className="flex flex-col gap-6">
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-lg bg-card py-2.5 pr-3.5 pl-4 shadow-ask focus-within:ring-3 focus-within:ring-ring/50"
      >
        <BrandMark className="ml-1" />
        <Input
          ref={input}
          autoFocus
          data-autofocus
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
      <p className="-mt-3 text-muted-foreground text-sm">{t.prompt.disclaimer}</p>

      {/* QS-05: Treffer ohne KI über der Antwort, schon beim Tippen */}
      <SearchHits
        term={question.trim().length >= minSearchLength ? question : (turns.at(-1)?.question ?? '')}
      />

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
            // Ein Bereich kann eine alte Adresse sein, die weiterleitet (/portfolio, K2-b.5)
            <Button asChild variant="secondary" className="w-fit">
              {routerLink({
                href: turn.destination.path,
                className: '',
                children: t.prompt.openArea,
              })}
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

/**
 * QS-05 für Lieferanten-Nutzer: Suchwort und Kunde; Treffer nur im gewählten Kunden. Die KI-Fragen
 * (PLT-12) gehören zur Käuferseite.
 */
function SupplierSearch({ customer }: { customer?: string | undefined }) {
  const t = useT();
  const text = t.prompt.search;
  const accessToken = useToken();
  const customers = useQuery({
    ...customerListQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const [term, setTerm] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const list = customers.data?.customers ?? [];
  const current =
    chosen ??
    list.find((entry) => entry.relationshipId === customer)?.relationshipId ??
    list[0]?.relationshipId;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">{text.supplierPurpose}</p>
      {customers.data && list.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {text.noCustomers}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {list.length > 1 && (
              <FormField label={text.customer} className="sm:w-64">
                {(field) => (
                  <NativeSelect
                    {...field}
                    value={current ?? ''}
                    onChange={(event) => setChosen(event.target.value)}
                  >
                    {list.map((entry) => (
                      <option key={entry.relationshipId} value={entry.relationshipId}>
                        {entry.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
            <FormField label={text.supplierField} hint={text.hint} className="flex-1">
              {(field) => (
                <Input
                  {...field}
                  autoFocus
                  data-autofocus
                  type="search"
                  value={term}
                  placeholder={text.supplierPlaceholder}
                  onChange={(event) => setTerm(event.target.value)}
                />
              )}
            </FormField>
          </div>
          {current && <SearchHits term={term} customer={current} />}
        </>
      )}
    </div>
  );
}
