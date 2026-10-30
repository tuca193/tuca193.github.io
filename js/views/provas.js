// provas: datas do ssa 2 e o que é o processo
import { h, icon, skeletonLine } from '../lib/dom.js';
import { withEdital } from '../ui/states.js';
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
    return list(rows.map((row) => row.li));
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
