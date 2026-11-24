// E-K0-01: Blatt und Frag Reziproq nutzen das native Element dialog. jsdom kennt showModal und close
// nicht; für Unit-Tests reicht Öffnen und Schließen. Fokus, Esc und den gesperrten Hintergrund
// prüft der echte Browser in den E2E-Tests.
if (typeof HTMLDialogElement !== 'undefined') {
  const dialog = HTMLDialogElement.prototype;
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof dialog.close !== 'function') {
    dialog.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
