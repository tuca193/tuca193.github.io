// provas: datas do ssa 2, provas anteriores e o que é o processo
import { h, icon, skeletonLine } from '../lib/dom.js';
import { withEdital, emptyBlock } from '../ui/states.js';
import { examStatus, formatDate, formatTime } from '../lib/dates.js';

const UPE_URL = 'https://processodeingresso.upe.pe.gov.br/';
const TICK_MS = 60000;

// item - linha da prova; o status é preenchido por setStatus
function item(prova) {
  const status = h('p', { class: 'prova-status' });
  const li = h('li', { class: 'prova' },
    h('div', { class: 'prova-info' },
      h('h3', { class: 'prova-label' }, prova.label),
      h('p', { class: 'prova-date' }, formatDate(prova.inicio)),
      h('p', { class: 'prova-time' }, formatTime(prova.inicio),
        prova.confirmado ? null : h('span', { class: 'pill' }, 'a confirmar'))),
    status);
  return { prova, li, status };
}

// setStatus - atualiza o texto e o estado de passada sem recriar a linha
function setStatus(row, now) {
  const st = examStatus(row.prova.inicio, now);
  row.status.textContent = st.text;
  row.li.classList.toggle('is-past', st.phase === 'done');
}

function list(children) {
  return h('section', { class: 'card surface', 'aria-labelledby': 'provas-list-title' },
    h('h2', { class: 'sr-only', id: 'provas-list-title' }, 'Datas'),
    h('ul', {}, children));
}

const VISIBLE_YEARS = 4;
const DIAS = [1, 2];

// pdfLink - link externo para o pdf oficial, com nome acessível completo
function pdfLink(text, href, fullName) {
  return h('a', { class: 'pdf-link', href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${fullName} (PDF, abre em nova aba)` },
    text, icon('external-link'));
}

// anteriores - tabela de provas e gabaritos dos processos anteriores, os mais recentes primeiro
function anteriores(lista) {
  const sorted = [...lista].sort((a, b) => b.processo - a.processo);
  const rows = sorted.map((p, i) => {
    const byDia = Object.fromEntries(p.dias.map((d) => [d.dia, d]));
    return h('tr', { hidden: i >= VISIBLE_YEARS },
      h('th', { scope: 'row' },
        h('span', { class: 'past-year' }, `SSA 2 · ${p.processo}`),
        h('a', { class: 'past-source', href: p.pagina, target: '_blank', rel: 'noopener noreferrer' },
          'página oficial', h('span', { class: 'sr-only' }, ` do processo ${p.processo} (abre em nova aba)`))),
      DIAS.map((dia) => {
        const d = byDia[dia];
        return h('td', { 'data-label': `${dia}º dia` }, d
          ? h('span', { class: 'past-links' },
            pdfLink('Prova', d.prova, `Caderno de provas do ${dia}º dia, SSA 2 ${p.processo}`),
            pdfLink('Gabarito', d.gabarito, `Gabarito definitivo do ${dia}º dia, SSA 2 ${p.processo}`))
          : h('span', { class: 'past-missing' }, '—'));
      }));
  });

  const hiddenCount = Math.max(0, sorted.length - VISIBLE_YEARS);
  const more = hiddenCount
    ? h('button', { class: 'btn btn-quiet past-more', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'past-table' }, `Mostrar mais ${hiddenCount} anos`)
    : null;
  more?.addEventListener('click', () => {
    const open = more.getAttribute('aria-expanded') !== 'true';
    rows.forEach((r, i) => { if (i >= VISIBLE_YEARS) r.hidden = !open; });
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? 'Mostrar menos' : `Mostrar mais ${hiddenCount} anos`;
  });

  return h('section', { class: 'card surface past', 'aria-labelledby': 'past-title' },
    h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'past-title' }, 'Provas anteriores')),
    h('p', { class: 'past-note' }, 'Cadernos de prova e gabaritos definitivos publicados pela UPE, para treinar. O ano é o do processo de ingresso; as provas costumam ser aplicadas no fim do ano anterior.'),
    sorted.length
      ? h('table', { class: 'past-table', id: 'past-table' },
        h('caption', { class: 'sr-only' }, 'Provas e gabaritos do SSA 2 por processo e dia'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Processo'), DIAS.map((d) => h('th', { scope: 'col' }, `${d}º dia`)))),
        h('tbody', {}, rows))
      : emptyBlock('Nenhuma prova anterior cadastrada.'),
    more);
}

function skeleton() {
  return list([1, 2].map(() => h('li', { class: 'prova' },
    h('div', { class: 'prova-info' }, skeletonLine('80px', 17), skeletonLine('180px', 15), skeletonLine('120px', 15)),
    skeletonLine('70px', 15))));
}

export function render() {
  let timer = 0;
  const body = h('div', {});
  withEdital(body, skeleton, (edital) => {
    const rows = [...edital.provas]
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
      .map(item);
    const tick = () => rows.forEach((row) => setStatus(row, new Date()));
    tick();
    timer = setInterval(tick, TICK_MS);
    return h('div', { class: 'provas-body' }, list(rows.map((row) => row.li)), anteriores(edital.anteriores || []));
  });

  const el = h('section', { class: 'provas', 'aria-labelledby': 'provas-title' },
    h('div', { class: 'page-head' }, h('div', {},
      h('h1', { class: 'page-title', id: 'provas-title' }, 'Provas'),
      h('p', { class: 'page-sub' }, 'Datas do SSA 2 · ingresso 2027'))),
    body,
    h('section', { class: 'card surface provas-about', 'aria-labelledby': 'provas-about-title' },
      h('h2', { class: 'card-title', id: 'provas-about-title' }, 'Sobre o SSA'),
      h('p', {}, 'O SSA (Sistema Seriado de Avaliação) é o processo seriado da Universidade de Pernambuco (UPE), feito em três etapas ao longo do ensino médio. O SSA 2 é a etapa do 2º ano.'),
      h('p', {}, 'Datas e horários podem mudar: confira sempre no edital oficial.'),
      h('a', { class: 'provas-link', href: UPE_URL, target: '_blank', rel: 'noopener noreferrer' },
        'Site do processo de ingresso da UPE', icon('external-link'),
        h('span', { class: 'sr-only' }, '(abre em nova aba)'))));
  return { el, title: 'Provas', destroy: () => clearInterval(timer) };
}
