// progresso na conta google: o firestore guarda o estado e o navegador fica como cópia de trabalho da conta
// nada é apagado ao juntar: na dúvida (primeira vez no aparelho ou mudanças sem conexão), os dois lados se somam
import { normalize, save } from '../store/storage.js';
import { mergeStates } from '../lib/merge.js';
import { signInAdmin, signOutAdmin, readProgress, writeProgress, watchProgress } from './remote.js';
import { accountKey, forget } from './session.js';

const SAVE_DELAY_MS = 1500;
const RETRY_MS = 15000;

// status: connecting · synced · saving · error
let sync = { status: 'connecting', user: null };
const listeners = new Set();
const set = (patch) => {
  sync = { ...sync, ...patch };
  listeners.forEach((fn) => fn(sync));
};

export const syncState = () => sync;
export function onSync(fn) {
  listeners.add(fn);
  fn(sync);
  return () => listeners.delete(fn);
}

export const signIn = () => signInAdmin();

let api = null;
// signOut - grava o que falta, sai da conta e tira a cópia da conta deste navegador (fica tudo na nuvem)
export async function signOut() {
  await api?.flush();
  await signOutAdmin();
  api?.clearLocal();
  forget();
  location.reload();
}

// startSync - liga a cópia do navegador (store da conta) ao documento users/{uid}
export function startSync(store, user, { storage = globalThis.localStorage } = {}) {
  const key = accountKey(user.uid);
  const linkKey = `${key}:sync`;
  const link = () => { try { return JSON.parse(storage.getItem(linkKey)) || {}; } catch { return {}; } };
  const setLink = (v) => { try { storage.setItem(linkKey, JSON.stringify(v)); } catch { /* sem storage */ } };

  let ready = false;
  let applying = false;
  let lastJson = null;
  let timer = 0;
  let saving = null;
  const json = () => JSON.stringify(store.getState());

  // applyLocal - troca a cópia do navegador e avisa as telas, sem disparar nova gravação
  const applyLocal = (state) => {
    applying = true;
    save(storage, state, key);
    store.reload();
    applying = false;
  };

  const push = async () => {
    clearTimeout(timer);
    if (!ready) return;
    const current = json();
    if (current === lastJson) return;
    set({ status: 'saving' });
    saving = writeProgress(user.uid, current)
      .then(() => {
        lastJson = current;
        if (json() === current) setLink({ synced: true, dirty: false });
        set({ status: 'synced' });
      })
      .catch(() => {
        set({ status: 'error' });
        clearTimeout(timer);
        timer = setTimeout(push, RETRY_MS);
      })
      .finally(() => { saving = null; });
    await saving;
  };

  // toda mudança local fica marcada até chegar na conta (assim nunca é descartada)
  store.subscribe(() => {
    if (applying || json() === lastJson) return;
    setLink({ ...link(), dirty: true });
    if (!ready) return;
    clearTimeout(timer);
    timer = setTimeout(push, SAVE_DELAY_MS);
  });

  const connect = async () => {
    set({ status: 'connecting', user });
    let remoteJson;
    try {
      remoteJson = await readProgress(user.uid);
    } catch {
      // sem a leitura da conta não há junção segura: nada é enviado até conseguir
      set({ status: 'error' });
      setTimeout(connect, RETRY_MS);
      return;
    }
    const l = link();
    let next = store.getState();
    if (remoteJson) {
      const remote = normalize(JSON.parse(remoteJson));
      next = l.synced && !l.dirty ? remote : mergeStates(remote, next);
    }
    applyLocal(next);
    lastJson = remoteJson;
    ready = true;
    set({ status: 'synced' });
    await push();
    if (json() === lastJson) setLink({ synced: true, dirty: false });

    watchProgress(user.uid, (incoming) => {
      if (!incoming || incoming === lastJson) return;
      const theirs = normalize(JSON.parse(incoming));
      const mine = link().dirty;
      applyLocal(mine ? mergeStates(theirs, store.getState()) : theirs);
      lastJson = incoming;
      if (json() !== incoming) push();
    }, () => set({ status: 'error' }));
  };

  connect();
  api = {
    flush: async () => { await push(); await saving; },
    // clearLocal - só limpa o que já chegou na conta; mudança ainda não enviada fica para a próxima entrada
    clearLocal: () => {
      if (link().dirty) return;
      try {
        storage.removeItem(key);
        storage.removeItem(linkKey);
      } catch { /* sem storage */ }
    },
  };
  return api;
}
