import { useNavigate } from '@tanstack/react-router';
import { ArrowUpIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n';

/**
 * Fragefeld auf Start (PLT-12): ruhige Fläche wie ein Chatfenster, ohne Symbol. Enter schickt die
 * Frage an /fragen, Umschalt+Enter macht eine neue Zeile.
 */
export function PromptTrigger() {
  const t = useT();
  const navigate = useNavigate();
  const form = useRef<HTMLFormElement>(null);
  const [question, setQuestion] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text) void navigate({ to: '/fragen', search: { q: text } });
  };
  return (
    <form
      ref={form}
      onSubmit={submit}
      data-slot="prompt"
      className="flex items-end gap-3 rounded-xl border border-border bg-card p-2 pl-4 transition-colors focus-within:border-ring"
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
        className="shrink-0 rounded-full"
        aria-label={t.prompt.send}
        disabled={!question.trim()}
      >
        <ArrowUpIcon aria-hidden />
      </Button>
    </form>
  );
}
