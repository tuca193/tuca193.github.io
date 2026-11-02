import { STORAGE_KEY, THEMES, emptyState, load, normalize, save } from './storage.js';
import * as P from './profiles.js';
import * as G from './progress.js';

const PROFILE_CHANGED = { ok: false, error: 'O perfil ativo mudou em outra aba. Tente de novo.' };

export function createStore({
  storage = globalThis.localStorage,
  knownIds = [],
  now = () => new Date(),
  newId = () => globalThis.crypto.randomUUID(),
  win = globalThis.window,
} = {}) {
  const known = new Set(knownIds);
  const listeners = new Set();
  let saveFailed = false;

  // applyKnown - remove dos mapas de progresso ids fora do edital
  function applyKnown(s) {
    if (known.size === 0) return s;
    const data = {};
    for (const [id, entry] of Object.entries(s.data)) data[id] = { ...entry, done: G.filterKnown(entry.done, known) };
    return { ...s, data };
  }

  let state = applyKnown(load(storage, { now, newId }));
  if (state.profiles.length > 0 && readRaw() === null) saveFailed = !save(storage, state);

  function readRaw() {
    try {
      return storage ? storage.getItem(STORAGE_KEY) : null;
    } catch {
      return undefined;
    }
  }

  // readFresh - le o estado atual do storage; se nao der, fica com o da memoria
  function readFresh() {
    // com a gravação falhando, o storage está atrás da memória: a memória manda
    if (saveFailed) return state;
    const raw = readRaw();
    if (raw === undefined) return state;
    // a chave sumiu (outra aba limpou os dados): começa do zero em vez de regravar o antigo
    if (raw === null) return state.profiles.length ? applyKnown(emptyState()) : state;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return state;
    }
    return applyKnown(normalize(parsed, now));
  }

  function notify() {
    for (const fn of [...listeners]) if (listeners.has(fn)) fn(state);
  }

  // commit - aplica uma mudanca sobre o estado mais recente do storage e salva
  function commit(change) {
    const base = readFresh();
    const result = change(base);
    const next = result && 'state' in result && result.state ? result.state : result;
    if (result && result.ok === false) {
      if (base !== state) {
        state = base;
        notify();
      }
      return result;
    }
    const changed = next !== base;
    state = next;
    if (changed) saveFailed = !save(storage, state);
    if (changed || base !== state) notify();
    return result;
  }

  function reload() {
    const fresh = readFresh();
    if (fresh === state) return;
    state = fresh;
    notify();
  }

  function onStorage(event) {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    reload();
  }

  if (win && typeof win.addEventListener === 'function') win.addEventListener('storage', onStorage);

  function outcome(result) {
    return result.ok ? { ok: true, profile: result.profile } : { ok: false, error: result.error };
  }

  const activeDone = () => G.doneMap(state);

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    destroy() {
      listeners.clear();
      if (win && typeof win.removeEventListener === 'function') win.removeEventListener('storage', onStorage);
    },
    reload,

    profiles: () => state.profiles,
    activeProfile: () => state.profiles.find((p) => p.id === state.activeId) ?? null,
    validateName: (name, excludeId) => P.validateName(state, name, excludeId),
    createProfile: (name) => outcome(commit((s) => P.createProfile(s, name, { id: newId(), now }))),
    renameProfile: (id, name) => outcome(commit((s) => P.renameProfile(s, id, name))),
    removeProfile: (id) => {
      const r = commit((s) => P.removeProfile(s, id));
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    },
    selectProfile: (id) => {
      commit((s) => P.selectProfile(s, id));
      return state.activeId === id;
    },

    isDone: (topicId) => Boolean(activeDone()[topicId]),
    doneAt: (topicId) => activeDone()[topicId] ?? null,
    // toggle - com profileId, recusa se o perfil ativo mudou (ex.: em outra aba)
    toggle(topicId, { profileId } = {}) {
      const r = commit((s) => (profileId && profileId !== s.activeId ? PROFILE_CHANGED : G.toggleTopic(s, topicId, { now, knownIds: known })));
      if (r === PROFILE_CHANGED) return false;
      return Boolean(activeDone()[topicId]);
    },
    doneCount: (ids) => G.countDone(activeDone(), ids),
    quizLog: () => G.quizMap(state),
    // recordAnswer - guarda acerto/erro da questão; com profileId, ignora se o perfil ativo mudou
    recordAnswer(questionId, ok, { profileId } = {}) {
      const r = commit((s) => (profileId && profileId !== s.activeId ? PROFILE_CHANGED : G.recordAnswer(s, questionId, ok, { now })));
      return r !== PROFILE_CHANGED;
    },
    resetProgress(profileId) {
      const r = commit((s) => (profileId && profileId !== s.activeId ? PROFILE_CHANGED : G.resetProgress(s, s.activeId)));
      return r === PROFILE_CHANGED ? { ok: false, error: PROFILE_CHANGED.error } : { ok: true };
    },

    theme: () => state.prefs.theme,
    setTheme(theme) {
      if (!THEMES.includes(theme)) return false;
      commit((s) => (s.prefs.theme === theme ? s : { ...s, prefs: { ...s.prefs, theme } }));
      return true;
    },

    exportActive: () => G.exportProfile(state, state.activeId, { now }),
    importBackup: (payload) =>
      outcome(commit((s) => G.importProfile(s, payload, { id: newId(), now, knownIds: known }))),

    lastSaveFailed: () => saveFailed,
  };
}
