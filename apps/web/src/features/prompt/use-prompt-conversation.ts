import {
  type PromptDestination,
  type PromptEvent,
  type PromptRequest,
  promptLimits,
  type Supplier,
} from '@reziproq/shared';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { ApiError, streamPrompt } from '@/lib/api';

export interface PromptTurn {
  id: number;
  question: string;
  answer: string;
  /** null, solange keine Suche lief; [] heißt „Keine Treffer“. */
  suppliers: Supplier[] | null;
  destination: PromptDestination | null;
  status: 'answering' | 'done' | 'failed' | 'rateLimited';
}

/**
 * Gespräch auf der Fragen-Seite. Es lebt nur, solange die Seite offen ist, und wird nirgends
 * gespeichert (PLT-12). Weitere Fragen schicken den bisherigen Verlauf mit.
 */
export function usePromptConversation() {
  const auth = useAuth();
  const [turns, setTurns] = useState<PromptTurn[]>([]);
  const nextId = useRef(1);
  const running = useRef<AbortController | null>(null);

  // Verlässt man die Seite, wird auch eine laufende Antwort abgebrochen.
  useEffect(() => () => running.current?.abort(), []);

  const update = (id: number, change: (turn: PromptTurn) => PromptTurn) =>
    setTurns((current) => current.map((turn) => (turn.id === id ? change(turn) : turn)));

  const apply = (id: number, event: PromptEvent) => {
    switch (event.type) {
      case 'text':
        update(id, (turn) => ({ ...turn, answer: turn.answer + event.delta }));
        break;
      case 'suppliers':
        update(id, (turn) => ({
          ...turn,
          suppliers: [...(turn.suppliers ?? []), ...event.suppliers],
        }));
        break;
      case 'navigate':
        update(id, (turn) => ({ ...turn, destination: event.destination }));
        break;
      case 'done':
        update(id, (turn) => ({ ...turn, status: 'done' }));
        break;
      case 'error':
        update(id, (turn) => ({ ...turn, status: 'failed' }));
        break;
    }
  };

  const ask = async (question: string) => {
    // Die API nimmt höchstens promptLimits.messages Nachrichten. Mitgeschickt werden deshalb nur
    // die letzten vollständigen Frage-Antwort-Paare, die zusammen mit der neuen Frage hineinpassen.
    const pairs = Math.floor((promptLimits.messages - 1) / 2);
    const history: PromptRequest['messages'] = turns
      .filter((turn) => turn.status === 'done' && turn.answer.trim())
      .slice(-pairs)
      .flatMap((turn) => [
        { role: 'user' as const, content: turn.question },
        { role: 'assistant' as const, content: turn.answer },
      ]);
    const id = nextId.current++;
    setTurns((current) => [
      ...current,
      { id, question, answer: '', suppliers: null, destination: null, status: 'answering' },
    ]);

    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    try {
      await streamPrompt(
        auth.user?.access_token ?? '',
        [...history, { role: 'user', content: question }],
        (event) => apply(id, event),
        controller.signal,
      );
      // Endet der Strom ohne „done“, gilt die Antwort als fehlgeschlagen.
      update(id, (turn) => (turn.status === 'answering' ? { ...turn, status: 'failed' } : turn));
    } catch (error) {
      if (controller.signal.aborted) return;
      const rateLimited = error instanceof ApiError && error.status === 429;
      update(id, (turn) => ({ ...turn, status: rateLimited ? 'rateLimited' : 'failed' }));
    }
  };

  const reset = () => {
    running.current?.abort();
    setTurns([]);
  };

  const busy = turns.some((turn) => turn.status === 'answering');

  return { turns, ask, reset, busy };
}
