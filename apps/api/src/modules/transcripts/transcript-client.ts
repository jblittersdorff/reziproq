import { Injectable } from '@nestjs/common';
import type { TranscriptEntry } from '@reziproq/shared';

/**
 * IN-05: Abruf von Transkripten bei Teams (Graph) und Meet. Nur Text: Es gibt hier keine Methode
 * für Audio, Video oder Aufzeichnungen. Der echte Client kommt mit dem Durchstich (Teams-App mit
 * ressourcenspezifischer Berechtigung, Meet-API); bis dahin der Nachbau, der jede Anfrage
 * protokolliert, damit Tests prüfen können, was abgefragt wurde.
 */
export const TRANSCRIPT_CLIENT = Symbol('TRANSCRIPT_CLIENT');

export type TranscriptResult =
  | { status: 'ok'; entries: TranscriptEntry[]; externalId: string; language: string | null }
  | { status: 'pending' }
  | {
      status: 'unavailable';
      reason: 'mandant_gesperrt' | 'keine_transkription' | 'nicht_gefunden';
    };

export interface TranscriptClient {
  /** Teams: Transkript einer Online-Besprechung als VTT (Graph …/transcripts/{id}/content) */
  teams(
    token: string,
    input: { joinUrl: string; transcriptId: string | null },
  ): Promise<TranscriptResult>;
  /** Teams, Weg meeting: Benachrichtigung „Transkript verfügbar“ für diese Besprechung abonnieren */
  subscribeTeams(token: string, input: { joinUrl: string }): Promise<void>;
  /** Meet: Transkripteinträge der Konferenz (Meet-API conferenceRecords/…/transcripts/…/entries) */
  meet(token: string, input: { meetingUrl: string; startsAt: string }): Promise<TranscriptResult>;
}

@Injectable()
export class FakeTranscriptClient implements TranscriptClient {
  /** Jede Anfrage, wie sie an Graph bzw. Meet ginge */
  readonly requests: string[] = [];
  /** Antworten je Besprechungslink */
  readonly results = new Map<string, TranscriptResult>();

  async teams(_token: string, input: { joinUrl: string; transcriptId: string | null }) {
    this.requests.push(
      `GET graph:/me/onlineMeetings?joinWebUrl=${input.joinUrl} /transcripts/${input.transcriptId ?? 'latest'}/content?$format=text/vtt`,
    );
    return (
      this.results.get(input.joinUrl) ?? {
        status: 'unavailable' as const,
        reason: 'keine_transkription' as const,
      }
    );
  }

  async subscribeTeams(_token: string, input: { joinUrl: string }) {
    this.requests.push(
      `POST graph:/subscriptions communications/onlineMeetings(joinWebUrl='${input.joinUrl}')/transcripts`,
    );
  }

  async meet(_token: string, input: { meetingUrl: string; startsAt: string }) {
    this.requests.push(
      `GET meet:/v2/conferenceRecords?meeting=${input.meetingUrl} /transcripts/-/entries`,
    );
    return this.results.get(input.meetingUrl) ?? { status: 'pending' as const };
  }
}
