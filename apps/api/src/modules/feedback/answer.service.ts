import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type PublicSurvey,
  publicSurveySchema,
  type SubmitSurvey,
  surveyTokenSchema,
} from '@reziproq/shared';
import { SurveyLinkStore } from '../../common/database.module.js';
import { hashSurveyToken } from './waves.service.js';

const notFound = () => new NotFoundException({ statusCode: 404, code: 'link_unbekannt' });

const submitErrors: Record<string, () => Error> = {
  survey_not_found: notFound,
  survey_used: () => new ConflictException({ statusCode: 409, code: 'schon_beantwortet' }),
  survey_expired: () => new GoneException({ statusCode: 410, code: 'abgelaufen' }),
  survey_answers_invalid: () =>
    new BadRequestException({ statusCode: 400, code: 'antworten_ungueltig' }),
};

/**
 * PUL-02b: Beantworten über den persönlichen Link ohne Anmeldung. Der Token ist der einzige
 * Schlüssel; die Datenbank sieht nur seinen Hash und schreibt genau einen Bogen ohne Person.
 */
@Injectable()
export class AnswerService {
  constructor(@Inject(SurveyLinkStore) private readonly store: SurveyLinkStore) {}

  async read(token: string): Promise<PublicSurvey> {
    if (!surveyTokenSchema.safeParse(token).success) throw notFound();
    const row = await this.store.read(hashSurveyToken(token));
    if (!row) throw notFound();
    return publicSurveySchema.parse({
      status: row.status,
      kind: row.kind,
      dueDate: row.due_date,
      side: row.side,
      buyer: row.buyer,
      supplier: row.supplier,
      // Fragen nur, solange der Link offen ist.
      questions: row.status === 'open' ? row.questions : [],
    });
  }

  async submit(token: string, input: SubmitSurvey): Promise<PublicSurvey> {
    if (!surveyTokenSchema.safeParse(token).success) throw notFound();
    try {
      await this.store.submit(hashSurveyToken(token), input.answers, input.comment || null);
    } catch (error) {
      const message =
        (error as { cause?: { message?: string } }).cause?.message ??
        (error as { message?: string }).message ??
        '';
      const translated = Object.entries(submitErrors).find(([code]) => message.includes(code));
      if (translated) throw translated[1]();
      throw error;
    }
    return this.read(token);
  }
}
