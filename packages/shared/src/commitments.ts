import { z } from 'zod';
import { meetingSides } from './meetings.js';

// JBP-05: Zusagen beider Seiten im Gemeinsamen Plan.

export const commitmentStatuses = ['open', 'kept', 'missed'] as const;
export type CommitmentStatus = (typeof commitmentStatuses)[number];

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

export const commitmentStatusSchema = z.object({ status: z.enum(commitmentStatuses) }).strict();
export type SetCommitmentStatus = z.infer<typeof commitmentStatusSchema>;
