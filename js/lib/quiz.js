// regras do quiz de verificação: sorteio das questões e aprovação

export const QUIZ_SIZE = 5;
export const MIN_QUESTIONS = 3;

// shuffle - embaralha uma cópia (fisher-yates) com o gerador dado
export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// categorias de prova que o aluno pode priorizar, na ordem em que aparecem
export const CATEGORIES = [
  { id: 'ssa2', nome: 'SSA 2' },
  { id: 'ssa1', nome: 'SSA 1' },
  { id: 'ssa3', nome: 'SSA 3' },
  { id: 'enem', nome: 'ENEM' },
  { id: 'autoral', nome: 'Autorais do painel' },
];

// categoryOf - categoria da questão (sem fonte = SSA 2)
export function categoryOf(q) {
  return q.fonte || 'ssa2';
}

// matchesPriority - a questão é da categoria (e do ano, se escolhido) priorizada
export function matchesPriority(q, prioridade) {
  if (!prioridade?.categoria) return false;
  return categoryOf(q) === prioridade.categoria && (!prioridade.ano || q.ano === prioridade.ano);
}

// priorityCounts - quantas questões do assunto há por categoria e, dentro dela, por ano (mais recentes primeiro)
export function priorityCounts(bank, topicId) {
  const map = new Map();
  bank.filter((q) => q.assunto === topicId).forEach((q) => {
    const c = categoryOf(q);
    if (!map.has(c)) map.set(c, { total: 0, anos: new Map() });
    const e = map.get(c);
    e.total += 1;
    if (q.ano) e.anos.set(q.ano, (e.anos.get(q.ano) || 0) + 1);
  });
  return CATEGORIES.filter((c) => map.has(c.id)).map((c) => {
    const e = map.get(c.id);
    return { ...c, total: e.total, anos: [...e.anos].sort((a, b) => b[0] - a[0]).map(([ano, n]) => ({ ano, n })) };
  });
}

// pickQuestions - sorteia até n questões do assunto (as da prioridade escolhida primeiro); se faltar, completa com outras da mesma matéria
export function pickQuestions(bank, { topicId, materiaId, prioridade = null }, { n = QUIZ_SIZE, rng = Math.random } = {}) {
  const assunto = bank.filter((q) => q.assunto === topicId);
  const doTopico = [
    ...shuffle(assunto.filter((q) => matchesPriority(q, prioridade)), rng),
    ...shuffle(assunto.filter((q) => !matchesPriority(q, prioridade)), rng),
  ];
  const outras = bank.filter((q) => q.materia === materiaId && q.assunto !== topicId);
  // questões sem assunto definido (gerais da matéria) entram antes das de outros assuntos
  const gerais = shuffle(outras.filter((q) => q.assunto === null), rng);
  const deOutros = shuffle(outras.filter((q) => q.assunto !== null), rng);
  const questions = [...doTopico, ...gerais, ...deOutros].slice(0, n);
  return { questions, fromTopic: Math.min(doTopico.length, n) };
}

// isPassed - aprovado com mais da metade de acertos
export function isPassed(correct, total) {
  return total > 0 && correct > total / 2;
}

// readingSeconds - tempo mínimo para ler a resolução: ~4 palavras por segundo, entre 5 e 25 s
export function readingSeconds(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.min(25, Math.max(5, Math.ceil(words / 4)));
}
