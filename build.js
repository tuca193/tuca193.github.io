// Reconstrução completa do painel a partir do README original
const fs = require('fs');
const SRC = 'C:/Users/arthu/AppData/Local/Temp/opencode/README.md';
const src = fs.readFileSync(SRC, 'utf8');

/* ---------- 1. Parse das matérias e assuntos ---------- */
const materias = [];
let m;
const mRe = /<details id="([a-z]+)" open style="--h:(\d+)"><summary><span>([^<]+)<\/span><small>(\d+) assuntos<\/small>/g;
while ((m = mRe.exec(src))) materias.push({ id: m[1], hue: +m[2], name: m[3], count: +m[4], topics: [], });

const tRe = /<li data-k="([a-z]+)(\d+)"><label class="lb"><input type="checkbox"><span class="k"><\/span><\/label><label class="t" for="o-\1\2"><span class="n">([^<]*)<\/span><span class="x">([^<]*)<\/span>/g;
let t;
while ((t = tRe.exec(src))) {
  const mat = materias.find((x) => x.id === t[1]);
  if (!mat) throw new Error('matéria não achada: ' + t[1]);
  mat.topics.push({ key: t[1] + t[2], hue: mat.hue, mid: mat.id, n: t[3], x: t[4], sections: [] });
}

/* ---------- 2. Parse do conteúdo detalhado (76 overlays) ---------- */
const ovRe = /<input type="checkbox" class="ov" id="o-([a-z]+\d+)"><section class="pg" id="d-[a-z]+\d+" style="--h:(\d+)">([\s\S]*?)<\/section>/g;
let ov;
const details = {};
while ((ov = ovRe.exec(src))) {
  const inner = ov[3].replace(/<label class="back"[^]*?Voltar ao painel<\/label>/, '');
  const secs = [];
  const sRe = /<h3>([^<]*)<\/h3><ul class="b">([\s\S]*?)<\/ul>/g;
  let s;
  while ((s = sRe.exec(inner))) {
    const items = [];
    const iRe = /<li>([\s\S]*?)<\/li>/g;
    let i;
    while ((i = iRe.exec(s[2]))) items.push(i[1]);
    secs.push({ h4: s[1], items });
  }
  details[ov[1]] = secs;
}

const out = {};
for (const mat of materias) out[mat.id] = mat;

/* ---------- 3. Validação ---------- */
let total = 0;
const problems = [];
for (const mat of materias) {
  if (mat.count !== mat.topics.length) problems.push(`${mat.id}: count=${mat.count} topics=${mat.topics.length}`);
  for (const tp of mat.topics) {
    total++;
    if (!details[tp.key]) problems.push(`sem detalhes: ${tp.key}`);
    else if (details[tp.key].length) tp.sections = details[tp.key];
  }
}
console.log('total assuntos:', total, '| problemas:', problems.length ? problems : 'nenhum');
if (problems.length) process.exit(1);

const DATA = {
  total,
  materias: materias.map((mt) => ({
    id: mt.id, name: mt.name, hue: mt.hue, count: mt.count, file: mt.id + '.html',
    keys: mt.topics.map((tp) => tp.key),
  })),
};
const JSON_BLOCK = `<script id="ssa-data" type="application/json">${JSON.stringify(DATA)}</script>`;

/* ---------- 4. FAB + templates ---------- */
const FAB = `<div class="prog-fab" role="status" aria-live="polite">
  <span class="pf-num" id="pf-num">0/${total}</span>
  <span class="pf-bar"><i id="pf-i"></i></span>
  <button class="pf-reset" id="pf-reset" type="button" title="Reiniciar progresso" aria-label="Reiniciar progresso">&#8634;</button>
</div>`;

const HEAD = (title) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f7f8fa" media="(prefers-color-scheme:light)">
<meta name="theme-color" content="#12151c" media="(prefers-color-scheme:dark)">
<title>${title}</title>
<link rel="stylesheet" href="style.css">
</head>
`;

const linkChips = (tp) => {
  const mname = out[tp.mid].name;
  const yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent('SSA 2 ' + mname + ' ' + tp.n);
  const kh = 'https://pt.khanacademy.org/search?page_search_query=' + encodeURIComponent(tp.n + ' ' + mname);
  const gg = 'https://www.google.com/search?q=' + encodeURIComponent('SSA 2 ' + mname + ' ' + tp.n + ' resumo aula');
  return `<div class="links"><a class="lk" target="_blank" rel="noopener" href="${yt}">&#9654; Vídeos no YouTube</a><a class="lk" target="_blank" rel="noopener" href="${kh}">Khan Academy</a><a class="lk" target="_blank" rel="noopener" href="${gg}">Busca: resumos e provas</a></div>`;
};

