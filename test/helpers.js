// fakeStorage - storage em memoria com a mesma api do localStorage
export function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// throwingStorage - simula modo privado / cota cheia
export function throwingStorage() {
  const fail = () => {
    throw new Error('SecurityError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

// fakeWindow - janela minima que permite disparar eventos de storage
export function fakeWindow() {
  const handlers = new Set();
  return {
    addEventListener: (type, fn) => type === 'storage' && handlers.add(fn),
    removeEventListener: (type, fn) => handlers.delete(fn),
    dispatch: (event) => handlers.forEach((fn) => fn(event)),
  };
}

export function seqIds(prefix = 'id') {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export const fixedNow = (iso = '2026-10-30T12:00:00.000Z') => () => new Date(iso);
