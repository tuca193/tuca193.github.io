// entrada: o painel agora funciona com a conta google; quem tem progresso antigo vê que ele está guardado
import { h, icon } from '../lib/dom.js';
import { enter, summary } from '../ui/account.js';
import { pendingProfiles } from '../data/legacy.js';

export function render() {
  const pending = pendingProfiles(localStorage);
  const go = h('button', { class: 'btn btn-primary entrada-go', type: 'button', onClick: enter }, icon('user'), 'Entrar com Google');
  queueMicrotask(() => go.focus());
  const el = h('section', { class: 'welcome', 'aria-labelledby': 'entrada-title' },
    h('p', { class: 'welcome-brand' }, h('img', { src: 'assets/favicon.svg', alt: '', width: 28, height: 28 }), 'Painel SSA 2 · ingresso 2027'),
    h('h1', { class: 'page-title', id: 'entrada-title' }, pending.length ? 'Atualize para o novo sistema' : 'Entre para estudar'),
    h('p', { class: 'page-sub' }, pending.length
      ? 'O painel agora guarda o progresso na sua conta Google, em vez de perfis salvos só neste navegador. Assim você não perde nada e continua de qualquer aparelho.'
      : 'Entre com sua conta Google para marcar os 76 assuntos do edital, fazer os quizzes e os simulados. O progresso fica salvo na sua conta e aparece em qualquer aparelho.'),
    pending.length
      ? h('div', { class: 'card glass entrada-legado' },
        h('p', { class: 'label' }, 'Progresso salvo neste navegador'),
        h('ul', { class: 'entrada-lista' }, pending.map((p) => h('li', {}, h('strong', { text: p.name }), h('span', { text: summary(p) })))),
        h('p', { class: 'settings-desc' }, 'Ele não se perde: depois de entrar, você escolhe qual perfil é o seu e ele vai para a sua conta. Os outros continuam guardados aqui até cada pessoa entrar com a própria conta.'))
      : null,
    go);
  return { el, title: pending.length ? 'Atualize para o novo sistema' : 'Entrar' };
}
