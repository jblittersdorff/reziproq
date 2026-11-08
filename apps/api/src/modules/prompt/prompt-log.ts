import { Injectable, Logger } from '@nestjs/common';

/** Ein Eintrag im Protokoll: nie der Text von Frage oder Antwort (PLT-12). */
export interface PromptLogEntry {
  zeitpunkt: string;
  nutzerId: string;
  organisationId: string | null;
  dauerMs: number;
  eingabeTokens: number;
  ausgabeTokens: number;
  erfolg: boolean;
}

@Injectable()
export class PromptLog {
  private readonly logger = new Logger('Prompt');

  write(entry: PromptLogEntry): void {
    this.logger.log(JSON.stringify(entry));
  }
}
