// texto das questões em blocos: títulos, parágrafos, estrofes, fontes, notas, afirmativas e a pergunta
import { h } from '../lib/dom.js';

// block - um bloco do banco de questões vira o elemento certo
function block(b, { questionId } = {}) {
  switch (b.t) {
    case 'titulo':
      return h('p', { class: 'qt-title' }, b.texto);
    case 'verso':
      return h('p', { class: 'qt-verse' }, b.linhas.flatMap((l, i) => (i ? [h('br'), l] : [l])));
    case 'fonte':
      return h('p', { class: 'qt-source' }, b.texto);
    case 'nota':
      return h('p', { class: 'qt-note' }, b.texto);
    case 'lista':
      return h('ol', { class: 'qt-list' }, b.itens.map((it) => h('li', {},
        h('span', { class: 'qt-mark', 'aria-hidden': it.marca ? null : 'true' }, it.marca || '•'),
        h('span', {}, it.texto))));
    case 'pergunta':
      return h('h3', { class: 'qt-ask quiz-stem', id: questionId, tabindex: '-1' }, b.texto);
    default:
      return h('p', { class: 'qt-p' }, b.texto);
  }
}

// supportText - texto(s) motivador(es) numa região rolável própria
export function supportText(blocks) {
  if (!blocks?.length) return null;
  return h('section', { class: 'quiz-context', tabindex: '0', 'aria-label': 'Texto de apoio' },
    h('p', { class: 'quiz-context-label' }, 'Texto de apoio'),
    h('div', { class: 'qt' }, blocks.map((b) => block(b))));
}

// questionBody - enunciado da questão; com imagem, mostra o recorte da prova original e guarda o texto digitado
export function questionBody(q, { questionId, prefix }) {
  if (!q.imagem) return [supportText(q.apoio), commandText(q.comando, { questionId, prefix })];
  const ask = q.comando.find((b) => b.t === 'pergunta');
  const typed = h('details', { class: 'qt-typed' },
    h('summary', {}, 'Ver texto digitado'),
    h('div', { class: 'qt' }, [...q.apoio, ...q.comando].map((b) => block(b.t === 'pergunta' ? { ...b, t: 'p' } : b))));
  return [
    h('figure', { class: 'qt-original' },
      h('img', { src: `data/img/${q.id}.webp`, alt: 'Enunciado da questão como aparece na prova original. O texto está em "Ver texto digitado".', loading: 'lazy', decoding: 'async' }),
      h('figcaption', {}, 'Recorte da prova original')),
    // rótulo das alternativas para leitores de tela: a pergunta em texto
    h('h3', { class: 'sr-only quiz-stem', id: questionId, tabindex: '-1' }, prefix, ask?.texto ?? ''),
    typed,
  ];
}

// commandText - o comando da questão; a pergunta final vira o título focável que rotula as alternativas
export function commandText(blocks, { questionId, prefix }) {
  const hasAsk = blocks.some((b) => b.t === 'pergunta');
  const nodes = blocks.map((b) => block(b, { questionId }));
  const ask = nodes.find((n) => n.id === questionId);
  ask?.prepend(h('span', { class: 'sr-only' }, prefix));
  return h('div', { class: 'qt qt-command' },
    hasAsk ? null : h('h3', { class: 'sr-only quiz-stem', id: questionId, tabindex: '-1' }, prefix),
    nodes);
}
