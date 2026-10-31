// quiz de verificação: 5 questões de provas anteriores antes de concluir um assunto
import { h, icon, skeletonLine } from '../lib/dom.js';
import { pickQuestions, isPassed, MIN_QUESTIONS } from '../lib/quiz.js';
import { loadQuestoes } from '../data/questoes.js';
import { sourceLine } from '../lib/source.js';
import { peekEdital } from '../data/edital.js';
import { openModal } from './feedback.js';
import { supportText, commandText } from './question-text.js';
import { exerciseLinks } from '../lib/links.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const SVG_NS = 'http://www.w3.org/2000/svg';

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

// runQuiz - abre o quiz do assunto; resolve true se a pessoa foi aprovada (ou escolheu concluir sem quiz)
export function runQuiz(topicId) {
  const info = peekEdital()?.topic(topicId);
  if (!info) return Promise.resolve(false);
  const { assunto, materia } = info;
  let earned = false;

  return openModal((close) => {
    const finish = () => close(earned);
    const titleId = `quiz-title-${topicId}`;
    const stage = h('div', { class: 'quiz-stage' });
    const dots = h('ol', { class: 'quiz-dots', 'aria-hidden': 'true' });
    const counter = h('p', { class: 'quiz-counter' });
    const closeBtn = h('button', { class: 'btn btn-quiet btn-icon quiz-close', type: 'button', 'aria-label': 'Fechar verificação', onClick: finish }, icon('x'));

    const root = h('div', { class: 'quiz', 'aria-labelledby': titleId },
      h('header', { class: 'quiz-head' },
        h('div', { class: 'quiz-head-text' },
          h('p', { class: 'quiz-kicker' }, `Verificação · ${materia.nome}`),
          h('h2', { class: 'quiz-title', id: titleId }, assunto.nome)),
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

    function start() {
      loading();
      loadQuestoes()
        .then((bank) => {
          if (!root.isConnected) return;
          const { questions, fromTopic } = pickQuestions(bank, { topicId, materiaId: materia.id });
          if (questions.length < MIN_QUESTIONS) notEnough(questions.length);
          else play(questions, fromTopic);
        })
        .catch(() => root.isConnected && failedToLoad());
    }

    function play(questions, fromTopic) {
      const results = [];
      const total = questions.length;
      const note = fromTopic < total
        ? `${fromTopic ? `${fromTopic} ${fromTopic === 1 ? 'questão é' : 'questões são'} deste assunto` : 'Não há questões só deste assunto'}; as outras são de ${materia.nome}.`
        : null;

      const ask = (i) => {
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
          action.focus();
        };
        action.onclick = confirm;

        const card = h('article', { class: 'quiz-card' },
          i === 0 && note ? h('p', { class: 'quiz-note' }, note) : null,
          h('p', { class: 'quiz-source' }, sourceLine(q),
            q.assunto !== assunto.id ? h('span', { class: 'quiz-tag' }, `outro assunto de ${materia.nome}`) : null),
          supportText(q.apoio),
          commandText(q.comando, { questionId: stemId, prefix: `Questão ${i + 1} de ${total}. ` }),
          group,
          feedback,
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
        root.onkeydown = null;
        const correct = results.filter(Boolean).length;
        const passed = isPassed(correct, total);
        earned = earned || passed;
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
  }, { label: `Verificação: ${assunto.nome}`, dismissOnBackdrop: false, className: 'modal-quiz', cancelValue: () => earned });
}
