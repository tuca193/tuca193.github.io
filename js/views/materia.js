// uma matéria: progresso, filtro e a lista de assuntos com detalhes e links de estudo
import { h, icon, progressBar, skeletonLine } from '../lib/dom.js';
import { relativeDay } from '../lib/dates.js';
import { peekEdital } from '../data/edital.js';
import { withEdital, emptyBlock } from '../ui/states.js';
import { toast } from '../ui/feedback.js';
import { setBar, topicCheck } from '../ui/topic.js';
import { plural } from '../lib/text.js';

const TICK_MS = 60000;

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendentes', label: 'Pendentes' },
  { id: 'estudados', label: 'Estudados' },
];

// studyLinks - buscas prontas no youtube, khan academy e google
function studyLinks(materia, assunto) {
  const q = encodeURIComponent(`SSA 2 ${materia.nome} ${assunto.nome}`);
  const links = [
    { label: 'YouTube', href: `https://www.youtube.com/results?search_query=${q}` },
    { label: 'Khan Academy', href: `https://pt.khanacademy.org/search?page_search_query=${q}` },
    { label: 'Google', href: `https://www.google.com/search?q=${encodeURIComponent(`SSA 2 ${materia.nome} ${assunto.nome} resumo`)}` },
  ];
  return h('div', { class: 'topic-links' },
    h('h3', { class: 'topic-sec-title' }, 'Pesquisar'),
    h('ul', {}, links.map((l) => h('li', {},
      h('a', { class: 'btn btn-quiet topic-link', href: l.href, target: '_blank', rel: 'noopener noreferrer' },
        l.label, icon('external-link'), h('span', { class: 'sr-only', text: ' (abre em nova aba)' }))))));
}

function skeleton() {
  return h('div', { class: 'topic-page' },
    h('div', { class: 'page-head' }, h('div', {},
      h('h1', { class: 'page-title', id: 'materia-title' },
        skeletonLine('14rem', 30), h('span', { class: 'sr-only' }, 'Carregando matéria')),
      h('p', { class: 'page-sub' }, skeletonLine('10rem', 14)))),
    h('div', { class: 'card glass topic-progress' },
      skeletonLine('5rem', 12), skeletonLine('7rem', 32), skeletonLine('100%', 6)),
    h('div', { class: 'topic-filter' }, skeletonLine('18rem', 42)),
    h('ul', { class: 'surface topic-list' }, Array.from({ length: 6 }, () => h('li', { class: 'topic' },
      h('div', { class: 'topic-row' },
        skeletonLine('var(--check-size)', 'var(--check-size)'),
        h('div', { class: 'topic-main' }, skeletonLine('55%', 16), skeletonLine('80%', 12)))))));
}

function notFound() {
  return h('div', { class: 'page-head' }, h('div', {},
    h('h1', { class: 'page-title', id: 'materia-title' }, 'Matéria não encontrada'),
    h('p', { class: 'page-sub' }, 'Esse endereço não corresponde a nenhuma matéria do edital. ',
      h('a', { href: '#/materias' }, 'Ver todas as matérias'))));
}

