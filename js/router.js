// rotas por hash: #/, #/materias, #/materia/<id>, #/provas, #/ajustes, #/perfis, #/banco, #/revisao, #/simulado

const ROUTES = [
  { pattern: /^$/, name: 'painel' },
  { pattern: /^materias$/, name: 'materias' },
  { pattern: /^materia\/([a-z]+)$/, name: 'materia', keys: ['id'] },
  { pattern: /^provas$/, name: 'provas' },
  { pattern: /^ajustes$/, name: 'ajustes' },
  { pattern: /^perfis$/, name: 'perfis' },
  { pattern: /^banco$/, name: 'banco' },
  { pattern: /^revisao$/, name: 'revisao' },
  { pattern: /^simulado$/, name: 'simulado' },
];

// matchRoute - converte o hash atual em { name, params }
export function matchRoute(hash) {
  const path = decodeURIComponent(hash.replace(/^#\/?/, '')).replace(/\/$/, '');
  for (const r of ROUTES) {
    const m = path.match(r.pattern);
    if (m) {
      const params = {};
      (r.keys || []).forEach((k, i) => { params[k] = m[i + 1]; });
      return { name: r.name, params };
    }
  }
  return { name: 'nao-encontrada', params: { path } };
}

// navSection - qual item da navegação fica marcado em cada rota
export function navSection(name) {
  if (name === 'materia') return 'materias';
  if (name === 'perfis') return 'ajustes';
  if (name === 'simulado') return 'provas';
  return name;
}
