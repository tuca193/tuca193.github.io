// carrega o banco de questões só quando o primeiro quiz abre

const URL = 'data/questoes.json';
let cache = null;
let pending = null;

// loadQuestoes - promessa da lista de questões; tenta de novo depois de um erro
export function loadQuestoes() {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = fetch(URL, { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((raw) => {
      if (!Array.isArray(raw?.questoes)) throw new Error('formato inesperado');
      cache = raw.questoes;
      return cache;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
