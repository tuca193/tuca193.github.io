// ações de perfil com diálogo: criar, renomear, excluir
import { h } from '../lib/dom.js';
import { openModal, confirmDialog, toast } from './feedback.js';
import { profileForm } from './profile-form.js';

// createProfileDialog - abre o diálogo de novo perfil; resolve com o perfil criado ou null
export function createProfileDialog(store) {
  return openModal((close) => {
    const { form, input } = profileForm({
      submitLabel: 'Criar perfil',
      onCancel: () => close(null),
      onSubmit: (name) => {
        const res = store.createProfile(name);
        if (res.ok) {
          toast(`Perfil "${res.profile.name}" criado.`);
          close(res.profile);
        }
        return res;
      },
    });
    form.prepend(h('h2', { class: 'modal-title', text: 'Novo perfil' }),
      h('p', { class: 'modal-text', text: 'Cada perfil tem o próprio progresso. Nada é compartilhado entre perfis.' }));
    queueMicrotask(() => input.focus());
    return form;
  }, { label: 'Novo perfil' });
}

// renameProfileDialog - renomeia um perfil existente
export function renameProfileDialog(store, profile) {
  return openModal((close) => {
    const { form, input } = profileForm({
      initial: profile.name,
      submitLabel: 'Salvar',
      onCancel: () => close(null),
      onSubmit: (name) => {
        const res = store.renameProfile(profile.id, name);
        if (res.ok) {
          toast('Nome do perfil atualizado.');
          close(res.profile);
        }
        return res;
      },
    });
    form.prepend(h('h2', { class: 'modal-title', text: 'Renomear perfil' }));
    queueMicrotask(() => input.select());
    return form;
  }, { label: 'Renomear perfil' });
}

// removeProfileFlow - confirma e exclui; diz exatamente o que será apagado
export async function removeProfileFlow(store, profile, doneCount) {
  const ok = await confirmDialog({
    title: `Excluir "${profile.name}"?`,
    text: doneCount
      ? `Os ${doneCount} assuntos marcados neste perfil serão apagados deste navegador. Exporte um backup em Ajustes se quiser guardar.`
      : 'Este perfil ainda não tem assuntos marcados.',
    confirmLabel: 'Excluir perfil',
  });
  if (!ok) return false;
  const res = store.removeProfile(profile.id);
  if (res && res.ok === false) {
    toast(res.error, { error: true });
    return false;
  }
  toast(`Perfil "${profile.name}" excluído.`);
  return true;
}
