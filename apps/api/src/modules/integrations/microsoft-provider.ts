import { BadGatewayException, Logger } from '@nestjs/common';
import { systemTime } from '@reziproq/db';
import { z } from 'zod';
import type { ConnectorDefinition } from './connectors.js';
import type {
  ConnectorProvider,
  FetchContext,
  ProviderItem,
  ProviderToken,
} from './fake-provider.js';
import type { GraphClient, GraphMessage } from './graph-client.js';

/**
 * Durchstich / IN-03: Microsoft 365 echt. Anmeldung beim Kalender einer Person über OAuth
 * (Authorization Code, delegierte Rechte), Erneuern über das Refresh Token, Kalender lesen und die
 * Beschreibung eines Termins schreiben (Microsoft Graph). Die App-Registrierung kommt aus der
 * Umgebung. Zugangsdaten verlassen die Integrationsschicht nur in Richtung Microsoft.
 */

const authority = 'https://login.microsoftonline.com/organizations/oauth2/v2.0';
const graph = 'https://graph.microsoft.com/v1.0';
// IN-04: Mail.Read nur für „In Reziproq ablegen“: gelesen wird genau die eine Mail, auf Klick
export const microsoftScopes = [
  'offline_access',
  'openid',
  'User.Read',
  'Calendars.ReadWrite',
  'Mail.Read',
];

/** So liegt der Zugang verschlüsselt in connection_secret: beide Tokens, nie einzeln */
const tokenSchema = z.object({ access: z.string().min(1), refresh: z.string().min(1) });
const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

export interface MicrosoftApp {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const failed = () =>
  new BadGatewayException({ statusCode: 502, code: 'microsoft_nicht_erreichbar' });

export function parseMicrosoftToken(token: string) {
  return tokenSchema.parse(JSON.parse(token));
}

export class MicrosoftLiveProvider implements ConnectorProvider {
  private readonly logger = new Logger(MicrosoftLiveProvider.name);
  beforeItem = null;

  constructor(private readonly app: MicrosoftApp) {}

