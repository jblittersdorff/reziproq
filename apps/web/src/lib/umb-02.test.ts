// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectDraft,
  type Draft,
  draftMaxAgeMs,
  restoreDraft,
  saveDraft,
  takeDraft,
} from './draft';

// Tests zu docs/specs/UMB-02.md für den Entwurf. Den Weg über Zitadel prüft e2e/umb-02.spec.ts.

const now = Date.parse('2026-11-02T09:00:00Z');
const stored = () => window.sessionStorage.getItem('reziproq-entwurf');

afterEach(() => {
  document.body.innerHTML = '';
  window.sessionStorage.clear();
});

function form(html: string) {
  document.body.innerHTML = html;
  return document.body;
}

describe('Entwurf der offenen Felder', () => {
  it('sessionStorage enthält zu keinem Zeitpunkt ein Token: nur Adresse, Zeitpunkt, Person und Felder', () => {
    const root = form(`
      <input name="title" value="Rahmenvertrag" />
      <textarea id="notes">Bitte bis Freitag</textarea>
      <input type="password" name="secret" value="geheim" />
      <input type="hidden" name="csrf" value="token-123" />
      <div data-no-draft><input name="code" value="einmal" /></div>
    `);
    saveDraft(collectDraft(root, { path: '/lieferanten', userId: 'user-1', now }));

    const draft = JSON.parse(stored() ?? '{}') as Draft;
    expect(Object.keys(draft).sort()).toEqual(['fields', 'path', 'savedAt', 'userId']);
    expect(draft.fields).toEqual([
      { key: 'title', index: 0, value: 'Rahmenvertrag' },
      { key: 'notes', index: 0, value: 'Bitte bis Freitag' },
    ]);
    expect(stored()).not.toMatch(/geheim|token-123|einmal|access|refresh|id_token/);
  });

  it('speichert ohne Felder keinen Entwurf', () => {
    saveDraft(collectDraft(form('<p>Nichts</p>'), { path: '/start', userId: 'user-1', now }));
    expect(stored()).toBeNull();
  });

  it('Ein Entwurf älter als 30 Minuten wird verworfen', () => {
    const root = form('<input name="title" value="Rahmenvertrag" />');
    const save = (savedAt: number) =>
      saveDraft(collectDraft(root, { path: '/start', userId: 'user-1', now: savedAt }));

    save(now - draftMaxAgeMs + 1000);
    expect(takeDraft({ path: '/start', userId: 'user-1', now })?.fields).toHaveLength(1);

    save(now - draftMaxAgeMs - 1000);
    expect(takeDraft({ path: '/start', userId: 'user-1', now })).toBeNull();
    expect(stored()).toBeNull();
  });

  it('wird für eine andere Person verworfen', () => {
    const root = form('<input name="title" value="Rahmenvertrag" />');
    saveDraft(collectDraft(root, { path: '/start', userId: 'user-1', now }));
    expect(takeDraft({ path: '/start', userId: 'user-2', now })).toBeNull();
    expect(stored()).toBeNull();
  });

  it('bleibt für eine andere Adresse liegen', () => {
    const root = form('<input name="title" value="Rahmenvertrag" />');
    saveDraft(collectDraft(root, { path: '/start', userId: 'user-1', now }));
    expect(takeDraft({ path: '/lieferanten', userId: 'user-1', now })).toBeNull();
    expect(stored()).not.toBeNull();
  });

  it('füllt Text, Auswahl und Häkchen wieder und meldet, was noch fehlt', () => {
    const root = form(`
      <input name="title" />
      <select name="bu"><option value="a">A</option><option value="b">B</option></select>
      <input type="checkbox" name="wg" value="1" /><input type="checkbox" name="wg" value="2" />
    `);
    const missing = restoreDraft(root, [
      { key: 'title', index: 0, value: 'Rahmenvertrag' },
      { key: 'bu', index: 0, value: 'b' },
      { key: 'wg', index: 1, value: '2', checked: true },
      { key: 'later', index: 0, value: 'kommt erst später' },
    ]);
    expect((root.querySelector('[name=title]') as HTMLInputElement).value).toBe('Rahmenvertrag');
    expect((root.querySelector('[name=bu]') as HTMLSelectElement).value).toBe('b');
    const boxes = root.querySelectorAll<HTMLInputElement>('[name=wg]');
    expect([boxes[0]?.checked, boxes[1]?.checked]).toEqual([false, true]);
    expect(missing.map((field) => field.key)).toEqual(['later']);
  });
});
