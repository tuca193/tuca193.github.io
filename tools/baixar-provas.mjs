// baixar-provas - baixa dos sites oficiais (inep e upe) os cadernos das questões que têm imagem
// uso: node tools/baixar-provas.mjs   (salva em tools/.provas, fora do git)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const OUT = 'tools/.provas';
const INEP = 'https://download.inep.gov.br/enem/provas_e_gabaritos';
const INEP_ANTIGO = 'https://download.inep.gov.br/educacao_basica/enem/provas';
const UPE = 'https://processodeingresso.upe.pe.gov.br';
// ssa 1 e 3: endereços dos cadernos no site da upe
const SSA13 = {
  'ssa1-2023-d2': '/processo2023/arquivos/ssa1/CADERNO-DE-PROVAS-SSA1-2DIA.pdf',
  'ssa1-2024-d2': '/processo2024/arquivos/ssa1/SSA1-2DIA-CADERNO-DE-PROVAS.pdf',
  'ssa1-2025-d1': '/processo2025/arquivos/ssa1_2025/CADERNO_DE_PROVAS_-_SSA_1_-_DIA-1_-_20241208.pdf',
  'ssa1-2026-d2': '/processo2026/arquivos/ssa1_2026/202512141523_-_CADERNO_DE_PROVAS_-_SSA_1_-_2_DIA.pdf',
  'ssa3-2023-d1': '/processo2023/arquivos/ssa3/CADERNO-DE-PROVAS-SSA3-1DIA.pdf',
  'ssa3-2024-d1': '/processo2024/arquivos/ssa3/CADERNO-DE-PROVAS-SSA3-1-DIA.pdf',
  'ssa3-2024-d2': '/processo2024/arquivos/ssa3/CADERNO-DE-PROVAS-SSA3-2-DIA.pdf',
};

// url - endereço oficial do caderno de uma prova (ex.: "enemppl2022-d2", "2024-d1", "ssa3-2024-d2")
function url(exam, edital) {
  let m = exam.match(/^enem(ppl)?(\d{4})-d(\d)$/);
  if (m) {
    const [, ppl, ano, dia] = m;
    // 2015 tem espaços no nome do arquivo
    if (+ano <= 2016) return `${INEP_ANTIGO}/${ano}/CAD_ENEM${ano === '2015' ? '%20' : '_'}${ano}_DIA${ano === '2015' ? '%20' : '_'}${dia}_${dia === '1' ? '01' : '07'}_AZUL.pdf`;
    if (+ano <= 2019) return `${INEP_ANTIGO}/${ano}/${ano}_PV_impresso_D${dia}_CD${dia === '1' ? 1 : 7}.pdf`;
    return `${INEP}/${ano}_PV_${ppl ? 'reaplicacao_PPL' : 'impresso'}_D${dia}_CD${dia === '1' ? 1 : 7}.pdf`;
  }
  if (SSA13[exam]) return UPE + SSA13[exam];
  m = exam.match(/^(\d{4})-d(\d)$/);
  if (m) return edital.anteriores.find((p) => p.processo === +m[1])?.dias.find((d) => d.dia === +m[2])?.prova ?? null;
  return null;
}

const bank = JSON.parse(readFileSync('data/questoes.json', 'utf8')).questoes;
const edital = JSON.parse(readFileSync('data/edital.json', 'utf8'));
const exams = [...new Set(bank.filter((q) => q.imagem).map((q) => q.id.replace(/-q\d+$/, '')))].sort();
mkdirSync(OUT, { recursive: true });
for (const exam of exams) {
  const file = `${OUT}/${exam}.pdf`;
  if (existsSync(file)) continue;
  const u = url(exam, edital);
  if (!u) { console.log('sem endereço', exam); continue; }
  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    try {
      const res = await fetch(u);
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.ok && buf.subarray(0, 4).toString() === '%PDF') { writeFileSync(file, buf); ok = true; }
    } catch { /* tenta de novo */ }
  }
  console.log(ok ? 'ok' : 'FALHOU', exam);
}
