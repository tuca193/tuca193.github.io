// lista das matérias com busca de assuntos em todo o edital
import { h, icon, skeletonLine } from '../lib/dom.js';
import { withEdital, emptyBlock } from '../ui/states.js';
import { toast } from '../ui/feedback.js';
import { setBar, topicCheck } from '../ui/topic.js';
import { plural } from '../lib/text.js';

const DEBOUNCE_MS = 120;

// fold - tira acentos e caixa para comparar textos
export function fold(text) {
  return String(text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function skeleton() {
  return h('div', { class: 'subjects' },
    h('div', { class: 'search subjects-search' }, skeletonLine('100%', 44)),
    h('ul', { class: 'surface subject-list' }, Array.from({ length: 10 }, () => h('li', { class: 'subject-row is-skeleton' },
      h('span', { class: 'subject-name' }, skeletonLine('60%', 16)),
      h('span', { class: 'subject-status' }, skeletonLine('5rem', 12)),
      h('span', { class: 'subject-bar' }, skeletonLine('100%', 6)),
      h('span', { class: 'subject-count' }, skeletonLine('2rem', 12))))));
}

export function render({ store }) {
  const offs = [];
  const profileId = store.activeProfile()?.id;
  let timer = 0;

  const body = h('div', {});
  const sub = h('p', { class: 'page-sub' }, skeletonLine('16rem', 16));
  const el = h('section', { 'aria-labelledby': 'materias-title' },
    h('div', { class: 'page-head' }, h('div', {},
      h('h1', { class: 'page-title', id: 'materias-title' }, 'Matérias'),
      sub)),
    body);

  withEdital(body, skeleton, (edital) => {
    const rows = [];
    const checks = new Map();

    // row - linha da matéria com status, barra e contagem
    const row = (m) => {
      const ids = edital.idsOf(m);
      const status = h('span', { class: 'subject-status' });
      const count = h('span', { class: 'subject-count' });
      const bar = h('span', { class: 'bar subject-bar', 'aria-hidden': 'true' }, h('span', {}));
      const li = h('li', {}, h('a', { class: 'subject-row', href: `#/materia/${m.id}` },
        h('span', { class: 'subject-name', text: m.nome }),
        status, bar, count,
        icon('chevron-right', 'subject-go')));
      const update = () => {
        const done = store.doneCount(ids);
        const left = ids.length - done;
        status.textContent = left ? plural(left, 'pendente', 'pendentes') : 'Concluída';
        status.classList.toggle('is-done', !left);
        count.replaceChildren(`${done}/${ids.length}`, h('span', { class: 'sr-only', text: ' estudados' }));
        setBar(bar, done, ids.length);
      };
      update();
      rows.push(update);
      return li;
    };

    const list = h('ul', { class: 'surface subject-list' }, edital.materias.map(row));
    const results = h('div', { class: 'search-results', hidden: true });
    const counter = h('p', { class: 'label search-count', 'aria-live': 'polite', 'aria-atomic': 'true' });

    // search - refaz os resultados agrupados por matéria
    const search = (raw) => {
      const q = fold(raw.trim());
      checks.clear();
      if (!q) {
        results.hidden = true;
        results.replaceChildren();
        list.hidden = false;
        counter.textContent = '';
        return;
      }
      let n = 0;
      const groups = [];
      for (const m of edital.materias) {
        const hits = m.assuntos.filter((a) => fold(a.nome).includes(q) || fold(a.resumo).includes(q));
        if (!hits.length) continue;
        n += hits.length;
        groups.push(h('div', {},
          h('h2', { class: 'result-head' },
            h('a', { href: `#/materia/${m.id}` }, m.nome),
            h('span', { class: 'label', text: plural(hits.length, 'assunto', 'assuntos') })),
          h('ul', { class: 'surface result-list' }, hits.map((a) => {
            const check = topicCheck(store, a, { profileId, onToggle: (on) => toast(on ? 'Marcado como estudado.' : 'Desmarcado.') });
            checks.set(a.id, check);
            return h('li', { class: 'result-item' },
              check,
              h('div', { class: 'result-main' },
                h('p', { class: 'result-name', text: a.nome }),
                h('p', { class: 'result-sum', text: a.resumo })));
          }))));
      }
      list.hidden = true;
      results.hidden = false;
      results.replaceChildren(...(groups.length ? groups : [emptyBlock(`Nenhum assunto encontrado para "${raw.trim()}".`)]));
      counter.textContent = n ? plural(n, 'resultado', 'resultados') : 'Nenhum resultado';
    };

    const input = h('input', {
      class: 'input',
      id: 'materias-busca',
      type: 'search',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'Buscar assunto',
      'aria-describedby': 'materias-busca-count',
    });
    counter.id = 'materias-busca-count';
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => search(input.value), DEBOUNCE_MS);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !input.value) return;
      e.preventDefault();
      clearTimeout(timer);
      input.value = '';
      search('');
    });

    offs.push(store.subscribe(() => {
      rows.forEach((fn) => fn());
      checks.forEach((check, id) => check.setAttribute('aria-checked', String(store.isDone(id))));
    }));

    const total = edital.materias.reduce((sum, m) => sum + m.assuntos.length, 0);
    sub.textContent = `${plural(edital.materias.length, 'matéria', 'matérias')} · ${total} assuntos do edital`;
    return h('div', { class: 'subjects' },
      h('div', { class: 'subjects-tools' },
        h('div', { class: 'search subjects-search' },
          h('label', { class: 'sr-only', for: 'materias-busca' }, 'Buscar assunto'),
          icon('search'),
          input),
        counter),
      list,
      results);
  });

  return {
    el,
    title: 'Matérias',
    destroy: () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    },
  };
}
