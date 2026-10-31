// links de exercícios externos por assunto (só busca no site; nada é copiado)

// exerciseLinks - listas de exercícios do assunto na toda matéria e na brasil escola
export function exerciseLinks(assunto) {
  const q = encodeURIComponent(`exercícios ${assunto.nome}`);
  return [
    { label: 'Exercícios na Toda Matéria', href: `https://www.todamateria.com.br/?s=${q}` },
    { label: 'Exercícios na Brasil Escola', href: `https://brasilescola.uol.com.br/busca?q=${q}` },
  ];
}
