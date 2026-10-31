// de onde veio cada questão do banco

const EXAM = { ssa1: 'SSA 1', ssa3: 'SSA 3' };

// examName - nome da prova: "SSA 2 2026", "SSA 1 2024", "ENEM 2023", "ENEM 2022 (reaplicação)"
export function examName(q) {
  if (q.fonte === 'enem') return `ENEM ${q.ano}${q.edicao === 'ppl' ? ' (reaplicação)' : ''}`;
  return `${EXAM[q.fonte] || 'SSA 2'} ${q.ano}`;
}

// sourceLine - origem completa, para o quiz
export function sourceLine(q) {
  const who = q.fonte === 'enem' ? 'INEP' : 'UPE';
  return `${examName(q)} (${who}) · ${q.dia}º dia · questão ${q.numero}`;
}

// sourceShort - origem curta, para listas
export function sourceShort(q) {
  return `${examName(q)} · ${q.dia}º dia · q${q.numero}`;
}
