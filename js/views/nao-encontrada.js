// rota desconhecida
import { h, icon } from '../lib/dom.js';

export function render() {
  const el = h('section', { 'aria-labelledby': 'nf-title' },
    h('div', { class: 'page-head' }, h('div', {},
      h('h1', { class: 'page-title', id: 'nf-title' }, 'Página não encontrada'),
      h('p', { class: 'page-sub' }, 'Esse endereço não existe no painel.'))),
    h('a', { class: 'btn btn-primary', href: '#/' }, icon('arrow-right'), 'Voltar ao painel'));
  return { el, title: 'Página não encontrada' };
}
