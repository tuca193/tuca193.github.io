// transição: o progresso antigo (perfis salvos só no navegador) vai para a conta google de cada pessoa
// nada é apagado antes de existir uma cópia de segurança; perfis não levados continuam guardados
import { STORAGE_KEY, LEGACY_KEY, load, save } from '../store/storage.js';
import { mergeStates } from '../lib/merge.js';

export const SAFETY_KEY = 'ssa2:legado';

const progressOf = (d = {}) => ({
  assuntos: Object.keys(d.done ?? {}).length,
  questoes: Object.keys(d.quiz ?? {}).length,
  simulados: (d.simulados ?? []).length,
});
const hasProgress = (p) => p.assuntos + p.questoes + p.simulados > 0;

// pendingProfiles - perfis antigos com algum progresso, ainda não levados para uma conta
export function pendingProfiles(storage) {
  const state = load(storage);
  return state.profiles
    .map((p) => ({ id: p.id, name: p.name, ...progressOf(state.data[p.id]) }))
    .filter(hasProgress);
}

// keepSafetyCopy - guarda o progresso antigo inteiro uma única vez, antes da primeira mudança
function keepSafetyCopy(storage) {
  try {
    if (storage.getItem(SAFETY_KEY) !== null) return;
    const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_KEY);
    if (raw !== null) storage.setItem(SAFETY_KEY, raw);
  } catch { /* sem storage: nada a proteger */ }
}

// takeProfile - tira um perfil do progresso antigo e devolve os dados dele
export function takeProfile(storage, profileId) {
  keepSafetyCopy(storage);
  const state = load(storage);
  const data = state.data[profileId];
  if (!data) return null;
  const profiles = state.profiles.filter((p) => p.id !== profileId);
  const rest = { ...state.data };
  delete rest[profileId];
  const left = { ...state, profiles, data: rest, activeId: profiles[0]?.id ?? null };
  const stillPending = profiles.some((p) => hasProgress(progressOf(rest[p.id])));
  try {
    if (stillPending) save(storage, left);
    else {
      storage.removeItem(STORAGE_KEY);
      storage.removeItem(LEGACY_KEY);
    }
  } catch { /* a cópia de segurança continua valendo */ }
  return data;
}

// importInto - junta o progresso de um perfil antigo ao perfil da conta (uid), sem perder nada
export function importInto(account, uid, data) {
  const incoming = {
    ...account,
    profiles: account.profiles.filter((p) => p.id === uid),
    data: { [uid]: { done: { ...(data.done ?? {}) }, quiz: { ...(data.quiz ?? {}) }, simulados: [...(data.simulados ?? [])] } },
    activeId: uid,
  };
  return mergeStates(account, incoming);
}
