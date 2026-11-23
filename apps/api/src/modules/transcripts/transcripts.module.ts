import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { FakeTranscriptClient, TRANSCRIPT_CLIENT } from './transcript-client.js';
import {
  MeetingTranscriptController,
  TranscriptSettingsController,
} from './transcripts.controller.js';
import { TranscriptsService } from './transcripts.service.js';
import { TranscriptsWorker } from './transcripts.worker.js';

/** IN-05 Transkripte aus Teams und Meet, Upload, Aufbewahrung */
@Module({
  imports: [IntegrationsModule, MeetingsModule],
  controllers: [TranscriptSettingsController, MeetingTranscriptController],
  providers: [
    TranscriptsService,
    TranscriptsWorker,
    FakeTranscriptClient,
    // Der echte Abruf kommt mit dem Durchstich (Teams-App mit RSC, Meet-API)
    { provide: TRANSCRIPT_CLIENT, useExisting: FakeTranscriptClient },
  ],
  exports: [TranscriptsService, FakeTranscriptClient],
})
export class TranscriptsModule {}
