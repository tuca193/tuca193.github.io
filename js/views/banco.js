// banco de questões: área administrativa trancada por senha, com distribuição, ações e log em tempo real
import { h, icon, skeletonLine } from '../lib/dom.js';
import { plural } from '../lib/text.js';
import { applyOverrides } from '../lib/overrides.js';
import { sourceShort } from '../lib/source.js';
import { withEdital, errorBlock, emptyBlock } from '../ui/states.js';
import { openModal, toast } from '../ui/feedback.js';
import { examDays } from '../ui/exam-days.js';
import { loadRaw } from '../data/questoes.js';
import { onOverrides, onLog, onAdmin, signInAdmin, signOutAdmin, commit, ADMIN_EMAIL } from '../data/remote.js';

// só o hash das senhas fica no código
const ACCESS_HASH = '46e9d22f3bc04be7b03d294863485433241dc2488d35e270666367f452698252';
const CONFIRM_HASH = '045c811f2240f6957e1b0bcb2565e8c2f452f289e8fb9ee3eb73e014ee06e9ae';
const UNLOCK_KEY = 'ssa2:banco';
const PAGE = 40;
const TIME_FMT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Recife' });
const ACTIONS = { mover: 'Moveu', remover: 'Removeu', restaurar: 'Restaurou' };

// sha256 - hash hexadecimal de um texto
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isUnlocked() {
  try { return sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch { return false; }
}

function setUnlocked() {
  try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch { /* sem storage: vale só nesta tela */ }
}

// preview - começo da pergunta para identificar a questão
function preview(q) {
  const ask = q.comando.find((b) => b.t === 'pergunta') || q.comando[0];
  const text = ask?.texto || '';
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

// passwordField - campo de senha com rótulo e erro
function passwordField(id, label) {
  const input = h('input', { class: 'input', id, type: 'password', inputmode: 'numeric', autocomplete: 'off', required: true });
  const error = h('p', { class: 'field-error', id: `${id}-err`, hidden: true });
  input.setAttribute('aria-describedby', error.id);
  const field = h('div', { class: 'field' }, h('label', { for: id }, label), input, error);
  const fail = (msg) => {
    error.replaceChildren(icon('circle-alert'), msg);
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.select();
    input.focus();
  };
  input.addEventListener('input', () => { error.hidden = true; input.removeAttribute('aria-invalid'); });
  return { field, input, fail };
}

// lockScreen - pede a senha de acesso antes de mostrar a área
function lockScreen(onOpen) {
  const pw = passwordField('banco-senha', 'Senha de acesso');
  const form = h('form', { class: 'card surface bank-lock', novalidate: true },
    h('div', { class: 'bank-lock-icon' }, icon('lock')),
    h('h2', { class: 'card-title' }, 'Área restrita'),
    h('p', { class: 'settings-desc' }, 'Digite a senha para ver e administrar o banco de questões.'),
    pw.field,
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Entrar'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pw.input.value) return pw.fail('Digite a senha.');
    if (await sha256(pw.input.value) !== ACCESS_HASH) return pw.fail('Senha incorreta.');
    setUnlocked();
    onOpen();
  });
  queueMicrotask(() => pw.input.focus());
  return form;
}

// confirmAction - diálogo da ação com a segunda senha; resolve com os dados escolhidos ou null
function confirmAction({ title, text, danger, confirmLabel, extra }) {
  return openModal((close) => {
    const pw = passwordField('banco-senha-2', 'Senha de confirmação');
    const ok = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'submit' }, confirmLabel);
    const form = h('form', { class: 'modal-body', novalidate: true },
      h('h2', { class: 'modal-title', text: title }),
      h('p', { class: 'modal-text', text }),
      extra?.el,
      pw.field,
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => close(null) }, 'Cancelar'), ok));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (extra && !extra.valid()) return;
      if (!pw.input.value) return pw.fail('Digite a senha de confirmação.');
      if (await sha256(pw.input.value) !== CONFIRM_HASH) return pw.fail('Senha de confirmação incorreta.');
      close(extra ? extra.value() : true);
    });
    queueMicrotask(() => (extra?.focus || pw.input).focus());
    return form;
  }, { label: title, dismissOnBackdrop: false });
}

