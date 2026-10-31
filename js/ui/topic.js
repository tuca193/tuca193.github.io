// peças de assunto compartilhadas: barra de progresso e caixa de marcar
import { h, icon } from '../lib/dom.js';
import { toast } from './feedback.js';
import { runQuiz } from './quiz.js';

export const PROFILE_CHANGED_MSG = 'O perfil ativo mudou em outra aba. Tente de novo.';

// setBar - atualiza uma barra existente sem recriá-la (com ou sem role=progressbar)
export function setBar(bar, done, total) {
  bar.firstElementChild.style.transform = `scaleX(${total ? done / total : 0})`;
  if (bar.getAttribute('role') !== 'progressbar') return;
  bar.setAttribute('aria-valuemax', total);
  bar.setAttribute('aria-valuenow', done);
  bar.setAttribute('aria-valuetext', `${done} de ${total}`);
}

// toggleFor - alterna o assunto no perfil da tela; se o perfil ativo mudou, avisa e não mexe
export function toggleFor(store, topicId, profileId) {
  const on = store.toggle(topicId, { profileId });
  if (!on && store.activeProfile()?.id !== profileId) {
    toast(PROFILE_CHANGED_MSG, { error: true });
    return { ok: false, on: store.isDone(topicId) };
  }
  return { ok: true, on };
}

// topicCheck - botão de marcar assunto; assunto pode ser uma função (o assunto muda, como no painel)
// concluir passa pelo quiz de verificação; desmarcar é direto
export function topicCheck(store, assunto, { profileId, id, onBefore, onToggle, onFail } = {}) {
  const current = () => (typeof assunto === 'function' ? assunto() : assunto);
  const first = typeof assunto === 'function' ? null : assunto;
  let busy = false;
  const apply = (a) => {
    onBefore?.(a.id);
    const r = toggleFor(store, a.id, profileId);
    btn.setAttribute('aria-checked', String(r.on));
    if (r.ok) onToggle?.(r.on, a.id);
    else onFail?.(a.id);
  };
  const btn = h('button', {
    class: 'check',
    type: 'button',
    id,
    role: 'checkbox',
    'aria-checked': String(first ? store.isDone(first.id) : false),
    'aria-label': first ? `Marcar ${first.nome} como estudado` : null,
    onClick: async () => {
      const a = current();
      if (!a || busy) return;
      if (store.isDone(a.id)) {
        apply(a);
        return;
      }
      busy = true;
      try {
        const passed = await runQuiz(a.id);
        // o perfil pode ter mudado enquanto o quiz estava aberto; toggleFor recusa nesse caso
        if (passed && !store.isDone(a.id)) {
          if (btn.isConnected) apply(a);
          else toggleFor(store, a.id, profileId);
        }
      } finally {
        busy = false;
        if (btn.isConnected) btn.focus();
      }
    },
  }, icon('check'));
  return btn;
}