  /** Adresse, an die die App die Person zur Anmeldung bei Microsoft schickt */
  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.app.clientId,
      response_type: 'code',
      redirect_uri: this.app.redirectUri,
      response_mode: 'query',
      scope: microsoftScopes.join(' '),
      state,
      prompt: 'select_account',
    });
    return `${authority}/authorize?${params.toString()}`;
  }

  private async token(body: Record<string, string>): Promise<ProviderToken> {
    let response: Response;
    try {
      response = await fetch(`${authority}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.app.clientId,
          client_secret: this.app.clientSecret,
          redirect_uri: this.app.redirectUri,
          scope: microsoftScopes.join(' '),
          ...body,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw failed();
    }
    // Antworten von Microsoft können Tokens enthalten: nur den Status ins Log
    if (!response.ok) {
      this.logger.warn(`Token-Endpunkt antwortete mit ${response.status}`);
      throw new Error('token_abgelehnt');
    }
    const parsed = tokenResponse.parse(await response.json());
    return {
      token: JSON.stringify({ access: parsed.access_token, refresh: parsed.refresh_token }),
      expiresAt: new Date(systemTime().getTime() + parsed.expires_in * 1000),
    };
  }

  /** Code aus der Rückleitung gegen Tokens tauschen */
  exchangeCode(code: string): Promise<ProviderToken> {
    return this.token({ grant_type: 'authorization_code', code });
  }

  async authorize(): Promise<ProviderToken> {
    // Echte Verbindungen entstehen nur über die Anmeldung der Person (authorizeUrl)
    throw new Error('anmeldung_noetig');
  }

  refresh(_connector: ConnectorDefinition, token: string): Promise<ProviderToken> {
    return this.token({
      grant_type: 'refresh_token',
      refresh_token: parseMicrosoftToken(token).refresh,
    });
  }

  async revoke(): Promise<void> {
    // Microsoft kennt keinen Widerruf einzelner Tokens per API; gelöscht werden sie bei uns sofort
  }

  /** Kalender der Person: Termine der nächsten 30 Tage als Elemente für IN-03 */
  async fetch(context: FetchContext, token: string): Promise<ProviderItem[]> {
    if (!context.personal || !context.parts.includes('calendar')) return [];
    const start = systemTime();
    const end = new Date(start.getTime() + 30 * 86_400_000);
    const url = `${graph}/me/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$top=100&$select=iCalUId,subject,start,end,location,attendees,isCancelled`;
    const events = z
      .object({
        value: z.array(
          z.object({
            id: z.string(),
            iCalUId: z.string().optional(),
            subject: z.string().nullable().optional(),
            isCancelled: z.boolean().optional(),
            start: z.object({ dateTime: z.string() }),
            end: z.object({ dateTime: z.string() }),
            location: z.object({ displayName: z.string().nullable().optional() }).optional(),
            attendees: z
              .array(
                z.object({
                  emailAddress: z.object({
                    address: z.string().optional(),
                    name: z.string().nullable().optional(),
                  }),
                }),
              )
              .optional(),
          }),
        ),
      })
      .parse(await this.graphJson(token, url, { Prefer: 'outlook.timezone="UTC"' }));
    return events.value.map((event) => ({
      externalId: `ms-${event.id}`,
      kind: 'calendar_event',
      relationshipId: null,
      text: '',
      data: {
        uid: event.iCalUId ?? event.id,
        subject: event.subject ?? '',
        startsAt: new Date(`${event.start.dateTime}Z`).toISOString(),
        endsAt: new Date(`${event.end.dateTime}Z`).toISOString(),
        location: event.location?.displayName ?? null,
        cancelled: event.isCancelled === true,
        attendees: (event.attendees ?? [])
          .filter((entry) => entry.emailAddress.address)
          .map((entry) => ({
            email: (entry.emailAddress.address ?? '').toLowerCase(),
            name: entry.emailAddress.name ?? null,
            response: null,
          })),
      },
    }));
  }

  async graphJson(token: string, url: string, headers: Record<string, string> = {}) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          authorization: `Bearer ${parseMicrosoftToken(token).access}`,
          accept: 'application/json',
          ...headers,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw failed();
    }
    if (!response.ok) {
      this.logger.warn(`Graph antwortete mit ${response.status}`);
      throw new Error('graph_abgelehnt');
    }
    return response.json() as Promise<unknown>;
  }
}

/** Beschreibung eines Termins über Graph lesen und schreiben */
export class MicrosoftGraphClient implements GraphClient {
  constructor(private readonly provider: MicrosoftLiveProvider) {}

  async getEventBody(token: string, eventId: string): Promise<string | null> {
    const event = z
      .object({ body: z.object({ content: z.string() }).optional() })
      .parse(
        await this.provider.graphJson(
          token,
          `${graph}/me/events/${encodeURIComponent(eventId)}?$select=body`,
        ),
      );
    return event.body?.content ?? null;
  }

  async updateEventBody(token: string, eventId: string, body: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${graph}/me/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${parseMicrosoftToken(token).access}`,
          'content-type': 'application/json',
        },
        // Nur die Beschreibung; Teilnehmer bleiben unverändert, es geht keine neue Einladung raus
        body: JSON.stringify({ body: { contentType: 'HTML', content: body } }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw failed();
    }
    if (!response.ok) throw new Error('graph_abgelehnt');
  }

  /** IN-04: genau eine Mail mit Anhängen, nur nach dem Klick auf „In Reziproq ablegen“ */
  async getMessage(token: string, messageId: string): Promise<GraphMessage | null> {
    const id = encodeURIComponent(messageId);
    const address = z.object({
      emailAddress: z.object({ address: z.string(), name: z.string().nullable().optional() }),
    });
    const message = z
      .object({
        internetMessageId: z.string().nullable().optional(),
        subject: z.string().nullable().optional(),
        from: address.nullable().optional(),
        toRecipients: z.array(address).default([]),
        ccRecipients: z.array(address).default([]),
        sentDateTime: z.string().nullable().optional(),
        body: z.object({ contentType: z.string(), content: z.string() }).optional(),
      })
      .parse(
        await this.provider.graphJson(
          token,
          `${graph}/me/messages/${id}?$select=internetMessageId,subject,from,toRecipients,ccRecipients,sentDateTime,body`,
        ),
      );
    const attachments = z
      .object({
        value: z.array(
          z.object({
            '@odata.type': z.string().optional(),
            name: z.string().nullable().optional(),
            contentType: z.string().nullable().optional(),
            size: z.number().int().nonnegative().default(0),
            contentBytes: z.string().nullable().optional(),
          }),
        ),
      })
      .parse(await this.provider.graphJson(token, `${graph}/me/messages/${id}/attachments`));
    if (!message.from || !message.internetMessageId) return null;
    return {
      internetMessageId: message.internetMessageId,
      subject: message.subject ?? '',
      from: {
        email: message.from.emailAddress.address,
        name: message.from.emailAddress.name ?? null,
      },
      to: message.toRecipients.map((entry) => entry.emailAddress.address),
      cc: message.ccRecipients.map((entry) => entry.emailAddress.address),
      sentAt: message.sentDateTime ?? systemTime().toISOString(),
      body: message.body?.content ?? '',
      bodyIsHtml: (message.body?.contentType ?? 'html').toLowerCase() === 'html',
      // Nur Dateien; eingebettete Mails und Verweise werden nicht übernommen
      attachments: attachments.value
        .filter((entry) => (entry['@odata.type'] ?? '').endsWith('fileAttachment'))
        .map((entry) => ({
          name: entry.name ?? 'Anhang',
          contentType: entry.contentType ?? 'application/octet-stream',
          size: entry.size,
          contentBytes: entry.contentBytes ?? null,
        })),
    };
  }

  /** Durchstich: nächster Termin der Person, dessen Betreff den Text enthält */
  async findEvent(token: string, subject: string): Promise<{ id: string; subject: string } | null> {
    const start = systemTime();
    const end = new Date(start.getTime() + 30 * 86_400_000);
    const events = z
      .object({
        value: z.array(z.object({ id: z.string(), subject: z.string().nullable().optional() })),
      })
      .parse(
        await this.provider.graphJson(
          token,
          `${graph}/me/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$top=100&$select=id,subject`,
        ),
      );
    const found = events.value.find((event) => (event.subject ?? '').includes(subject));
    return found ? { id: found.id, subject: found.subject ?? '' } : null;
  }
}
