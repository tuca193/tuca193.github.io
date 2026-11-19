// conta google: entrar, sair, estado da sincronização e a transição do progresso antigo
import { h, icon } from '../lib/dom.js';
import { plural } from '../lib/text.js';
import { toast, confirmDialog, openModal } from './feedback.js';
import { onSync, signIn, signOut } from '../data/sync.js';
import { pendingProfiles, takeProfile, importInto } from '../data/legacy.js';
import { accountKey } from '../data/session.js';
import { save } from '../store/storage.js';

const STATUS = {
  connecting: 'Conectando à sua conta…',
  synced: 'Progresso salvo na sua conta.',
  saving: 'Salvando na sua conta…',
  error: 'Sem conexão com a conta agora. O progresso fica neste aparelho e é enviado assim que a conexão voltar.',
};

// enter - abre o login do google; fechar a janela não é erro
export function enter() {
  return signIn().catch((e) => {
    if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') toast('Não consegui entrar com o Google. Tente de novo.', { error: true });
  });
}

// summary - "12 assuntos · 30 questões · 2 simulados"
export function summary(p) {
  return [
    p.assuntos && plural(p.assuntos, 'assunto', 'assuntos'),
    p.questoes && plural(p.questoes, 'questão respondida', 'questões respondidas'),
    p.simulados && plural(p.simulados, 'simulado', 'simulados'),
  ].filter(Boolean).join(' · ');
}

// avatar - foto da conta ou a inicial do nome
export function avatar(session, cls = '') {
  return session.photo
    ? h('img', { class: `avatar ${cls}`.trim(), src: session.photo, alt: '', referrerpolicy: 'no-referrer', width: 32, height: 32 })
    : h('span', { class: `avatar ${cls}`.trim(), 'aria-hidden': 'true' }, (session.name || '?').trim().charAt(0).toUpperCase());
}

// accountPanel - bloco de conta para a tela de ajustes; devolve { el, destroy }
export function accountPanel(session) {
  const status = h('p', { class: 'settings-desc', 'aria-live': 'polite' });
  const off = onSync((s) => {
    status.className = `settings-desc account-status is-${s.status}`;
    status.textContent = STATUS[s.status] ?? '';
  });
  const out = h('button', {
    class: 'btn btn-quiet', type: 'button',
    onClick: async () => {
      const ok = await confirmDialog({
        title: 'Sair da conta?',
        text: 'Seu progresso continua salvo na conta e volta quando você entrar de novo, aqui ou em outro aparelho.',
        confirmLabel: 'Sair', danger: false,
      });
      if (ok) await signOut();
    },
  }, 'Sair da conta');
  const el = h('div', { class: 'account' },
    h('div', { class: 'account-who' }, avatar(session),
      h('span', {}, h('strong', { text: session.name }), session.email ? h('small', { text: session.email }) : null)),
    status,
    h('div', { class: 'account-actions' }, out));
  return { el, destroy: off };
}

const skipKey = (uid) => `ssa2:u:${uid}:transicao`;

// offerTransition - depois de entrar, pergunta qual perfil antigo deste navegador é da pessoa e leva para a conta
export async function offerTransition(store, session, { force = false } = {}) {
  const pending = pendingProfiles(localStorage);
  if (!pending.length) return;
  try { if (!force && localStorage.getItem(skipKey(session.uid))) return; } catch { /* sem storage */ }
  const chosen = await openModal((close) => {
    let pick = pending.length === 1 ? pending[0].id : null;
    const ok = h('button', { class: 'btn btn-primary', type: 'submit', disabled: !pick }, 'Levar para minha conta');
    const options = pending.map((p) => h('label', { class: 'transition-option' },
      h('input', { type: 'radio', name: 'perfil-antigo', value: p.id, checked: p.id === pick, onChange: () => { pick = p.id; ok.disabled = false; } }),
      h('span', {}, h('strong', { text: p.name }), h('small', { text: summary(p) }))));
    const form = h('form', { class: 'modal-body' },
      h('h2', { class: 'modal-title' }, 'Traga seu progresso antigo'),
      h('p', { class: 'modal-text' }, pending.length === 1
        ? 'Este navegador tem progresso salvo do sistema antigo de perfis. Se ele é seu, leve para a sua conta: nada se perde e ele passa a aparecer em qualquer aparelho.'
        : 'Este navegador tem progresso salvo de mais de um perfil do sistema antigo. Escolha o seu; os outros continuam guardados aqui até cada pessoa entrar com a própria conta.'),
      h('div', { class: 'transition-list', role: 'radiogroup', 'aria-label': 'Perfis antigos' }, options),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => close('skip') }, pending.length === 1 ? 'Não é meu' : 'Nenhum é meu'),
        ok));
    form.addEventListener('submit', (e) => { e.preventDefault(); if (pick) close(pick); });
    return form;
  }, { label: 'Traga seu progresso antigo', dismissOnBackdrop: false, cancelValue: () => null });
  if (chosen === 'skip') {
    try { localStorage.setItem(skipKey(session.uid), '1'); } catch { /* sem storage */ }
    return;
  }
  if (!chosen) return;
  const data = takeProfile(localStorage, chosen);
  if (!data) return;
  save(localStorage, importInto(store.getState(), session.uid, data), accountKey(session.uid));
  store.reload();
  toast('Progresso antigo levado para a sua conta.');
}

// transitionNotice - aviso no painel enquanto houver progresso antigo esperando neste navegador
export function transitionNotice(store, session) {
  const pending = pendingProfiles(localStorage);
  if (!pending.length) return null;
  return h('section', { class: 'card surface account-nudge', 'aria-labelledby': 'transicao-title' },
    h('div', {},
      h('h2', { class: 'card-title', id: 'transicao-title' }, 'Progresso antigo esperando'),
      h('p', { class: 'settings-desc' }, `Este navegador ainda tem progresso do sistema antigo de perfis: ${pending.map((p) => `${p.name} (${summary(p)})`).join('; ')}. Cada pessoa deve entrar com a própria conta Google aqui para levar o seu. Ele fica guardado até lá.`)),
    h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => offerTransition(store, session, { force: true }) }, icon('arrow-right'), 'Algum destes é meu'));
}
