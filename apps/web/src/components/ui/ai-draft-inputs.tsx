import { useT } from '@/lib/i18n';
import { Textarea } from './textarea';

export interface DraftInput {
  content?: string;
  reason?: string;
}

/** Die Übernahme nutzt den bearbeiteten Text, beim Verwerfen zählt nur der optionale Grund. */
export function AiDraftInputs({
  content,
  input,
  onChange,
}: {
  content: string;
  input: DraftInput;
  onChange: (input: DraftInput) => void;
}) {
  const t = useT().draftEvidence;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <details>
        <summary className="min-h-11 cursor-pointer content-center">{t.edit}</summary>
        <Textarea
          aria-label={t.edit}
          value={input.content ?? content}
          maxLength={5000}
          onChange={(event) => onChange({ ...input, content: event.target.value })}
        />
      </details>
      <details>
        <summary className="min-h-11 cursor-pointer content-center">{t.reason}</summary>
        <Textarea
          aria-label={t.reason}
          value={input.reason ?? ''}
          maxLength={2000}
          onChange={(event) => onChange({ ...input, reason: event.target.value })}
        />
      </details>
    </div>
  );
}
