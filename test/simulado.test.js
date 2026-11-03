import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIAS, quotas, buildSimulado, scoreSimulado } from '../js/lib/simulado.js';

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const bank = ['port', 'edf', 'ing', 'his', 'geo', 'soc', 'mat', 'bio', 'qui', 'fis']
  .flatMap((m) => Array.from({ length: 30 }, (_, i) => ({ id: `${m}${i}`, materia: m, resposta: 'A' })));

test('cada dia completo tem 45 questões', () => {
  for (const dia of [1, 2]) {
    const n = DIAS[dia].areas.reduce((s, a) => s + Object.values(a.materias).reduce((x, y) => x + y, 0), 0);
    assert.equal(n, 45);
    assert.equal(buildSimulado(bank, dia, { rng: seeded() }).length, 45);
  }
});

test('modo rápido mantém todas as matérias com ao menos uma questão', () => {
  const q = quotas(1, 'rapido');
  const all = q.flatMap((a) => Object.values(a.materias));
  assert.ok(all.every((n) => n >= 1));
  assert.equal(all.reduce((a, b) => a + b, 0), 15);
});

test('buildSimulado segue a ordem do caderno e prioriza questões não respondidas', () => {
  const log = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`mat${i}`, { c: 1, e: 0 }]));
  const items = buildSimulado(bank, 2, { rng: seeded(), log });
  assert.deepEqual([...new Set(items.map((i) => i.materia))], ['mat', 'bio', 'qui', 'fis']);
  const mats = items.filter((i) => i.materia === 'mat').map((i) => i.id);
  assert.equal(new Set(mats).size, 22);
  for (let i = 25; i < 30; i++) assert.ok(mats.includes(`mat${i}`));
});

test('scoreSimulado conta brancos como erro e separa por área e matéria', () => {
  const items = [
    { id: 'mat0', area: 'M', materia: 'mat' },
    { id: 'mat1', area: 'M', materia: 'mat' },
    { id: 'bio0', area: 'N', materia: 'bio' },
  ];
  const byId = new Map(bank.map((q) => [q.id, q]));
  const s = scoreSimulado(items, { mat0: 'A', bio0: 'B' }, byId);
  assert.deepEqual(s.total, { c: 1, n: 3 });
  assert.deepEqual(s.byArea.M, { c: 1, n: 2 });
  assert.deepEqual(s.byMateria.bio, { c: 0, n: 1 });
});
