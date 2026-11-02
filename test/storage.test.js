import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, LEGACY_KEY, emptyState, load, save } from '../js/store/storage.js';
import { fakeStorage, throwingStorage, seqIds, fixedNow } from './helpers.js';

const NOW = '2026-10-30T12:00:00.000Z';
const opts = { now: fixedNow(NOW), newId: seqIds('p') };

test('storage vazio retorna estado vazio', () => {
  assert.deepEqual(load(fakeStorage(), opts), emptyState());
});

test('json corrompido retorna estado vazio', () => {
  const s = fakeStorage({ [STORAGE_KEY]: '{nao e json' });
  assert.deepEqual(load(s, opts), emptyState());
});

test('storage que lanca excecao nao quebra load nem save', () => {
  assert.deepEqual(load(throwingStorage(), opts), emptyState());
  assert.equal(save(throwingStorage(), emptyState()), false);
});

test('save grava e load relê', () => {
  const s = fakeStorage();
  const state = {
    ...emptyState(),
    activeId: 'a',
    profiles: [{ id: 'a', name: 'Ana', createdAt: NOW }],
    data: { a: { done: { port0: NOW }, quiz: { q1: { c: 1, e: 2, ok: false, last: NOW } } } },
  };
  assert.equal(save(s, state), true);
  assert.deepEqual(load(s, opts), state);
});

test('normaliza dados invalidos', () => {
  const raw = {
    version: 2,
    activeId: 'fantasma',
    profiles: [
      { id: 'a', name: ' Ana ' },
      { id: '', name: 'Sem id' },
      { id: 'b' },
      { id: 'a', name: 'Duplicado' },
      null,
    ],
    data: { a: { done: { port0: NOW, mat1: true, mat2: 3 } }, x: { done: { port1: NOW } } },
    prefs: { theme: 'neon' },
  };
  const state = load(fakeStorage({ [STORAGE_KEY]: JSON.stringify(raw) }), opts);
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].name, 'Ana');
  assert.equal(state.profiles[0].createdAt, NOW);
  assert.equal(state.activeId, 'a');
  assert.deepEqual(state.data, { a: { done: { port0: NOW }, quiz: {} } });
  assert.equal(state.prefs.theme, 'system');
});

test('activeId vira null sem perfis', () => {
  const raw = { activeId: 'a', profiles: 'lixo', data: [], prefs: null };
  const state = load(fakeStorage({ [STORAGE_KEY]: JSON.stringify(raw) }), opts);
  assert.deepEqual(state, emptyState());
});

test('migra o formato antigo e mantem a chave antiga', () => {
  const legacy = JSON.stringify({ port0: true, mat3: true, mat4: false, lixo: true });
  const s = fakeStorage({ [LEGACY_KEY]: legacy });
  const state = load(s, opts);
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].name, 'Meu perfil');
  assert.equal(state.activeId, state.profiles[0].id);
  assert.deepEqual(state.data[state.activeId].done, { port0: NOW, mat3: NOW, lixo: NOW });
  assert.equal(s.getItem(LEGACY_KEY), legacy);
});

test('nao migra legado sem itens marcados ou corrompido', () => {
  assert.deepEqual(load(fakeStorage({ [LEGACY_KEY]: '{"port0":false}' }), opts), emptyState());
  assert.deepEqual(load(fakeStorage({ [LEGACY_KEY]: 'xx' }), opts), emptyState());
  assert.deepEqual(load(fakeStorage({ [LEGACY_KEY]: '[true]' }), opts), emptyState());
});

test('nao migra se a chave nova ja existe', () => {
  const s = fakeStorage({ [STORAGE_KEY]: JSON.stringify(emptyState()), [LEGACY_KEY]: '{"port0":true}' });
  assert.deepEqual(load(s, opts), emptyState());
});
