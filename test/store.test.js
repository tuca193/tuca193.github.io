import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store/store.js';
import { STORAGE_KEY, LEGACY_KEY } from '../js/store/storage.js';
import { fakeStorage, throwingStorage, fakeWindow, seqIds, fixedNow } from './helpers.js';

const knownIds = ['port0', 'port1', 'mat0', 'mat1'];
const make = (storage, extra = {}) =>
  createStore({ storage, knownIds, now: fixedNow(), newId: seqIds(extra.prefix ?? 'p'), win: null, ...extra });

test('isolamento entre perfis', () => {
  const store = make(fakeStorage());
  const a = store.createProfile('Ana').profile;
  store.toggle('port0');
  const b = store.createProfile('Bia').profile;
  assert.equal(store.activeProfile().id, b.id);
  assert.equal(store.doneCount(knownIds), 0);
  assert.equal(store.isDone('port0'), false);
  store.selectProfile(a.id);
  assert.equal(store.isDone('port0'), true);
  assert.equal(store.doneAt('port0'), '2026-10-30T12:00:00.000Z');
  assert.equal(store.doneCount(knownIds), 1);
});

test('topico desconhecido e ignorado', () => {
  const s = fakeStorage();
  const store = make(s);
  store.createProfile('Ana');
  assert.equal(store.toggle('xyz'), false);
  assert.equal(store.doneAt('xyz'), null);
  assert.deepEqual(JSON.parse(s.getItem(STORAGE_KEY)).data.p1.done, {});
});

test('cada mutacao salva e notifica', () => {
  const s = fakeStorage();
  const store = make(s);
  const seen = [];
  const off = store.subscribe((state) => seen.push(state.profiles.length));
  store.createProfile('Ana');
  store.createProfile('Bia');
  off();
  store.createProfile('Caio');
  assert.deepEqual(seen, [1, 2]);
  assert.equal(JSON.parse(s.getItem(STORAGE_KEY)).profiles.length, 3);
});

test('erros de perfil retornam mensagem', () => {
  const store = make(fakeStorage());
  store.createProfile('Ana');
  assert.deepEqual(store.createProfile('ANA'), { ok: false, error: 'Já existe um perfil com esse nome.' });
  assert.equal(store.validateName(''), 'Digite um nome.');
  assert.equal(store.renameProfile('nada', 'X').error, 'Perfil não encontrado.');
  assert.equal(store.renameProfile('p1', 'Ana Luiza').profile.name, 'Ana Luiza');
});

test('remover perfis', () => {
  const store = make(fakeStorage());
  store.createProfile('Ana');
  store.createProfile('Bia');
  assert.equal(store.removeProfile('p2').ok, true);
  assert.equal(store.activeProfile().id, 'p1');
  store.removeProfile('p1');
  assert.equal(store.activeProfile(), null);
  assert.equal(store.getState().activeId, null);
  assert.equal(store.toggle('port0'), false);
});

test('duas abas no mesmo storage nao se sobrescrevem', () => {
  const s = fakeStorage();
  const setup = make(s);
  setup.createProfile('Ana');
  const tab2 = make(s, { prefix: 't2-' });
  const tab1 = make(s, { prefix: 't1-' });
  tab1.toggle('port0');
  tab2.toggle('mat1');
  const done = JSON.parse(s.getItem(STORAGE_KEY)).data.p1.done;
  assert.deepEqual(Object.keys(done).sort(), ['mat1', 'port0']);
  assert.equal(tab2.isDone('port0'), true);
});

test('evento storage recarrega e notifica', () => {
  const s = fakeStorage();
  const win = fakeWindow();
  const store = make(s, { win });
  const other = make(s, { prefix: 'o' });
  other.createProfile('Ana');
  let calls = 0;
  store.subscribe(() => calls++);
  win.dispatch({ key: 'outra-chave' });
  assert.equal(calls, 0);
  win.dispatch({ key: STORAGE_KEY });
  assert.equal(calls, 1);
  assert.equal(store.activeProfile().name, 'Ana');
  store.destroy();
  other.toggle('port0');
  win.dispatch({ key: STORAGE_KEY });
  assert.equal(calls, 1);
});

test('migracao do legado persiste e filtra ids desconhecidos', () => {
  const s = fakeStorage({ [LEGACY_KEY]: JSON.stringify({ port0: true, velho: true }) });
  const store = make(s);
  assert.equal(store.activeProfile().name, 'Meu perfil');
  assert.equal(store.isDone('port0'), true);
  assert.equal(store.doneCount(['port0', 'velho']), 1);
  assert.ok(s.getItem(STORAGE_KEY));
  assert.ok(s.getItem(LEGACY_KEY));
  const again = make(s, { prefix: 'z' });
  assert.equal(again.activeProfile().id, store.activeProfile().id);
});

