// simulado: prova completa de um dia do ssa 2 com cronômetro, gabarito no fim e nota por área
import { h, icon, skeletonLine } from '../lib/dom.js';
import { plural } from '../lib/text.js';
import { sourceLine } from '../lib/source.js';
import { MODOS, quotas, buildSimulado, scoreSimulado } from '../lib/simulado.js';
import { withEdital, errorBlock, emptyBlock } from '../ui/states.js';
import { confirmDialog, toast } from '../ui/feedback.js';
import { meter, pct } from '../ui/meter.js';
import { resolutionPanel } from '../ui/quiz.js';
import { questionBody } from '../ui/question-text.js';
import { loadQuestoes } from '../data/questoes.js';
import { loadResolucoes } from '../data/resolucoes.js';
import { track } from '../lib/metricas.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' });

// sessão em andamento: fica no navegador para sobreviver a recarregar a página
const sessionKey = (profileId) => `ssa2:simulado:${profileId}`;
function readSession(profileId) {
  try {
    const s = JSON.parse(localStorage.getItem(sessionKey(profileId)));
    return s && Array.isArray(s.items) && s.deadline ? s : null;
  } catch {
    return null;
  }
}
function writeSession(profileId, s) {
  try { localStorage.setItem(sessionKey(profileId), JSON.stringify(s)); } catch { /* sem storage: vale só nesta aba */ }
}
function clearSession(profileId) {
  try { localStorage.removeItem(sessionKey(profileId)); } catch { /* nada a limpar */ }
}

