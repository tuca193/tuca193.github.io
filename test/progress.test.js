import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../js/store/storage.js';
import { createProfile } from '../js/store/profiles.js';
import {
  doneMap,
  toggleTopic,
  resetProgress,
  countDone,
  exportProfile,
  importProfile,
} from '../js/store/progress.js';
import { fixedNow } from './helpers.js';

const NOW = '2026-10-30T12:00:00.000Z';
const now = fixedNow(NOW);
const knownIds = ['port0', 'port1', 'mat0'];

const oneProfile = () => createProfile(emptyState(), 'Ana', { id: 'a', now }).state;

test('toggleTopic marca e desmarca', () => {
  const s1 = toggleTopic(oneProfile(), 'port0', { now, knownIds });
  assert.deepEqual(doneMap(s1), { port0: NOW });
  const s2 = toggleTopic(s1, 'port0', { now, knownIds });
  assert.deepEqual(doneMap(s2), {});
  assert.deepEqual(doneMap(s1), { port0: NOW });
});

test('toggleTopic ignora id desconhecido e estado sem perfil', () => {
  const s = oneProfile();
  assert.equal(toggleTopic(s, 'xyz9', { now, knownIds }), s);
  const empty = emptyState();
  assert.equal(toggleTopic(empty, 'port0', { now, knownIds }), empty);
  assert.deepEqual(doneMap(empty), {});
});

test('resetProgress e countDone', () => {
  let s = toggleTopic(oneProfile(), 'port0', { now, knownIds });
  s = toggleTopic(s, 'mat0', { now, knownIds });
  assert.equal(countDone(doneMap(s), ['port0', 'port1']), 1);
  assert.equal(countDone(doneMap(s), knownIds), 2);
  s = resetProgress(s, 'a');
  assert.equal(countDone(doneMap(s), knownIds), 0);
});

test('export e import com colisao de nome', () => {
  const s = toggleTopic(oneProfile(), 'port1', { now, knownIds });
  const backup = JSON.parse(JSON.stringify(exportProfile(s, 'a', { now })));
  assert.equal(backup.format, 'painel-ssa2');
  assert.equal(backup.version, 1);
  assert.deepEqual(backup.profile, { name: 'Ana' });

  backup.done.lixo9 = NOW;
  const r = importProfile(s, backup, { id: 'b', now, knownIds });
  assert.equal(r.ok, true);
  assert.equal(r.profile.name, 'Ana (2)');
  assert.equal(r.state.activeId, 'b');
  assert.deepEqual(r.state.data.b.done, { port1: NOW });

  const r2 = importProfile(r.state, backup, { id: 'c', now, knownIds });
  assert.equal(r2.profile.name, 'Ana (3)');
});

test('import aceita texto json', () => {
  const s = oneProfile();
  const text = JSON.stringify({ format: 'painel-ssa2', version: 1, profile: { name: 'Bia' }, done: {} });
  assert.equal(importProfile(s, text, { id: 'b', now }).profile.name, 'Bia');
});

test('import rejeita lixo', () => {
  const s = oneProfile();
  const invalid = 'Arquivo inválido: não é um backup do Painel SSA 2.';
  for (const payload of [null, 42, 'nao json', [], {}, { format: 'outro', version: 1 }]) {
    assert.deepEqual(importProfile(s, payload, { id: 'x', now }), { ok: false, error: invalid });
  }
  const base = { format: 'painel-ssa2', version: 1, profile: { name: 'X' }, done: {} };
  assert.equal(importProfile(s, { ...base, profile: { name: ' ' } }, { id: 'x', now }).error, invalid);
  assert.equal(importProfile(s, { ...base, done: [] }, { id: 'x', now }).error, invalid);
  assert.match(importProfile(s, { ...base, version: 9 }, { id: 'x', now }).error, /versão/);
  assert.match(importProfile(s, { ...base, done: { port0: 'ontem' } }, { id: 'x', now }).error, /datas/);
  assert.match(importProfile(s, { ...base, done: { port0: true } }, { id: 'x', now }).error, /datas/);
});
