// @vitest-environment jsdom
import type { ImportPreview, ImportResult } from '@reziproq/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const preview: ImportPreview = {
  type: 'suppliers',
  rows: [
    {
      row: 2,
      status: 'new',
      values: { Name: 'Neu GmbH (Demo)', Land: 'DE' },
      issues: [],
      changes: [],
    },
    {
      row: 3,
      status: 'invalid',
      values: { Name: 'Fehler GmbH (Demo)', Land: 'XX' },
      issues: [{ field: 'Land', code: 'invalid_country', value: 'XX' }],
      changes: [],
    },
  ],
  summary: { new: 1, changed: 0, unchanged: 0, invalid: 1 },
};

let requests: { method: string; url: string; body: unknown }[] = [];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  requests = [];
  api.handle = (request) => {
    requests.push(request);
    if (request.url === '/api/suppliers/import/preview?type=suppliers') {
      return Response.json(preview);
    }
    if (request.url === '/api/suppliers/import?type=suppliers') {
      const result: ImportResult = { type: 'suppliers', summary: preview.summary };
      return Response.json(result);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('PLT-07a Importseite', () => {
  it('prüft eine Datei, markiert fehlerhafte Felder und bestätigt den transaktionalen Import', async () => {
    const router = renderAt('/lieferanten/importieren');
    await screen.findByRole('heading', { level: 1, name: 'Lieferanten importieren' });
    await screen.findByText('UTF-8 · höchstens 10 MB und 5.000 Zeilen');
    const file = new File(['Name;Land\nNeu;DE'], 'lieferanten.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Datei auswählen'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));

    expect(
      await screen.findByText('1 neu · 0 geändert · 0 unverändert · 1 fehlerhaft'),
    ).toBeDefined();
    expect(screen.getByText('Land: Kein gültiger ISO-Ländercode.')).toBeDefined();
    expect(screen.getByText('XX').closest('td')?.className).toContain('bg-destructive-soft');
    expect(screen.getByRole('button', { name: 'Fehlerdatei herunterladen' })).toBeDefined();

    const previewRequest = requests.find((request) =>
      request.url.startsWith('/api/suppliers/import/preview'),
    );
    expect(previewRequest).toBeDefined();
    if (!previewRequest) throw new Error('Vorschauanfrage fehlt');
    expect(previewRequest.method).toBe('POST');
    expect(previewRequest.body).toBeInstanceOf(FormData);
    if (!(previewRequest.body instanceof FormData)) throw new Error('Datei fehlt im Formular');
    expect(previewRequest.body.get('file')).toBe(file);

    fireEvent.click(screen.getByRole('button', { name: 'Importieren' }));
    await screen.findByRole('heading', { level: 2, name: 'Import abgeschlossen' });
    expect(screen.getByText('1 neu · 0 geändert · 0 unverändert · 1 fehlerhaft')).toBeDefined();
    fireEvent.click(screen.getByRole('link', { name: 'Zu den Lieferanten' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/lieferanten'));
  });

  it('zeigt Lesern die Vorlagen, aber keine Importdatei oder Importaktion', async () => {
    api.permissions = actionsFor.viewer;
    renderAt('/lieferanten/importieren');
    await screen.findByText(
      'Du kannst Vorlagen herunterladen. Für den Import brauchst du die Rolle Admin oder Nutzer.',
    );
    expect(screen.queryByLabelText('Datei auswählen')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Importieren' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'CSV-Vorlage' })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Excel-Vorlage' })).toHaveLength(4);
  });

  it('Admins können Business Units über die Importkacheln übernehmen', async () => {
    api.handle = (request) => {
      requests.push(request);
      if (request.url === '/api/suppliers/import/preview?type=business-units') {
        return Response.json({
          type: 'business-units',
          rows: [
            {
              row: 2,
              status: 'new',
              values: { Name: 'Fahrzeuge', Code: 'BU-01' },
              issues: [],
              changes: [],
            },
          ],
          summary: { new: 1, changed: 0, unchanged: 0, invalid: 0 },
        });
      }
      if (request.url === '/api/suppliers/import?type=business-units') {
        return Response.json({
          type: 'business-units',
          summary: { new: 1, changed: 0, unchanged: 0, invalid: 0 },
        });
      }
      return undefined;
    };
    renderAt('/lieferanten/importieren');
    await screen.findByRole('heading', { level: 1, name: 'Lieferanten importieren' });
    fireEvent.click(await screen.findByRole('button', { name: 'Business Units' }));
    fireEvent.change(screen.getByLabelText('Datei auswählen'), {
      target: {
        files: [new File(['Name;Code\nFahrzeuge;BU-01'], 'units.csv', { type: 'text/csv' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));
    expect(
      await screen.findByText('1 neu · 0 geändert · 0 unverändert · 0 fehlerhaft'),
    ).toBeDefined();
    expect(
      requests.some((request) =>
        request.url.startsWith('/api/suppliers/import/preview?type=business-units'),
      ),
    ).toBe(true);
  });

  it('können Kontakte als Nutzer über die Importkachel übernehmen', async () => {
    api.handle = (request) => {
      requests.push(request);
      if (request.url === '/api/suppliers/import/preview?type=contacts') {
        return Response.json({
          type: 'contacts',
          rows: [
            {
              row: 2,
              status: 'new',
              values: {
                'Eigene Lieferantennummer': 'L-10001',
                Name: 'Ada Example',
                'E-Mail': 'ada@example.com',
              },
              issues: [],
              changes: [],
            },
          ],
          summary: { new: 1, changed: 0, unchanged: 0, invalid: 0 },
        });
      }
      return undefined;
    };
    renderAt('/lieferanten/importieren');
    await screen.findByRole('heading', { level: 1, name: 'Lieferanten importieren' });
    fireEvent.click(await screen.findByRole('button', { name: 'Kontakte' }));
    fireEvent.change(screen.getByLabelText('Datei auswählen'), {
      target: {
        files: [
          new File(
            ['Eigene Lieferantennummer;Name;E-Mail\nL-10001;Ada Example;ada@example.com'],
            'contacts.csv',
            { type: 'text/csv' },
          ),
        ],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));
    expect(
      await screen.findByText('1 neu · 0 geändert · 0 unverändert · 0 fehlerhaft'),
    ).toBeDefined();
    expect(
      requests.some((request) =>
        request.url.startsWith('/api/suppliers/import/preview?type=contacts'),
      ),
    ).toBe(true);
  });
});