// clock - hh:mm:ss de um intervalo em segundos
function clock(sec) {
  const s = Math.max(0, Math.round(sec));
  const pad = (n) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// duration - "2 h 15 min" para o tempo usado
function duration(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}

function skeleton() {
  return h('div', { class: 'sim' },
    h('div', { class: 'sim-days' }, [1, 2].map(() => h('div', { class: 'card surface' },
      skeletonLine('40%', 18), skeletonLine('80%', 14), skeletonLine('70%', 14), skeletonLine('35%', 40)))));
}

export function render({ store }) {
  const offs = [];
  const profileId = store.activeProfile()?.id;
  const body = h('div', {});
  const el = h('section', { class: 'sim-view', 'aria-labelledby': 'simulado-title' },
    h('a', { class: 'back-link', href: '#/provas' }, icon('chevron-left'), 'Provas'),
    h('div', { class: 'page-head' }, h('div', {},
      h('h1', { class: 'page-title', id: 'simulado-title', tabindex: '-1' }, 'Simulado'),
      h('p', { class: 'page-sub' }, 'Uma prova inteira de um dia do SSA 2, com tempo, como no dia'))),
    body);

  let stopTimer = () => {};
  offs.push(() => stopTimer());

  const load = () => withEdital(body, skeleton, (edital) => {
    const host = h('div', {}, skeleton());
    Promise.all([loadQuestoes(), loadResolucoes()])
      .then(([bank, res]) => {
        if (!host.isConnected) return;
        const ctx = { edital, bank, res, byId: new Map(bank.map((q) => [q.id, q])) };
        const saved = readSession(profileId);
        host.replaceChildren(saved ? exam(ctx, saved) : start(ctx));
      })
      .catch(() => host.isConnected && host.replaceChildren(errorBlock('Não consegui carregar o banco de questões.', load)));
    return host;
  });

  const mount = (node) => {
    stopTimer();
    body.replaceChildren(node);
    window.scrollTo(0, 0);
  };

  /* ---------- início: escolher o dia e o modo ---------- */

  function start(ctx) {
    const { edital } = ctx;
    let modo = 'completo';
    const modeBtns = Object.entries(MODOS).map(([id, m]) => h('button', {
      type: 'button',
      'aria-pressed': String(id === modo),
      onClick: () => {
        modo = id;
        modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(Object.keys(MODOS)[i] === modo)));
        cards.forEach((c) => c.refresh());
      },
    }, m.nome));

    const cards = [1, 2].map((dia) => {
      const comp = h('ul', { class: 'sim-comp' });
      const meta = h('p', { class: 'sim-meta' });
      const go = h('button', { class: 'btn btn-primary', type: 'button', onClick: () => begin(ctx, dia, modo) }, `Começar ${dia}º dia`, icon('arrow-right'));
      const prova = edital.provas[dia - 1];
      const card = h('section', { class: 'card surface sim-day', 'aria-labelledby': `sim-dia-${dia}` },
        h('h2', { class: 'card-title', id: `sim-dia-${dia}` }, `${dia}º dia`),
        prova ? h('p', { class: 'settings-desc', text: `A prova de verdade: ${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Recife' }).format(new Date(prova.inicio))}` }) : null,
        comp, meta, go);
      card.refresh = () => {
        const q = quotas(dia, modo);
        comp.replaceChildren(...q.map((a) => h('li', {},
          h('strong', { text: a.nome }),
          h('span', { text: Object.entries(a.materias).map(([m, n]) => `${edital.materiaById(m)?.nome ?? m} ${n}`).join(' · ') }))));
        const total = q.reduce((s, a) => s + Object.values(a.materias).reduce((x, y) => x + y, 0), 0);
        meta.textContent = `${total} questões · ${duration(MODOS[modo].minutos * 60)}`;
      };
      card.refresh();
      return card;
    });

    const history = store.simulados().slice().reverse();
    return h('div', { class: 'sim' },
      h('div', { class: 'card surface sim-intro' },
        h('p', {}, 'No SSA 2 cada dia tem 45 questões e 4 horas de prova. O simulado sorteia questões oficiais do SSA e do ENEM na mesma proporção de matérias do caderno, sem mostrar se você acertou até entregar. Prefere treinar em menos tempo? Use o modo rápido, com um terço da prova.'),
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tamanho do simulado' }, modeBtns)),
      h('div', { class: 'sim-days' }, cards),
      h('section', { class: 'card surface', 'aria-labelledby': 'sim-hist' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'sim-hist' }, 'Seus simulados')),
        history.length
          ? h('ul', { class: 'sim-hist' }, history.map((r) => h('li', { class: 'perf-row' },
            h('span', {}, h('strong', { text: `${r.dia}º dia · ${MODOS[r.modo]?.nome ?? r.modo}` }), h('small', { class: 'perf-sub', text: `${DATE_FMT.format(new Date(r.at))} · ${duration(r.segundos)}` })),
            meter(r, `Acerto no simulado do ${r.dia}º dia`),
            h('span', { class: 'perf-n', text: `${pct(r)} · ${r.c}/${r.n}` }))))
          : emptyBlock('Os resultados dos simulados que você entregar aparecem aqui, para acompanhar a evolução.')));
  }

  function begin(ctx, dia, modo) {
    const items = buildSimulado(ctx.bank, dia, { modo, log: store.quizLog() });
    const now = Date.now();
    track('simulado_iniciado', { dia, modo });
    const session = { dia, modo, items, answers: {}, flags: {}, current: 0, startedAt: now, deadline: now + MODOS[modo].minutos * 60000 };
    writeSession(profileId, session);
    mount(exam(ctx, session));
  }

  /* ---------- prova em andamento ---------- */

  function exam(ctx, s) {
    const { edital, byId } = ctx;
    const save = () => writeSession(profileId, s);
    const timer = h('p', { class: 'sim-timer', role: 'timer', 'aria-live': 'off' });
    const answeredCount = h('p', { class: 'sim-count' });
    const stage = h('div', { class: 'sim-stage' });
    const nav = h('nav', { class: 'sim-nav', 'aria-label': 'Questões do simulado' });
    const navBtns = [];

    // navegação agrupada por área, como no caderno
    let n = 0;
    const groups = [];
    for (const item of s.items) {
      if (!groups.length || groups.at(-1).area !== item.area) groups.push({ area: item.area, idx: [] });
      groups.at(-1).idx.push(n++);
    }
    nav.append(...groups.map((g) => h('div', { class: 'sim-nav-group' },
      h('p', { class: 'sim-nav-title', text: g.area }),
      h('ol', {}, g.idx.map((i) => {
        const b = h('button', { type: 'button', class: 'sim-nav-btn', onClick: () => go(i) }, String(i + 1));
        navBtns[i] = b;
        return h('li', {}, b);
      })))));

    const refreshNav = () => {
      s.items.forEach((it, i) => {
        const b = navBtns[i];
        const answered = Boolean(s.answers[it.id]);
        b.classList.toggle('is-answered', answered);
        b.classList.toggle('is-flagged', Boolean(s.flags[it.id]));
        b.toggleAttribute('aria-current', i === s.current);
        b.setAttribute('aria-label', `Questão ${i + 1}${answered ? `, respondida ${s.answers[it.id]}` : ', em branco'}${s.flags[it.id] ? ', marcada para revisar' : ''}`);
      });
      const done = Object.keys(s.answers).length;
      answeredCount.textContent = `${done} de ${s.items.length} respondidas`;
    };

    function go(i) {
      s.current = Math.max(0, Math.min(s.items.length - 1, i));
      save();
      renderQuestion();
      stage.querySelector('.quiz-stem')?.focus({ preventScroll: true });
      stage.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function renderQuestion() {
      const i = s.current;
      const it = s.items[i];
      const q = byId.get(it.id);
      const stemId = `sim-stem-${i}`;
      if (!q) {
        stage.replaceChildren(emptyBlock('Esta questão saiu do banco. Siga para a próxima.'));
        refreshNav();
        return;
      }
      const options = q.alternativas.map((text, k) => h('button', {
        class: 'quiz-option', type: 'button', role: 'radio',
        'aria-checked': String(s.answers[it.id] === LETTERS[k]),
        onClick: () => {
          s.answers[it.id] = LETTERS[k];
          save();
          options.forEach((o, j) => o.setAttribute('aria-checked', String(j === k)));
          refreshNav();
        },
      }, h('span', { class: 'quiz-letter', 'aria-hidden': 'true' }, LETTERS[k]), h('span', { class: 'quiz-option-text' }, text), h('span', { class: 'quiz-option-icon' })));
      const flag = h('button', { class: 'btn btn-quiet', type: 'button', 'aria-pressed': String(Boolean(s.flags[it.id])) },
        icon('list-checks'), s.flags[it.id] ? 'Marcada para revisar' : 'Marcar para revisar');
      flag.addEventListener('click', () => {
        if (s.flags[it.id]) delete s.flags[it.id];
        else s.flags[it.id] = true;
        save();
        renderQuestion();
      });
      const clear = s.answers[it.id]
        ? h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => { delete s.answers[it.id]; save(); renderQuestion(); } }, 'Limpar resposta')
        : null;
      stage.replaceChildren(h('article', { class: 'quiz-card' },
        h('p', { class: 'quiz-source' }, `Questão ${i + 1} de ${s.items.length} · ${edital.materiaById(it.materia)?.nome ?? it.materia}`),
        questionBody(q, { questionId: stemId, prefix: `Questão ${i + 1}. ` }),
        h('div', { class: 'quiz-options', role: 'radiogroup', 'aria-labelledby': stemId }, options),
        h('div', { class: 'sim-q-tools' }, flag, clear),
        h('div', { class: 'quiz-actions sim-q-nav' },
          h('button', { class: 'btn btn-quiet', type: 'button', disabled: i === 0, onClick: () => go(i - 1) }, icon('chevron-left'), 'Anterior'),
          i < s.items.length - 1
            ? h('button', { class: 'btn btn-primary', type: 'button', onClick: () => go(i + 1) }, 'Próxima', icon('chevron-right'))
            : h('button', { class: 'btn btn-primary', type: 'button', onClick: () => submit(false) }, 'Entregar simulado'))));
      refreshNav();
    }

    async function submit(timeUp) {
      if (!timeUp) {
        const blank = s.items.filter((it) => !s.answers[it.id]).length;
        const ok = await confirmDialog({
          title: 'Entregar o simulado?',
          text: blank ? `Você deixou ${plural(blank, 'questão', 'questões')} em branco; elas contam como erro.` : 'Depois de entregar você vê o gabarito e não dá para mudar as respostas.',
          confirmLabel: 'Entregar', danger: false,
        });
        if (!ok || !readSession(profileId)) return;
      }
      finishExam(ctx, s, timeUp);
    }

    const tick = () => {
      const left = (s.deadline - Date.now()) / 1000;
      timer.textContent = clock(left);
      timer.classList.toggle('is-low', left <= 600);
      if (left <= 0) {
        stopTimer();
        toast('O tempo acabou. Simulado entregue.');
        finishExam(ctx, s, true);
      }
    };
    const handle = setInterval(tick, 1000);
    stopTimer = () => clearInterval(handle);
    tick();

    const quit = h('button', { class: 'btn btn-quiet', type: 'button' }, 'Desistir');
    quit.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Desistir do simulado?', text: 'As respostas deste simulado são descartadas e ele não entra no seu histórico.', confirmLabel: 'Desistir' });
      if (!ok) return;
      clearSession(profileId);
      mount(start(ctx));
    });

    renderQuestion();
    return h('div', { class: 'sim sim-exam' },
      h('div', { class: 'sim-bar glass' },
        h('div', {}, h('p', { class: 'label', text: `${s.dia}º dia · ${MODOS[s.modo].nome}` }), answeredCount),
        h('div', { class: 'sim-bar-time' }, icon('clock'), timer),
        h('div', { class: 'sim-bar-actions' }, quit,
          h('button', { class: 'btn btn-primary', type: 'button', onClick: () => submit(false) }, 'Entregar'))),
      h('div', { class: 'sim-body' }, stage, h('aside', { class: 'card surface sim-side' }, nav,
        h('p', { class: 'sim-legend' },
          h('span', { class: 'sim-key is-answered' }), 'respondida ',
          h('span', { class: 'sim-key is-flagged' }), 'para revisar'))));
  }

  /* ---------- entrega e resultado ---------- */

  function finishExam(ctx, s, timeUp) {
    stopTimer();
    if (!readSession(profileId)) return;
    clearSession(profileId);
    const score = scoreSimulado(s.items, s.answers, ctx.byId);
    const segundos = Math.max(0, Math.round((Math.min(Date.now(), s.deadline) - s.startedAt) / 1000));
    // respostas dadas entram no histórico do quiz: as erradas vão para o caderno de erros
    for (const it of s.items) {
      const q = ctx.byId.get(it.id);
      if (q && s.answers[it.id]) store.recordAnswer(it.id, s.answers[it.id] === q.resposta, { profileId });
    }
    store.recordSimulado({ dia: s.dia, modo: s.modo, c: score.total.c, n: score.total.n, areas: score.byArea, segundos, at: new Date().toISOString() }, { profileId });
    track('simulado_entregue', { dia: s.dia, modo: s.modo, acertos: score.total.c, total: score.total.n, tempo_min: Math.round(segundos / 60), tempo_esgotado: timeUp });
    mount(result(ctx, s, score, segundos, timeUp));
  }

  function result(ctx, s, score, segundos, timeUp) {
    const { edital, byId, res } = ctx;
    let filter = 'erradas';
    const list = h('ol', { class: 'sim-review' });
    const filterBtns = [['erradas', 'Erradas e em branco'], ['todas', 'Todas']].map(([id, label]) => h('button', {
      type: 'button', 'aria-pressed': String(id === filter),
      onClick: () => { filter = id; filterBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (id === 'erradas' ? 0 : 1)))); fill(); },
    }, label));

    // reviewItem - questão corrigida, recolhida; abre com texto, alternativas e resolução
    const reviewItem = (it, i) => {
      const q = byId.get(it.id);
      const given = s.answers[it.id];
      const ok = given === q.resposta;
      const status = ok ? 'certa' : given ? `marcou ${given}, certa ${q.resposta}` : `em branco, certa ${q.resposta}`;
      const details = h('details', { class: 'sim-review-item' },
        h('summary', {},
          h('span', { class: `sim-mark ${ok ? 'is-right' : 'is-wrong'}` }, icon(ok ? 'check' : 'x')),
          h('span', { class: 'sim-review-n', text: `${i + 1}.` }),
          h('span', { class: 'sim-review-mat', text: edital.materiaById(it.materia)?.nome ?? it.materia }),
          h('span', { class: 'sim-review-status', text: status })));
      details.addEventListener('toggle', () => {
        if (!details.open || details.dataset.ready) return;
        details.dataset.ready = '1';
        const chosen = LETTERS.indexOf(given);
        details.append(h('div', { class: 'sim-review-body' },
          h('p', { class: 'quiz-source', text: sourceLine(q) }),
          questionBody(q, { questionId: `sim-r-${i}`, prefix: '' }),
          h('ul', { class: 'quiz-res-alts' }, q.alternativas.map((t, k) => h('li', { class: k === LETTERS.indexOf(q.resposta) ? 'is-correct' : k === chosen ? 'is-chosen' : '' },
            h('span', { class: 'quiz-res-letter', 'aria-hidden': 'true' }, LETTERS[k]), h('p', {}, t)))),
          res[q.id] ? resolutionPanel(q, res[q.id], chosen).el : null));
      });
      return h('li', {}, details);
    };
    const fill = () => {
      const rows = s.items.map((it, i) => ({ it, i })).filter(({ it }) => byId.has(it.id)
        && (filter === 'todas' || s.answers[it.id] !== byId.get(it.id).resposta));
      list.replaceChildren(...(rows.length ? rows.map(({ it, i }) => reviewItem(it, i)) : [h('li', {}, emptyBlock('Você acertou todas. Excelente!'))]));
    };
    fill();

    const areaRows = quotas(s.dia, s.modo).map((a) => {
      const sc = score.byArea[a.nome] ?? { c: 0, n: 0 };
      return h('li', { class: 'perf-row' },
        h('span', {}, h('strong', { text: a.nome }),
          h('small', { class: 'perf-sub', text: Object.keys(a.materias).map((m) => {
            const ms = score.byMateria[m];
            return `${edital.materiaById(m)?.nome ?? m} ${ms ? `${ms.c}/${ms.n}` : '—'}`;
          }).join(' · ') })),
        meter(sc, `Acerto em ${a.nome}`),
        h('span', { class: 'perf-n', text: `${pct(sc)} · ${sc.c}/${sc.n}` }));
    });

    const title = h('h2', { class: 'card-title sim-score-title', tabindex: '-1' }, timeUp ? 'Tempo esgotado' : 'Simulado entregue');
    queueMicrotask(() => title.focus());
    return h('div', { class: 'sim' },
      h('section', { class: 'card surface sim-score', 'aria-labelledby': 'sim-score-title' },
        title,
        h('p', { class: 'figure' }, String(score.total.c), h('small', { text: ` de ${score.total.n} · ${pct(score.total)}` })),
        h('p', { class: 'settings-desc', text: `${s.dia}º dia · ${MODOS[s.modo].nome} · ${duration(segundos)} de ${duration(MODOS[s.modo].minutos * 60)}. As questões que você errou foram para o caderno de erros.` }),
        h('ul', { class: 'perf-list' }, areaRows),
        h('div', { class: 'quiz-actions' },
          h('a', { class: 'btn btn-quiet', href: '#/revisao' }, 'Abrir caderno de erros'),
          h('button', { class: 'btn btn-primary', type: 'button', onClick: () => mount(start(ctx)) }, icon('rotate-ccw'), 'Novo simulado'))),
      h('section', { class: 'card surface', 'aria-labelledby': 'sim-gab' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'sim-gab' }, 'Gabarito comentado')),
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'Filtrar questões' }, filterBtns),
        list));
  }

  load();
  return { el, title: 'Simulado', destroy: () => offs.forEach((off) => off()) };
}
