import { z } from 'zod';
import { meetingSides } from './meetings.js';

// JBP-05: Zusagen beider Seiten im Gemeinsamen Plan. ZQ-01 (K2-a): Zusagen hängen an der
// Beziehung; ersetzt (replaced) und zurückgezogen (withdrawn) kommen dazu. Die Werte sind englisch
// wie im Schema: open = offen, kept = gehalten, missed = verfehlt.

export const commitmentStatuses = ['open', 'kept', 'missed', 'replaced', 'withdrawn'] as const;
export type CommitmentStatus = (typeof commitmentStatuses)[number];
/** Direkt setzbar; „ersetzt“ entsteht nur, wenn eine neue Zusage die alte ersetzt (ZQ-01 Regel 3) */
export const commitmentSettableStatuses = ['open', 'kept', 'missed', 'withdrawn'] as const;

/**
 * ZQ-01 Regel 2: Beleg der Buchung „gehalten“. Lieferavis, Wareneingang, Dokument (auch das
 * Ergebnis eines Termins) oder Bestätigung der anderen Seite; legacy für Buchungen vor ZQ-01.
 */
export const commitmentEvidenceKinds = [
  'delivery_advice',
  'goods_receipt',
  'document',
  'confirmation',
] as const;
export type CommitmentEvidenceKind = (typeof commitmentEvidenceKinds)[number];

export const commitmentEvidenceSchema = z
  .object({
    kind: z.enum(commitmentEvidenceKinds),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export type CommitmentEvidence = z.infer<typeof commitmentEvidenceSchema>;

/** Gespeicherter Beleg: wer wann gebucht hat und worauf er sich stützt */
export const storedCommitmentEvidenceSchema = z.object({
  kind: z.enum([...commitmentEvidenceKinds, 'legacy']),
  note: z.string().optional(),
  ref: z.object({ objectType: z.string(), objectId: z.uuid(), title: z.string() }).optional(),
  byUserId: z.string().optional(),
  byName: z.string().optional(),
  at: z.iso.datetime({ offset: true }).optional(),
});
export type StoredCommitmentEvidence = z.infer<typeof storedCommitmentEvidenceSchema>;

/** Person der eigenen Seite, die Verantwortung übernehmen kann (Team, sonst man selbst). */
export const personSchema = z.object({ userId: z.string(), name: z.string() });
export type Person = z.infer<typeof personSchema>;

export const commitmentSchema = z.object({
  id: z.uuid(),
  /** Wer zusagt */
  side: z.enum(meetingSides),
  own: z.boolean(),
  title: z.string(),
  ownerUserId: z.string().nullable(),
  ownerName: z.string(),
  dueOn: z.iso.date(),
  status: z.enum(commitmentStatuses),
  /** Beleg, wenn gehalten (ZQ-01 Regel 2) */
  evidence: storedCommitmentEvidenceSchema.nullable(),
  /** Offen über die Frist hinaus */
  overdue: z.boolean(),
  initiative: z.object({ id: z.uuid(), title: z.string() }).nullable(),
});
export type Commitment = z.infer<typeof commitmentSchema>;

export const commitmentsSchema = z.object({
  hasPlan: z.boolean(),
  ownSide: z.enum(meetingSides),
  canEdit: z.boolean(),
  /** Für Neu und Bearbeiten: Personen der eigenen Seite und Initiativen des Plans */
  people: z.array(personSchema),
  initiatives: z.array(z.object({ id: z.uuid(), title: z.string() })),
  /** Je Seite: überfällige zuerst, dann nach Frist */
  buyer: z.array(commitmentSchema),
  supplier: z.array(commitmentSchema),
});
export type Commitments = z.infer<typeof commitmentsSchema>;

export const saveCommitmentSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    ownerUserId: z.string().min(1),
    dueOn: z.iso.date(),
    initiativeId: z.uuid().nullable(),
  })
  .strict();
export type SaveCommitment = z.infer<typeof saveCommitmentSchema>;

/** „Gehalten“ braucht einen Beleg; ohne antwortet die API mit 422 beleg_fehlt (T2-ZQ2) */
export const commitmentStatusSchema = z
  .object({
    status: z.enum(commitmentSettableStatuses),
    evidence: commitmentEvidenceSchema.optional(),
  })
  .strict();
export type SetCommitmentStatus = z.infer<typeof commitmentStatusSchema>;
