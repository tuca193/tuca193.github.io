// formulário de perfil (criar e renomear), usado no diálogo e no primeiro acesso
import { h, icon } from '../lib/dom.js';

let seq = 0;

// profileForm - campo de nome com validação junto ao campo; onSubmit recebe o nome e devolve { ok, error }
export function profileForm({ initial = '', submitLabel, onSubmit, onCancel }) {
  const id = `profile-name-${++seq}`;
  const errorId = `${id}-error`;
  let touched = false;

  const input = h('input', {
    class: 'input',
    id,
    name: 'name',
    type: 'text',
    value: initial,
    maxlength: 60,
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: 'false',
    'aria-describedby': `${id}-hint`,
  });
  const error = h('p', { class: 'field-error', id: errorId, hidden: true });

  const showError = (msg) => {
    error.replaceChildren();
    if (msg) error.append(icon('circle-alert'), msg);
    error.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    input.setAttribute('aria-describedby', msg ? `${errorId} ${id}-hint` : `${id}-hint`);
  };

  const form = h('form', { class: 'modal-body', novalidate: true },
    h('div', { class: 'field' },
      h('label', { for: id }, 'Nome do perfil'),
      input,
      error,
      h('p', { class: 'field-hint', id: `${id}-hint` }, 'Até 40 caracteres. Aparece no seletor de perfil.')),
    h('div', { class: 'modal-actions' },
      onCancel ? h('button', { class: 'btn btn-quiet', type: 'button', onClick: onCancel }, 'Cancelar') : null,
      h('button', { class: 'btn btn-primary', type: 'submit' }, submitLabel)));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    touched = true;
    const res = onSubmit(input.value);
    if (res && !res.ok) {
      showError(res.error);
      input.focus();
    }
  });
  // depois da primeira tentativa, revalida enquanto digita
  form.addEventListener('input', () => {
    if (touched) showError(null);
  });

  return { form, input, showError };
}
