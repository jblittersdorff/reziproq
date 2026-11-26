import { describe, expect, it } from 'vitest';
import { DemoTokens, demoSecret } from './demo-token.js';

// DM-01, E-K0-05: Demo-Tokens. Ohne festen Schlüssel endet eine Demo-Sitzung mit dem Prozess; die
// feste Vorschau gibt ihn über DEMO_SESSION_SECRET vor, damit sie einen Neustart übersteht.

const fixed = 'vorschau-schluessel-mit-mindestens-32-zeichen';

class FixedTokens extends DemoTokens {
  protected override readonly secret = demoSecret(fixed);
}

// Unabhängig von einer lokalen Konfiguration: Schlüssel wie ohne DEMO_SESSION_SECRET
class RandomTokens extends DemoTokens {
  protected override readonly secret = demoSecret(undefined);
}

describe('DM-01 Schlüssel der Demo-Tokens', () => {
  it('ohne festen Schlüssel gilt ein Token nur im Prozess, der es ausgestellt hat', async () => {
    expect(demoSecret(undefined)).toHaveLength(32);
    expect(demoSecret(undefined)).not.toEqual(demoSecret(undefined));
    const { token } = await new RandomTokens().issue('hollmann-jan-luka');
    await expect(new RandomTokens().verify(token)).rejects.toThrow();
  });

  it('mit festem Schlüssel gilt ein Token auch nach einem Neustart', async () => {
    const { token } = await new FixedTokens().issue('hollmann-jan-luka');
    await expect(new FixedTokens().verify(token)).resolves.toMatchObject({
      sub: 'hollmann-jan-luka',
    });
    // Ein Token mit anderem Schlüssel bleibt ungültig
    await expect(new RandomTokens().verify(token)).rejects.toThrow();
  });
});
