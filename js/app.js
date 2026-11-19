// bootstrap: conta google, store da conta, tema, esqueleto (sidebar/top bar/tab bar) e troca de telas
import { h, icon } from './lib/dom.js';
import { createStore } from './store/store.js';
import { loadEdital } from './data/edital.js';
import { matchRoute, navSection } from './router.js';
import { toast } from './ui/feedback.js';
import { initAnalytics, pageview } from './lib/metricas.js';
import { consentBanner } from './ui/consent.js';
import { startSync, onSync } from './data/sync.js';
import { resolveSession, accountKey } from './data/session.js';
import { avatar, offerTransition } from './ui/account.js';
import * as painel from './views/painel.js';
import * as materias from './views/materias.js';
import * as materia from './views/materia.js';
import * as provas from './views/provas.js';
import * as ajustes from './views/ajustes.js';
import * as banco from './views/banco.js';
import * as revisao from './views/revisao.js';
import * as simulado from './views/simulado.js';
import * as entrada from './views/entrada.js';
import * as naoEncontrada from './views/nao-encontrada.js';

const VIEWS = { painel, materias, materia, provas, ajustes, banco, revisao, simulado, 'nao-encontrada': naoEncontrada };
const NAV = [
  { id: 'painel', href: '#/', label: 'Painel', icon: 'house' },
  { id: 'materias', href: '#/materias', label: 'Matérias', icon: 'book-open' },
  { id: 'revisao', href: '#/revisao', label: 'Revisão', icon: 'list-checks' },
  { id: 'provas', href: '#/provas', label: 'Provas', icon: 'calendar' },
  { id: 'banco', href: '#/banco', label: 'Questões', icon: 'database' },
  { id: 'ajustes', href: '#/ajustes', label: 'Ajustes', icon: 'settings' },
];
const APP_NAME = 'Painel SSA 2';

// os ids conhecidos chegam com o edital; até lá o store não filtra nada
const [edital, session] = await Promise.all([loadEdital().catch(() => null), resolveSession()]);
// sem conta não há progresso: só a tela de entrada (o progresso antigo continua guardado no navegador)
const store = session
  ? createStore({ knownIds: edital ? edital.ids : [], key: accountKey(session.uid), newId: () => session.uid })
  : null;
if (store && store.profiles().length === 0) store.createProfile(session.name.slice(0, 40).trim() || 'Você');

const main = document.getElementById('main');
let current = null;
let firstRender = true;

/* ---------- tema ---------- */

const dark = window.matchMedia('(prefers-color-scheme: dark)');

// applyTheme - resolve "sistema" e grava o tema efetivo no <html>
function applyTheme() {
  const pref = store ? store.theme() : 'system';
  const resolved = pref === 'system' ? (dark.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = resolved;
  const ground = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ground);
}
dark.addEventListener('change', applyTheme);

/* ---------- esqueleto ---------- */

function brandMark() {
  // a folha do edital com o canto dobrado e uma linha marcada
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'brand-mark');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M7 4h13l6 6v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="currentColor"/>'
    + '<path d="M20 4v6h6" fill="none" stroke="var(--ground)" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<path d="m10 17 2.5 2.5L17 15" fill="none" stroke="var(--ground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M10 23h11" stroke="var(--ground)" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>';
  return svg;
}

function brand(withSub) {
  return h('a', { class: 'brand', href: '#/' }, brandMark(),
    h('span', {}, APP_NAME, withSub ? h('small', {}, 'Ingresso 2027 · UPE') : null));
}

function navLinks(cls) {
  return NAV.map((n) => h('a', { class: cls, href: n.href, dataset: { nav: n.id } }, icon(n.icon), h('span', {}, n.label)));
}

// accountChip - quem está logado; leva para ajustes, onde fica a conta
function accountChip(compact) {
  if (!session) return null;
  return h('a', { class: compact ? 'account-chip is-compact' : 'account-chip', href: '#/ajustes', 'aria-label': `Conta: ${session.name}` },
    avatar(session), compact ? null : h('span', { class: 'account-chip-name', text: session.name }));
}

const sidebar = document.getElementById('sidebar');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');
sidebar.append(h('div', { class: 'sidebar-in glass' },
  brand(true),
  h('nav', { class: 'nav', 'aria-label': 'Principal' }, navLinks('')),
  accountChip(false)));
topbar.append(brand(false), accountChip(true));
tabbar.append(...navLinks(''));

function setChromeVisible(visible) {
  for (const el of [sidebar, topbar, tabbar]) el.hidden = !visible;
  document.getElementById('shell').classList.toggle('is-bare', !visible);
}

/* ---------- telas ---------- */

// render - monta a tela da rota atual (ou a entrada, sem conta)
function render({ moveFocus = false } = {}) {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  const route = matchRoute(location.hash);
  const view = store ? VIEWS[route.name] : entrada;
  current?.destroy?.();
  const ctx = { store, session, navigate: (hash) => { location.hash = hash; } };
  current = view.render(ctx, route.params) || {};
  main.replaceChildren(current.el);

  setChromeVisible(Boolean(store));
  const section = navSection(route.name);
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === section && store) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = current.title ? `${current.title} · ${APP_NAME}` : APP_NAME;
  pageview();

  // foco e rolagem só quando a pessoa navegou nesta aba
  if (moveFocus && !firstRender) {
    window.scrollTo(0, 0);
    const title = main.querySelector('h1');
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    } else {
      main.focus({ preventScroll: true });
    }
  }
  firstRender = false;
}

window.addEventListener('hashchange', () => render({ moveFocus: true }));

// o tema vale na hora; o resto cada tela atualiza sozinha
store?.subscribe(applyTheme);

applyTheme();
initAnalytics();
render();
consentBanner();
if (store) {
  startSync(store, session);
  // assim que a conta estiver em dia, oferece trazer o progresso antigo deste navegador
  let offered = false;
  onSync((s) => {
    if (offered || s.status !== 'synced') return;
    offered = true;
    offerTransition(store, session);
  });
}
if (!edital) toast('Não consegui carregar o edital. Algumas telas vão pedir para tentar de novo.', { error: true });
if (store?.lastSaveFailed()) toast('Este navegador não está salvando dados (modo privado?). O progresso some ao fechar.', { error: true });
