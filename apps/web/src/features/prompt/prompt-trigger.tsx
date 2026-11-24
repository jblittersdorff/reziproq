import { ArrowUpIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAsk } from '@/features/prompt/ask-context';
import { useT } from '@/lib/i18n';

/**
 * Fragefeld auf Start (PLT-12): ruhige Fläche wie ein Chatfenster, ohne Symbol. Enter stellt die
 * Frage in Frag Reziproq (NAV-10 2.0), Umschalt+Enter macht eine neue Zeile.
 */
export function PromptTrigger() {
  const t = useT();
  const ask = useAsk();
  const form = useRef<HTMLFormElement>(null);
  const [question, setQuestion] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text) ask({ question: text });
  };
  return (
    <form
      ref={form}
      onSubmit={submit}
      data-slot="prompt"
      className="flex max-w-190 items-end gap-3 rounded-lg bg-card py-3.5 pr-3.5 pl-5.5 shadow-ask transition-shadow focus-within:ring-3 focus-within:ring-ring/50"
    >
      <Textarea
        value={question}
        rows={1}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            form.current?.requestSubmit();
          }
        }}
        aria-label={t.prompt.question}
        placeholder={t.prompt.placeholder}
        className="field-sizing-content max-h-48 min-h-11 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-lg shadow-none focus-visible:ring-0"
      />
      <Button
        type="submit"
        size="icon"
        className="shrink-0 bg-ink text-mint hover:bg-ink/90"
        aria-label={t.prompt.send}
        disabled={!question.trim()}
      >
        <ArrowUpIcon aria-hidden />
      </Button>
    </form>
  );
}
