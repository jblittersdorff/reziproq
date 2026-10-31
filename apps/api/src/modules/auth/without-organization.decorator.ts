import { SetMetadata } from '@nestjs/common';

export const WITHOUT_ORGANIZATION = Symbol('WITHOUT_ORGANIZATION');

/**
 * Erlaubt eine Route auch Personen ohne Organisation (PLT-02). Ohne diese Markierung antwortet
 * jede Route ihnen mit 403 keine_organisation. Gedacht nur für /me und den Betreiber-Zugang.
 */
export const WithoutOrganization = () => SetMetadata(WITHOUT_ORGANIZATION, true);
