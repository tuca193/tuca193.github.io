// alterações administrativas aplicadas sobre o banco de questões original

// applyOverrides - devolve o banco com as questões movidas e sem as removidas
export function applyOverrides(bank, overrides) {
  const out = [];
  for (const q of bank) {
    const o = overrides.get(q.id);
    if (o?.removido) continue;
    out.push(o ? { ...q, materia: o.materia ?? q.materia, assunto: o.assunto === undefined ? q.assunto : o.assunto } : q);
  }
  return out;
}