test('storage que lanca: funciona em memoria e sinaliza falha', () => {
  const store = make(throwingStorage());
  assert.equal(store.lastSaveFailed(), false);
  store.createProfile('Ana');
  store.toggle('port0');
  assert.equal(store.isDone('port0'), true);
  assert.equal(store.lastSaveFailed(), true);
});

test('tema valida valores', () => {
  const s = fakeStorage();
  const store = make(s);
  assert.equal(store.theme(), 'system');
  assert.equal(store.setTheme('neon'), false);
  assert.equal(store.setTheme('dark'), true);
  assert.equal(store.theme(), 'dark');
  assert.equal(JSON.parse(s.getItem(STORAGE_KEY)).prefs.theme, 'dark');
});

test('exportActive e importBackup', () => {
  const store = make(fakeStorage());
  assert.equal(store.exportActive(), null);
  store.createProfile('Ana');
  store.toggle('mat0');
  const backup = store.exportActive();
  const r = store.importBackup(JSON.stringify(backup));
  assert.equal(r.ok, true);
  assert.equal(r.profile.name, 'Ana (2)');
  assert.equal(store.isDone('mat0'), true);
  assert.equal(store.importBackup({ foo: 1 }).ok, false);
  store.resetProgress();
  assert.equal(store.doneCount(knownIds), 0);
  store.selectProfile('p1');
  assert.equal(store.doneCount(knownIds), 1);
});

test('toggle e reset recusam quando o perfil ativo mudou em outra aba', () => {
  const s = fakeStorage();
  const tabA = make(s, { prefix: 'a' });
  const ana = tabA.createProfile('Ana').profile;
  const tabB = make(s, { prefix: 'b' });
  const joao = tabB.createProfile('João').profile;
  tabB.toggle('mat0');
  // a aba A ainda mostra a Ana, mas o ativo no storage é o João
  assert.equal(tabA.toggle('port0', { profileId: ana.id }), false);
  assert.deepEqual(tabA.resetProgress(ana.id), { ok: false, error: 'O perfil ativo mudou em outra aba. Tente de novo.' });
  const fresh = make(s, { prefix: 'c' });
  assert.equal(fresh.activeProfile().id, joao.id);
  assert.equal(fresh.isDone('mat0'), true);
  assert.equal(fresh.isDone('port0'), false);
  assert.deepEqual(fresh.resetProgress(joao.id), { ok: true });
  assert.equal(fresh.isDone('mat0'), false);
});

test('dados apagados em outra aba nao sao regravados', () => {
  const s = fakeStorage();
  const store = make(s);
  store.createProfile('Ana');
  s.removeItem(STORAGE_KEY);
  store.toggle('port0');
  assert.equal(store.profiles().length, 0);
});

test('com gravacao falhando, mudancas seguidas nao se perdem', () => {
  const s = fakeStorage();
  const store = make(s);
  store.createProfile('Ana');
  const realSet = s.setItem;
  s.setItem = () => { throw new Error('quota'); };
  store.toggle('port0');
  store.toggle('mat0');
  assert.equal(store.lastSaveFailed(), true);
  assert.equal(store.isDone('port0'), true);
  assert.equal(store.isDone('mat0'), true);
  s.setItem = realSet;
});

test('listener removido durante a notificacao nao e chamado', () => {
  const store = make(fakeStorage());
  let calls = 0;
  let offB = null;
  store.subscribe(() => offB());
  offB = store.subscribe(() => { calls++; });
  store.createProfile('Ana');
  assert.equal(calls, 0);
});

test('recordAnswer acumula acertos e erros por questão no perfil ativo', () => {
  const store = make(fakeStorage());
  store.createProfile('Ana');
  store.recordAnswer('q1', false);
  store.recordAnswer('q1', true);
  store.recordAnswer('q2', false);
  assert.equal(store.quizLog().q1.c, 1);
  assert.equal(store.quizLog().q1.e, 1);
  assert.equal(store.quizLog().q1.ok, true);
  assert.equal(store.quizLog().q2.ok, false);
  store.createProfile('Bia');
  assert.deepEqual(store.quizLog(), {});
  store.resetProgress();
  assert.deepEqual(store.quizLog(), {});
});
