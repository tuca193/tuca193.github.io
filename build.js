// valida data/edital.json e gera as páginas antigas (<materia>.html) como redirecionamentos
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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

// banco de questões do quiz: 5 alternativas, resposta a–e, matéria e assunto existentes
let banco = { questoes: [] };
try {
  banco = JSON.parse(readFileSync('data/questoes.json', 'utf8'));
} catch (e) {
  problems.push(`não consegui ler data/questoes.json (${e.message})`);
}
const materiaIds = new Set((edital.materias || []).map((m) => m.id));
const BLOCOS = new Set(['titulo', 'p', 'fonte', 'nota', 'pergunta']);
const qids = new Set();
for (const q of banco.questoes || []) {
  if (qids.has(q.id)) problems.push(`questão duplicada: ${q.id}`);
  qids.add(q.id);
  if (!materiaIds.has(q.materia)) problems.push(`${q.id}: matéria desconhecida ${q.materia}`);
  if (q.assunto !== null && !ids.has(q.assunto)) problems.push(`${q.id}: assunto desconhecido ${q.assunto}`);
  if (q.assunto && !q.assunto.startsWith(q.materia)) problems.push(`${q.id}: assunto ${q.assunto} fora da matéria ${q.materia}`);
  if (!Array.isArray(q.alternativas) || q.alternativas.length !== 5 || q.alternativas.some((a) => !String(a).trim())) problems.push(`${q.id}: alternativas inválidas`);
  if (!/^[A-E]$/.test(q.resposta)) problems.push(`${q.id}: resposta inválida`);
  if (!Array.isArray(q.comando) || !q.comando.length) problems.push(`${q.id}: sem comando`);
  for (const b of [...(q.apoio || []), ...(q.comando || [])]) {
    const ok = b.t === 'verso' ? Array.isArray(b.linhas) && b.linhas.length
      : b.t === 'lista' ? Array.isArray(b.itens) && b.itens.length
      : BLOCOS.has(b.t) && typeof b.texto === 'string' && b.texto.trim();
    if (!ok) problems.push(`${q.id}: bloco inválido ${JSON.stringify(b).slice(0, 60)}`);
  }
}

// resoluções comentadas: uma por questão, com passos e um comentário por alternativa
let resolucoes = {};
try {
  resolucoes = JSON.parse(readFileSync('data/resolucoes.json', 'utf8'));
} catch (e) {
  problems.push(`não consegui ler data/resolucoes.json (${e.message})`);
}
for (const id of qids) {
  const r = resolucoes[id];
  if (!r) problems.push(`${id}: sem resolução`);
  else if (!Array.isArray(r.passos) || !r.passos.length || !Array.isArray(r.alternativas) || r.alternativas.length !== 5) problems.push(`${id}: resolução inválida`);
}
for (const id of Object.keys(resolucoes)) if (!qids.has(id)) problems.push(`resolução sem questão: ${id}`);
// questões com imagem precisam do recorte em data/img
for (const q of banco.questoes || []) if (q.imagem && !existsSync(`data/img/${q.id}.webp`)) problems.push(`${q.id}: imagem ausente em data/img`);
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
console.log(`ok: ${edital.materias.length} matérias, ${ids.size} assuntos, ${edital.provas.length} provas, ${qids.size} questões`);
