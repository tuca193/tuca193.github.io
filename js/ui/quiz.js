// quiz de verificação: 5 questões de provas anteriores antes de concluir um assunto
import { h, icon, skeletonLine } from '../lib/dom.js';
import { pickQuestions, isPassed, readingSeconds, shuffle, MIN_QUESTIONS } from '../lib/quiz.js';
import { loadQuestoes } from '../data/questoes.js';
import { loadResolucoes } from '../data/resolucoes.js';
import { sourceLine } from '../lib/source.js';
import { peekEdital } from '../data/edital.js';
import { openModal } from './feedback.js';
import { questionBody } from './question-text.js';
import { exerciseLinks } from '../lib/links.js';
import { track } from '../lib/metricas.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const SVG_NS = 'http://www.w3.org/2000/svg';

// resolutionPanel - resolução comentada: passos até a resposta e o comentário de cada alternativa
export function resolutionPanel(q, res, chosen) {
  const correct = LETTERS.indexOf(q.resposta);
  const title = h('h4', { class: 'quiz-res-title', tabindex: '-1' }, 'Resolução');
  const sentinel = h('span', { class: 'quiz-res-end', 'aria-hidden': 'true' });
  const el = h('section', { class: 'quiz-res', 'aria-label': 'Resolução da questão' },
    title,
    h('div', { class: 'quiz-res-steps' }, res.passos.map((p) => h('p', { text: p }))),
    h('h5', { class: 'quiz-res-sub' }, 'Alternativa por alternativa'),
    h('ul', { class: 'quiz-res-alts' }, res.alternativas.map((text, k) => h('li', {
      class: k === correct ? 'is-correct' : k === chosen ? 'is-chosen' : '',
    },
    h('span', { class: 'quiz-res-letter', 'aria-hidden': 'true' }, LETTERS[k]),
    h('p', {}, h('span', { class: 'sr-only' }, `Alternativa ${LETTERS[k]}${k === chosen ? ', a sua' : ''}: `), text),
    k === chosen && k !== correct ? h('span', { class: 'quiz-res-yours' }, 'sua resposta') : null))),
    sentinel);
  const words = [...res.passos, ...res.alternativas].join(' ');
  return { el, title, sentinel, seconds: readingSeconds(words) };
}


// resultMark - anel com o símbolo de aprovado ou não, desenhado com animação
function resultMark(passed) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'quiz-mark ' + (passed ? 'is-pass' : 'is-fail'));
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('class', 'quiz-mark-ring');
  ring.setAttribute('cx', '32');
  ring.setAttribute('cy', '32');
  ring.setAttribute('r', '28');
  const glyph = document.createElementNS(SVG_NS, 'path');
  glyph.setAttribute('class', 'quiz-mark-glyph');
  glyph.setAttribute('d', passed ? 'M20 33l8 8 16-17' : 'M24 24l16 16M40 24 24 40');
  svg.append(ring, glyph);
  return svg;
}

// runQuiz - verificação do assunto; resolve true se a pessoa foi aprovada (ou escolheu concluir sem quiz)
// onAnswer(questionId, acertou) - chamado a cada resposta confirmada
export function runQuiz(topicId, { onAnswer } = {}) {
  const info = peekEdital()?.topic(topicId);
  if (!info) return Promise.resolve(false);
  const { assunto, materia } = info;
  return quizModal({
    key: topicId, kicker: `Verificação · ${materia.nome}`, title: assunto.nome, label: `Verificação: ${assunto.nome}`,
    topic: { assunto, materia }, onAnswer,
    pick: (bank) => {
      const { questions, fromTopic } = pickQuestions(bank, { topicId, materiaId: materia.id });
      const total = questions.length;
      const note = fromTopic < total
        ? `${fromTopic ? `${fromTopic} ${fromTopic === 1 ? 'questão é' : 'questões são'} deste assunto` : 'Não há questões só deste assunto'}; as outras são de ${materia.nome}.`
        : null;
      return { questions, note };
    },
  });
}

// runReview - refaz questões do caderno de erros; acertar tira a questão do caderno
export function runReview(questionIds, { onAnswer, title = 'Caderno de erros' } = {}) {
  const wanted = new Set(questionIds);
  return quizModal({
    key: 'revisao', kicker: 'Revisão', title, label: `Revisão: ${title}`, onAnswer, review: true,
    pick: (bank) => ({ questions: shuffle(bank.filter((q) => wanted.has(q.id))), note: null }),
  });
}

