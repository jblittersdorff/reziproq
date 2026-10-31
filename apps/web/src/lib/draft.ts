// UMB-02: Entwurf der offenen Formularfelder für die Neuanmeldung. Er liegt kurz in sessionStorage,
// mit Adresse, Zeitpunkt und der Zitadel-ID der Person. Nie ein Token.

const draftKey = 'reziproq-entwurf';

/** Älter als 30 Minuten wird ein Entwurf verworfen. */
export const draftMaxAgeMs = 30 * 60 * 1000;

export interface DraftField {
  key: string;
  /** Mehrere Felder mit gleichem Schlüssel (z. B. Häkchen einer Gruppe) nach Reihenfolge. */
  index: number;
  value: string;
  checked?: boolean;
}

export interface Draft {
  path: string;
  savedAt: number;
  userId: string;
  fields: DraftField[];
}

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// Nie gespeichert: Passwörter, Dateien, versteckte Felder und alles, was nichts enthält.
const skippedTypes = new Set(['password', 'file', 'hidden', 'submit', 'button', 'reset', 'image']);

function fieldKey(field: Field): string | null {
  return field.name || field.id || field.getAttribute('aria-label') || null;
}

/** Alle Felder unter root, die in einen Entwurf gehören, mit Schlüssel und Index. */
function draftableFields(root: ParentNode): { field: Field; key: string; index: number }[] {
  const counts = new Map<string, number>();
  return Array.from(root.querySelectorAll<Field>('input, textarea, select')).flatMap((field) => {
    if (field instanceof HTMLInputElement && skippedTypes.has(field.type)) return [];
    if (field.closest('[data-no-draft]') || field.disabled) return [];
    const key = fieldKey(field);
    if (!key) return [];
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    return [{ field, key, index }];
  });
}

const isCheckable = (field: Field): field is HTMLInputElement =>
  field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio');

/** Liest die Felder unter root; ein Entwurf ohne Felder ist keiner. */
export function collectDraft(
  root: ParentNode,
  { path, userId, now }: { path: string; userId: string; now: number },
): Draft | null {
  const fields = draftableFields(root).map(({ field, key, index }) =>
    isCheckable(field)
      ? { key, index, value: field.value, checked: field.checked }
      : { key, index, value: field.value },
  );
  if (fields.length === 0) return null;
  return { path, savedAt: now, userId, fields };
}

export function saveDraft(draft: Draft | null) {
  try {
    if (draft) window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
    else window.sessionStorage.removeItem(draftKey);
  } catch {}
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(draftKey);
  } catch {}
}

/**
 * Gibt den Entwurf für diese Adresse und diese Person zurück. Ist er zu alt oder gehört er
 * jemand anderem, wird er verworfen; ein Entwurf für eine andere Adresse bleibt liegen.
 */
export function takeDraft({
  path,
  userId,
  now,
}: {
  path: string;
  userId: string;
  now: number;
}): Draft | null {
  let draft: Draft;
  try {
    const stored = window.sessionStorage.getItem(draftKey);
    if (!stored) return null;
    draft = JSON.parse(stored) as Draft;
  } catch {
    clearDraft();
    return null;
  }
  if (now - draft.savedAt > draftMaxAgeMs || draft.userId !== userId) {
    clearDraft();
    return null;
  }
  return draft.path === path ? draft : null;
}

/** Setzt den Wert so, dass React die Änderung mitbekommt (kontrollierte Felder). */
function fill(field: Field, saved: DraftField) {
  if (isCheckable(field)) {
    if (field.checked !== Boolean(saved.checked)) field.click();
    return;
  }
  const prototype = Object.getPrototypeOf(field) as object;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(field, saved.value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Füllt, was unter root schon da ist, und gibt die Felder zurück, die noch fehlen. */
export function restoreDraft(root: ParentNode, fields: DraftField[]): DraftField[] {
  const present = draftableFields(root);
  return fields.filter((saved) => {
    const match = present.find(({ key, index }) => key === saved.key && index === saved.index);
    if (!match) return true;
    fill(match.field, saved);
    return false;
  });
}

/** Wie lange auf Felder gewartet wird, die erst nach dem Laden der Daten erscheinen. */
export const restoreTimeoutMs = 10_000;

/**
 * Füllt die Felder, sobald sie erscheinen, und löscht danach den Entwurf. Gibt eine Funktion
 * zum Aufräumen zurück.
 */
export function restoreWhenReady(root: HTMLElement, draft: Draft): () => void {
  let missing = restoreDraft(root, draft.fields);
  if (missing.length === 0) {
    clearDraft();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    missing = restoreDraft(root, missing);
    if (missing.length === 0) stop();
  });
  const timer = window.setTimeout(() => stop(), restoreTimeoutMs);
  function stop() {
    observer.disconnect();
    window.clearTimeout(timer);
    clearDraft();
  }
  observer.observe(root, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    window.clearTimeout(timer);
  };
}
