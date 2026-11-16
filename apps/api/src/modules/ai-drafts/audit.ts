import { auditedObject } from '@reziproq/db';

/** Verlauf der KI-Entwürfe: wer übernommen oder verworfen hat; ohne den Text (SEG-11, PUL-08). */
export const aiDraftAudit = auditedObject({
  type: 'ai_draft',
  visibility: 'internal',
  fields: ['status'],
});
