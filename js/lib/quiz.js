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

// pickQuestions - sorteia até n questões do assunto; se faltar, completa com outras da mesma matéria
export function pickQuestions(bank, { topicId, materiaId }, { n = QUIZ_SIZE, rng = Math.random } = {}) {
  const doTopico = shuffle(bank.filter((q) => q.assunto === topicId), rng);
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
