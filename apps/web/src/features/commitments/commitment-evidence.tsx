import type {
  CommitmentEvidence,
  CommitmentEvidenceKind,
  StoredCommitmentEvidence,
} from '@reziproq/shared';
import { commitmentEvidenceKinds } from '@reziproq/shared';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useT } from '@/lib/i18n';

// ZQ-01 Regel 2: „Gehalten“ zählt nur mit Beleg. Gemeinsam für die Zusagen im Gemeinsamen Plan
// (JBP-05) und für die alten Maßnahmen-Seiten, die bis zur Akte (K2-c) Zusagen und Aufgaben zeigen.

/** Zeile unter einer gehaltenen Zusage: Beleg, wer gebucht hat, Bezug und Notiz */
export function useEvidenceLine() {
  const text = useT().jbp.commitments.evidence;
  return (status: string, evidence: StoredCommitmentEvidence | null | undefined) =>
    status === 'kept' && evidence && evidence.kind !== 'legacy'
      ? [
          text.shown(text.kinds[evidence.kind] ?? evidence.kind, evidence.byName ?? null),
          evidence.ref?.title,
          evidence.note,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;
}

/** Fragt in der Zeile nach dem Beleg, statt sofort als gehalten zu buchen */
export function EvidenceForm({
  title,
  onBook,
  onCancel,
}: {
  /** Titel der Zusage, für den Namen des Formulars */
  title: string;
  onBook: (evidence: CommitmentEvidence) => void;
  onCancel: () => void;
}) {
  const text = useT().jbp.commitments.evidence;
  const [kind, setKind] = useState<CommitmentEvidenceKind | ''>('');
  const [note, setNote] = useState('');
  const book = (event: FormEvent) => {
    event.preventDefault();
    if (!kind) return;
    onBook({ kind, ...(note.trim() ? { note: note.trim() } : {}) });
  };
  return (
    <form
      className="flex flex-col gap-3 rounded-md bg-paper p-4"
      aria-label={text.legend(title)}
      onSubmit={book}
    >
      <p className="text-muted-foreground text-sm">{text.hint}</p>
      <FormField label={text.kind}>
        {(field) => (
          <NativeSelect
            {...field}
            value={kind}
            onChange={(event) => setKind(event.target.value as CommitmentEvidenceKind | '')}
          >
            <option value="">{text.choose}</option>
            {commitmentEvidenceKinds.map((value) => (
              <option key={value} value={value}>
                {text.kinds[value]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={text.note}>
        {(field) => (
          <Input
            {...field}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!kind}>
          {text.submit}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
      </div>
    </form>
  );
}
