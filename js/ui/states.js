// estados de dados reutilizáveis: carregando, erro e vazio
import { h, icon } from '../lib/dom.js';
import { loadEdital, peekEdital } from '../data/edital.js';

// errorBlock - erro dentro do bloco que falhou, com "tentar de novo"
export function errorBlock(message, onRetry) {
  return h('div', { class: 'error-block', role: 'alert' },
    icon('circle-alert'),
    h('p', { text: message }),
    onRetry ? h('button', { class: 'btn btn-quiet', type: 'button', onClick: onRetry }, icon('refresh-cw'), 'Tentar de novo') : null);
}

// emptyBlock - frase única dentro da moldura vazia, com ação opcional
export function emptyBlock(message, action) {
  return h('div', { class: 'empty' }, h('p', { text: message }), action || null);
}

// withEdital - mostra o esqueleto até o edital chegar; em erro mostra o bloco de erro
export function withEdital(container, skeleton, render) {
  const ready = peekEdital();
  if (ready) {
    container.replaceChildren(render(ready));
    return;
  }
  container.replaceChildren(skeleton());
  container.setAttribute('aria-busy', 'true');
  const attempt = (force) => loadEdital({ force })
    .then((edital) => {
      if (!container.isConnected) return;
      container.replaceChildren(render(edital));
    })
    .catch(() => {
      if (!container.isConnected) return;
      container.replaceChildren(errorBlock('Não consegui carregar o conteúdo do edital. Verifique a conexão.', () => {
        container.replaceChildren(skeleton());
        container.setAttribute('aria-busy', 'true');
        attempt(true);
      }));
    })
    .finally(() => container.removeAttribute('aria-busy'));
  attempt(false);
}
