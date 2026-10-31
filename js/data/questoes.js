// carrega o banco de questões só quando o primeiro quiz abre, já com as alterações do administrador
import { applyOverrides } from '../lib/overrides.js';
import { watchOverrides, currentOverrides } from './remote.js';

const URL = 'data/questoes.json';
let cache = null;
let pending = null;

// loadRaw - o banco original, sem alterações
export function loadRaw() {
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

// loadQuestoes - banco em vigor; sem conexão com o banco remoto, vale o original
export async function loadQuestoes() {
  const [bank] = await Promise.all([loadRaw(), watchOverrides()]);
  return applyOverrides(bank, currentOverrides());
}
