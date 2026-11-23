// tutor com ia: conversa sobre a questão (por que errei, passo a passo, perguntas de continuação)
import { h, icon } from '../lib/dom.js';
import { renderRich } from '../lib/math.js';
import { idToken } from '../data/remote.js';
import { peekEdital } from '../data/edital.js';
import { sourceLine } from '../lib/source.js';
import { track } from '../lib/metricas.js';

export const TUTOR_URL = 'https://painel-ssa2-tutor.vercel.app/api/tutor';
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// questaoParaTutor - o que o servidor precisa saber da questão (sem nenhum dado do aluno além da alternativa marcada)
function questaoParaTutor(q, res, chosen) {
  const edital = peekEdital();
  const text = (b) => b.texto ?? (b.linhas || []).join('\n') ?? (b.itens || []).map((i) => `${i.marca} ${i.texto}`).join('\n');
  return {
    materia: edital?.materiaById(q.materia)?.nome ?? q.materia,
    assunto: q.assunto ? edital?.topic(q.assunto)?.assunto.nome ?? q.assunto : null,
    origem: sourceLine(q),
    enunciado: [...q.apoio, ...q.comando].map(text).join('\n'),
    alternativas: q.alternativas,
    resposta: q.resposta,
    marcada: chosen >= 0 ? LETTERS[chosen] : null,
    resolucao: res ? res.passos.join('\n') : null,
    temImagem: Boolean(q.imagem),
  };
}

async function perguntar(questao, conversa) {
  const token = await idToken().catch(() => null);
  if (!token) throw new Error('Entre com sua conta Google para usar o tutor.');
  const r = await fetch(TUTOR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ questao, conversa }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.texto) throw new Error(data.erro || 'O tutor não conseguiu responder agora. Tente de novo.');
  return data.texto;
}

// tutorPanel - botão "Pergunte ao tutor" que abre a conversa dentro da resolução
export function tutorPanel(q, res, chosen) {
  const questao = questaoParaTutor(q, res, chosen);
  const conversa = [];
  const list = h('div', { class: 'tutor-msgs', 'aria-live': 'polite' });
  const input = h('textarea', { class: 'input tutor-input', rows: 2, maxlength: 600, placeholder: 'Pergunte sobre esta questão (ex.: por que dividiu por 2?)', 'aria-label': 'Sua pergunta ao tutor' });
  const send = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Enviar');
  const form = h('form', { class: 'tutor-form', hidden: true }, input, send);
  const start = h('button', { class: 'btn tutor-start', type: 'button' }, icon('arrow-right'), chosen >= 0 && LETTERS[chosen] !== q.resposta ? 'Não entendi: pergunte ao tutor' : 'Pergunte ao tutor');
  let busy = false;

  const bubble = (de, texto) => {
    const body = h('div', { class: 'tutor-text' });
    const el = h('div', { class: `tutor-msg is-${de}` }, h('p', { class: 'tutor-who', text: de === 'tutor' ? 'Tutor' : 'Você' }), body);
    if (de === 'tutor') renderRich(body, texto);
    else body.textContent = texto;
    list.append(el);
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return el;
  };

  const ask = async (texto) => {
    if (busy || !texto.trim()) return;
    busy = true;
    send.disabled = true;
    conversa.push({ de: 'aluno', texto: texto.trim() });
    bubble('aluno', texto.trim());
    const wait = h('p', { class: 'tutor-wait', text: 'O tutor está escrevendo…' });
    list.append(wait);
    try {
      const resposta = await perguntar(questao, conversa);
      conversa.push({ de: 'tutor', texto: resposta });
      wait.remove();
      bubble('tutor', resposta);
      track('tutor_pergunta', { materia: q.materia, turno: conversa.length / 2 });
    } catch (e) {
      wait.remove();
      conversa.pop();
      list.append(h('p', { class: 'tutor-error', role: 'alert', text: e.message }));
    } finally {
      busy = false;
      send.disabled = false;
    }
  };

  start.addEventListener('click', () => {
    start.hidden = true;
    form.hidden = false;
    const primeira = questao.marcada && questao.marcada !== q.resposta
      ? `Eu marquei a alternativa ${questao.marcada}, mas a certa é a ${q.resposta}. Onde eu errei? Me explique a resolução passo a passo.`
      : 'Me explique a resolução desta questão passo a passo.';
    ask(primeira);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = input.value;
    input.value = '';
    ask(t);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  return h('section', { class: 'tutor', 'aria-label': 'Tutor com inteligência artificial' },
    start, list, form,
    h('p', { class: 'tutor-note' }, 'Respostas geradas por IA (Gemini, do Google). Podem conter erros; confira com o gabarito. Só a questão e a sua pergunta são enviadas.'));
}
