// barra de aproveitamento (acertos de respostas), colorida pela faixa
import { h } from '../lib/dom.js';
import { ratio } from '../lib/stats.js';

export const pct = (s) => `${Math.round((ratio(s) ?? 0) * 100)}%`;

// meter - barra com o valor exposto para leitores de tela: verde ≥ 70%, laranja ≥ 50%, vermelha abaixo
export function meter(s, label) {
  const r = ratio(s) ?? 0;
  const level = r >= 0.7 ? 'is-good' : r >= 0.5 ? 'is-mid' : 'is-low';
  return h('div', {
    class: `bar perf-bar ${level}`, role: 'meter', 'aria-label': label,
    'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(r * 100), 'aria-valuetext': `${pct(s)} de acerto`,
  }, h('span', { style: `transform:scaleX(${r})` }));
}
