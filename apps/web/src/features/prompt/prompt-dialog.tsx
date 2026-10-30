import { IconArrowUp, IconRefresh, IconSparkles } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SupplierCard } from '@/features/suppliers/supplier-card';
import { useT } from '@/lib/i18n';
import { type PromptTurn, usePromptConversation } from './use-prompt-conversation';

/** Das Prompt-Fenster (PLT-12): ein großes Feld, Vorschläge oder das Gespräch, ein Hinweis. */
export function PromptDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="sr-only">{t.prompt.title}</DialogTitle>
        {/* Der Inhalt hängt nur im offenen Fenster; schließen leert so auch das Gespräch. */}
        <Conversation onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Conversation({ onClose }: { onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const { turns, ask, reset, busy } = usePromptConversation({
    onNavigate: (to) => {
      void navigate({ to });
      onClose();
    },
  });

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
    t.prompt.suggestionElectronics,
    t.prompt.suggestionPulse,
  ];

  return (
    <>
      <form onSubmit={submit} className="flex items-center gap-2 border-border border-b p-3">
        <IconSparkles aria-hidden className="ml-2 size-6 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          // biome-ignore lint/a11y/noAutofocus: Das Fenster öffnet für genau diese Eingabe (PLT-12).
          autoFocus
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-label={t.prompt.question}
          placeholder={t.prompt.placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="icon"
          aria-label={t.prompt.send}
          disabled={!question.trim() || busy}
        >
          <IconArrowUp />
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {turns.length === 0 ? (
          <section aria-labelledby="prompt-vorschlaege" className="flex flex-col gap-1 p-3">
            <h2 id="prompt-vorschlaege" className="px-3 pt-1 pb-2 text-muted-foreground text-sm">
              {t.prompt.suggestions}
            </h2>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuestion(suggestion);
                  input.current?.focus();
                }}
                className="flex min-h-11 items-center rounded-lg px-3 text-left text-base transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {suggestion}
              </button>
            ))}
          </section>
        ) : (
          <ol className="flex flex-col gap-6 p-5">
            {turns.map((turn) => (
              <Turn key={turn.id} turn={turn} />
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>

      <footer className="flex items-center justify-between gap-3 border-border border-t px-5 py-2">
        <p className="text-muted-foreground text-sm">{t.prompt.disclaimer}</p>
        {turns.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              input.current?.focus();
            }}
          >
            <IconRefresh />
            {t.prompt.restart}
          </Button>
        )}
      </footer>
    </>
  );
}

function Turn({ turn }: { turn: PromptTurn }) {
  const t = useT();
  return (
    <li className="flex flex-col gap-3">
      <p className="font-medium text-base">{turn.question}</p>

      <div
        aria-live="polite"
        aria-busy={turn.status === 'answering'}
        className="flex flex-col gap-3"
      >
        {turn.answer ? (
          <p className="whitespace-pre-wrap text-base">{turn.answer}</p>
        ) : (
          turn.status === 'answering' && <AnsweringDots />
        )}

        {turn.suppliers?.length === 0 && <p className="text-muted-foreground">{t.prompt.noHits}</p>}
        {turn.suppliers && turn.suppliers.length > 0 && (
          <ul aria-label={t.prompt.hits} className="grid gap-3 sm:grid-cols-2">
            {turn.suppliers.map((supplier) => (
              <SupplierCard key={supplier.relationshipId} supplier={supplier} headingLevel={3} />
            ))}
          </ul>
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
