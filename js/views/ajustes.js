// ajustes: conta google, tema, estatísticas de uso e zerar progresso
import { consent, setConsent, onConsent } from '../lib/metricas.js';
import { accountPanel } from '../ui/account.js';
import { h, icon, skeletonLine } from '../lib/dom.js';
import { withEdital } from '../ui/states.js';
import { toast, confirmDialog } from '../ui/feedback.js';
import { PROFILE_CHANGED_MSG } from '../ui/topic.js';

const THEMES = [
  { id: 'system', label: 'Sistema', icon: 'monitor' },
  { id: 'light', label: 'Claro', icon: 'sun' },
  { id: 'dark', label: 'Escuro', icon: 'moon' },
];

const topics = (n) => (n === 1 ? '1 assunto estudado' : `${n} assuntos estudados`);

function block(id, title, desc, ...children) {
  return h('section', { class: 'settings-block card surface', 'aria-labelledby': id },
    h('h2', { class: 'card-title', id, tabindex: '-1' }, title),
    desc ? h('p', { class: 'settings-desc', text: desc }) : null,
    ...children);
}

export function render({ store, session }) {
  const updaters = [];

  /* conta */
  const account = accountPanel(session);
  const accountBlock = block('aj-conta', 'Conta', 'Seu progresso fica salvo na sua conta Google e aparece em qualquer aparelho em que você entrar.', account.el);

  /* aparência */
  const themeBtns = THEMES.map((t) => h('button', {
    type: 'button',
    dataset: { theme: t.id },
    onClick: () => store.setTheme(t.id),
  }, icon(t.icon), t.label));
  updaters.push(() => {
    const current = store.theme();
    for (const b of themeBtns) b.setAttribute('aria-pressed', String(b.dataset.theme === current));
  });
  const themeBlock = block('aj-tema', 'Aparência', '"Sistema" segue o modo claro ou escuro do aparelho.',
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tema' }, themeBtns));

  /* estatísticas de uso */
  const statsBtns = [['granted', 'Permitir'], ['denied', 'Não permitir']].map(([v, label]) => h('button', {
    type: 'button', dataset: { consent: v },
    onClick: () => setConsent(v),
  }, label));
  const paintStats = () => statsBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.consent === consent())));
  paintStats();
  const offConsent = onConsent(paintStats);
  const statsBlock = block('aj-estatisticas', 'Estatísticas de uso',
    'Contagem anônima de acessos pelo Google Analytics, com cookies. Nenhum dado da conta ou do progresso é enviado.',
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Estatísticas de uso' }, statsBtns));

  /* zerar progresso */
  const resetBody = h('div', { class: 'settings-reset' });
  withEdital(resetBody,
    () => h('div', { class: 'settings-reset' }, skeletonLine('70%', 14), skeletonLine('150px', 40)),
    (edital) => {
      const desc = h('p', { class: 'settings-desc' });
      const btn = h('button', {
        class: 'btn btn-danger',
        type: 'button',
        onClick: async () => {
          const p = store.activeProfile();
          const n = store.doneCount(edital.ids);
          if (!p || n === 0) return;
          const ok = await confirmDialog({
            title: 'Zerar progresso?',
            text: `${n === 1 ? 'O assunto marcado' : `Os ${n} assuntos marcados`} como ${n === 1 ? 'estudado' : 'estudados'} ${n === 1 ? 'vai ficar desmarcado' : 'vão ficar desmarcados'} na sua conta, em todos os aparelhos. O histórico do quiz, o caderno de erros e os simulados também são apagados. Isso não pode ser desfeito.`,
            confirmLabel: 'Zerar progresso',
          });
          if (!ok) return;
          const res = store.resetProgress(p.id);
          if (!res.ok) {
            toast(PROFILE_CHANGED_MSG, { error: true });
            return;
          }
          toast('Progresso zerado.');
          if (btn.disabled) document.getElementById('aj-zerar')?.focus();
        },
      }, icon('rotate-ccw'), 'Zerar progresso');
      const sync = () => {
        const n = store.doneCount(edital.ids);
        desc.textContent = n
          ? `Desmarca ${n === 1 ? 'o' : 'os'} ${topics(n)} na sua conta.`
          : 'Nenhum assunto marcado. Não há o que zerar.';
        btn.disabled = n === 0;
      };
      updaters.push(sync);
      sync();
      return h('div', { class: 'settings-reset' }, desc, h('div', { class: 'settings-actions' }, btn));
    });
  const resetBlock = block('aj-zerar', 'Zerar progresso', null, resetBody);

  const update = () => updaters.forEach((fn) => fn());
  update();
  const off = store.subscribe(update);

  const el = h('section', { 'aria-labelledby': 'ajustes-title' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { class: 'page-title', id: 'ajustes-title' }, 'Ajustes'))),
    h('div', { class: 'settings-stack' }, accountBlock, themeBlock, statsBlock, resetBlock),
    h('footer', { class: 'settings-foot' }, h('p', {}, 'Painel SSA 2 · progresso salvo na sua conta Google.')));

  return { el, title: 'Ajustes', destroy: () => { off(); offConsent(); account.destroy(); } };
}
