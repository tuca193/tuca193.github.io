import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOverrides } from '../js/lib/overrides.js';

const bank = [
  { id: 'a', materia: 'mat', assunto: 'mat-1' },
  { id: 'b', materia: 'mat', assunto: null },
  { id: 'c', materia: 'fis', assunto: 'fis-2' },
];

test('applyOverrides move, remove e mantém o resto', () => {
  const o = new Map([['a', { materia: 'fis', assunto: 'fis-1' }], ['c', { removido: true }]]);
  const out = applyOverrides(bank, o);
  assert.deepEqual(out.map((q) => q.id), ['a', 'b']);
  assert.equal(out[0].assunto, 'fis-1');
  assert.equal(out[0].materia, 'fis');
  assert.equal(bank[0].assunto, 'mat-1');
});

test('applyOverrides aceita mover para geral da matéria', () => {
  const out = applyOverrides(bank, new Map([['a', { materia: 'mat', assunto: null }]]));
  assert.equal(out[0].assunto, null);
});
