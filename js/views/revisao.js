// revisão: desempenho no quiz por matéria e assunto, pontos fracos e caderno de erros
import { h, icon, skeletonLine } from '../lib/dom.js';
import { plural } from '../lib/text.js';
import { sourceShort } from '../lib/source.js';
import { errorIds, performance, ratio, weakTopics } from '../lib/stats.js';
import { withEdital, errorBlock, emptyBlock } from '../ui/states.js';
import { examDays } from '../ui/exam-days.js';
import { runReview, resolutionPanel } from '../ui/quiz.js';
import { loadQuestoes } from '../data/questoes.js';
import { loadResolucoes } from '../data/resolucoes.js';

const REVIEW_SIZE = 10;
const PAGE = 20;

const pct = (s) => `${Math.round(ratio(s) * 100)}%`;

// preview - começo da pergunta, para reconhecer a questão
function preview(q) {
  const ask = q.comando.find((b) => b.t === 'pergunta') || q.comando[0];
  const text = ask?.texto || '';
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

// meter - barra de aproveitamento com o valor exposto para leitores de tela
function meter(s, label) {
  const r = ratio(s) ?? 0;
  const level = r >= 0.7 ? 'is-good' : r >= 0.5 ? 'is-mid' : 'is-low';
  return h('div', {
    class: `bar perf-bar ${level}`, role: 'meter', 'aria-label': label,
    'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(r * 100), 'aria-valuetext': `${pct(s)} de acerto`,
  }, h('span', { style: `transform:scaleX(${r})` }));
}

function skeleton() {
  return h('div', { class: 'review' },
    h('div', { class: 'card surface' }, skeletonLine('30%', 18), skeletonLine('20%', 36), skeletonLine('100%', 8)),
    h('div', { class: 'card surface' }, Array.from({ length: 5 }, () => skeletonLine('100%', 20))));
}

export function render({ store }) {
  const offs = [];
  const profileId = store.activeProfile()?.id;
  const body = h('div', {});
  const el = h('section', { class: 'review-view', 'aria-labelledby': 'revisao-title' },
    h('div', { class: 'page-head' }, h('div', {},
      h('h1', { class: 'page-title', id: 'revisao-title' }, 'Revisão'),
      h('p', { class: 'page-sub' }, 'Seu desempenho no quiz e as questões que você errou'))),
    body);

  const open = () => withEdital(body, skeleton, (edital) => {
    const host = h('div', {}, skeleton());
    Promise.all([loadQuestoes(), loadResolucoes()])
      .then(([bank, res]) => host.isConnected && host.replaceChildren(view(edital, bank, res)))
      .catch(() => host.isConnected && host.replaceChildren(errorBlock('Não consegui carregar o banco de questões.', open)));
    return host;
  });

  function view(edital, bank, res) {
    const byId = new Map(bank.map((q) => [q.id, q]));
    const valid = new Set(byId.keys());
    const topicName = (id) => edital.topic(id)?.assunto.nome ?? id;
    const where = (q) => `${edital.materiaById(q.materia)?.nome ?? q.materia} › ${q.assunto ? topicName(q.assunto) : 'geral da matéria'}`;
    let materiaFilter = '';
    let shown = PAGE;

    const summary = h('div', {});
    const weak = h('div', {});
    const errCount = h('p', { class: 'settings-desc', 'aria-live': 'polite' });
    const errList = h('ul', { class: 'err-list' });
    const more = h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => { shown += PAGE; update(); } });
    const redo = h('button', { class: 'btn btn-primary', type: 'button' }, icon('rotate-ccw'), h('span', {}));
    const filter = h('select', { class: 'input', id: 'revisao-materia' },
      h('option', { value: '' }, 'Todas as matérias'),
      edital.materias.map((m) => h('option', { value: m.id }, m.nome)));
    filter.addEventListener('change', () => { materiaFilter = filter.value; shown = PAGE; update(); });

    const record = (qid, ok) => store.recordAnswer(qid, ok, { profileId });
    const currentErrors = () => errorIds(store.quizLog(), valid).filter((id) => !materiaFilter || byId.get(id).materia === materiaFilter);
    redo.addEventListener('click', () => {
      const ids = currentErrors().slice(0, REVIEW_SIZE);
      if (ids.length) runReview(ids, { onAnswer: record, title: materiaFilter ? `Erros de ${edital.materiaById(materiaFilter).nome}` : 'Caderno de erros' });
    });

    // errorItem - questão errada com origem, onde está no edital e a resolução recolhível
    const errorItem = (q, log) => {
      const r = res[q.id];
      const toggle = h('button', { class: 'btn btn-quiet', type: 'button', 'aria-expanded': 'false' }, 'Ver resolução');
      const panelHost = h('div', {});
      toggle.addEventListener('click', () => {
        const opened = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(opened));
        toggle.textContent = opened ? 'Esconder resolução' : 'Ver resolução';
        panelHost.replaceChildren(opened ? resolutionPanel(q, r, -1).el : '');
      });
      const single = h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => runReview([q.id], { onAnswer: record, title: 'Refazer questão' }) }, icon('rotate-ccw'), 'Refazer');
      return h('li', { class: 'err-item' },
        h('p', { class: 'bank-q-meta' }, h('span', { text: sourceShort(q) }),
          h('span', { class: 'pill', text: `errou ${plural(log.e, 'vez', 'vezes')}` })),
        h('p', { class: 'bank-q-where', text: where(q) }),
        h('p', { class: 'bank-q-text', text: preview(q) }),
        h('div', { class: 'err-actions' }, single, r ? toggle : null),
        panelHost);
    };

    function update() {
      const log = store.quizLog();
      const perf = performance(log, bank);

      // desempenho por dia de prova e matéria
      if (!perf.total.n) {
        summary.replaceChildren(emptyBlock('Responda os quizzes de verificação dos assuntos para ver seu desempenho aqui.'));
      } else {
        summary.replaceChildren(
          h('p', { class: 'figure' }, pct(perf.total), h('small', { text: ` de acerto em ${plural(perf.total.n, 'resposta', 'respostas')}` })),
          ...examDays(edital).map((day) => h('div', { class: 'perf-day' },
            h('h3', { class: 'area-title', text: `${day.dia}º dia` }),
            h('ul', { class: 'perf-list' }, day.materias.map((m) => {
              const s = perf.byMateria[m.id];
              return h('li', { class: 'perf-row' },
                h('a', { href: `#/materia/${m.id}`, text: m.nome }),
                s ? meter(s, `Acerto em ${m.nome}`) : h('span', { class: 'perf-none' }),
                h('span', { class: 'perf-n', text: s ? `${pct(s)} · ${s.c}/${s.n}` : 'sem respostas' }));
            })))));
      }

      // pontos fracos: assuntos com poucas respostas certas
      const weakList = weakTopics(perf.byTopic);
      weak.replaceChildren(weakList.length
        ? h('ul', { class: 'perf-list' }, weakList.map((t) => {
          const info = edital.topic(t.id);
          return h('li', { class: 'perf-row' },
            h('a', { href: `#/materia/${info.materia.id}` }, info.assunto.nome, h('small', { class: 'perf-sub', text: info.materia.nome })),
            meter(t, `Acerto em ${info.assunto.nome}`),
            h('span', { class: 'perf-n', text: `${pct(t)} · ${t.c}/${t.n}` }));
        }))
        : emptyBlock(perf.total.n ? 'Nenhum assunto abaixo de 70% de acerto (com pelo menos 3 respostas). Bom trabalho!' : 'Aparecem aqui os assuntos em que você mais erra.'));

      // caderno de erros
      const ids = currentErrors();
      errCount.textContent = ids.length ? plural(ids.length, 'questão para revisar', 'questões para revisar') : '';
      redo.hidden = !ids.length;
      redo.lastChild.textContent = `Refazer ${Math.min(ids.length, REVIEW_SIZE)} ${Math.min(ids.length, REVIEW_SIZE) === 1 ? 'questão' : 'questões'}`;
      errList.replaceChildren(...(ids.length
        ? ids.slice(0, shown).map((id) => errorItem(byId.get(id), log[id]))
        : [h('li', {}, emptyBlock(materiaFilter ? 'Nenhum erro pendente nesta matéria.' : 'Nenhum erro pendente. Quando errar uma questão no quiz, ela aparece aqui para você refazer.'))]));
      more.hidden = ids.length <= shown;
      more.textContent = `Mostrar mais ${Math.min(PAGE, ids.length - shown)}`;
    }

    update();
    offs.push(store.subscribe(update));

    return h('div', { class: 'review' },
      h('section', { class: 'card surface', 'aria-labelledby': 'revisao-desempenho' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'revisao-desempenho' }, 'Desempenho por matéria')),
        summary),
      h('section', { class: 'card surface', 'aria-labelledby': 'revisao-fracos' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'revisao-fracos' }, 'Pontos fracos')),
        h('p', { class: 'settings-desc' }, 'Assuntos com menos de 70% de acerto. Releia o conteúdo e refaça os erros deles.'),
        weak),
      h('section', { class: 'card surface', 'aria-labelledby': 'revisao-erros' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'revisao-erros' }, 'Caderno de erros'), errCount),
        h('p', { class: 'settings-desc' }, 'Toda questão que você erra fica aqui. Ela sai do caderno quando você acerta ao refazer.'),
        h('div', { class: 'err-tools' },
          h('div', { class: 'field' }, h('label', { for: 'revisao-materia' }, 'Matéria'), filter),
          redo),
        errList,
        more));
  }

  open();
  return { el, title: 'Revisão', destroy: () => offs.forEach((off) => off()) };
}
