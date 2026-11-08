import { createHash } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Legt Organisation und Person beim Identitätsanbieter an (LIF-01). In LIF-01a gibt es nur den
 * Nachbau für Entwicklung und Tests; LIF-01b bringt die Zitadel-Verwaltungsschnittstelle.
 */
export interface IdentityProvisioner {
  /** Gibt die Zitadel-Organisation des Lieferanten zurück und legt sie an, wenn es keine gibt. */
  ensureOrganization(input: {
    supplierOrgId: string;
    name: string;
    existingId: string | null;
  }): Promise<string>;
  /**
   * Legt die Person in dieser Zitadel-Organisation an (oder findet sie wieder) und gibt ihre
   * Nutzer-ID und den Link zur Einrichtung des Passkeys zurück.
   */
  createUser(input: {
    zitadelOrgId: string;
    email: string;
    name: string;
  }): Promise<{ userId: string; passkeySetupUrl: string }>;
}

export const IDENTITY_PROVISIONER = Symbol('IDENTITY_PROVISIONER');

/** Nachgebautes Zitadel: deterministisch, ohne Internet. Der Passkey-Schritt führt direkt zu /start. */
export class FakeIdentityProvisioner implements IdentityProvisioner {
  async ensureOrganization(input: { supplierOrgId: string; existingId: string | null }) {
    return input.existingId ?? `fake-org-${input.supplierOrgId}`;
  }

  async createUser(input: { email: string }) {
    const digest = createHash('sha256').update(input.email.trim().toLowerCase()).digest('hex');
    return { userId: `fake-user-${digest.slice(0, 24)}`, passkeySetupUrl: '/start' };
  }
}

/** Im Betrieb bis LIF-01b: Annehmen ist noch nicht möglich, alles andere läuft. */
export class UnavailableIdentityProvisioner implements IdentityProvisioner {
  private unavailable(): never {
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: 'invitation_accept_unavailable',
      message: 'Die Annahme von Einladungen ist hier noch nicht eingerichtet.',
    });
  }

  async ensureOrganization(): Promise<string> {
    return this.unavailable();
  }

  async createUser(): Promise<{ userId: string; passkeySetupUrl: string }> {
    return this.unavailable();
  }
}
