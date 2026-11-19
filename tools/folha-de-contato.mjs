// folha-de-contato - junta os recortes em folhas numeradas para conferir tudo de olho
// uso: node tools/folha-de-contato.mjs   (grava tools/.recortes/_folha-N.png)
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';

const DIR = process.argv[2] || 'tools/.recortes';
const COLS = 4, ROWS = 4, CELL_W = 420, CELL_H = 420, LABEL = 22;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.webp')).sort();
const per = COLS * ROWS;
for (let s = 0; s * per < files.length; s++) {
  const c = createCanvas(COLS * CELL_W, ROWS * (CELL_H + LABEL));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 0, c.width, c.height);
  const page = files.slice(s * per, s * per + per);
  for (let i = 0; i < page.length; i++) {
    const img = await loadImage(fs.readFileSync(`${DIR}/${page[i]}`));
    const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * (CELL_H + LABEL);
    const k = Math.min((CELL_W - 8) / img.width, (CELL_H - 8) / img.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 4, y + LABEL, img.width * k, img.height * k);
    ctx.drawImage(img, x + 4, y + LABEL, img.width * k, img.height * k);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(page[i].replace('.webp', ''), x + 6, y + 17);
  }
  fs.writeFileSync(`${DIR}/_folha-${s + 1}.png`, c.toBuffer('image/png'));
}
console.log(Math.ceil(files.length / per), 'folhas');