export function render({ store }, params = {}) {
  const offs = [];
  const profileId = store.activeProfile()?.id;
  const known = peekEdital();
  const initial = known ? known.materiaById(params.id) : null;

  const body = h('div', {});
  const el = h('section', { class: 'topic-view', 'aria-labelledby': 'materia-title' },
    h('a', { class: 'back-link', href: '#/materias' }, icon('chevron-left'), 'Matérias'),
    body);

  withEdital(body, skeleton, (edital) => {
    const materia = edital.materiaById(params.id);
    if (!known) document.title = `${materia ? materia.nome : 'Matéria não encontrada'} · Painel SSA 2`;
    if (!materia) return notFound();

    const ids = edital.idsOf(materia);
    const pinned = new Set();
    let filter = 'todos';

    const sub = h('p', { class: 'page-sub' });
    const figure = h('p', { class: 'figure' });
    const bar = progressBar(0, ids.length, `Assuntos estudados em ${materia.nome}`);
    const filterBtns = FILTERS.map((f) => h('button', {
      type: 'button',
      'aria-pressed': String(f.id === filter),
      onClick: () => {
        filter = f.id;
        pinned.clear();
        update();
      },
    }));
    const allDone = h('p', { class: 'empty', hidden: true, text: `Todos os assuntos de ${materia.nome} estudados.` });
    const emptyHost = h('div', {});

    // item - um assunto com marcação, resumo e detalhes recolhíveis
    const item = (a) => {
      const detailsId = `detalhes-${a.id}`;
      const nameId = `nome-${a.id}`;
      const doneLine = h('p', { class: 'topic-done' });
      const toggle = h('button', {
        class: 'btn btn-quiet topic-toggle',
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': detailsId,
        'aria-describedby': nameId,
      }, 'Detalhes', icon('chevron-right'));
      const details = h('div', { class: 'topic-details', id: detailsId, hidden: true },
        a.secoes.map((s) => h('div', { class: 'topic-sec' },
          h('h3', { class: 'topic-sec-title', text: s.titulo }),
          h('ul', {}, s.itens.map((t) => h('li', { text: t }))))),
        studyLinks(materia, a));
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        details.hidden = !open;
      });
      const check = topicCheck(store, a, {
        profileId,
        onBefore: (id) => pinned.add(id),
        onToggle: (on) => toast(on ? 'Marcado como estudado.' : 'Desmarcado.'),
      });
      const li = h('li', { class: 'topic' },
        h('div', { class: 'topic-row' },
          check,
          h('div', { class: 'topic-main' },
            h('p', { class: 'topic-name', id: nameId, text: a.nome }),
            doneLine,
            h('p', { class: 'topic-sum', text: a.resumo })),
          toggle),
        details);
      return { id: a.id, li, check, doneLine };
    };

    const items = materia.assuntos.map(item);
    const list = h('ul', { class: 'surface topic-list' }, items.map((i) => i.li));

    // update - recalcula contagens e estados sem recriar a lista
    function update() {
      const done = store.doneCount(ids);
      const left = ids.length - done;
      sub.textContent = `${plural(ids.length, 'assunto', 'assuntos')} · ${plural(done, 'estudado', 'estudados')}`;
      figure.replaceChildren(String(done), h('small', { text: `de ${ids.length}` }));
      setBar(bar, done, ids.length);
      const counts = { todos: ids.length, pendentes: left, estudados: done };
      FILTERS.forEach((f, i) => {
        filterBtns[i].textContent = `${f.label} (${counts[f.id]})`;
        filterBtns[i].setAttribute('aria-pressed', String(f.id === filter));
      });
      allDone.hidden = left > 0;

      let visible = 0;
      for (const it of items) {
        const on = store.isDone(it.id);
        it.check.setAttribute('aria-checked', String(on));
        it.li.classList.toggle('is-done', on);
        const at = on ? store.doneAt(it.id) : null;
        it.doneLine.textContent = at ? `Estudado ${relativeDay(at)}` : '';
        it.doneLine.hidden = !at;
        const match = filter === 'todos' || (filter === 'estudados') === on;
        const show = match || pinned.has(it.id);
        it.li.hidden = !show;
        if (show) visible += 1;
      }
      list.hidden = visible === 0;
      if (visible) emptyHost.replaceChildren();
      else if (!emptyHost.firstChild || emptyHost.dataset.filter !== filter) {
        emptyHost.replaceChildren(emptyBlock(filter === 'pendentes'
          ? `Nenhum assunto pendente em ${materia.nome}.`
          : `Nenhum assunto estudado em ${materia.nome} ainda.`));
      }
      emptyHost.dataset.filter = filter;
      // com tudo estudado, a linha de concluída já explica o filtro "pendentes" vazio
      emptyHost.hidden = visible > 0 || (left === 0 && filter === 'pendentes');
    }

    update();
    offs.push(store.subscribe(update));
    // "estudado hoje" vira "ontem" à meia-noite
    const timer = setInterval(update, TICK_MS);
    offs.push(() => clearInterval(timer));

    return h('div', { class: 'topic-page' },
      h('div', { class: 'page-head' }, h('div', {},
        h('h1', { class: 'page-title', id: 'materia-title', text: materia.nome }),
        sub)),
      h('div', { class: 'card glass topic-progress' },
        h('p', { class: 'label' }, 'Progresso da matéria'),
        figure,
        bar),
      h('h2', { class: 'sr-only' }, 'Assuntos'),
      h('div', { class: 'segmented topic-filter', role: 'group', 'aria-label': 'Filtrar assuntos' }, filterBtns),
      allDone,
      emptyHost,
      list);
  });

  return {
    el,
    title: initial ? initial.nome : (known ? 'Matéria não encontrada' : 'Matéria'),
    destroy: () => offs.forEach((off) => off()),
  };
}