// topicSelect - escolha do assunto de destino, agrupada por matéria
function topicSelect(edital, current) {
  const select = h('select', { class: 'input', id: 'banco-destino' },
    edital.materias.map((m) => h('optgroup', { label: m.nome },
      h('option', { value: `${m.id}|` }, `${m.nome} · geral (sem assunto)`),
      m.assuntos.map((a) => h('option', { value: `${m.id}|${a.id}` }, a.nome)))));
  select.value = `${current.materia}|${current.assunto ?? ''}`;
  const start = select.value;
  const error = h('p', { class: 'field-error', hidden: true }, icon('circle-alert'), 'Escolha um destino diferente do atual.');
  return {
    el: h('div', { class: 'field' }, h('label', { for: 'banco-destino' }, 'Mover para'), select, error),
    focus: select,
    valid: () => { error.hidden = select.value !== start; return select.value !== start; },
    value: () => {
      const [materia, assunto] = select.value.split('|');
      return { materia, assunto: assunto || null };
    },
  };
}

function skeleton() {
  return h('div', { class: 'bank' },
    h('div', { class: 'bank-stats' }, Array.from({ length: 4 }, () => h('div', { class: 'card surface' }, skeletonLine('5rem', 12), skeletonLine('4rem', 32)))),
    h('div', { class: 'card surface' }, Array.from({ length: 6 }, () => skeletonLine('100%', 18))));
}

