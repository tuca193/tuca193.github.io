// toasts e diálogos de confirmação
import { h, icon } from '../lib/dom.js';

const TOAST_MS = 4000;

// toast - mensagem curta no canto, anunciada pela região aria-live
export function toast(message, { error = false } = {}) {
  const region = document.getElementById('toasts');
  if (!region) return;
  const el = h('div', { class: 'toast glass' + (error ? ' is-error' : '') },
    icon(error ? 'circle-alert' : 'check'), h('span', { text: message }));
  region.append(el);
  setTimeout(() => el.remove(), TOAST_MS);
}

// openModal - abre um <dialog> com o conteúdo dado e resolve com o valor passado a close()
export function openModal(build, { label } = {}) {
  return new Promise((resolve) => {
    let result = null;
    const dialog = h('dialog', { class: 'modal glass', 'aria-label': label });
    const close = (value = null) => {
      result = value;
      dialog.close();
    };
    dialog.append(build(close));
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });
    // clique no fundo fecha
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close(null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

// confirmDialog - pergunta antes de uma ação destrutiva
export function confirmDialog({ title, text, confirmLabel, danger = true }) {
  return openModal((close) => {
    const cancel = h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => close(false) }, 'Cancelar');
    const ok = h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), type: 'button', onClick: () => close(true) }, confirmLabel);
    queueMicrotask(() => cancel.focus());
    return h('div', { class: 'modal-body' },
      h('h2', { class: 'modal-title', text: title }),
      text ? h('p', { class: 'modal-text', text }) : null,
      h('div', { class: 'modal-actions' }, cancel, ok));
  }, { label: title }).then(Boolean);
}