function quizModal({ key, kicker, title: heading, label, topic = null, pick, onAnswer, review = false }) {
  const { assunto, materia } = topic ?? {};
  let earned = false;

  return openModal((close) => {
    const finish = () => {
      clearGate();
      close(earned);
    };
    const titleId = `quiz-title-${key}`;
    const stage = h('div', { class: 'quiz-stage' });
    const dots = h('ol', { class: 'quiz-dots', 'aria-hidden': 'true' });
    const counter = h('p', { class: 'quiz-counter' });
    const closeBtn = h('button', { class: 'btn btn-quiet btn-icon quiz-close', type: 'button', 'aria-label': review ? 'Fechar revisão' : 'Fechar verificação', onClick: finish }, icon('x'));

    const root = h('div', { class: 'quiz', 'aria-labelledby': titleId },
      h('header', { class: 'quiz-head' },
        h('div', { class: 'quiz-head-text' },
          h('p', { class: 'quiz-kicker' }, kicker),
          h('h2', { class: 'quiz-title', id: titleId }, heading)),
        closeBtn),
      h('div', { class: 'quiz-progress' }, dots, counter),
      stage);

    // show - troca o conteúdo do palco com a animação de entrada
    const show = (node, focusEl) => {
      node.classList.add('quiz-enter');
      stage.replaceChildren(node);
      (focusEl || node.querySelector('h3, [data-autofocus]'))?.focus({ preventScroll: true });
      stage.scrollTop = 0;
      root.scrollTop = 0;
    };

    const setProgress = (results, current, total) => {
      dots.replaceChildren(...Array.from({ length: total }, (_, i) => {
        const state = results[i] === true ? 'is-right' : results[i] === false ? 'is-wrong' : i === current ? 'is-current' : '';
        return h('li', { class: `quiz-dot ${state}` }, results[i] === true ? icon('check') : results[i] === false ? icon('x') : null);
      }));
      counter.textContent = current < total ? `Questão ${current + 1} de ${total}` : `${total} de ${total} respondidas`;
    };

    function loading() {
      dots.replaceChildren();
      counter.textContent = 'Sorteando questões…';
      show(h('div', { class: 'quiz-card', 'aria-busy': 'true' },
        skeletonLine('40%', 12), skeletonLine('100%', 18), skeletonLine('85%', 18),
        ...Array.from({ length: 5 }, () => skeletonLine('100%', 44))));
    }

    function failedToLoad() {
      counter.textContent = '';
      const retry = h('button', { class: 'btn btn-primary', type: 'button', 'data-autofocus': true, onClick: start }, icon('refresh-cw'), 'Tentar de novo');
      show(h('div', { class: 'quiz-card quiz-message', role: 'alert' },
        h('h3', { tabindex: '-1' }, 'Não consegui carregar o banco de questões'),
        h('p', {}, 'Verifique a conexão e tente de novo. O assunto continua pendente.'),
        h('div', { class: 'quiz-actions' }, h('button', { class: 'btn btn-quiet', type: 'button', onClick: finish }, 'Fechar'), retry)), retry);
    }

    function notEnough(count) {
      counter.textContent = '';
      const mark = h('button', { class: 'btn btn-primary', type: 'button', 'data-autofocus': true, onClick: () => { earned = true; finish(); } }, 'Concluir mesmo assim');
      show(h('div', { class: 'quiz-card quiz-message' },
        h('h3', { tabindex: '-1' }, 'Poucas questões para este assunto'),
        h('p', {}, count
          ? `O banco só tem ${count} ${count === 1 ? 'questão' : 'questões'} de ${materia.nome} com texto legível, menos do que o mínimo de ${MIN_QUESTIONS} para uma verificação justa.`
          : `Ainda não há questões de ${materia.nome} com texto legível nas provas anteriores (muitas dependem de imagens).`),
        h('p', {}, 'Você pode concluir o assunto sem a verificação.'),
        h('div', { class: 'quiz-actions' }, h('button', { class: 'btn btn-quiet', type: 'button', onClick: finish }, 'Cancelar'), mark)), mark);
    }

    let resolucoes = {};
    let gate = null;
    const clearGate = () => {
      gate?.();
      gate = null;
    };

    function start() {
      loading();
      Promise.all([loadQuestoes(), loadResolucoes()])
        .then(([bank, res]) => {
          resolucoes = res;
          if (!root.isConnected) return;
          const { questions, note } = pick(bank);
          if (review && !questions.length) emptyReview();
          else if (!review && questions.length < MIN_QUESTIONS) notEnough(questions.length);
          else play(questions, note);
        })
        .catch(() => root.isConnected && failedToLoad());
    }

    function emptyReview() {
      counter.textContent = '';
      const ok = h('button', { class: 'btn btn-primary', type: 'button', 'data-autofocus': true, onClick: finish }, 'Fechar');
      show(h('div', { class: 'quiz-card quiz-message' },
        h('h3', { tabindex: '-1' }, 'Nada para revisar'),
        h('p', {}, 'Essas questões não estão mais no banco.'),
        h('div', { class: 'quiz-actions' }, ok)), ok);
    }

    function play(questions, note) {
      const results = [];
      const total = questions.length;

      const ask = (i) => {
        clearGate();
        const q = questions[i];
        setProgress(results, i, total);
        let chosen = -1;
        let answered = false;
        const correctIdx = LETTERS.indexOf(q.resposta);
        const stemId = `quiz-stem-${q.id}`;

        const options = q.alternativas.map((text, idx) => h('button', {
          class: 'quiz-option',
          type: 'button',
          role: 'radio',
          'aria-checked': 'false',
          tabindex: idx === 0 ? '0' : '-1',
          onClick: () => select(idx),
        }, h('span', { class: 'quiz-letter', 'aria-hidden': 'true' }, LETTERS[idx]), h('span', { class: 'quiz-option-text' }, text),
        h('span', { class: 'quiz-option-icon', 'aria-hidden': 'true' })));
        const group = h('div', { class: 'quiz-options', role: 'radiogroup', 'aria-labelledby': stemId }, options);
        const feedback = h('p', { class: 'quiz-feedback', role: 'status' });
        const resHost = h('div', {});
        const hint = h('p', { class: 'quiz-res-hint', 'aria-live': 'polite', hidden: true });
        const action = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, 'Confirmar resposta');

        const select = (idx) => {
          if (answered) return;
          chosen = idx;
          options.forEach((o, k) => {
            o.setAttribute('aria-checked', String(k === idx));
            o.tabIndex = k === idx ? 0 : -1;
          });
          options[idx].focus();
          action.disabled = false;
        };

        // setas movem a seleção dentro do grupo, como em botões de rádio nativos
        group.addEventListener('keydown', (e) => {
          const moves = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
          if (!(e.key in moves) || answered) return;
          e.preventDefault();
          const from = chosen < 0 ? options.indexOf(document.activeElement) : chosen;
          select((Math.max(from, 0) + moves[e.key] + options.length) % options.length);
        });

        const confirm = () => {
          if (chosen < 0 || answered) return;
          answered = true;
          const right = chosen === correctIdx;
          results[i] = right;
          onAnswer?.(q.id, right);
          options.forEach((o, k) => {
            o.disabled = true;
            if (k === correctIdx) {
              o.classList.add('is-correct');
              o.lastElementChild.replaceChildren(icon('check'));
            }
            if (k === chosen && !right) {
              o.classList.add('is-wrong');
              o.lastElementChild.replaceChildren(icon('x'));
            }
          });
          feedback.className = 'quiz-feedback ' + (right ? 'is-right' : 'is-wrong');
          feedback.replaceChildren(icon(right ? 'check' : 'x'), right ? 'Resposta certa.' : `Não foi dessa vez. A resposta certa é a ${q.resposta}.`);
          setProgress(results, i, total);
          const last = i === total - 1;
          action.textContent = last ? 'Ver resultado' : 'Próxima questão';
          action.append(icon('arrow-right'));
          action.onclick = () => (last ? result() : ask(i + 1));
          const res = resolucoes[q.id];
          if (!res) {
            action.focus();
            return;
          }
          const panel = resolutionPanel(q, res, chosen);
          if (right) {
            // acertou: a resolução fica disponível, sem obrigar a leitura
            const open = h('button', { class: 'btn btn-quiet', type: 'button', 'aria-expanded': 'false' }, 'Ver resolução');
            open.onclick = () => {
              const show = open.getAttribute('aria-expanded') !== 'true';
              open.setAttribute('aria-expanded', String(show));
              open.textContent = show ? 'Esconder resolução' : 'Ver resolução';
              resHost.replaceChildren(show ? panel.el : '');
            };
            action.before(open);
            action.focus();
            return;
          }
          // errou: só avança depois de rolar até o fim da resolução e do tempo mínimo de leitura
          resHost.replaceChildren(panel.el);
          action.disabled = true;
          hint.hidden = false;
          let seen = false;
          let left = panel.seconds;
          const update = () => {
            const ready = seen && left <= 0;
            action.disabled = !ready;
            hint.textContent = ready ? ''
              : !seen ? 'Leia a resolução até o fim para continuar.'
                : `Termine a leitura: libera em ${left} s.`;
            hint.hidden = ready;
            if (ready) {
              clearGate();
              action.focus({ preventScroll: true });
            }
          };
          const tick = setInterval(() => {
            if (!root.isConnected) return clearGate();
            left -= 1;
            update();
          }, 1000);
          const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) { seen = true; update(); }
          });
          io.observe(panel.sentinel);
          gate = () => { clearInterval(tick); io.disconnect(); };
          update();
          panel.title.focus({ preventScroll: true });
          panel.title.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        action.onclick = confirm;

        const card = h('article', { class: 'quiz-card' },
          i === 0 && note ? h('p', { class: 'quiz-note' }, note) : null,
          h('p', { class: 'quiz-source' }, sourceLine(q),
            assunto && q.assunto !== assunto.id ? h('span', { class: 'quiz-tag' }, `outro assunto de ${materia.nome}`) : null),
          questionBody(q, { questionId: stemId, prefix: `Questão ${i + 1} de ${total}. ` }),
          group,
          feedback,
          resHost,
          hint,
          h('div', { class: 'quiz-actions' }, action));
        show(card);
      };

      // atalhos: letras a–e ou 1–5 escolhem, enter confirma
      root.onkeydown = (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const card = stage.firstElementChild;
        const opts = card ? [...card.querySelectorAll('.quiz-option')] : [];
        if (!opts.length || opts[0].disabled) return;
        const k = e.key.toLowerCase();
        const idx = 'abcde'.indexOf(k) >= 0 && k.length === 1 ? 'abcde'.indexOf(k) : '12345'.indexOf(e.key);
        if (idx >= 0 && idx < opts.length && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          opts[idx].click();
        }
      };

      const result = () => {
        clearGate();
        root.onkeydown = null;
        const correct = results.filter(Boolean).length;
        if (review) {
          track('revisao_erros', { acertos: correct, total });
          setProgress(results, total, total);
          const done = h('button', { class: 'btn btn-primary', type: 'button', 'data-autofocus': true, onClick: finish }, 'Fechar');
          const title = h('h3', { class: 'quiz-result-title', tabindex: '-1' }, correct === total ? 'Tudo certo!' : 'Revisão feita');
          show(h('div', { class: 'quiz-card quiz-result ' + (correct === total ? 'is-pass' : 'is-fail') },
            resultMark(correct === total),
            h('p', { class: 'quiz-score' }, h('b', {}, String(correct)), ` de ${total}`),
            title,
            h('p', { class: 'quiz-result-text' }, correct
              ? `${correct === 1 ? 'A questão que você acertou saiu' : `As ${correct} questões que você acertou saíram`} do caderno de erros.${correct < total ? ' As outras continuam lá para a próxima revisão.' : ''}`
              : 'As questões continuam no caderno de erros. Releia as resoluções e tente de novo depois.'),
            h('div', { class: 'quiz-actions' }, done)), title);
          return;
        }
        const passed = isPassed(correct, total);
        earned = earned || passed;
        track('quiz_verificacao', { assunto: key, materia: materia.id, acertos: correct, total, aprovado: passed });
        setProgress(results, total, total);
        const needed = Math.floor(total / 2) + 1;
        const primary = passed
          ? h('button', { class: 'btn btn-primary', type: 'button', 'data-autofocus': true, onClick: finish }, icon('check'), 'Concluir assunto')
          : h('button', { class: 'btn btn-primary', type: 'button', 'data-autofocus': true, onClick: start }, icon('rotate-ccw'), 'Tentar com outras questões');
        const secondary = passed
          ? null
          : h('a', { class: 'btn btn-quiet', href: `#/materia/${materia.id}`, onClick: finish }, 'Revisar a matéria');
        const title = h('h3', { class: 'quiz-result-title', tabindex: '-1' }, passed ? 'Parabéns!' : 'Conhecimento insuficiente, por enquanto');
        show(h('div', { class: 'quiz-card quiz-result ' + (passed ? 'is-pass' : 'is-fail') },
          resultMark(passed),
          h('p', { class: 'quiz-score' }, h('b', {}, String(correct)), ` de ${total}`),
          title,
          h('p', { class: 'quiz-result-text' }, passed
            ? `Você acertou ${correct} de ${total} questões de provas anteriores e pode concluir "${assunto.nome}".`
            : `Você acertou ${correct} de ${total}; para concluir é preciso acertar pelo menos ${needed}. Revise o assunto e tente de novo com outras questões.`),
          passed ? null : h('ul', { class: 'quiz-extra' }, exerciseLinks(assunto).map((l) => h('li', {},
            h('a', { href: l.href, target: '_blank', rel: 'noopener noreferrer' }, l.label, icon('external-link'),
              h('span', { class: 'sr-only' }, ' (abre em nova aba)'))))),
          h('div', { class: 'quiz-actions' }, secondary, primary)), title);
      };

      ask(0);
    }

    start();
    return root;
  }, { label, dismissOnBackdrop: false, className: 'modal-quiz', cancelValue: () => earned });
}
