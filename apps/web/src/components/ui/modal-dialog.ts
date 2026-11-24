import * as React from 'react';

/**
 * Natives `<dialog>` als modale Fläche für die erlaubten Überlagerungen (E-K0-01): Blatt und Frag
 * Reziproq. Der Browser hält den Fokus darin, sperrt die Seite dahinter und gibt den Fokus beim
 * Schließen zurück; Esc löst `onClose` aus. Die Fläche ist offen, solange sie eingehängt ist. Ein
 * Feld mit `data-autofocus` bekommt beim Öffnen den Fokus, sonst das erste bedienbare Element.
 */
export function useModalDialog(onClose: () => void) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const close = React.useRef(onClose);
  close.current = onClose;
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Wer den Fokus vor dem Öffnen hatte, bekommt ihn beim Schließen zurück. React nimmt die Fläche
    // aus der Seite, bevor der Browser das selbst tun könnte.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const cancel = (event: Event) => {
      event.preventDefault();
      close.current();
    };
    dialog.addEventListener('cancel', cancel);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      if (dialog.open) dialog.close();
      if (opener?.isConnected && opener !== document.body) opener.focus();
    };
  }, []);
  return ref;
}

/** Klick auf die abgedunkelte Fläche um die Überlagerung schließt sie (nicht ein Klick darin). */
export function closeOnBackdrop(onClose: () => void) {
  return (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
}
