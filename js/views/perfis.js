// perfis: lista, cria, renomeia, exclui e troca o perfil ativo
import { h, icon } from '../lib/dom.js';
import { TIME_ZONE } from '../lib/dates.js';
import { initials } from '../store/profiles.js';
import { countDone } from '../store/progress.js';
import { loadEdital, peekEdital } from '../data/edital.js';
import { toast } from '../ui/feedback.js';
import { createProfileDialog, renameProfileDialog, removeProfileFlow } from '../ui/profiles.js';

const createdFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: TIME_ZONE });

// doneOf - assuntos marcados no perfil; sem edital, conta tudo o que está salvo
function doneOf(state, profileId, edital) {
  const done = state.data[profileId]?.done ?? {};
  return edital ? countDone(done, edital.ids) : Object.keys(done).length;
}

function createdLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `criado em ${createdFmt.format(d)}`;
}

export function render({ store }) {
  const rows = new Map();
  const list = h('ul', { class: 'profile-list surface', 'aria-label': 'Perfis neste navegador' });
  let edital = peekEdital();
  let destroyed = false;

  const newBtn = h('button', {
    class: 'btn btn-primary',
    type: 'button',
    dataset: { newProfile: '' },
    onClick: () => createProfileDialog(store),
  }, icon('plus'), 'Novo perfil');

  // focusNew - depois de excluir; se a tela foi remontada, procura o botão da tela nova
  const focusNew = () => {
    const btn = newBtn.isConnected ? newBtn : document.querySelector('[data-new-profile]');
    btn?.focus();
  };

  // buildRow - linha de um perfil; os textos são preenchidos por fillRow
  function buildRow(profile) {
    const row = { id: profile.id, profile };
    row.avatar = h('span', { class: 'avatar avatar-lg', 'aria-hidden': 'true' });
    row.name = h('span', { class: 'profile-row-name', id: `perfil-nome-${profile.id}` });
    row.count = h('span', {});
    row.created = h('span', {});
    row.sub = h('span', { class: 'profile-row-sub' }, row.count, row.created);
    row.pill = h('span', { class: 'pill-active' }, 'Ativo');
    row.use = h('button', {
      class: 'btn btn-quiet',
      type: 'button',
      'aria-describedby': row.name.id,
      onClick: () => {
        const p = row.profile;
        if (store.selectProfile(p.id)) toast(`Usando o perfil "${p.name}".`);
      },
    }, 'Usar este perfil');
    row.rename = h('button', {
      class: 'btn btn-quiet btn-icon',
      type: 'button',
      onClick: () => renameProfileDialog(store, row.profile),
    }, icon('pencil'));
    row.remove = h('button', {
      class: 'btn btn-quiet btn-icon',
      type: 'button',
      onClick: async () => {
        const done = doneOf(store.getState(), row.profile.id, edital);
        if (await removeProfileFlow(store, row.profile, done)) focusNew();
      },
    }, icon('trash-2'));
    row.el = h('li', { class: 'profile-row' },
      row.avatar,
      h('div', { class: 'profile-row-info' }, row.name, row.sub),
      row.pill,
      h('div', { class: 'profile-row-actions' }, row.use, row.rename, row.remove));
    return row;
  }

  function fillRow(row, profile, state) {
    row.profile = profile;
    const active = profile.id === state.activeId;
    row.avatar.textContent = initials(profile.name);
    row.name.textContent = profile.name;
    row.name.title = profile.name;
    const created = createdLabel(profile.createdAt);
    row.count.classList.toggle('is-unknown', !edital);
    if (edital) row.count.textContent = `${doneOf(state, profile.id, edital)} de ${edital.total} assuntos`;
    else row.count.replaceChildren(h('span', { 'aria-hidden': 'true' }, '—'), h('span', { class: 'sr-only' }, 'contagem indisponível'));
    row.created.textContent = created ? ` · ${created}` : '';
    row.pill.hidden = !active;
    row.use.hidden = active;
    row.el.classList.toggle('is-active', active);
    row.rename.setAttribute('aria-label', `Renomear ${profile.name}`);
    row.remove.setAttribute('aria-label', `Excluir ${profile.name}`);
  }

  // update - sincroniza as linhas com o store sem recriar as que já existem
  function update() {
    const state = store.getState();
    const seen = new Set();
    state.profiles.forEach((profile, i) => {
      seen.add(profile.id);
      let row = rows.get(profile.id);
      if (!row) {
        row = buildRow(profile);
        rows.set(profile.id, row);
      }
      fillRow(row, profile, state);
      if (list.children[i] !== row.el) list.insertBefore(row.el, list.children[i] ?? null);
    });
    for (const [id, row] of rows) {
      if (seen.has(id)) continue;
      row.el.remove();
      rows.delete(id);
    }
  }

  update();
  // a lista não espera o edital: a contagem entra quando ele chegar
  if (!edital) {
    loadEdital()
      .then((ed) => {
        edital = ed;
        if (!destroyed) update();
      })
      .catch(() => {});
  }

  const off = store.subscribe(update);

  const el = h('section', { 'aria-labelledby': 'perfis-title' },
    h('a', { class: 'back-link', href: '#/ajustes' }, icon('chevron-left'), 'Ajustes'),
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', { class: 'page-title', id: 'perfis-title' }, 'Perfis'),
        h('p', { class: 'page-sub' }, 'Cada perfil guarda o próprio progresso neste navegador. Nada é compartilhado entre perfis.')),
      newBtn),
    list);

  return {
    el,
    title: 'Perfis',
    destroy() {
      destroyed = true;
      off();
    },
  };
}
