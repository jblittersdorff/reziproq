// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadPreRead } from '@/lib/api';

// QBR-06: Der Knopf auf der Termin-Seite lädt das PDF vom Server, in der Sprache der Oberfläche,
// mit dem Dateinamen des Servers.
describe('QBR-06 Pre-Read herunterladen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ruft das Pre-Read der eigenen Seite ab und speichert es unter dem Namen des Servers', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Blob(['%PDF-1.7']), {
          headers: {
            'content-type': 'application/pdf',
            'content-disposition': `attachment; filename="Pre-Read.pdf"; filename*=UTF-8''${encodeURIComponent('Pre-Read Quartalsreview 2099-03-15.pdf')}`,
          },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(() => 'blob:pre-read');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let downloaded = '';
    click.mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });

    await downloadPreRead('token', '/kunden/rel-1', 'meeting-1', 'en');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/kunden/rel-1/termine/meeting-1/pre-read?sprache=en',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer token' }),
      }),
    );
    expect(downloaded).toBe('Pre-Read Quartalsreview 2099-03-15.pdf');
  });

  it('meldet einen Fehler, statt eine leere Datei zu speichern', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    await expect(downloadPreRead('token', '/suppliers/rel-1', 'x', 'de')).rejects.toThrow();
  });
});
