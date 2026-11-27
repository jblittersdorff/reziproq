import { Module } from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { CommitmentFollowupService } from './commitment-followup.service.js';
import { CommitmentFollowupWorker } from './commitment-followup.worker.js';

/** ZQ-01 (K2-b.6): Aufgabe „Zusagen nachhalten“ mit täglichem Job; die Demo-Regie startet sie selbst */
@Module({
  providers: [CommitmentFollowupService, CommitmentFollowupWorker, EmailService],
  exports: [CommitmentFollowupService],
})
export class CommitmentsModule {}
