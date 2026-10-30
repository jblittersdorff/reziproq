import { useSyncExternalStore } from 'react';

// Betreiber-Ansicht (PLT-13): der gewählte Kunde, nur für diesen Browser-Tab.
// Jede Anfrage an die API schickt ihn im Header x-reziproq-kunde mit (siehe api.ts).

export interface SupportCustomer {
  id: string;
  name: string;
}

const storageKey = 'reziproq-betreiber-kunde';
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: SupportCustomer | null } = { raw: null, value: null };

function read(): string | null {
  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function getSupportCustomer(): SupportCustomer | null {
  const raw = read();
  if (raw !== cached.raw) {
    let value: SupportCustomer | null = null;
    try {
      value = raw ? (JSON.parse(raw) as SupportCustomer) : null;
    } catch {
      value = null;
    }
    cached = { raw, value };
  }
  return cached.value;
}

export function setSupportCustomer(customer: SupportCustomer | null): void {
  try {
    if (customer) window.sessionStorage.setItem(storageKey, JSON.stringify(customer));
    else window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ohne Speicher gibt es keine Betreiber-Ansicht.
  }
  for (const listener of listeners) listener();
}

export function useSupportCustomer(): SupportCustomer | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSupportCustomer,
    () => null,
  );
}
