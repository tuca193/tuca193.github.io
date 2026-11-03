export const MAX_PROFILES = 20;
export const MAX_NAME_LENGTH = 40;

export const ERRORS = {
  empty: 'Digite um nome.',
  tooLong: `Use no máximo ${MAX_NAME_LENGTH} caracteres.`,
  duplicate: 'Já existe um perfil com esse nome.',
  limit: `Limite de ${MAX_PROFILES} perfis atingido.`,
  notFound: 'Perfil não encontrado.',
};

// nameKey - chave de comparacao sem acento e sem diferenciar maiusculas
export function nameKey(name) {
  return String(name)
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

export function validateName(state, name, excludeId) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return ERRORS.empty;
  if ([...trimmed].length > MAX_NAME_LENGTH) return ERRORS.tooLong;
  const key = nameKey(trimmed);
  const clash = state.profiles.some((p) => p.id !== excludeId && nameKey(p.name) === key);
  return clash ? ERRORS.duplicate : null;
}

export function createProfile(state, name, { id, now = () => new Date() }) {
  if (state.profiles.length >= MAX_PROFILES) return { ok: false, error: ERRORS.limit };
  const error = validateName(state, name);
  if (error) return { ok: false, error };
  const profile = { id, name: name.trim(), createdAt: now().toISOString() };
  return {
    ok: true,
    profile,
    state: {
      ...state,
      activeId: id,
      profiles: [...state.profiles, profile],
      data: { ...state.data, [id]: { done: {}, quiz: {}, simulados: [] } },
    },
  };
}

export function renameProfile(state, id, name) {
  const current = state.profiles.find((p) => p.id === id);
  if (!current) return { ok: false, error: ERRORS.notFound };
  const error = validateName(state, name, id);
  if (error) return { ok: false, error };
  const profile = { ...current, name: name.trim() };
  return {
    ok: true,
    profile,
    state: { ...state, profiles: state.profiles.map((p) => (p.id === id ? profile : p)) },
  };
}

export function removeProfile(state, id) {
  if (!state.profiles.some((p) => p.id === id)) return { ok: false, error: ERRORS.notFound, state };
  const profiles = state.profiles.filter((p) => p.id !== id);
  const data = { ...state.data };
  delete data[id];
  const activeId = state.activeId === id ? (profiles[0]?.id ?? null) : state.activeId;
  return { ok: true, state: { ...state, profiles, data, activeId } };
}

export function selectProfile(state, id) {
  if (!state.profiles.some((p) => p.id === id) || state.activeId === id) return state;
  return { ...state, activeId: id };
}

// initials - só contam palavras que começam com letra ou número (ignora "(2)" e pontuação)
export function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return '?';
  const first = [...words[0]][0];
  const last = words.length > 1 ? [...words[words.length - 1]][0] : '';
  return (first + last).toLocaleUpperCase('pt-BR');
}
