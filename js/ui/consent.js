// aviso de cookies: aparece até a pessoa aceitar ou recusar as estatísticas de uso
import { h } from '../lib/dom.js';
import { consent, setConsent } from '../lib/metricas.js';

export function consentBanner() {
  if (consent()) return;
  const choose = (value) => {
    setConsent(value);
    banner.remove();
  };
  const banner = h('aside', { class: 'consent glass', role: 'region', 'aria-label': 'Aviso de cookies' },
    h('p', {}, 'Usamos o Google Analytics, com cookies, para contar acessos e entender quais partes do painel são mais usadas. Nenhum dado do seu perfil ou do seu progresso é enviado. Dá para mudar a escolha em Ajustes.'),
    h('div', { class: 'consent-actions' },
      h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => choose('denied') }, 'Recusar'),
      h('button', { class: 'btn btn-primary', type: 'button', onClick: () => choose('granted') }, 'Aceitar')));
  document.body.append(banner);
}
