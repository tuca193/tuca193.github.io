import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates } from '../js/lib/merge.js';
import { normalize } from '../js/store/storage.js';

const T1 = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-05T10:00:00.000Z';
const sim = (at, c) => ({ dia: 1, modo: 'rapido', c, n: 15, areas: { L: { c, n: 15 } }, segundos: 600, at });

const conta = normalize({
  version: 2, activeId: 'a',
  profiles: [{ id: 'a', name: 'Ana', createdAt: T1 }],
  data: { a: { done: { port0: T2 }, quiz: { q1: { c: 1, e: 0, ok: true, last: T2 } }, simulados: [sim(T1, 5)] } },
  prefs: { theme: 'dark' },
});
const navegador = normalize({
  version: 2, activeId: 'b',
  profiles: [{ id: 'a', name: 'Ana', createdAt: T1 }, { id: 'b', name: 'Ana', createdAt: T1 }, { id: 'c', name: 'Caio', createdAt: T1 }],
  data: {
    a: { done: { port0: T1, mat1: T2 }, quiz: { q1: { c: 1, e: 2, ok: false, last: T1 }, q2: { c: 0, e: 1, ok: false, last: T1 } }, simulados: [sim(T1, 5), sim(T2, 9)] },
    b: { done: { his0: T1 } },
    c: { done: {} },
  },
  prefs: { theme: 'light' },
});

test('mergeStates não perde nenhum perfil nem progresso', () => {
  const m = mergeStates(conta, navegador);
  assert.deepEqual(m.profiles.map((p) => p.id), ['a', 'b', 'c']);
  assert.deepEqual(m.data.a.done, { port0: T1, mat1: T2 });
  assert.equal(m.data.a.quiz.q1.e, 2);
  assert.ok(m.data.a.quiz.q2);
  assert.equal(m.data.a.simulados.length, 2);
  assert.deepEqual(m.data.b.done, { his0: T1 });
});

test('mergeStates renomeia nome repetido de outro perfil e mantém o tema da conta', () => {
  const m = mergeStates(conta, navegador);
  assert.equal(m.profiles.find((p) => p.id === 'b').name, 'Ana (2)');
  assert.equal(m.prefs.theme, 'dark');
  assert.equal(m.activeId, 'b');
});

test('mergeStates é estável: juntar de novo não muda nada', () => {
  const m = mergeStates(conta, navegador);
  assert.deepEqual(mergeStates(m, navegador), m);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(m))), m);
});

test('mergeStates com navegador vazio devolve a conta', () => {
  const m = mergeStates(conta, normalize({}));
  assert.deepEqual(m.profiles, conta.profiles);
  assert.deepEqual(m.data, conta.data);
});