const topicLi = (tp) => {
  const secs = tp.sections
    .map((s) => `<h4>${s.h4}</h4><ul class="bl">${s.items.map((li) => `<li>${li}</li>`).join('')}</ul>`)
    .join('');
  return `<li class="topic" data-key="${tp.key}" data-mat="${tp.mid}">
<button class="tick" type="button" data-key="${tp.key}" aria-pressed="false" aria-label="Marcar ${tp.n} como estudado"></button>
<div class="tx"><span class="n">${tp.n}</span><span class="x">${tp.x}</span></div>
<details class="det"><summary>Detalhes</summary><div class="dbody">${secs}${linkChips(tp)}</div></details>
</li>`;
};

/* ---------- 5. index.html ---------- */
const cards = materias
  .map(
    (mt) => `<a class="mcard" style="--h:${mt.hue}" href="${mt.id}.html"><span class="mn">${mt.name}</span><span class="mbar"><i data-prog-bar="${mt.id}"></i></span><span class="mtxt" data-prog-text="${mt.id}">0/${mt.count}</span></a>`
  )
  .join('\n');

const index = `${HEAD('SSA 2 · Pernambuco')}
<body style="--h:210">
${FAB}
<main>
<header class="hero">
<h1>SSA 2 <span class="sub1">· Pernambuco</span></h1>
<p class="lead">Sistema Seriado de Avaliação do estado de Pernambuco — o conteúdo completo do edital em um painel de estudos.</p>
<section id="countdown" class="countdown" aria-live="polite"></section>
</header>
<section class="block">
<h2 class="kicker">Matérias do edital · ingresso 2027</h2>
<div class="cards">
${cards}
</div>
</section>
<section class="block">
<h2 class="kicker">Sobre o SSA</h2>
<div class="info">
<div class="icard"><h3>Datas</h3><p>1ª prova: 06/12/2026 · 2ª prova: 13/12/2026 — ambas à tarde (&#42;horário a confirmar no edital).</p></div>
<div class="icard"><h3>Formato</h3><p>O SSA é o seriado do ensino médio das escolas estaduais de PE: as notas das avaliações compõem a nota final — estudar por edital é essencial. Veja o site oficial:</p><p><a class="btn" href="https://www.educacao.pe.gov.br/" target="_blank" rel="noopener">Secretaria de Educação &#8599;</a></p></div>
</div>
<p class="note">Seu progresso fica salvo neste navegador (localStorage) — a barra de progresso canto inferior direito atualiza sozinha.</p>
</section>
</main>
${JSON_BLOCK}
<script src="script.js"></script>
</body>
</html>
`;
// fim index
fs.writeFileSync('index.html', index, 'utf8');

/* ---------- 6. páginas de matéria ---------- */
for (const mt of materias) {
  const items = mt.topics.map(topicLi).join('\n');
  const page = `${HEAD(mt.name + ' · SSA 2')}
<body style="--h:${mt.hue}">
${FAB}
<main class="mmain">
<a class="back" href="index.html">&#8592; Painel</a>
<header class="mhead" style="--h:${mt.hue}">
<h1>${mt.name}</h1>
<p class="sub">${mt.count} assuntos do edital · SSA 2 ingresso 2027</p>
<div class="mp"><span class="mpb"><i data-prog-bar="${mt.id}"></i></span><span class="mpn" data-prog-text="${mt.id}">0/${mt.count}</span></div>
</header>
<ul class="topics">
${items}
</ul>
<p class="note">Toque no botão de cada assunto ao concluir — a página, a barra da matéria e a global (canto da tela) atualizam e salvam automaticamente.</p>
</main>
${JSON_BLOCK}
<script src="script.js"></script>
</body>
</html>
`;
  fs.writeFileSync(`${mt.id}.html`, page, 'utf8');
}

console.log('gerado: index.html +', materias.map((mt) => mt.id + '.html').join(', '));