export function render() {
  const offs = [];
  const body = h('div', {});
  const el = h('section', { class: 'bank-view', 'aria-labelledby': 'banco-title' },
    h('div', { class: 'page-head' }, h('div', {},
      h('h1', { class: 'page-title', id: 'banco-title' }, 'Banco de questões'),
      h('p', { class: 'page-sub' }, 'Distribuição, administração e registro de alterações'))),
    body);

  const open = () => withEdital(body, skeleton, (edital) => {
    const host = h('div', {}, skeleton());
    loadRaw()
      .then((raw) => host.isConnected && host.replaceChildren(admin(edital, raw)))
      .catch(() => host.isConnected && host.replaceChildren(errorBlock('Não consegui carregar o banco de questões.', open)));
    return host;
  });

  // admin - a área já destrancada
  function admin(edital, raw) {
    let overrides = new Map();
    let user = null;
    let materiaFilter = '';
    let topicFilter = '';
    let statusFilter = 'ativas';
    let search = '';
    let shown = PAGE;
    const byId = new Map(raw.map((q) => [q.id, q]));
    const topicName = (id) => (id ? edital.topic(id)?.assunto.nome ?? id : 'Geral da matéria');
    const materiaName = (id) => edital.materiaById(id)?.nome ?? id;
    const where = (q) => `${materiaName(q.materia)} › ${topicName(q.assunto)}`;

    /* ---------- conexão e administrador ---------- */

    const conn = h('p', { class: 'bank-conn' });
    const who = h('div', { class: 'bank-who' });
    const isAdmin = () => user?.email === ADMIN_EMAIL;
    const renderWho = () => {
      if (isAdmin()) {
        who.replaceChildren(h('span', {}, 'Administrador: ', h('strong', { text: user.email })),
          h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => signOutAdmin() }, 'Sair'));
      } else {
        who.replaceChildren(
          h('span', { class: 'settings-desc' }, user ? `${user.email} não é o administrador.` : 'Para alterar o banco, entre com a conta Google do administrador.'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: () => (user ? signOutAdmin() : Promise.resolve()).then(signInAdmin)
              .catch((e) => e?.code !== 'auth/popup-closed-by-user' && toast('Não consegui entrar com o Google.', { error: true })),
          }, 'Entrar com Google'));
      }
      update();
    };

    /* ---------- distribuição ---------- */

    const stats = h('div', { class: 'bank-stats' });
    const dist = h('div', { class: 'bank-dist' });

    const stat = (label, value) => h('div', { class: 'card surface bank-stat' }, h('p', { class: 'label', text: label }), h('p', { class: 'figure', text: String(value) }));

    function renderDistribution(active) {
      const removed = raw.length - active.length;
      const moved = [...overrides.values()].filter((o) => !o.removido).length;
      const enem = active.filter((q) => q.fonte === 'enem').length;
      stats.replaceChildren(
        stat('Questões ativas', active.length),
        stat('UPE · ENEM', `${active.length - enem} · ${enem}`),
        stat('Movidas', moved),
        stat('Removidas', removed));

      const count = new Map();
      for (const q of active) {
        const k = `${q.materia}|${q.assunto ?? ''}`;
        count.set(k, (count.get(k) || 0) + 1);
      }
      const n = (m, a) => count.get(`${m}|${a ?? ''}`) || 0;
      dist.replaceChildren(...examDays(edital).map((day) => h('section', { class: 'bank-day' },
        h('h3', { class: 'bank-day-title' }, `${day.dia}º dia`),
        day.areas.flatMap((area) => area.materias.map((m) => {
          const mid = m.id;
          const total = active.filter((q) => q.materia === mid).length;
          const pick = (a) => () => {
            materiaFilter = mid;
            topicFilter = a === null ? '-' : a;
            materiaSel.value = mid;
            fillTopics();
            topicSel.value = topicFilter;
            shown = PAGE;
            update();
            listTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
          const row = (label, a) => {
            const c = n(mid, a);
            return h('li', { class: c === 0 ? 'is-empty' : c < 5 ? 'is-low' : '' },
              h('button', { class: 'bank-dist-row', type: 'button', onClick: pick(a) },
                h('span', { text: label }), h('span', { class: 'bank-dist-n', text: String(c) })));
          };
          return h('details', { class: 'bank-mat' },
            h('summary', {}, h('span', { text: m.nome }), h('span', { class: 'bank-dist-n', text: plural(total, 'questão', 'questões') })),
            h('ul', {}, m.assuntos.map((a) => row(a.nome, a.id)), row('Geral da matéria (sem assunto)', null)));
        })))));
    }

    /* ---------- lista de questões ---------- */

    const materiaSel = h('select', { class: 'input', id: 'banco-materia' },
      h('option', { value: '' }, 'Todas as matérias'),
      edital.materias.map((m) => h('option', { value: m.id }, m.nome)));
    const topicSel = h('select', { class: 'input', id: 'banco-assunto' });
    const statusSel = h('select', { class: 'input', id: 'banco-status' },
      h('option', { value: 'ativas' }, 'Ativas'),
      h('option', { value: 'movidas' }, 'Movidas'),
      h('option', { value: 'removidas' }, 'Removidas'),
      h('option', { value: 'todas' }, 'Todas'));
    const searchInput = h('input', { class: 'input', id: 'banco-busca', type: 'search', placeholder: 'id ou trecho do texto' });
    const fillTopics = () => {
      const m = edital.materiaById(materiaFilter);
      topicSel.replaceChildren(h('option', { value: '' }, 'Todos os assuntos'),
        m ? [...m.assuntos.map((a) => h('option', { value: a.id }, a.nome)), h('option', { value: '-' }, 'Geral da matéria')] : []);
      topicSel.disabled = !m;
    };
    fillTopics();
    materiaSel.addEventListener('change', () => { materiaFilter = materiaSel.value; topicFilter = ''; fillTopics(); shown = PAGE; update(); });
    topicSel.addEventListener('change', () => { topicFilter = topicSel.value; shown = PAGE; update(); });
    statusSel.addEventListener('change', () => { statusFilter = statusSel.value; shown = PAGE; update(); });
    searchInput.addEventListener('input', () => { search = searchInput.value.trim().toLowerCase(); shown = PAGE; update(); });

    const listTitle = h('h2', { class: 'card-title', id: 'banco-lista' }, 'Questões');
    const listCount = h('p', { class: 'settings-desc', 'aria-live': 'polite' });
    const list = h('ul', { class: 'bank-list' });
    const more = h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => { shown += PAGE; update(); } });

    // act - executa a ação no banco remoto com log
    async function act(kind, q, current) {
      if (!isAdmin()) {
        toast('Entre com a conta Google do administrador para alterar o banco.', { error: true });
        return;
      }
      let override;
      let entry;
      if (kind === 'mover') {
        const dest = await confirmAction({
          title: 'Mover questão', confirmLabel: 'Mover', extra: topicSelect(edital, current),
          text: `${sourceShort(q)} está em ${where(current)}.`,
        });
        if (!dest) return;
        override = { materia: dest.materia, assunto: dest.assunto, removido: false };
        entry = { acao: 'mover', origem: sourceShort(q), de: where(current), para: where(dest) };
      } else if (kind === 'remover') {
        const ok = await confirmAction({
          title: 'Remover questão', confirmLabel: 'Remover', danger: true,
          text: `${sourceShort(q)} sai do quiz em todos os aparelhos. Dá para restaurar depois.`,
        });
        if (!ok) return;
        override = { materia: current.materia, assunto: current.assunto, removido: true };
        entry = { acao: 'remover', origem: sourceShort(q), de: where(current), para: null };
      } else {
        const ok = await confirmAction({
          title: 'Restaurar questão', confirmLabel: 'Restaurar',
          text: `${sourceShort(q)} volta ao quiz em ${where(current)}.`,
        });
        if (!ok) return;
        override = { materia: current.materia, assunto: current.assunto, removido: false };
        entry = { acao: 'restaurar', origem: sourceShort(q), de: null, para: where(current) };
      }
      try {
        await commit({ questao: q.id, override, entry });
        toast('Alteração salva e enviada a todos os aparelhos.');
      } catch (e) {
        toast(e?.code === 'permission-denied' ? 'O banco recusou: esta conta não tem permissão.' : 'Não consegui salvar a alteração. Verifique a conexão.', { error: true });
      }
    }

    function questionRow(q) {
      const o = overrides.get(q.id);
      const current = o ? { materia: o.materia ?? q.materia, assunto: o.assunto === undefined ? q.assunto : o.assunto } : q;
      const removed = Boolean(o?.removido);
      const moved = o && !removed && (current.materia !== q.materia || current.assunto !== q.assunto);
      return h('li', { class: `bank-q${removed ? ' is-removed' : ''}` },
        h('div', { class: 'bank-q-main' },
          h('p', { class: 'bank-q-meta' },
            h('span', { class: 'quiz-tag', text: q.id }),
            h('span', { text: sourceShort(q) }),
            removed ? h('span', { class: 'pill', text: 'removida' }) : null,
            moved ? h('span', { class: 'pill', text: 'movida' }) : null),
          h('p', { class: 'bank-q-where', text: where(current) }),
          moved ? h('p', { class: 'bank-q-orig', text: `Original: ${where(q)}` }) : null,
          h('p', { class: 'bank-q-text', text: preview(q) })),
        h('div', { class: 'bank-q-actions' },
          removed
            ? h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => act('restaurar', q, current) }, icon('rotate-ccw'), 'Restaurar')
            : [
              h('button', { class: 'btn btn-quiet', type: 'button', onClick: () => act('mover', q, current) }, icon('arrow-left-right'), 'Mover'),
              h('button', { class: 'btn btn-quiet bank-danger', type: 'button', onClick: () => act('remover', q, current) }, icon('trash'), 'Remover'),
            ]));
    }

    function renderList(active) {
      const activeIds = new Set(active.map((q) => q.id));
      const effective = new Map(applyOverrides(raw, new Map([...overrides].map(([k, v]) => [k, { ...v, removido: false }]))).map((q) => [q.id, q]));
      const rows = raw.filter((q) => {
        const cur = effective.get(q.id);
        const isActive = activeIds.has(q.id);
        if (statusFilter === 'ativas' && !isActive) return false;
        if (statusFilter === 'removidas' && isActive) return false;
        if (statusFilter === 'movidas' && !(overrides.has(q.id) && isActive && (cur.materia !== q.materia || cur.assunto !== q.assunto))) return false;
        if (materiaFilter && cur.materia !== materiaFilter) return false;
        if (topicFilter === '-' && cur.assunto !== null) return false;
        if (topicFilter && topicFilter !== '-' && cur.assunto !== topicFilter) return false;
        if (search && !q.id.toLowerCase().includes(search) && !preview(q).toLowerCase().includes(search)) return false;
        return true;
      });
      listCount.textContent = plural(rows.length, 'questão encontrada', 'questões encontradas');
      list.replaceChildren(...rows.slice(0, shown).map(questionRow));
      if (!rows.length) list.replaceChildren(h('li', {}, emptyBlock('Nenhuma questão com esses filtros.')));
      more.hidden = rows.length <= shown;
      more.textContent = `Mostrar mais ${Math.min(PAGE, rows.length - shown)}`;
    }

    /* ---------- log ---------- */

    const log = h('ol', { class: 'bank-log' }, h('li', { class: 'settings-desc' }, 'Carregando o registro…'));
    const renderLog = (entries) => {
      if (!entries.length) {
        log.replaceChildren(h('li', {}, emptyBlock('Nenhuma alteração registrada ainda.')));
        return;
      }
      log.replaceChildren(...entries.map((e) => {
        const at = e.at?.toDate ? e.at.toDate() : null;
        return h('li', { class: `bank-log-row is-${e.acao}` },
          h('time', { datetime: at?.toISOString() ?? '', text: at ? TIME_FMT.format(at) : '—' }),
          h('p', {},
            h('strong', { text: ACTIONS[e.acao] || e.acao }), ' ',
            h('span', { class: 'quiz-tag', text: e.questao }), ' ',
            h('span', { class: 'settings-desc', text: e.origem || (byId.get(e.questao) ? sourceShort(byId.get(e.questao)) : '') })),
          e.de || e.para ? h('p', { class: 'bank-log-path' },
            e.de ? h('span', { text: e.de }) : null,
            e.de && e.para ? ' → ' : null,
            e.para ? h('span', { text: e.para }) : null) : null,
          h('p', { class: 'bank-log-dev', text: e.dispositivo || '' }));
      }));
    };

    function update() {
      const active = applyOverrides(raw, overrides);
      renderDistribution(active);
      renderList(active);
    }

    offs.push(onOverrides(({ status, overrides: o }) => {
      overrides = new Map(o);
      conn.className = `bank-conn is-${status}`;
      conn.textContent = status === 'online' ? 'Conectado ao banco · atualiza em tempo real'
        : status === 'offline' ? 'Sem conexão com o banco remoto · mostrando o banco original'
          : 'Conectando ao banco…';
      update();
    }));
    offs.push(onAdmin((u) => { user = u; renderWho(); }));
    offs.push(onLog(renderLog, () => log.replaceChildren(h('li', {}, errorBlock('Não consegui ler o registro de alterações.')))));
    renderWho();

    return h('div', { class: 'bank' },
      h('div', { class: 'card surface bank-status' }, h('div', { class: 'bank-conn-row' }, icon('database'), conn), who),
      stats,
      h('section', { class: 'card surface', 'aria-labelledby': 'banco-dist' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'banco-dist' }, 'Distribuição por assunto')),
        h('p', { class: 'settings-desc' }, 'Quantas questões ativas cada assunto tem. Assuntos com menos de 5 completam o quiz com outras da matéria. Toque num assunto para listar as questões dele.'),
        dist),
      h('section', { class: 'card surface', 'aria-labelledby': 'banco-lista' },
        h('div', { class: 'card-head' }, listTitle, listCount),
        h('div', { class: 'bank-filters' },
          h('div', { class: 'field' }, h('label', { for: 'banco-materia' }, 'Matéria'), materiaSel),
          h('div', { class: 'field' }, h('label', { for: 'banco-assunto' }, 'Assunto'), topicSel),
          h('div', { class: 'field' }, h('label', { for: 'banco-status' }, 'Situação'), statusSel),
          h('div', { class: 'field' }, h('label', { for: 'banco-busca' }, 'Buscar'), searchInput)),
        list,
        more),
      h('section', { class: 'card surface', 'aria-labelledby': 'banco-log' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title', id: 'banco-log' }, 'Registro de alterações')),
        log));
  }

  if (isUnlocked()) open();
  else body.replaceChildren(lockScreen(open));

  return { el, title: 'Banco de questões', destroy: () => offs.forEach((off) => off()) };
}
