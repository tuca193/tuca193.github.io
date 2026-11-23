// tutor - recebe a dúvida de um aluno logado sobre uma questão e responde com o gemini (plano gratuito)
// a chave do gemini fica só aqui, na variável de ambiente GEMINI_API_KEY da vercel
import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROJECT = 'projetossa2-database';
// modelos em ordem de preferência; se o primeiro estiver sem cota no plano gratuito, tenta o seguinte
const MODELS = (process.env.GEMINI_MODELS || 'gemini-flash-latest,gemini-flash-lite-latest').split(',').map((m) => m.trim()).filter(Boolean);
const ORIGINS = ['https://tuca193.github.io', 'https://painelssa2.com', 'http://localhost:8000', 'http://localhost:8001'];
const PER_DAY = Number(process.env.TUTOR_PER_DAY || 30);
const MAX_TURNS = 12;
const MAX_CHARS = 6000;

// chaves públicas do firebase auth: confirmam que o pedido vem de alguém logado no painel
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

// limite por pessoa por dia (por instância; o limite do próprio google protege o total)
const usage = new Map();
function allow(uid) {
  const day = new Date().toISOString().slice(0, 10);
  const cur = usage.get(uid);
  const n = cur?.day === day ? cur.n : 0;
  if (n >= PER_DAY) return false;
  usage.set(uid, { day, n: n + 1 });
  return true;
}

const SYSTEM = `Você é o tutor do Painel SSA 2, um site de estudos para o vestibular seriado da UPE (alunos do 2º ano do ensino médio).
O aluno errou uma questão de prova (ou quer entender melhor a resolução) e vai conversar com você sobre ela.

Como responder:
- Em português do Brasil, num tom de professor paciente, direto e encorajador.
- Primeiro, diga em uma frase onde está o erro mais provável de quem marcou a alternativa do aluno.
- Depois resolva passo a passo, uma ideia por passo, numerando os passos. Em contas, mostre a fórmula, substitua os valores com unidades, faça a conta e diga o resultado com unidade.
- Escreva toda matemática, unidade e fórmula química em LaTeX: $...$ no meio do texto e $$...$$ para contas em destaque. Exemplos: $v = \\dfrac{\\Delta s}{\\Delta t}$, $20\\,\\text{m/s}^2$, $\\text{CO}_2$, $\\Delta H = -286\\,\\text{kJ/mol}$, $10^{-3}$.
- Use no máximo ~250 palavras por resposta, salvo se o aluno pedir mais detalhe. Sem títulos grandes; pode usar **negrito** e listas curtas.
- Se o aluno perguntar algo fora da questão ou do conteúdo do SSA 2, traga a conversa de volta para a questão.
- Termine, quando fizer sentido, com uma pergunta curta para o aluno conferir se entendeu.
- Confie no gabarito oficial informado. Se ele parecer errado, diga com cuidado o que você acha, sem afirmar que a prova errou.`;

// contexto - a questão em texto, para o modelo
function contexto(q) {
  const alts = (q.alternativas || []).map((a, i) => `${'ABCDE'[i]}) ${a}`).join('\n');
  return [
    `Matéria: ${q.materia || '-'} · Assunto: ${q.assunto || '-'} · Origem: ${q.origem || '-'}`,
    q.enunciado ? `Enunciado:\n${q.enunciado}` : '',
    alts ? `Alternativas:\n${alts}` : '',
    `Gabarito oficial: ${q.resposta}`,
    q.marcada ? `O aluno marcou: ${q.marcada}` : 'O aluno ainda não marcou nenhuma alternativa.',
    q.resolucao ? `Resolução resumida do site (pode estar curta demais):\n${q.resolucao}` : '',
    q.temImagem ? 'Observação: a questão tem uma figura ou tabela que você não vê; trabalhe com o texto e, se precisar, peça ao aluno os dados da figura.' : '',
  ].filter(Boolean).join('\n\n').slice(0, MAX_CHARS);
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ erro: 'O tutor ainda não foi configurado.' });

  // só alunos logados no painel
  let uid;
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT}`, audience: PROJECT });
    uid = payload.sub;
  } catch {
    return res.status(401).json({ erro: 'Entre com sua conta Google para usar o tutor.' });
  }
  if (!allow(uid)) return res.status(429).json({ erro: `Você já fez ${PER_DAY} perguntas hoje. O tutor volta amanhã.` });

  const { questao, conversa } = req.body || {};
  if (!questao || !Array.isArray(conversa) || !conversa.length) return res.status(400).json({ erro: 'Pedido incompleto.' });
  const turns = conversa.slice(-MAX_TURNS).map((m) => ({
    role: m.de === 'tutor' ? 'model' : 'user',
    parts: [{ text: String(m.texto || '').slice(0, 1500) }],
  }));
  turns[0].parts.unshift({ text: `${contexto(questao)}\n\n---\n` });

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: turns,
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  });
  let busy = false;
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body,
      });
      const data = await r.json();
      // sem cota ou modelo indisponível no plano gratuito: tenta o próximo
      if (r.status === 429 || r.status === 404 || r.status === 403) { busy ||= r.status === 429; continue; }
      if (!r.ok) continue;
      const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
      if (texto) return res.status(200).json({ texto });
    } catch { /* tenta o próximo modelo */ }
  }
  return res.status(busy ? 429 : 502).json({ erro: busy ? 'O tutor atingiu o limite gratuito por agora. Tente de novo mais tarde.' : 'O tutor não conseguiu responder agora. Tente de novo.' });
}
