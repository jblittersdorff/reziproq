import { describe, expect, it } from 'vitest';
import { displayNameOf } from './supplier-name.js';

describe('LS-01 Anzeigename', () => {
  it('entfernt die Rechtsform und macht aus „(Demo)“ ein Kennzeichen', () => {
    expect(displayNameOf('Rheintal Elektronik GmbH (Demo)')).toEqual({
      name: 'Rheintal Elektronik',
      demo: true,
    });
    expect(displayNameOf('Saar Circuits GmbH & Co. KG')).toEqual({
      name: 'Saar Circuits',
      demo: false,
    });
    expect(displayNameOf('Silesia Guss Sp. z o.o.').name).toBe('Silesia Guss');
    expect(displayNameOf('Lombardia Fonderie S.p.A.').name).toBe('Lombardia Fonderie');
    expect(displayNameOf('Moravia Plast s.r.o.').name).toBe('Moravia Plast');
    expect(displayNameOf('Pearl River Components Ltd.').name).toBe('Pearl River Components');
    // Ein Name, der nur aus der Rechtsform bestünde, bleibt stehen
    expect(displayNameOf('AG').name).toBe('AG');
    expect(displayNameOf('Kugellager Agentur').name).toBe('Kugellager Agentur');
  });
});
