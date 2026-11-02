import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../js/store/storage.js';
import {
  validateName,
  createProfile,
  renameProfile,
  removeProfile,
  selectProfile,
  initials,
} from '../js/store/profiles.js';
import { fixedNow } from './helpers.js';

const now = fixedNow();

function withProfiles(...names) {
  let state = emptyState();
  names.forEach((name, i) => {
    state = createProfile(state, name, { id: `p${i + 1}`, now }).state;
  });
  return state;
}

test('validateName: vazio, longo e duplicado', () => {
  const state = withProfiles('José Antônio');
  assert.equal(validateName(state, '   '), 'Digite um nome.');
  assert.equal(validateName(state, 'a'.repeat(41)), 'Use no máximo 40 caracteres.');
  assert.equal(validateName(state, 'a'.repeat(40)), null);
  assert.equal(validateName(state, '  jose antonio '), 'Já existe um perfil com esse nome.');
  assert.equal(validateName(state, 'JOSÉ ANTONIO'), 'Já existe um perfil com esse nome.');
  assert.equal(validateName(state, 'José Antônio', 'p1'), null);
  assert.equal(validateName(state, 'Maria'), null);
});

test('createProfile ativa o novo perfil sem mutar o estado', () => {
  const before = emptyState();
  const r = createProfile(before, '  Ana  ', { id: 'a', now });
  assert.equal(r.ok, true);
  assert.equal(r.profile.name, 'Ana');
  assert.equal(r.state.activeId, 'a');
  assert.deepEqual(r.state.data.a, { done: {}, quiz: {} });
  assert.deepEqual(before, emptyState());
});

test('createProfile respeita limite de 20', () => {
  const state = withProfiles(...Array.from({ length: 20 }, (_, i) => `Perfil ${i}`));
  const r = createProfile(state, 'Mais um', { id: 'x', now });
  assert.deepEqual(r, { ok: false, error: 'Limite de 20 perfis atingido.' });
});

test('renameProfile', () => {
  const state = withProfiles('Ana', 'Bia');
  assert.equal(renameProfile(state, 'zz', 'X').error, 'Perfil não encontrado.');
  assert.equal(renameProfile(state, 'p1', 'bia').error, 'Já existe um perfil com esse nome.');
  const r = renameProfile(state, 'p1', 'Ana Luiza');
  assert.equal(r.ok, true);
  assert.equal(r.state.profiles[0].name, 'Ana Luiza');
  assert.equal(state.profiles[0].name, 'Ana');
});

test('removeProfile do ativo passa para o primeiro restante', () => {
  const state = withProfiles('Ana', 'Bia', 'Caio');
  assert.equal(state.activeId, 'p3');
  const r = removeProfile(state, 'p3');
  assert.equal(r.ok, true);
  assert.equal(r.state.activeId, 'p1');
  assert.equal(r.state.data.p3, undefined);
  const r2 = removeProfile(selectProfile(r.state, 'p2'), 'p1');
  assert.equal(r2.state.activeId, 'p2');
});

test('removeProfile do ultimo deixa activeId null', () => {
  const r = removeProfile(withProfiles('Ana'), 'p1');
  assert.equal(r.state.activeId, null);
  assert.deepEqual(r.state.profiles, []);
  assert.deepEqual(r.state.data, {});
});

test('selectProfile ignora id desconhecido', () => {
  const state = withProfiles('Ana', 'Bia');
  assert.equal(selectProfile(state, 'nada'), state);
  assert.equal(selectProfile(state, 'p1').activeId, 'p1');
});

test('initials', () => {
  assert.equal(initials('Ana Luiza'), 'AL');
  assert.equal(initials('ana'), 'A');
  assert.equal(initials('  '), '?');
  assert.equal(initials('Ana Luíza Ção (2)'), 'AÇ');
  assert.equal(initials('(2)'), '?');
  assert.equal(initials('élida maria de órfão'), 'ÉÓ');
});
