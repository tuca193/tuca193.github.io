// google analytics 4: só carrega depois do consentimento e nunca no ambiente local

export const MEASUREMENT_ID = 'G-HJ9DVSBMB9';
const CONSENT_KEY = 'ssa2:analytics';
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)$/;

let loaded = false;
const listeners = new Set();

// consent - "granted", "denied" ou null (ainda não escolheu)
export function consent() {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

// setConsent - guarda a escolha; ao aceitar, carrega o analytics e registra a tela atual
export function setConsent(value) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* sem storage: vale só nesta visita */ }
  if (value === 'granted') {
    load();
    pageview();
  } else if (loaded) {
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  }
  listeners.forEach((fn) => fn(value));
}

export function onConsent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const active = () => consent() === 'granted' && !LOCAL.test(location.hostname);

// load - injeta o gtag.js uma vez; page_view fica manual porque o site troca de tela pelo hash
function load() {
  if (loaded || !active()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.append(s);
}

// pageview - registra a tela atual (o hash vira o caminho: #/materia/mat → /materia/mat)
export function pageview() {
  if (!active()) return;
  load();
  const path = `/${location.hash.replace(/^#\/?/, '')}`;
  window.gtag('event', 'page_view', { page_title: document.title, page_location: `${location.origin}${path}`, page_path: path });
}

// track - evento de uso (sem nenhum dado pessoal)
export function track(name, params = {}) {
  if (!active()) return;
  load();
  window.gtag('event', name, params);
}

export function initAnalytics() {
  if (active()) load();
}
