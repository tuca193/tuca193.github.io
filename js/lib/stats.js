// desempenho no quiz: caderno de erros e aproveitamento por matéria e assunto

export const MIN_ANSWERS = 3;

// errorIds - questões cuja última resposta foi errada, as mais recentes primeiro
export function errorIds(log, validIds) {
  return Object.entries(log)
    .filter(([id, v]) => v.ok === false && (!validIds || validIds.has(id)))
    .sort((a, b) => b[1].last.localeCompare(a[1].last))
    .map(([id]) => id);
}

// performance - soma acertos (c) e respostas (n) no total, por matéria e por assunto
export function performance(log, bank) {
  const total = { c: 0, n: 0 };
  const byMateria = {};
  const byTopic = {};
  const add = (map, key, c, n) => {
    const cur = map[key] ?? (map[key] = { c: 0, n: 0 });
    cur.c += c;
    cur.n += n;
  };
  for (const q of bank) {
    const v = log[q.id];
    if (!v) continue;
    const n = v.c + v.e;
    total.c += v.c;
    total.n += n;
    add(byMateria, q.materia, v.c, n);
    if (q.assunto) add(byTopic, q.assunto, v.c, n);
  }
  return { total, byMateria, byTopic };
}

// ratio - aproveitamento de 0 a 1 (null sem respostas)
export function ratio(s) {
  return s && s.n ? s.c / s.n : null;
}

// weakTopics - assuntos com pelo menos min respostas, do pior aproveitamento para o melhor
export function weakTopics(byTopic, { min = MIN_ANSWERS, limit = 5 } = {}) {
  return Object.entries(byTopic)
    .filter(([, s]) => s.n >= min && s.c / s.n < 0.7)
    .sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n || b[1].n - a[1].n)
    .slice(0, limit)
    .map(([id, s]) => ({ id, ...s }));
}
