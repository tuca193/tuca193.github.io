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
