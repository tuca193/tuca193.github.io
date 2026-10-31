import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceLine, sourceShort } from '../js/lib/source.js';

test('sourceLine nomeia cada prova e o órgão', () => {
  assert.equal(sourceLine({ ano: 2026, dia: 1, numero: 4 }), 'SSA 2 2026 (UPE) · 1º dia · questão 4');
  assert.equal(sourceLine({ fonte: 'ssa3', ano: 2024, dia: 2, numero: 10 }), 'SSA 3 2024 (UPE) · 2º dia · questão 10');
  assert.equal(sourceLine({ fonte: 'enem', edicao: 'ppl', ano: 2022, dia: 2, numero: 150 }), 'ENEM 2022 (reaplicação) (INEP) · 2º dia · questão 150');
});

test('sourceShort é a versão curta', () => {
  assert.equal(sourceShort({ fonte: 'enem', ano: 2025, dia: 1, numero: 7 }), 'ENEM 2025 · 1º dia · q7');
});
