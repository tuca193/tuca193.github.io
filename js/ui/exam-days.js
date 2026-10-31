// dias de prova do ssa 2: cada dia, suas áreas de conhecimento e as matérias de cada área
import { h } from '../lib/dom.js';
import { formatDate } from '../lib/dates.js';

// examDays - junta dias, provas e matérias do edital numa estrutura pronta para as telas
export function examDays(edital) {
  return (edital.dias || []).map((d) => {
    const prova = edital.provas.find((p) => p.id === d.prova) || null;
    const areas = d.areas.map((a) => ({ nome: a.nome, materias: a.materias.map((id) => edital.materiaById(id)).filter(Boolean) }));
    return {
      dia: d.dia,
      prova,
      areas,
      materias: areas.flatMap((a) => a.materias),
      ids: areas.flatMap((a) => a.materias.flatMap((m) => edital.idsOf(m))),
    };
  });
}

// areasText - "Linguagens e suas Tecnologias e Ciências Humanas e Sociais Aplicadas"
export function areasText(day) {
  const names = day.areas.map((a) => a.nome);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} + ${names[names.length - 1]}` : names[0] || '';
}

// dayHeader - cabeçalho de um dia: "1º dia", data da prova, áreas e progresso do dia
export function dayHeader(day, { id, level = 'h3', progress } = {}) {
  return h('header', { class: 'day-head' },
    h('div', { class: 'day-head-main' },
      h(level, { class: 'day-title', id }, `${day.dia}º dia`,
        day.prova ? h('span', { class: 'day-date' }, ` · ${formatDate(day.prova.inicio)}`) : null),
      h('ul', { class: 'day-areas', 'aria-label': `Áreas do ${day.dia}º dia` },
        day.areas.map((a) => h('li', {}, a.nome)))),
    progress || null);
}
