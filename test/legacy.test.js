import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingProfiles, takeProfile, importInto, SAFETY_KEY } from '../js/data/legacy.js';
import { STORAGE_KEY, normalize } from '../js/store/storage.js';
import { fakeStorage } from './helpers.js';

const T = '2026-11-01T10:00:00.000Z';
const antigo = {
  version: 2, activeId: 'a',
  profiles: [{ id: 'a', name: 'Arthur', createdAt: T }, { id: 'b', name: 'Irmã', createdAt: T }, { id: 'c', name: 'Vazio', createdAt: T }],
  data: {
    a: { done: { port0: T, mat1: T }, quiz: { q1: { c: 1, e: 1, ok: true, last: T } } },
    b: { done: { his0: T } },
    c: { done: {} },
  },
  prefs: { theme: 'dark' },
};
const conta = normalize({ version: 2, activeId: 'u1', profiles: [{ id: 'u1', name: 'Arthur S', createdAt: T }], data: { u1: { done: { geo1: T } } } });

test('pendingProfiles lista só perfis com progresso', () => {
  const s = fakeStorage({ [STORAGE_KEY]: JSON.stringify(antigo) });
  assert.deepEqual(pendingProfiles(s).map((p) => [p.name, p.assuntos, p.questoes]), [['Arthur', 2, 1], ['Irmã', 1, 0]]);
});

test('takeProfile guarda cópia de segurança e mantém os outros perfis', () => {
  const s = fakeStorage({ [STORAGE_KEY]: JSON.stringify(antigo) });
  const data = takeProfile(s, 'a');
  assert.deepEqual(Object.keys(data.done), ['port0', 'mat1']);
  assert.equal(s.getItem(SAFETY_KEY), JSON.stringify(antigo));
  assert.deepEqual(pendingProfiles(s).map((p) => p.name), ['Irmã']);
});

test('takeProfile do último perfil com progresso limpa o progresso antigo, mas a cópia fica', () => {
  const s = fakeStorage({ [STORAGE_KEY]: JSON.stringify(antigo) });
  takeProfile(s, 'a');
  takeProfile(s, 'b');
  assert.equal(s.getItem(STORAGE_KEY), null);
  assert.deepEqual(pendingProfiles(s), []);
  assert.equal(s.getItem(SAFETY_KEY), JSON.stringify(antigo));
});

test('importInto soma o perfil antigo à conta sem perder o que já estava nela', () => {
  const m = importInto(conta, 'u1', antigo.data.a);
  assert.deepEqual(m.profiles.map((p) => p.id), ['u1']);
  assert.deepEqual(Object.keys(m.data.u1.done).sort(), ['geo1', 'mat1', 'port0']);
  assert.equal(m.data.u1.quiz.q1.c, 1);
});
