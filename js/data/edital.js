// carrega data/edital.json uma vez e monta índices para as telas

const URL = 'data/edital.json';
let cache = null;
let pending = null;

// index - acrescenta índices derivados ao edital carregado
function index(raw) {
  const topics = new Map();
  const materias = new Map();
  for (const m of raw.materias) {
    materias.set(m.id, m);
    m.assuntos.forEach((a, i) => topics.set(a.id, { assunto: a, materia: m, posicao: i + 1 }));
  }
  return {
    ...raw,
    ids: [...topics.keys()],
    total: topics.size,
    materiaById: (id) => materias.get(id) ?? null,
    topic: (id) => topics.get(id) ?? null,
    idsOf: (m) => m.assuntos.map((a) => a.id),
  };
}

// loadEdital - promessa do edital; force=true tenta de novo depois de um erro
export function loadEdital({ force = false } = {}) {
  if (cache && !force) return Promise.resolve(cache);
  if (pending && !force) return pending;
  pending = fetch(URL, { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((raw) => {
      if (!Array.isArray(raw?.materias)) throw new Error('formato inesperado');
      cache = index(raw);
      return cache;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

// peekEdital - o edital se já estiver carregado, senão null
export function peekEdital() {
  return cache;
}
