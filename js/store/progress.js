import { MAX_NAME_LENGTH, MAX_PROFILES, ERRORS, nameKey } from './profiles.js';

export const EXPORT_FORMAT = 'painel-ssa2';
export const EXPORT_VERSION = 1;

export const IMPORT_ERRORS = {
  invalid: 'Arquivo inválido: não é um backup do Painel SSA 2.',
  version: 'Arquivo inválido: versão de backup não suportada.',
  dates: 'Arquivo inválido: há datas corrompidas no backup.',
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function doneMap(state) {
  return state.data[state.activeId]?.done ?? {};
}

// hasKnown - diz se ha uma lista de ids conhecidos para filtrar
function hasKnown(knownIds) {
  if (!knownIds) return false;
  return (knownIds instanceof Set ? knownIds.size : knownIds.length) > 0;
}

// filterKnown - descarta ids de topicos que nao existem no edital
export function filterKnown(done, knownIds) {
  if (!hasKnown(knownIds)) return done;
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds);
  const out = {};
  for (const [key, value] of Object.entries(done)) if (known.has(key)) out[key] = value;
  return out;
}

function isKnown(topicId, knownIds) {
  if (typeof topicId !== 'string' || !topicId) return false;
  if (!hasKnown(knownIds)) return true;
  return knownIds instanceof Set ? knownIds.has(topicId) : knownIds.includes(topicId);
}

function withDone(state, profileId, done) {
  return { ...state, data: { ...state.data, [profileId]: { ...state.data[profileId], done } } };
}

export function toggleTopic(state, topicId, { now = () => new Date(), knownIds } = {}) {
  const id = state.activeId;
  if (!id || !state.data[id] || !isKnown(topicId, knownIds)) return state;
  const done = { ...state.data[id].done };
  if (done[topicId]) delete done[topicId];
  else done[topicId] = now().toISOString();
  return withDone(state, id, done);
}

export function resetProgress(state, profileId) {
  if (!state.data[profileId]) return state;
  return withDone(state, profileId, {});
}

export function countDone(done, ids) {
  let n = 0;
  for (const id of ids) if (done[id]) n++;
  return n;
}

export function exportProfile(state, profileId, { now = () => new Date() } = {}) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) return null;
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now().toISOString(),
    profile: { name: profile.name },
    done: { ...(state.data[profileId]?.done ?? {}) },
  };
}

// uniqueName - acrescenta " (2)", " (3)"... ate o nome ficar livre
function uniqueName(state, name) {
  const taken = new Set(state.profiles.map((p) => nameKey(p.name)));
  if (!taken.has(nameKey(name))) return name;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const base = [...name].slice(0, MAX_NAME_LENGTH - suffix.length).join('').trimEnd();
    const candidate = base + suffix;
    if (!taken.has(nameKey(candidate))) return candidate;
  }
}

export function importProfile(state, payload, { id, now = () => new Date(), knownIds } = {}) {
  let data = payload;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { ok: false, error: IMPORT_ERRORS.invalid };
    }
  }
  if (!isObject(data) || data.format !== EXPORT_FORMAT) return { ok: false, error: IMPORT_ERRORS.invalid };
  if (data.version !== EXPORT_VERSION) return { ok: false, error: IMPORT_ERRORS.version };
  const rawName = isObject(data.profile) && typeof data.profile.name === 'string' ? data.profile.name.trim() : '';
  if (!rawName || !isObject(data.done)) return { ok: false, error: IMPORT_ERRORS.invalid };
  if (state.profiles.length >= MAX_PROFILES) return { ok: false, error: ERRORS.limit };

  const done = {};
  for (const [topicId, value] of Object.entries(data.done)) {
    const time = typeof value === 'string' ? Date.parse(value) : NaN;
    if (Number.isNaN(time)) return { ok: false, error: IMPORT_ERRORS.dates };
    done[topicId] = new Date(time).toISOString();
  }

  const name = uniqueName(state, [...rawName].slice(0, MAX_NAME_LENGTH).join('').trim());
  const profile = { id, name, createdAt: now().toISOString() };
  return {
    ok: true,
    profile,
    state: {
      ...state,
      activeId: id,
      profiles: [...state.profiles, profile],
      data: { ...state.data, [id]: { done: filterKnown(done, knownIds) } },
    },
  };
}
