// recortar-questoes - recorta do pdf oficial o enunciado de cada questão com imagem (até antes das alternativas)
// uso: node tools/recortar-questoes.mjs [id ...]   (sem ids: todas as questões com "imagem": true)
// lê tools/.provas (baixe com tools/baixar-provas.mjs), grava tools/.recortes/<id>.webp e _relatorio.json
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

const PDFS = 'tools/.provas';
const OUT = 'tools/.recortes';
const SCALE = 2;
const NOISE = /^(\*|=== |RASCUNHO|CH -|LC -|CN -|MT -|\d+\s*$)|Caderno \d|•\s*CADERNO|^SSA\b.*FASE|PROCESSO DE INGRESSO|^ENEM\s?20/i;

const only = new Set(process.argv.slice(2));
// questões conferidas de olho em que a figura passa das alternativas: o recorte vai até o fim da questão
const INTEIRAS = new Set(['2026-d1-q44']);
const bank = JSON.parse(fs.readFileSync('data/questoes.json', 'utf8')).questoes;
const jobs = bank.filter((q) => (only.size ? only.has(q.id) : q.imagem)).map((q) => {
  const m = q.id.match(/^(.*-d\d)-q0*(\d+)$/);
  return { id: q.id, pdf: `${m[1]}.pdf`, n: +m[2], enem: q.fonte === 'enem' };
});
fs.mkdirSync(OUT, { recursive: true });
const report = [];

// lines - linhas de texto de uma página; no enem separa as duas colunas pelo vão do meio
async function pageLines(page, twoCols) {
  const vp = page.getViewport({ scale: 1 });
  const [ox, oy] = page.view;
  const mid = ox + vp.width / 2;
  const tc = await page.getTextContent();
  const lines = [];
  for (const it of tc.items) {
    if (!it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5], hgt = Math.abs(it.transform[3]) || 10;
    let line = lines.find((l) => Math.abs(l.y - y) < 2.5);
    if (!line) lines.push(line = { y, h: hgt, parts: [] });
    line.parts.push({ x, end: x + (it.width || 0), s: it.str });
    line.h = Math.max(line.h, hgt);
  }
  const rows = [];
  for (const l of lines) {
    l.parts.sort((a, b) => a.x - b.x);
    const groups = [[l.parts[0]]];
    for (const p of l.parts.slice(1)) {
      const prev = groups.at(-1).at(-1);
      if (twoCols && prev.end <= mid + 6 && p.x >= mid - 6 && p.x - prev.end > 2) groups.push([p]);
      else groups.at(-1).push(p);
    }
    for (const g of groups) {
      const x = g[0].x, end = Math.max(...g.map((p) => p.end));
      rows.push({
        y: l.y, h: l.h, x, end,
        col: twoCols && x >= mid - 4 ? 1 : 0,
        wide: x < mid - 10 && end > mid + 10,
        text: g.map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim(),
      });
    }
  }
  const content = rows.filter((r) => !NOISE.test(r.text) && r.y < oy + vp.height * 0.95 && r.y > oy + vp.height * 0.04);
  content.sort((a, b) => a.col - b.col || b.y - a.y);
  return { page, vp, rows: content, mid };
}

// edgeInk - fração de pixels escuros numa faixa vertical da imagem (conteúdo encostado na borda = recorte cortado)
function edgeInk(ctx, x, y, h) {
  const d = ctx.getImageData(Math.max(0, Math.round(x)), Math.round(y), 3, Math.max(1, Math.round(h))).data;
  let dark = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) dark++;
  return dark / (d.length / 4);
}

// inkArea - fração de pixels escuros num retângulo da página renderizada
function inkArea(ctx, x, y, w, h) {
  const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
  let dark = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) dark++;
  return dark / (d.length / 4);
}

const byPdf = {};
for (const j of jobs) (byPdf[j.pdf] ??= []).push(j);

