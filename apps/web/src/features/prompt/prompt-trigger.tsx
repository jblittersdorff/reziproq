import { useNavigate } from '@tanstack/react-router';
import { ArrowUpIcon, SparklesIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

/** Großes Feld auf Start; es führt zur Seite /fragen, wie Cmd+K (PLT-12). */
export function PromptTrigger() {
  const t = useT();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text) void navigate({ to: '/fragen', search: { q: text } });
  };
  return (
    <form
      onSubmit={submit}
      className="flex min-h-14 items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:border-ring"
    >
      <SparklesIcon aria-hidden className="ml-1 size-6 shrink-0 text-muted-foreground" />
      <Input
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        aria-label={t.prompt.question}
        placeholder={t.prompt.placeholder}
        className="h-12 min-w-0 flex-1 border-0 bg-transparent text-lg shadow-none focus-visible:ring-0"
      />
      <kbd className="hidden shrink-0 rounded-md bg-muted px-2 py-0.5 font-sans text-sm sm:inline">
        {isMac ? t.prompt.shortcutMac : t.prompt.shortcutOther}
      </kbd>
      <Button type="submit" size="icon" aria-label={t.prompt.send} disabled={!question.trim()}>
        <ArrowUpIcon aria-hidden />
      </Button>
    </form>
  );
}
