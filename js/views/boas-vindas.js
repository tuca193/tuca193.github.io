// primeiro acesso: nenhum perfil cadastrado neste navegador
import { h } from '../lib/dom.js';
import { profileForm } from '../ui/profile-form.js';
import { toast } from '../ui/feedback.js';

export function render({ store }) {
  const { form, input } = profileForm({
    submitLabel: 'Criar perfil e começar',
    onSubmit: (name) => {
      const res = store.createProfile(name);
      if (res.ok) toast(`Perfil "${res.profile.name}" criado.`);
      return res;
    },
  });
  form.classList.add('card', 'glass');
  queueMicrotask(() => input.focus());
  const el = h('section', { class: 'welcome', 'aria-labelledby': 'welcome-title' },
    h('p', { class: 'welcome-brand' }, h('img', { src: 'assets/favicon.svg', alt: '', width: 28, height: 28 }), 'Painel SSA 2 · ingresso 2027'),
    h('h1', { class: 'page-title', id: 'welcome-title' }, 'Quem vai estudar?'),
    h('p', { class: 'page-sub' }, 'Crie um perfil para guardar o progresso nos 76 assuntos do edital do SSA 2. Dá para ter um perfil por pessoa neste navegador.'),
    form);
  return { el, title: 'Criar perfil' };
}
