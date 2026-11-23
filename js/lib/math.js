// fórmulas montadas (katex) e um markdown mínimo para o texto do tutor

const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9';
const MONEY = '\u0001';
let loading = null;

// loadKatex - carrega o katex uma vez, só quando a primeira fórmula aparece
export function loadKatex() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${KATEX}/katex.min.css`;
    document.head.append(css);
    const js = document.createElement('script');
    js.src = `${KATEX}/katex.min.js`;
    js.onload = () => resolve(window.katex);
    js.onerror = () => { loading = null; reject(new Error('katex')); };
    document.head.append(js);
  });
  return loading;
}

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// splitMath - separa o texto em pedaços de texto e de fórmula ($...$ e $$...$$)
export function splitMath(input) {
  // "R$" de dinheiro não abre fórmula
  const text = input.replace(/R\$(?=\s?\d)/g, () => `R${MONEY}`);
  const back = (v) => v.split(MONEY).join('$');
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: back(text.slice(last, m.index)) });
    out.push(m[1] !== undefined ? { t: 'block', v: m[1] } : { t: 'inline', v: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', v: back(text.slice(last)) });
  return out;
}

// inlineHtml - negrito e itálico simples, com as fórmulas guardadas como marcadores
function inlineHtml(text, formulas) {
  return splitMath(text).map((p) => {
    if (p.t === 'text') return escape(p.v).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    formulas.push(p);
    return `<span data-f="${formulas.length - 1}"></span>`;
  }).join('');
}

// renderRich - converte o texto do tutor (markdown mínimo + latex) em elementos; o texto entra escapado
export async function renderRich(el, text) {
  const formulas = [];
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const html = blocks.map((b) => {
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*\d+[.)]\s/.test(l))) return `<ol>${lines.map((l) => `<li>${inlineHtml(l.replace(/^\s*\d+[.)]\s/, ''), formulas)}</li>`).join('')}</ol>`;
    if (lines.every((l) => /^\s*[-*•]\s/.test(l))) return `<ul>${lines.map((l) => `<li>${inlineHtml(l.replace(/^\s*[-*•]\s/, ''), formulas)}</li>`).join('')}</ul>`;
    return `<p>${lines.map((l) => inlineHtml(l, formulas)).join('<br>')}</p>`;
  }).join('');
  el.innerHTML = html;
  if (!formulas.length) return;
  let katex = null;
  try { katex = await loadKatex(); } catch { /* sem katex: mostra o latex como texto */ }
  el.querySelectorAll('[data-f]').forEach((span) => {
    const f = formulas[+span.dataset.f];
    if (!katex) { span.textContent = f.v; return; }
    try {
      katex.render(f.v, span, { displayMode: f.t === 'block', throwOnError: false, strict: 'ignore' });
      if (f.t === 'block') span.classList.add('math-block');
    } catch { span.textContent = f.v; }
  });
}
