// Painel SSA 2 — progresso global + countdown
document.documentElement.classList.add('js');

var DATA = JSON.parse(document.getElementById('ssa-data').textContent);
var KEY = 'ssa2';

var state = {};
try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { state = {}; }

// chaves conhecidas
var KNOWN = {};
DATA.materias.forEach(function (mt) { mt.keys.forEach(function (k) { KNOWN[k] = mt.id; }); });

var done = 0;
KNOWN && Object.keys(KNOWN).forEach(function (k) { if (state[k]) done++; });

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

function syncUI() {
  document.querySelectorAll('[data-prog-bar]').forEach(function (i) {
    var id = i.getAttribute('data-prog-bar');
    var mt = DATA.materias.filter(function (x) { return x.id === id; })[0];
    if (!mt) return;
    var dn = 0;
    mt.keys.forEach(function (k) { if (state[k]) dn++; });
    i.style.transform = 'scaleX(' + (mt.count ? dn / mt.count : 0) + ')';
  });
  document.querySelectorAll('[data-prog-text]').forEach(function (sp) {
    var id = sp.getAttribute('data-prog-text');
    var mt = DATA.materias.filter(function (x) { return x.id === id; })[0];
    if (!mt) return;
    var dn = 0;
    mt.keys.forEach(function (k) { if (state[k]) dn++; });
    sp.textContent = dn + '/' + mt.count;
  });
  document.querySelectorAll('#pf-num').forEach(function (el) { el.textContent = done + '/' + DATA.total; });
  document.querySelectorAll('#pf-i').forEach(function (el) { el.style.transform = 'scaleX(' + (DATA.total ? done / DATA.total : 0) + ')'; });
}

function initTicks() {
  document.querySelectorAll('.tick').forEach(function (b) {
    var on = !!state[b.dataset.key];
    b.setAttribute('aria-pressed', on);
    var li = b.closest('.topic');
    if (li && on) li.classList.add('done');
  });
}

document.addEventListener('click', function (e) {
  var t = e.target;
  var tick = t.closest && t.closest('.tick');
  if (tick) {
    var k = tick.dataset.key;
    if (!KNOWN[k]) return;
    var on = !state[k];
    if (on) { state[k] = true; done++; } else { delete state[k]; done--; }
    tick.setAttribute('aria-pressed', on);
    var li = tick.closest('.topic');
    if (li) li.classList.toggle('done', on);
    save();
    syncUI();
    return;
  }
  var reset = t.closest && t.closest('#pf-reset');
  if (reset && confirm('Apagar todo o progresso salvo neste navegador?')) {
    state = {};
    done = 0;
    save();
    location.reload();
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') document.querySelectorAll('details[open]').forEach(function (d) { d.open = false; });
});

initTicks();
syncUI();

/* ---- countdown ---- */
var PROVAS = [
  { label: '1ª prova', iso: '2026-12-06T13:30:00-03:00', data: '06/12/2026' },
  { label: '2ª prova', iso: '2026-12-13T13:30:00-03:00', data: '13/12/2026' },
];

function renderCountdown() {
  var el = document.getElementById('countdown');
  if (!el) return;
  var now = Date.now();
  var next = null;
  for (var i = 0; i < PROVAS.length; i++) {
    var t = new Date(PROVAS[i].iso).getTime() - now;
    if (t > 0) { next = { ms: t, p: PROVAS[i] }; break; }
  }
  if (!next) {
    el.innerHTML = '<div class="cd-label">Todas as provas foram realizadas — boa sorte no resultado!</div>';
    return;
  }
  var s = Math.floor(next.ms / 1000);
  var units = [
    ['Dias', Math.floor(s / 86400)],
    ['Horas', Math.floor((s % 86400) / 3600)],
    ['Min', Math.floor((s % 3600) / 60)],
    ['Seg', s % 60],
  ];
  var html = '<div class="cd-label">' + next.p.label + ' · ' + next.p.data + ' à tarde</div><div class="cd-units">';
  units.forEach(function (u) {
    html += '<div class="cdu"><b>' + String(u[1]).padStart(2, '0') + '</b><span>' + u[0] + '</span></div>';
  });
  el.innerHTML = html + '</div>';
}

renderCountdown();
setInterval(renderCountdown, 1000);
