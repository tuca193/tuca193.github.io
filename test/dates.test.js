import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextExam,
  countdownParts,
  weeklyPace,
  formatDate,
  formatTime,
  relativeDay,
  calendarDays,
  examStatus,
} from '../js/lib/dates.js';

const provas = [
  { id: 'p2', inicio: '2026-12-13T13:30:00-03:00' },
  { id: 'p1', inicio: '2026-12-06T13:30:00-03:00' },
];

test('nextExam', () => {
  assert.equal(nextExam(provas, new Date('2026-10-30T12:00:00Z')).id, 'p1');
  assert.equal(nextExam(provas, new Date('2026-12-06T16:30:00Z')).id, 'p2');
  assert.equal(nextExam(provas, new Date('2026-12-14T00:00:00Z')), null);
  assert.equal(nextExam([], new Date()), null);
});

test('countdownParts', () => {
  const ms = ((2 * 24 + 3) * 60 + 4) * 60000 + 59999;
  assert.deepEqual(countdownParts(ms), { days: 2, hours: 3, minutes: 4 });
  assert.deepEqual(countdownParts(-5000), { days: 0, hours: 0, minutes: 0 });
  assert.deepEqual(countdownParts(NaN), { days: 0, hours: 0, minutes: 0 });
});

test('weeklyPace', () => {
  const now = new Date('2026-11-01T00:00:00Z');
  const in4w = new Date('2026-11-29T00:00:00Z');
  assert.equal(weeklyPace(0, in4w, now), 0);
  assert.equal(weeklyPace(10, in4w, now), 3);
  assert.equal(weeklyPace(8, in4w, now), 2);
  assert.equal(weeklyPace(5, new Date('2026-11-02T00:00:00Z'), now), 5);
  assert.equal(weeklyPace(5, now, now), null);
  assert.equal(weeklyPace(5, '2026-10-01T00:00:00Z', now), null);
  assert.equal(weeklyPace(0, '2026-10-01T00:00:00Z', now), 0);
});

test('formatDate e formatTime no fuso de recife', () => {
  assert.equal(formatDate('2026-12-06T13:30:00-03:00'), 'domingo, 6 de dezembro');
  assert.equal(formatTime('2026-12-06T13:30:00-03:00'), '13h30');
  assert.equal(formatTime('2026-12-06T03:05:00Z'), '00h05');
  assert.equal(formatDate('2026-12-07T01:00:00Z'), 'domingo, 6 de dezembro');
});

test('relativeDay', () => {
  const now = new Date('2026-10-30T15:00:00-03:00');
  assert.equal(relativeDay('2026-10-30T00:10:00-03:00', now), 'hoje');
  assert.equal(relativeDay('2026-10-29T23:59:00-03:00', now), 'ontem');
  assert.equal(relativeDay('2026-10-27T10:00:00-03:00', now), 'há 3 dias');
  assert.equal(relativeDay('2026-10-24T10:00:00-03:00', now), 'há 6 dias');
  assert.equal(relativeDay('2026-10-23T10:00:00-03:00', now), 'sexta-feira, 23 de outubro');
});

test('calendarDays conta dias de calendário em recife', () => {
  const prova = '2026-12-06T13:30:00-03:00';
  assert.equal(calendarDays(prova, new Date('2026-12-05T23:59:00-03:00')), 1);
  assert.equal(calendarDays(prova, new Date('2026-12-06T00:00:00-03:00')), 0);
  // 01h utc do dia 6 ainda é dia 5 em recife
  assert.equal(calendarDays(prova, new Date('2026-12-06T01:00:00Z')), 1);
  assert.equal(calendarDays(prova, new Date('2026-11-30T20:00:00-03:00')), 6);
  assert.equal(calendarDays(prova, new Date('2026-12-07T00:01:00-03:00')), -1);
});

test('examStatus', () => {
  const prova = '2026-12-06T13:30:00-03:00';
  const at = (iso) => examStatus(prova, new Date(iso));
  assert.deepEqual(at('2026-10-30T23:00:00-03:00'), { phase: 'upcoming', days: 37, text: 'em 37 dias' });
  assert.equal(at('2026-11-04T23:59:00-03:00').text, 'em 32 dias');
  assert.equal(at('2026-12-05T08:00:00-03:00').text, 'amanhã');
  assert.equal(at('2026-12-06T09:00:00-03:00').text, 'hoje');
  assert.equal(at('2026-12-06T13:30:00-03:00').text, 'em andamento');
  assert.equal(at('2026-12-06T23:59:00-03:00').phase, 'ongoing');
  assert.deepEqual(at('2026-12-07T00:00:00-03:00'), { phase: 'done', days: -1, text: 'realizada' });
});
