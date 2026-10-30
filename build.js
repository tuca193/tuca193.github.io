// valida data/edital.json e gera as páginas antigas (<materia>.html) como redirecionamentos
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'data/edital.json';

// fail - encerra o build com uma mensagem clara
function fail(msg) {
  console.error('build: ' + msg);
  process.exit(1);
}

let edital;
try {
  edital = JSON.parse(readFileSync(SRC, 'utf8'));
} catch (e) {
  fail(`não consegui ler ${SRC} (${e.message})`);
}

const problems = [];
const ids = new Set();
if (!Array.isArray(edital.provas) || !edital.provas.length) problems.push('sem provas');
for (const p of edital.provas || []) {
  if (Number.isNaN(Date.parse(p.inicio))) problems.push(`data inválida em ${p.id}`);
}
// provas anteriores: só links https do site oficial da upe
const OFICIAL = /^https:\/\/processodeingresso\.upe\.pe\.gov\.br\//;
const anos = new Set();
for (const p of edital.anteriores || []) {
  if (!Number.isInteger(p.processo) || anos.has(p.processo)) problems.push(`processo anterior inválido ou repetido: ${p.processo}`);
  anos.add(p.processo);
  if (!OFICIAL.test(p.pagina || '')) problems.push(`${p.processo}: página fora do site oficial`);
  for (const d of p.dias || []) {
    for (const k of ['prova', 'gabarito']) {
      if (!OFICIAL.test(d[k] || '')) problems.push(`${p.processo} dia ${d.dia}: ${k} fora do site oficial`);
    }
  }
}
for (const m of edital.materias || []) {
  if (!/^[a-z]+$/.test(m.id)) problems.push(`id de matéria inválido: ${m.id}`);
  if (!m.assuntos?.length) problems.push(`${m.id}: sem assuntos`);
  for (const a of m.assuntos || []) {
    if (ids.has(a.id)) problems.push(`assunto duplicado: ${a.id}`);
    ids.add(a.id);
    if (!a.nome?.trim()) problems.push(`${a.id}: sem nome`);
  }
}
if (problems.length) fail(problems.join('\n'));

// escapeHtml - escapa &, <, > e aspas para texto dentro do html
const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const redirect = (m) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(m.nome)} · Painel SSA 2</title>
<meta http-equiv="refresh" content="0; url=index.html#/materia/${m.id}">
<link rel="canonical" href="index.html#/materia/${m.id}">
</head>
<body>
<p><a href="index.html#/materia/${m.id}">Abrir ${escapeHtml(m.nome)} no painel</a></p>
</body>
</html>
`;

for (const m of edital.materias) writeFileSync(`${m.id}.html`, redirect(m), 'utf8');
console.log(`ok: ${edital.materias.length} matérias, ${ids.size} assuntos, ${edital.provas.length} provas`);
