// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Breadcrumb } from './breadcrumb';
import { ConfirmButton } from './confirm-button';
import { CheckboxGroup, FormField } from './form-field';
import { Stage, StageMetrics } from './stage';
import { StatusLine } from './status-line';
import { StepProgress } from './step-progress';
import { Tile, TileActions, TileMetric, TileText, TileTitle } from './tile';
import { VisibilityBadge } from './visibility-badge';

// Tests zu docs/specs/PLT-10.md für die Logik der neuen Bausteine.

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Bestätigung auf der Seite (NAV-04)', () => {
  const setup = () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton
        question="Wirklich beenden?"
        confirmLabel="Ja"
        cancelLabel="Abbrechen"
        onConfirm={onConfirm}
      >
        Beziehung beenden
      </ConfirmButton>,
    );
    return onConfirm;
  };

  it('wird zur Zeile mit Frage, Ja und Abbrechen, ohne Fenster', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beziehung beenden' }));
    expect(screen.getByRole('group', { name: 'Wirklich beenden?' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' }));
  });

  it('führt die Aktion erst nach Ja aus', () => {
    const onConfirm = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beziehung beenden' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('stellt mit Abbrechen oder Esc den Knopf wieder her, mit Fokus darauf', () => {
    const onConfirm = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beziehung beenden' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Ja' }), { key: 'Escape' });
    const trigger = screen.getByRole('button', { name: 'Beziehung beenden' });
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole('button', { name: 'Beziehung beenden' })).toBeDefined();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('Rückmeldezeile (NAV-04)', () => {
  it('steht im Seitenfluss und meldet sich nach kurzer Zeit ab', () => {
    vi.useFakeTimers();
    const onHidden = vi.fn();
    render(<StatusLine message="Gespeichert." onHidden={onHidden} durationMs={4000} />);
    const line = screen.getByRole('status');
    expect(line.textContent).toBe('Gespeichert.');
    expect(line.className).not.toMatch(/\bfixed\b/);
    act(() => vi.advanceTimersByTime(3999));
    expect(onHidden).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onHidden).toHaveBeenCalledOnce();
  });
});

describe('Abläufe in Schritten', () => {
  it('zeigt „Schritt 2 von 4“ und markiert den aktuellen Schritt', () => {
    render(
      <StepProgress
        current={2}
        total={4}
        label={(current, total) => `Schritt ${current} von ${total}`}
        stepTitle="Lieferanten wählen"
      />,
    );
    expect(screen.getByText('Schritt 2 von 4')).toBeDefined();
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps.map((step) => step.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
      null,
    ]);
  });
});

describe('Formularseite', () => {
  it('verbindet Fehlermeldung und Feld', () => {
    render(
      <FormField label="Name" error="Bitte einen Namen eingeben.">
        {(field) => <input {...field} />}
      </FormField>,
    );
    const input = screen.getByLabelText('Name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = screen.getByText('Bitte einen Namen eingeben.');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('wählt in der Mehrfachauswahl mehrere Einträge', () => {
    const onChange = vi.fn();
    render(
      <CheckboxGroup
        legend="Business Units"
        options={[
          { value: 'a', label: 'Antriebe' },
          { value: 'b', label: 'Service' },
        ]}
        value={['a']}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Service' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });
});

describe('Navigation', () => {
  it('führt im Pfad mit dem Zurück-Pfeil eine Ebene zurück', () => {
    render(
      <Breadcrumb
        label="Pfad"
        backLabel="Zurück zu Einstellungen"
        trail={[{ label: 'Einstellungen', href: '/einstellungen' }]}
        current="Organisation"
      />,
    );
    expect(screen.getByRole('link', { name: 'Zurück zu Einstellungen' }).getAttribute('href')).toBe(
      '/einstellungen',
    );
    expect(screen.getByText('Organisation').getAttribute('aria-current')).toBe('page');
  });
});

describe('Kennzeichen Intern und Geteilt (NAV-09)', () => {
  it('zeigt immer Symbol und Text', () => {
    render(<VisibilityBadge visibility="internal" label="Intern" />);
    const badge = screen.getByText('Intern');
    expect(badge.querySelector('svg')).not.toBeNull();
  });
});

describe('Handschrift Bühne (überarbeitet am 8.11.2026)', () => {
  it('Kachel-Titel, -Text, -Kennzahl und -Knöpfe stehen linksbündig', () => {
    render(
      <Tile size="lg">
        <TileTitle>Strategie</TileTitle>
        <TileText>Wohin wir die Beziehung entwickeln wollen.</TileText>
        <TileMetric value="3 / 3" label="Bewertungen" />
        <TileActions>
          <button type="button">Öffnen</button>
        </TileActions>
      </Tile>,
    );
    const tile = screen.getByRole('heading', { name: 'Strategie' }).closest('[data-slot="tile"]');
    expect(tile?.className).toContain('text-left');
    for (const element of tile?.querySelectorAll('*') ?? []) {
      expect(element.className, element.outerHTML).not.toMatch(/text-center|justify-center/);
    }
  });

  it('Kacheln gibt es in den Tönen Karte, Bühne und Geteilt', () => {
    render(
      <>
        <Tile tone="card">a</Tile>
        <Tile tone="stage">b</Tile>
        <Tile tone="shared">c</Tile>
      </>,
    );
    const tones = [...document.querySelectorAll('[data-slot="tile"]')].map((tile) => [
      tile.getAttribute('data-tone'),
      tile.className,
    ]);
    expect(tones.map(([tone]) => tone)).toEqual(['card', 'stage', 'shared']);
    expect(tones[1]?.[1]).toContain('stage-scope');
    expect(tones[2]?.[1]).toContain('bg-primary-soft');
  });

  it('Die Bühne zeigt Anlass, Titel als h1, Satz, Knopf und höchstens drei Kennzahlen', () => {
    render(
      <Stage
        eyebrow="Sonntag, 8. November"
        title="Guten Abend, Lena"
        text="3 Dinge warten auf dich."
        actions={<button type="button">Fällige Aufgaben</button>}
        aside={
          <StageMetrics
            label="Auf einen Blick"
            items={['a', 'b', 'c', 'd'].map((key) => ({ key, value: 1, label: key }))}
          />
        }
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Guten Abend, Lena' })).toBeDefined();
    expect(screen.getByText('Sonntag, 8. November')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fällige Aufgaben' })).toBeDefined();
    const metrics = screen.getByLabelText('Auf einen Blick');
    expect(metrics.querySelectorAll('dd')).toHaveLength(3);
    expect(document.querySelector('[data-slot="stage"]')?.className).toContain('stage-scope');
  });

  it('Die hellere Bühne hat keinen dunklen Ton', () => {
    render(<Stage tone="light" title="Rheintal Elektronik GmbH" />);
    expect(document.querySelector('[data-slot="stage"]')?.className).not.toContain('stage-scope');
  });
});
