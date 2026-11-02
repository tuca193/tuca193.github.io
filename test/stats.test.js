import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorIds, performance, ratio, weakTopics } from '../js/lib/stats.js';

const log = {
  a: { c: 0, e: 2, ok: false, last: '2026-11-01T10:00:00Z' },
  b: { c: 1, e: 0, ok: true, last: '2026-11-01T11:00:00Z' },
  c: { c: 1, e: 1, ok: false, last: '2026-11-01T12:00:00Z' },
  x: { c: 0, e: 1, ok: false, last: '2026-11-01T13:00:00Z' },
};
const bank = [
  { id: 'a', materia: 'mat', assunto: 'mat1' },
  { id: 'b', materia: 'mat', assunto: 'mat1' },
  { id: 'c', materia: 'fis', assunto: null },
];

test('errorIds traz só as erradas na última tentativa, mais recentes primeiro', () => {
  assert.deepEqual(errorIds(log), ['x', 'c', 'a']);
  assert.deepEqual(errorIds(log, new Set(['a', 'b', 'c'])), ['c', 'a']);
});

test('performance soma por matéria e assunto, ignorando questões fora do banco', () => {
  const p = performance(log, bank);
  assert.deepEqual(p.total, { c: 2, n: 5 });
  assert.deepEqual(p.byMateria.mat, { c: 1, n: 3 });
  assert.deepEqual(p.byTopic.mat1, { c: 1, n: 3 });
  assert.equal(p.byTopic.fis, undefined);
  assert.equal(ratio({ c: 0, n: 0 }), null);
});

test('weakTopics exige mínimo de respostas e ordena do pior', () => {
  const byTopic = { t1: { c: 1, n: 4 }, t2: { c: 0, n: 2 }, t3: { c: 2, n: 5 }, t4: { c: 5, n: 5 } };
  assert.deepEqual(weakTopics(byTopic).map((t) => t.id), ['t1', 't3']);
});
