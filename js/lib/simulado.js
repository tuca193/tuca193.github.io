// simulado no formato do ssa 2: 45 questões em 4 horas por dia, na ordem das áreas do caderno
import { shuffle } from './quiz.js';

// composição de cada dia, seguindo os cadernos recentes (2024–2026)
export const DIAS = {
  1: {
    areas: [
      { nome: 'Linguagens e suas Tecnologias', materias: { port: 12, edf: 5, ing: 6 } },
      { nome: 'Ciências Humanas e Sociais Aplicadas', materias: { his: 7, geo: 7, soc: 8 } },
    ],
  },
  2: {
    areas: [
      { nome: 'Matemática e suas Tecnologias', materias: { mat: 22 } },
      { nome: 'Ciências da Natureza e suas Tecnologias', materias: { bio: 8, qui: 8, fis: 7 } },
    ],
  },
};

export const MODOS = {
  completo: { nome: 'Completo', fator: 1, minutos: 240 },
  rapido: { nome: 'Rápido', fator: 1 / 3, minutos: 80 },
};

// quotas - quantas questões de cada matéria no modo escolhido (no mínimo 1 por matéria)
export function quotas(dia, modo = 'completo') {
  const f = MODOS[modo].fator;
  return DIAS[dia].areas.map((a) => ({
    nome: a.nome,
    materias: Object.fromEntries(Object.entries(a.materias).map(([m, n]) => [m, Math.max(1, Math.round(n * f))])),
  }));
}

// buildSimulado - sorteia as questões por matéria, priorizando as que a pessoa ainda não respondeu
// devolve a lista na ordem do caderno: área por área, matéria por matéria
export function buildSimulado(bank, dia, { modo = 'completo', log = {}, rng = Math.random } = {}) {
  const out = [];
  for (const area of quotas(dia, modo)) {
    for (const [materia, n] of Object.entries(area.materias)) {
      const pool = bank.filter((q) => q.materia === materia);
      const fresh = shuffle(pool.filter((q) => !log[q.id]), rng);
      const seen = shuffle(pool.filter((q) => log[q.id]), rng);
      for (const q of [...fresh, ...seen].slice(0, n)) out.push({ id: q.id, area: area.nome, materia });
    }
  }
  return out;
}

// scoreSimulado - acertos no total, por área e por matéria; questões em branco contam como erro
export function scoreSimulado(items, answers, byId) {
  const total = { c: 0, n: 0 };
  const byArea = {};
  const byMateria = {};
  const add = (map, key, ok) => {
    const cur = map[key] ?? (map[key] = { c: 0, n: 0 });
    cur.n += 1;
    if (ok) cur.c += 1;
  };
  for (const it of items) {
    const q = byId.get(it.id);
    if (!q) continue;
    const ok = answers[it.id] === q.resposta;
    total.n += 1;
    if (ok) total.c += 1;
    add(byArea, it.area, ok);
    add(byMateria, it.materia, ok);
  }
  return { total, byArea, byMateria };
}
