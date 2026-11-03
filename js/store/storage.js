export const STORAGE_KEY = 'ssa2:v2';
export const LEGACY_KEY = 'ssa2';
export const THEMES = ['system', 'light', 'dark'];

const LEGACY_PROFILE_NAME = 'Meu perfil';

export function emptyState() {
  return { version: 2, activeId: null, profiles: [], data: {}, prefs: { theme: 'system' } };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readItem(storage, key) {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

function parseJson(raw) {
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// normalizeDone - mantem so as entradas cujo valor e string
function normalizeDone(done) {
  const out = {};
  if (!isObject(done)) return out;
  for (const [key, value] of Object.entries(done)) {
    if (typeof value === 'string' && value) out[key] = value;
  }
  return out;
}

// normalizeQuiz - histórico de respostas por questão: { c: acertos, e: erros, ok: última certa, last: data }
export function normalizeQuiz(quiz) {
  const out = {};
  if (!isObject(quiz)) return out;
  for (const [key, v] of Object.entries(quiz)) {
    if (!key || !isObject(v)) continue;
    const c = Number.isInteger(v.c) && v.c >= 0 ? v.c : 0;
    const e = Number.isInteger(v.e) && v.e >= 0 ? v.e : 0;
    if (c + e === 0 || typeof v.ok !== 'boolean' || typeof v.last !== 'string' || Number.isNaN(Date.parse(v.last))) continue;
    out[key] = { c, e, ok: v.ok, last: v.last };
  }
  return out;
}

export const MAX_SIMULADOS = 30;
const isCount = (s) => isObject(s) && Number.isInteger(s.c) && Number.isInteger(s.n) && s.c >= 0 && s.n >= s.c;

// normalizeSimulados - resultados de simulados já entregues, os mais recentes por último
export function normalizeSimulados(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((r) => isObject(r) && (r.dia === 1 || r.dia === 2) && typeof r.modo === 'string'
    && isCount(r) && Number.isInteger(r.segundos) && r.segundos >= 0
    && typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at))
    && isObject(r.areas) && Object.values(r.areas).every(isCount))
    .map((r) => ({ dia: r.dia, modo: r.modo, c: r.c, n: r.n, areas: { ...r.areas }, segundos: r.segundos, at: r.at }))
    .slice(-MAX_SIMULADOS);
}

// normalize - valida e corrige um estado lido do storage
export function normalize(raw, now = () => new Date()) {
  const state = emptyState();
  if (!isObject(raw)) return state;

  const seen = new Set();
  if (Array.isArray(raw.profiles)) {
    for (const p of raw.profiles) {
      if (!isObject(p)) continue;
      if (typeof p.id !== 'string' || !p.id || seen.has(p.id)) continue;
      if (typeof p.name !== 'string' || !p.name.trim()) continue;
      seen.add(p.id);
      state.profiles.push({
        id: p.id,
        name: p.name.trim(),
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : now().toISOString(),
      });
    }
  }

  const data = isObject(raw.data) ? raw.data : {};
  for (const p of state.profiles) {
    const entry = isObject(data[p.id]) ? data[p.id] : {};
    state.data[p.id] = { done: normalizeDone(entry.done), quiz: normalizeQuiz(entry.quiz), simulados: normalizeSimulados(entry.simulados) };
  }

  state.activeId = seen.has(raw.activeId) ? raw.activeId : (state.profiles[0]?.id ?? null);

  const theme = isObject(raw.prefs) ? raw.prefs.theme : undefined;
  state.prefs.theme = THEMES.includes(theme) ? theme : 'system';
  return state;
}

// migrateLegacy - converte o formato antigo { topicId: true } num perfil
function migrateLegacy(legacy, now, newId) {
  if (!isObject(legacy)) return null;
  const keys = Object.keys(legacy).filter((k) => Boolean(legacy[k]));
  if (keys.length === 0) return null;
  const stamp = now().toISOString();
  const id = newId();
  const done = {};
  for (const k of keys) done[k] = stamp;
  return {
    ...emptyState(),
    activeId: id,
    profiles: [{ id, name: LEGACY_PROFILE_NAME, createdAt: stamp }],
    data: { [id]: { done } },
  };
}

export function load(storage, { now = () => new Date(), newId = () => globalThis.crypto.randomUUID() } = {}) {
  try {
    const raw = readItem(storage, STORAGE_KEY);
    if (raw !== null) return normalize(parseJson(raw), now);
    const migrated = migrateLegacy(parseJson(readItem(storage, LEGACY_KEY)), now, newId);
    return migrated ?? emptyState();
  } catch {
    return emptyState();
  }
}

export function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
