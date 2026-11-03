// bootstrap: store, tema, esqueleto (sidebar/top bar/tab bar) e troca de telas
import { h, icon } from './lib/dom.js';
import { createStore } from './store/store.js';
import { loadEdital } from './data/edital.js';
import { matchRoute, navSection } from './router.js';
import { profileSwitcher } from './ui/profile-switcher.js';
import { toast } from './ui/feedback.js';
import * as painel from './views/painel.js';
import * as materias from './views/materias.js';
import * as materia from './views/materia.js';
import * as provas from './views/provas.js';
import * as ajustes from './views/ajustes.js';
import * as perfis from './views/perfis.js';
import * as banco from './views/banco.js';
import * as revisao from './views/revisao.js';
import * as simulado from './views/simulado.js';
import * as boasVindas from './views/boas-vindas.js';
import * as naoEncontrada from './views/nao-encontrada.js';

const VIEWS = { painel, materias, materia, provas, ajustes, perfis, banco, revisao, simulado, 'nao-encontrada': naoEncontrada };
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
const edital = await loadEdital().catch(() => null);
const store = createStore({ knownIds: edital ? edital.ids : [] });

const main = document.getElementById('main');
let current = null;
let currentKey = '';
let firstRender = true;

/* ---------- tema ---------- */

const dark = window.matchMedia('(prefers-color-scheme: dark)');

// applyTheme - resolve "sistema" e grava o tema efetivo no <html>
function applyTheme() {
  const pref = store.theme();
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

const sidebar = document.getElementById('sidebar');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');
const switchers = [profileSwitcher(store), profileSwitcher(store, { compact: true })];
sidebar.append(h('div', { class: 'sidebar-in glass' },
  brand(true),
  h('nav', { class: 'nav', 'aria-label': 'Principal' }, navLinks('')),
  switchers[0].el));
topbar.append(brand(false), switchers[1].el);
tabbar.append(...navLinks(''));

function setChromeVisible(visible) {
  for (const el of [sidebar, topbar, tabbar]) el.hidden = !visible;
  document.getElementById('shell').classList.toggle('is-bare', !visible);
}

/* ---------- telas ---------- */

// render - monta a tela da rota atual (ou o primeiro acesso, se não houver perfil)
function render({ moveFocus = false } = {}) {
  // diálogo aberto pertence à tela anterior (ex.: renomear um perfil que outra aba excluiu)
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  const route = matchRoute(location.hash);
  const noProfile = store.profiles().length === 0;
  const view = noProfile ? boasVindas : VIEWS[route.name];
  current?.destroy?.();
  const ctx = { store, navigate: (hash) => { location.hash = hash; } };
  current = view.render(ctx, route.params) || {};
  main.replaceChildren(current.el);
  currentKey = `${noProfile ? 'boas-vindas' : route.name}|${store.getState().activeId}`;

  setChromeVisible(!noProfile);
  const section = navSection(route.name);
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === section && !noProfile) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = current.title ? `${current.title} · ${APP_NAME}` : APP_NAME;

  // foco e rolagem só quando a pessoa navegou nesta aba, nunca por mudança vinda de outra aba
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

// troca de perfil (aqui ou em outra aba) remonta a tela; o resto cada tela atualiza sozinha
store.subscribe(() => {
  applyTheme();
  const noProfile = store.profiles().length === 0;
  const key = `${noProfile ? 'boas-vindas' : matchRoute(location.hash).name}|${store.getState().activeId}`;
  if (key !== currentKey) render({ moveFocus: document.hasFocus() });
});

applyTheme();
render();
if (!edital) toast('Não consegui carregar o edital. Algumas telas vão pedir para tentar de novo.', { error: true });
if (store.lastSaveFailed()) toast('Este navegador não está salvando dados (modo privado?). O progresso some ao fechar.', { error: true });
