// ajustes: perfil ativo, tema, backup e zerar progresso
import { h, icon, skeletonLine } from '../lib/dom.js';
import { TIME_ZONE } from '../lib/dates.js';
import { initials } from '../store/profiles.js';
import { withEdital } from '../ui/states.js';
import { toast, confirmDialog } from '../ui/feedback.js';
import { PROFILE_CHANGED_MSG } from '../ui/topic.js';

const MAX_BACKUP_BYTES = 1024 * 1024;
const THEMES = [
  { id: 'system', label: 'Sistema', icon: 'monitor' },
  { id: 'light', label: 'Claro', icon: 'sun' },
  { id: 'dark', label: 'Escuro', icon: 'moon' },
];
const isoDay = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE });

// slug - nome sem acento, minúsculo, só letras, números e hífens
function slug(name) {
  const s = String(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'perfil';
}

const topics = (n) => (n === 1 ? '1 assunto estudado' : `${n} assuntos estudados`);

function block(id, title, desc, ...children) {
  return h('section', { class: 'settings-block card surface', 'aria-labelledby': id },
    h('h2', { class: 'card-title', id, tabindex: '-1' }, title),
    desc ? h('p', { class: 'settings-desc', text: desc }) : null,
    ...children);
}

export function render({ store }) {
  const updaters = [];

  /* perfil */
  const avatar = h('span', { class: 'avatar avatar-lg', 'aria-hidden': 'true' });
  const name = h('span', { class: 'settings-profile-name' });
  updaters.push(() => {
    const p = store.activeProfile();
    if (!p) return;
    avatar.textContent = initials(p.name);
    name.textContent = p.name;
    name.title = p.name;
  });
  const profileBlock = block('aj-perfil', 'Perfil', 'O progresso que você marca fica guardado neste perfil.',
    h('div', { class: 'settings-profile' },
      avatar,
      h('div', { class: 'settings-profile-who' }, h('span', { class: 'label' }, 'Perfil ativo'), name),
      h('a', { class: 'btn', href: '#/perfis' }, icon('users'), 'Gerenciar perfis')));

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

  /* backup */
  const fileInput = h('input', {
    class: 'sr-only',
    type: 'file',
    accept: '.json,application/json',
    tabindex: '-1',
    'aria-hidden': 'true',
  });
  const importError = h('p', { class: 'field-error', role: 'alert', hidden: true });
  const showImportError = (msg) => {
    importError.replaceChildren();
    if (msg) importError.append(icon('circle-alert'), h('span', { text: msg }));
    importError.hidden = !msg;
  };

  const exportBackup = () => {
    const data = store.exportActive();
    const p = store.activeProfile();
    if (!data || !p) {
      toast('Não há perfil ativo para exportar.', { error: true });
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `painel-ssa2-${slug(p.name)}-${isoDay.format(new Date())}.json`, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup exportado.');
  };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    showImportError(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) {
        showImportError('Arquivo grande demais para ser um backup.');
        return;
      }
      let text;
      try {
        text = await file.text();
      } catch {
        showImportError('Não consegui ler esse arquivo.');
        return;
      }
      const res = store.importBackup(text);
      if (res.ok) toast(`Backup importado como perfil "${res.profile.name}".`);
      else showImportError(res.error);
    } finally {
      fileInput.value = '';
    }
  });

  const backupBlock = block('aj-backup', 'Backup do perfil',
    'O progresso fica só neste navegador. Exporte para guardar ou levar para outro aparelho.',
    h('div', { class: 'settings-actions' },
      h('button', { class: 'btn', type: 'button', onClick: exportBackup }, icon('download'), 'Exportar backup'),
      h('button', { class: 'btn', type: 'button', onClick: () => fileInput.click() }, icon('upload'), 'Importar backup'),
      fileInput),
    importError);

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
            text: `${n === 1 ? 'O assunto marcado' : `Os ${n} assuntos marcados`} como ${n === 1 ? 'estudado' : 'estudados'} no perfil "${p.name}" ${n === 1 ? 'vai ficar desmarcado' : 'vão ficar desmarcados'}. Isso não pode ser desfeito. Outros perfis não mudam.`,
            confirmLabel: 'Zerar progresso',
          });
          if (!ok) return;
          // passa o perfil do diálogo: se outra aba trocou o ativo, o store recusa
          const res = store.resetProgress(p.id);
          if (!res.ok) {
            toast(PROFILE_CHANGED_MSG, { error: true });
            return;
          }
          toast('Progresso zerado.');
          // o botão fica desabilitado; o foco vai para o título do bloco
          if (btn.disabled) document.getElementById('aj-zerar')?.focus();
        },
      }, icon('rotate-ccw'), 'Zerar progresso');
      const sync = () => {
        const p = store.activeProfile();
        const n = store.doneCount(edital.ids);
        desc.textContent = n
          ? `Desmarca ${n === 1 ? 'o' : 'os'} ${topics(n)} no perfil ${p ? p.name : ''}. Não afeta outros perfis.`
          : `Nenhum assunto marcado no perfil ${p ? p.name : ''}. Não há o que zerar.`;
        btn.disabled = n === 0;
      };
      updaters.push(sync);
      sync();
      return h('div', { class: 'settings-reset' }, desc, h('div', { class: 'settings-actions' }, btn));
    });
  const resetBlock = block('aj-zerar', 'Zerar progresso', null, resetBody);

  /* rodapé */
  const saveWarn = h('p', { class: 'settings-warn' }, icon('circle-alert'), 'Este navegador não está salvando os dados.');
  updaters.push(() => {
    saveWarn.hidden = !store.lastSaveFailed();
  });
  const footer = h('footer', { class: 'settings-foot' },
    h('p', {}, 'Painel SSA 2 · dados salvos só neste navegador.'), saveWarn);

  const update = () => updaters.forEach((fn) => fn());
  update();
  const off = store.subscribe(update);

  const el = h('section', { 'aria-labelledby': 'ajustes-title' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', { class: 'page-title', id: 'ajustes-title' }, 'Ajustes'))),
    h('div', { class: 'settings-stack' }, profileBlock, themeBlock, backupBlock, resetBlock),
    footer);

  return { el, title: 'Ajustes', destroy: off };
}
