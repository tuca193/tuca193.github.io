// textos reutilizáveis

// plural - "1 assunto", "3 assuntos"
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
