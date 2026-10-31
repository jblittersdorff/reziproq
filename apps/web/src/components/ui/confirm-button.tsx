import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button } from './button';

/**
 * Bestätigung auf der Seite statt Dialog (NAV-04): Der Knopf wird zur Zeile
 * „Wirklich beenden? Ja · Abbrechen“. Esc oder Abbrechen stellen den Knopf wieder her.
 */
function ConfirmButton({
  children,
  question,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = 'destructive',
}: {
  children: React.ReactNode;
  question: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  variant?: 'destructive' | 'default';
}) {
  const [asking, setAsking] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  // Fokus wandert in die Frage und nach dem Abbrechen zurück auf den Knopf.
  useEffect(() => {
    if (asking) cancelRef.current?.focus();
    else if (wasAsking.current) triggerRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking) {
    return (
      <Button
        ref={triggerRef}
        variant={variant === 'destructive' ? 'outline' : 'secondary'}
        onClick={() => setAsking(true)}
      >
        {children}
      </Button>
    );
  }
  return (
    <fieldset
      data-slot="confirm-row"
      className="flex flex-wrap items-center gap-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setAsking(false);
      }}
    >
      <legend className="float-left font-medium text-base">{question}</legend>
      <Button
        variant={variant}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button ref={cancelRef} variant="ghost" onClick={() => setAsking(false)}>
        {cancelLabel}
      </Button>
    </fieldset>
  );
}

export { ConfirmButton };
