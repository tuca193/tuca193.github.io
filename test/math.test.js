import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMath } from '../js/lib/math.js';

test('splitMath separa texto, fórmula no meio da frase e fórmula em destaque', () => {
  const parts = splitMath('A velocidade é $v = \\dfrac{d}{t}$, logo $$v = 20\\,\\text{m/s}$$ fim');
  assert.deepEqual(parts.map((p) => p.t), ['text', 'inline', 'text', 'block', 'text']);
  assert.equal(parts[1].v, 'v = \\dfrac{d}{t}');
  assert.equal(parts[3].v, 'v = 20\\,\\text{m/s}');
});

test('splitMath deixa "R$" sem par como texto', () => {
  assert.deepEqual(splitMath('Custa R$ 20,00 no total').map((p) => p.t), ['text']);
});

test('splitMath não confunde dois valores em reais com uma fórmula', () => {
  const parts = splitMath('Paga R$ 20,00 e recebe R$ 30,00 de troco, e $x = 2$');
  assert.deepEqual(parts.map((p) => p.t), ['text', 'inline']);
  assert.equal(parts[0].v, 'Paga R$ 20,00 e recebe R$ 30,00 de troco, e ');
});