for (const [pdfName, list] of Object.entries(byPdf)) {
  const file = path.join(PDFS, pdfName);
  if (!fs.existsSync(file)) { list.forEach((j) => report.push({ id: j.id, ok: false, motivo: 'pdf ausente' })); continue; }
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/', disableFontFace: true, verbosity: 0, isOffscreenCanvasSupported: false }).promise;
  const twoCols = list[0].enem;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) pages.push(await pageLines(await doc.getPage(p), twoCols));
  // rendered - página desenhada uma vez por pdf (reaproveitada por todas as questões dela)
  const cache = new Map();
  const rendered = async (pi) => {
    if (!cache.has(pi)) {
      const v = pages[pi].page.getViewport({ scale: SCALE });
      const c = createCanvas(Math.round(v.width), Math.round(v.height));
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, c.width, c.height);
      await pages[pi].page.render({ canvasContext: ctx, viewport: v }).promise;
      cache.set(pi, { c, v });
    }
    return cache.get(pi);
  };

  // cabeçalhos das questões em ordem de leitura
  const order = [];
  pages.forEach((pg, pi) => pg.rows.forEach((r, ri) => order.push({ pi, ri, r })));
  const colLeft = (pg, col) => Math.min(...pg.rows.filter((r) => r.col === col).map((r) => r.x));
  const compact = (t) => t.replace(/\s/g, '');
  const enemWord = twoCols && order.filter((o) => /^QUEST[ÃA]O0*\d/i.test(compact(o.r.text))).length >= 20;
  const headers = [];
  let expected = 1;
  for (const o of order) {
    const pg = pages[o.pi];
    if (twoCols && enemWord) {
      const m = compact(o.r.text).match(/^QUEST[ÃA]O0*(\d{1,3})(?!\d)/i);
      if (m && !headers.some((h) => h.n === +m[1])) headers.push({ n: +m[1], ...o });
    } else if (twoCols) {
      // enem sem a palavra "QUESTÃO": só o número no início da coluna
      const m = o.r.text.match(/^0*(\d{1,3})$/);
      if (m && o.r.x - colLeft(pg, o.r.col) < 25 && !headers.some((h) => h.n === +m[1])
        && (!headers.length || +m[1] > headers.at(-1).n) && +m[1] <= (headers.length ? headers.at(-1).n + 3 : 95)) headers.push({ n: +m[1], ...o });
    } else {
      const m = o.r.text.match(/^0*(\d{1,2})\s*\.(\s|$)/);
      if (m && +m[1] >= expected && +m[1] <= expected + 3 && o.r.x - colLeft(pg, o.r.col) < 25) {
        headers.push({ n: +m[1], ...o });
        expected = +m[1] + 1;
      }
    }
  }

  for (const j of list) {
    const hi = headers.findIndex((h) => h.n === j.n);
    if (hi < 0) { report.push({ id: j.id, ok: false, motivo: 'cabeçalho não achado' }); continue; }
    const startK = order.findIndex((o) => o.pi === headers[hi].pi && o.ri === headers[hi].ri);
    const end = headers[hi + 1];
    const endK = end ? order.findIndex((o) => o.pi === end.pi && o.ri === end.ri) : order.length;
    const span = order.slice(startK, endK);

    // corta antes das alternativas: última sequência A..E no início das linhas
    const marker = (t, L) => (twoCols ? new RegExp(`^${L}(\\s|$)`) : new RegExp(`^${L.toLowerCase()}\\)`, 'i')).test(t);
    let cut = span.length;
    for (let k = span.length - 1; k > 0; k--) {
      if (!marker(span[k].r.text, 'A')) continue;
      const rest = span.slice(k).map((o) => o.r.text);
      if (['B', 'C', 'D', 'E'].every((L) => rest.some((t) => marker(t, L)))) { cut = k; break; }
    }
    if (INTEIRAS.has(j.id)) cut = span.length;
    // ssa: figura ao lado ou abaixo das alternativas; nesse caso o recorte vai até o fim da questão
    if (!twoCols && cut < span.length) {
      const alts = span.slice(cut).filter((o) => o.pi === span[cut].pi);
      const pg = pages[span[cut].pi];
      const { c, v } = await rendered(span[cut].pi);
      const ctx = c.getContext('2d');
      const right = Math.max(...alts.map((o) => o.r.end));
      const [ax0, ay0] = v.convertToViewportPoint(right + 15, alts[0].r.y + alts[0].r.h);
      const [ax1, ay1] = v.convertToViewportPoint(pg.page.view[0] + pg.vp.width * 0.97, alts.at(-1).r.y - 4);
      const beside = ax1 - ax0 > 40 ? inkArea(ctx, ax0, Math.min(ay0, ay1), ax1 - ax0, Math.abs(ay1 - ay0)) : 0;
      const nextRow = order[endK];
      const belowTo = nextRow && nextRow.pi === span[cut].pi ? nextRow.r.y + nextRow.r.h : pg.page.view[1] + pg.vp.height * 0.04;
      const [bx0, by0] = v.convertToViewportPoint(pg.page.view[0] + pg.vp.width * 0.03, alts.at(-1).r.y - 6);
      const [bx1, by1] = v.convertToViewportPoint(pg.page.view[0] + pg.vp.width * 0.97, belowTo + 4);
      const below = Math.abs(by1 - by0) > 30 ? inkArea(ctx, bx0, Math.min(by0, by1), bx1 - bx0, Math.abs(by1 - by0)) : 0;
      // figura à esquerda das alternativas (alternativas numa coluna estreita à direita)
      const leftEdge = Math.min(...alts.map((o) => o.r.x));
      const [lx0] = v.convertToViewportPoint(pg.page.view[0] + pg.vp.width * 0.03, 0);
      const [lx1] = v.convertToViewportPoint(leftEdge - 15, 0);
      const left = lx1 - lx0 > 40 ? inkArea(ctx, lx0, Math.min(ay0, ay1), lx1 - lx0, Math.abs(ay1 - ay0)) : 0;
      // traço fino (charge, tirinha) tem pouca tinta: 0,4% já indica desenho; área em branco fica perto de 0
      if (beside > 0.004 || below > 0.004 || left > 0.004) cut = span.length;
    }
    const body = span.slice(0, cut);

    // segmentos por página e coluna (a questão pode continuar na outra coluna ou página)
    const segs = [];
    for (const o of body) {
      const last = segs.at(-1);
      if (last && last.pi === o.pi && last.col === o.r.col) last.bottom = Math.min(last.bottom, o.r.y - 3);
      else segs.push({ pi: o.pi, col: o.r.col, top: o.r.y + Math.min(o.r.h, 13) + 3, bottom: o.r.y - 3 });
    }
    segs.forEach((s, i) => {
      const pg = pages[s.pi];
      const oy = pg.page.view[1];
      const next = i === segs.length - 1 ? order[startK + cut] : null;
      // nunca acima da última linha da própria questão (a alternativa A pode estar mais alta, ao lado)
      if (next && next.pi === s.pi && next.r.col === s.col) s.bottom = Math.min(s.bottom, next.r.y + next.r.h + 2);
      // figuras não têm texto: vai até o pé útil da página (o rodapé do enem é mais alto que o do ssa)
      else {
        // até o pé útil da página (figuras não têm texto), mas sem cortar a última linha de texto da coluna
        const lowest = Math.min(...pg.rows.filter((r) => r.col === s.col).map((r) => r.y));
        s.bottom = Math.min(oy + pg.vp.height * (twoCols ? 0.085 : 0.04), lowest - 4);
      }
      if (i > 0) s.top = Math.max(...pg.rows.filter((r) => r.col === s.col).map((r) => r.y + r.h)) + 3;
    });

    const parts = [];
    let clipped = false;
    for (const s of segs.slice(0, 3)) {
      const { page, vp, mid } = pages[s.pi];
      // página renderizada uma vez; a largura do recorte é decidida olhando a imagem
      const { c, v } = await rendered(s.pi);
      const ctx = c.getContext('2d');
      const ox = page.view[0];
      const [, pyTop] = v.convertToViewportPoint(ox, s.top);
      const [, pyBot] = v.convertToViewportPoint(ox, s.bottom);
      const sy = Math.min(pyTop, pyBot), sh = Math.max(10, Math.abs(pyBot - pyTop));
      const [pmid] = v.convertToViewportPoint(mid, s.top);
      // enem: largura total só quando texto ou figura atravessa o vão entre as colunas (a linha do meio não conta)
      const crosses = twoCols && edgeInk(ctx, pmid - 12, sy, sh) > 0.04 && edgeInk(ctx, pmid + 9, sy, sh) > 0.04;
      const full = !twoCols || crosses;
      const x0 = full || s.col === 0 ? ox + vp.width * 0.015 : mid;
      const x1 = full || s.col === 1 ? ox + vp.width * 0.985 : mid;
      const [px0] = v.convertToViewportPoint(x0, s.top);
      const [px1] = v.convertToViewportPoint(x1, s.top);
      const sx = Math.min(px0, px1), sw = Math.abs(px1 - px0);
      // conferência: conteúdo encostado na borda externa indica recorte cortado
      const outer = full ? Math.max(edgeInk(ctx, sx + 2, sy, sh), edgeInk(ctx, sx + sw - 5, sy, sh)) : edgeInk(ctx, s.col === 0 ? sx + 2 : sx + sw - 5, sy, sh);
      const part = { c, sx, sy, sw, sh, ink: outer, full };
      if (part.ink > 0.03) clipped = true;
      parts.push(part);
    }
    const W = Math.max(...parts.map((p) => p.sw));
    const H = parts.reduce((a, p) => a + p.sh, 0);
    const out = createCanvas(Math.round(W), Math.round(H));
    const octx = out.getContext('2d');
    octx.fillStyle = 'white';
    octx.fillRect(0, 0, out.width, out.height);
    let y = 0;
    for (const p of parts) { octx.drawImage(p.c, p.sx, p.sy, p.sw, p.sh, 0, y, p.sw, p.sh); y += p.sh; }
    fs.writeFileSync(path.join(OUT, `${j.id}.webp`), out.toBuffer('image/webp', 72));
    report.push({ id: j.id, ok: true, segmentos: segs.length, largura: Math.round(W), altura: Math.round(H), cortado: clipped, alternativas: cut < span.length });
  }
}
fs.writeFileSync(path.join(OUT, '_relatorio.json'), JSON.stringify(report, null, 1));
const bad = report.filter((r) => !r.ok || r.cortado || r.altura < 150);
console.log(`recortadas ${report.filter((r) => r.ok).length} de ${jobs.length}; para revisar: ${bad.length}`);
for (const r of bad) console.log(r.id, r.ok ? (r.cortado ? 'borda cortada' : `baixa (${r.altura}px)`) : r.motivo);
