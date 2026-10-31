// painel: o que estudar agora e se o ritmo fecha o edital antes da prova
import { h, icon, progressBar, skeletonLine } from '../lib/dom.js';
import { plural } from '../lib/text.js';
import { withEdital } from '../ui/states.js';
import { toast } from '../ui/feedback.js';
import { setBar, topicCheck } from '../ui/topic.js';
import { examDays, dayHeader } from '../ui/exam-days.js';
import { nextExam, countdownParts, weeklyPace, formatDate, formatTime, relativeDay, examStatus } from '../lib/dates.js';

const TICK_MS = 30000;
const SWAP_MS = 450;

// listJoin - junta nomes como "a", "a e b", "a, b e c"
function listJoin(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

// pickNext - matéria com menor fração concluída que ainda tem pendente (empate: ordem do edital)
function pickNext(edital, store) {
  let best = null;
  for (const materia of edital.materias) {
    const assunto = materia.assuntos.find((a) => !store.isDone(a.id));
    if (!assunto) continue;
    const ratio = store.doneCount(edital.idsOf(materia)) / materia.assuntos.length;
    if (!best || ratio < best.ratio) best = { ratio, materia, assunto };
  }
  return best;
}

// finding - o achado do dia que vai no subtítulo
function finding(edital, store, now) {
  const marks = edital.ids.map((id) => store.doneAt(id)).filter(Boolean);
  if (!marks.length) return ['Comece por qualquer matéria — o progresso fica salvo neste perfil.'];

  const idle = edital.materias.filter((m) => store.doneCount(edital.idsOf(m)) === 0).map((m) => m.nome);
  if (idle.length > 3) return [`${idle.length} matérias ainda não começaram.`];
  if (idle.length) return [h('strong', {}, listJoin(idle)), idle.length === 1 ? ' ainda não começou.' : ' ainda não começaram.'];

  const today = marks.filter((iso) => relativeDay(iso, now) === 'hoje').length;
  if (today) return [`Você marcou ${plural(today, 'assunto', 'assuntos')} hoje.`];

  const last = marks.reduce((a, b) => (new Date(b) > new Date(a) ? b : a));
  const rel = relativeDay(last, now);
  const near = rel === 'ontem' || rel.startsWith('há ');
  return [`Último assunto marcado ${near ? rel : `em ${rel}`}.`];
}

// examLabel - "1ª prova · domingo, 6 de dezembro, 13h30 (horário a confirmar)"
function examLabel(prova) {
  return `${prova.label} · ${formatDate(prova.inicio)}, ${formatTime(prova.inicio)}${prova.confirmado ? '' : ' (horário a confirmar)'}`;
}

// countdownPhrase - versão falada da contagem
function countdownPhrase({ days, hours, minutes }) {
  if (days) return `Faltam ${plural(days, 'dia', 'dias')} e ${plural(hours, 'hora', 'horas')}`;
  if (hours) return `Faltam ${plural(hours, 'hora', 'horas')} e ${plural(minutes, 'minuto', 'minutos')}`;
  return `Faltam ${plural(minutes, 'minuto', 'minutos')}`;
}

function unit(name) {
  const num = h('span', { class: 'figure' }, '0');
  const label = h('span', { class: 'label' }, name);
  return { el: h('span', { class: 'cd-unit' }, num, label), num, label };
}

function skeleton() {
  const block = (cls, ...lines) => h('div', { class: `card ${cls}` }, ...lines);
  const rows = Array.from({ length: 10 }, () => h('li', { class: 'materia-row is-skeleton' },
    skeletonLine('45%', 16), skeletonLine('65%', 13), skeletonLine('100%', 6)));
  return h('div', { class: 'painel-grid' },
    h('div', { class: 'painel-side' },
      block('glass', skeletonLine('40%', 13), skeletonLine('50%', 36), skeletonLine('100%', 6), skeletonLine('90%', 14)),
      block('glass', skeletonLine('80%', 13), skeletonLine('60%', 36)),
      block('surface', skeletonLine('35%', 16), skeletonLine('45%', 13), skeletonLine('70%', 20), skeletonLine('90%', 14))),
    h('div', { class: 'card surface painel-materias' },
      h('div', { class: 'card-head' }, skeletonLine('30%', 18)),
      h('ul', { class: 'materia-list' }, rows)));
}

export function render({ store }) {
  const profileId = store.activeProfile()?.id;
  const sub = h('p', { class: 'page-sub' }, skeletonLine('320px', 15));
  const cta = h('a', { class: 'btn btn-primary', href: '#/materias' }, 'Continuar estudando', icon('arrow-right'));
  const body = h('div', {});
  const el = h('section', { class: 'painel', 'aria-labelledby': 'painel-title' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', { class: 'page-title', id: 'painel-title' }, 'Painel'), sub),
      cta),
    body);

  let edital = null;
  let ui = null;
  let current = null;
  let swapping = false;
  let timer = 0;
  let swapTimer = 0;

  function updateSub(now) {
    sub.replaceChildren(...finding(edital, store, now));
  }

  function updateStats(now) {
    const done = store.doneCount(edital.ids);
    const remaining = edital.total - done;
    ui.statDone.textContent = String(done);
    ui.statTotal.textContent = `de ${edital.total}`;
    setBar(ui.statBar, done, edital.total);
    const prova = nextExam(edital.provas, now);
    let pace = '';
    if (!remaining) pace = 'Edital completo. Agora é revisar.';
    else if (prova) {
      const perWeek = weeklyPace(remaining, prova.inicio, now);
      if (perWeek) {
        pace = `${remaining === 1 ? 'Falta 1 assunto' : `Faltam ${remaining} assuntos`}. `
          + `Cerca de ${perWeek} por semana fecha o edital antes da ${prova.label}.`;
      }
    }
    ui.pace.textContent = pace;
    ui.pace.hidden = !pace;
  }

  // updateExam - contagem até a próxima prova; prova que começou hoje fica "em andamento" até a meia-noite
  function updateExam(now) {
    const ongoing = edital.provas.find((p) => examStatus(p.inicio, now).phase === 'ongoing');
    const prova = ongoing ? null : nextExam(edital.provas, now);
    ui.countdown.hidden = !prova;
    ui.countdownSr.hidden = !prova;
    if (ongoing) {
      ui.examLabel.textContent = `${ongoing.label} em andamento`;
      return;
    }
    if (!prova) {
      ui.examLabel.textContent = 'As provas do SSA 2 terminaram.';
      return;
    }
    ui.examLabel.textContent = examLabel(prova);
    const parts = countdownParts(new Date(prova.inicio).getTime() - now.getTime());
    ui.days.num.textContent = String(parts.days);
    ui.days.label.textContent = parts.days === 1 ? 'dia' : 'dias';
    ui.hours.num.textContent = String(parts.hours);
    ui.hours.label.textContent = parts.hours === 1 ? 'hora' : 'horas';
    ui.minutes.num.textContent = String(parts.minutes).padStart(2, '0');
    ui.countdownSr.textContent = countdownPhrase(parts);
  }

  function updateMaterias() {
    for (const materia of edital.materias) {
      const row = ui.rows.get(materia.id);
      const total = materia.assuntos.length;
      const done = store.doneCount(edital.idsOf(materia));
      const pending = materia.assuntos.find((a) => !store.isDone(a.id));
      row.count.textContent = `${done}/${total}`;
      row.countSr.textContent = `${done} de ${total} estudados`;
      setBar(row.bar, done, total);
      row.next.classList.toggle('is-done', !pending);
      if (pending) {
        row.next.replaceChildren('Próximo: ', h('span', { class: 'materia-topic' }, pending.nome));
        row.next.title = pending.nome;
      } else {
        row.next.replaceChildren('Concluída');
        row.next.removeAttribute('title');
      }
    }
    for (const { day, el } of ui.dayCounts.values()) {
      el.textContent = `${store.doneCount(day.ids)} de ${day.ids.length} assuntos`;
    }
  }

  function updateNext() {
    current = pickNext(edital, store);
    ui.nextBody.hidden = !current;
    ui.nextDone.hidden = Boolean(current);
    cta.href = current ? `#/materia/${current.materia.id}` : '#/materias';
    if (!current) {
      if (ui.nextBlock.contains(document.activeElement) && document.activeElement !== ui.nextTitle) ui.nextTitle.focus();
      return;
    }
    const { materia, assunto } = current;
    const pos = edital.topic(assunto.id)?.posicao ?? 1;
    ui.nextMeta.textContent = `${materia.nome} · ${pos} de ${materia.assuntos.length}`;
    ui.nextName.textContent = assunto.nome;
    ui.nextResumo.textContent = assunto.resumo || '';
    ui.nextResumo.hidden = !assunto.resumo;
    ui.nextOpen.href = `#/materia/${materia.id}`;
  }

  function update() {
    if (!ui) return;
    const now = new Date();
    updateSub(now);
    updateStats(now);
    updateExam(now);
    updateMaterias();
    if (!swapping) updateNext();
  }

  // afterCheck - mostra a marcação por um instante e troca para o próximo assunto
  function afterCheck() {
    toast('Marcado como estudado.');
    swapTimer = setTimeout(() => {
      swapping = false;
      ui.check.setAttribute('aria-checked', 'false');
      updateNext();
    }, SWAP_MS);
  }

  function build(data) {
    edital = data;
    const rows = new Map();
    const materiaItem = (materia) => {
      const row = {
        next: h('span', { class: 'materia-next' }),
        count: h('span', { class: 'materia-count', 'aria-hidden': 'true' }),
        countSr: h('span', { class: 'sr-only' }),
        bar: progressBar(0, materia.assuntos.length, materia.nome),
      };
      row.bar.setAttribute('aria-hidden', 'true');
      rows.set(materia.id, row);
      return h('li', {}, h('a', { class: 'materia-row', href: `#/materia/${materia.id}` },
        h('span', { class: 'materia-name' }, materia.nome), row.next, row.bar, row.count, row.countSr));
    };
    // matérias agrupadas por dia de prova e, dentro do dia, por área de conhecimento
    const dayCounts = new Map();
    const groups = examDays(edital).map((day) => {
      const count = h('p', { class: 'day-count' });
      dayCounts.set(day.dia, { day, el: count });
      const titleId = `painel-dia-${day.dia}`;
      return h('section', { class: 'day-group', 'aria-labelledby': titleId },
        dayHeader(day, { id: titleId, progress: count }),
        day.areas.map((area) => h('div', { class: 'area-group' },
          h('h4', { class: 'area-title' }, area.nome),
          h('ul', { class: 'materia-list' }, area.materias.map(materiaItem)))));
    });

    const check = topicCheck(store, () => (swapping ? null : current?.assunto), {
      id: 'painel-check',
      profileId,
      onBefore: () => {
        swapping = true;
      },
      onToggle: afterCheck,
      onFail: () => {
        swapping = false;
        updateNext();
      },
    });
    const days = unit('dias');
    const hours = unit('horas');
    const minutes = unit('min');
    ui = {
      rows,
      dayCounts,
      check,
      days,
      hours,
      minutes,
      statDone: h('span', {}),
      statTotal: h('small', {}),
      statBar: progressBar(0, edital.total, 'Assuntos estudados no edital'),
      pace: h('p', { class: 'pace' }),
      examLabel: h('h2', { class: 'label', id: 'painel-exam-title' }),
      countdown: h('p', { class: 'countdown', 'aria-hidden': 'true' }, days.el, hours.el, minutes.el),
      countdownSr: h('p', { class: 'sr-only' }),
      nextTitle: h('h2', { class: 'card-title', id: 'painel-next-title', tabindex: '-1' }, 'Próximo assunto'),
      nextMeta: h('p', { class: 'label' }),
      nextName: h('h3', { class: 'next-name' }),
      nextResumo: h('p', { class: 'next-resumo' }),
      nextOpen: h('a', { class: 'next-open', href: '#/materias' }, 'Abrir matéria', icon('chevron-right')),
    };
    ui.nextBody = h('div', {},
      ui.nextMeta, ui.nextName, ui.nextResumo,
      h('div', { class: 'next-actions' },
        h('div', { class: 'next-mark' }, check, h('label', { for: 'painel-check' }, 'Marcar como estudado')),
        ui.nextOpen));
    ui.nextDone = h('p', { class: 'next-resumo', hidden: true }, 'Todos os assuntos do edital estão marcados. Agora é revisar.');
    ui.nextBlock = h('section', { class: 'card surface next', 'aria-labelledby': 'painel-next-title' },
      ui.nextTitle, ui.nextBody, ui.nextDone);

    const grid = h('div', { class: 'painel-grid' },
      h('div', { class: 'painel-side' },
        h('section', { class: 'card glass stat', 'aria-labelledby': 'painel-stat-title' },
          h('h2', { class: 'label', id: 'painel-stat-title' }, 'Assuntos estudados'),
          h('p', { class: 'figure' }, ui.statDone, ui.statTotal),
          ui.statBar,
          ui.pace),
        h('section', { class: 'card glass', 'aria-labelledby': 'painel-exam-title' },
          ui.examLabel, ui.countdown, ui.countdownSr),
        ui.nextBlock),
      h('section', { class: 'card surface painel-materias', 'aria-labelledby': 'painel-materias-title' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'painel-materias-title' }, 'Matérias por dia de prova')),
        groups));

    update();
    timer = setInterval(() => {
      if (!ui) return;
      const now = new Date();
      updateSub(now);
      updateExam(now);
      updateStats(now);
    }, TICK_MS);
    return grid;
  }

  const off = store.subscribe(update);
  withEdital(body, skeleton, build);

  return {
    el,
    title: 'Painel',
    destroy() {
      off();
      clearInterval(timer);
      clearTimeout(swapTimer);
      ui = null;
    },
  };
}
