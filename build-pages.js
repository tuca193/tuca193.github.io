// Extrai as paginas de detalhe (<section class="pg">) do index.html para arquivos independentes
const fs = require('fs');

const OBJ = fs.readFileSync('index.html', 'utf8');

const MATERIAS = {
  port: 'Português e Literatura',
  edf: 'Educação Física',
  fis: 'Física',
  geo: 'Geografia',
  bio: 'Biologia',
  qui: 'Química',
  mat: 'Matemática',
  ing: 'Inglês',
  soc: 'Sociologia',
  his: 'História',
};

// 1) Localiza todos os blocos overlay: <input ... id="o-KEY"><section ... id="d-KEY">
const blockRe = /<input type="checkbox" class="ov" id="o-([a-z]+\d+)"><section class="pg" id="d-[a-z]+\d+" style="--h:(\d+)">([\s\S]*?)<\/section>/g;

const pages = [];
let html = OBJ.replace(blockRe, (all, key, hue, inner) => {
  const materia = key.replace(/\d+$/, '');
  const title = (inner.match(/<h2>([^<]*)<\/h2>/) || [null, key])[1];

  // Monta a pagina independente a partir do conteudo do overlay
  let body = inner
    // substitui o label voltar por link real para a ancora da materia
    .replace(new RegExp(`<label class="back" for="o-${key}">Voltar ao painel</label>`), `<a class="back" href="index.html#${materia}">Voltar ao painel&nbsp;·&nbsp;${MATERIAS[materia] || materia}</a>`);

  const page = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} · ${materia.toUpperCase()} · Painel SSA 2</title>
<link rel="stylesheet" href="style.css">
</head>
<body style="--h:${hue}">
<main class="dpage">
${body}
</main>
</body>
</html>
`;
  fs.writeFileSync(key + '.html', page, 'utf8');
  pages.push(key);

  // remove o bloco do index (promo: so o input de marcacao do li permanece)
  return '';
});

// 2) No index, converte o label de detalhe em link para a pagina independente
for (const key of pages) {
  const labelRe = new RegExp(`(<li data-k="${key}"><label class="lb"><input type="checkbox"><span class="k"></span></label>)<label class="t" for="o-${key}">`);
  html = html.replace(labelRe, `$1<a class="t" href="${key}.html">`);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('paginas geradas:', pages.length);
console.log('index.html agora tem', html.length, 'bytes');
