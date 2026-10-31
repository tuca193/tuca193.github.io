import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickQuestions, isPassed, shuffle, QUIZ_SIZE } from '../js/lib/quiz.js';

const q = (id, materia, assunto) => ({ id, materia, assunto });
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test('aprovacao exige mais da metade', () => {
  assert.equal(isPassed(3, 5), true);
  assert.equal(isPassed(2, 5), false);
  assert.equal(isPassed(2, 4), false);
  assert.equal(isPassed(3, 4), true);
  assert.equal(isPassed(0, 0), false);
});

test('shuffle nao perde nem repete itens', () => {
  const list = [1, 2, 3, 4, 5, 6];
  const out = shuffle(list, seeded(7));
  assert.deepEqual([...out].sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6]);
});

test('sorteia 5 do assunto quando ha questoes suficientes', () => {
  const bank = [...Array(8)].map((_, i) => q(`t${i}`, 'mat', 'mat3')).concat(q('o1', 'mat', 'mat1'));
  const { questions, fromTopic } = pickQuestions(bank, { topicId: 'mat3', materiaId: 'mat' }, { rng: seeded(3) });
  assert.equal(questions.length, QUIZ_SIZE);
  assert.equal(fromTopic, 5);
  assert.ok(questions.every((x) => x.assunto === 'mat3'));
  assert.equal(new Set(questions.map((x) => x.id)).size, 5);
});

test('completa com a mesma materia, gerais primeiro, nunca de outra materia', () => {
  const bank = [q('a', 'geo', 'geo2'), q('b', 'geo', 'geo2'), q('g1', 'geo', null), q('o1', 'geo', 'geo5'), q('o2', 'geo', 'geo6'), q('x', 'his', 'his1')];
  const { questions, fromTopic } = pickQuestions(bank, { topicId: 'geo2', materiaId: 'geo' }, { rng: seeded(5) });
  assert.equal(fromTopic, 2);
  assert.equal(questions.length, 5);
  assert.deepEqual(questions.slice(0, 2).map((x) => x.assunto), ['geo2', 'geo2']);
  assert.equal(questions[2].id, 'g1');
  assert.ok(!questions.some((x) => x.materia === 'his'));
});

test('materia sem questoes devolve lista vazia', () => {
  const { questions } = pickQuestions([q('x', 'his', 'his1')], { topicId: 'edf1', materiaId: 'edf' });
  assert.equal(questions.length, 0);
});
