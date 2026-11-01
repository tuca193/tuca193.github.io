// resoluções comentadas das questões, carregadas junto com o primeiro quiz

const URL = 'data/resolucoes.json';
let cache = null;
let pending = null;

// loadResolucoes - mapa id → { passos, alternativas }; sem arquivo, mapa vazio (o quiz segue sem resolução)
export function loadResolucoes() {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = fetch(URL, { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((raw) => {
      cache = raw && typeof raw === 'object' ? raw : {};
      return cache;
    })
    .catch(() => ({}))
    .finally(() => {
      pending = null;
    });
  return pending;
}
