// junta dois estados do painel (navegador e conta) sem perder nada de nenhum dos dois
import { MAX_SIMULADOS } from '../store/storage.js';
import { MAX_NAME_LENGTH, nameKey } from '../store/profiles.js';

// mergeDone - união dos assuntos estudados; vale a data mais antiga (quando foi estudado primeiro)
function mergeDone(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || v < out[k]) out[k] = v;
  return out;
}

// mergeQuiz - por questão, fica o histórico com mais respostas (e, no empate, o mais recente)
function mergeQuiz(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (!cur || v.c + v.e > cur.c + cur.e || (v.c + v.e === cur.c + cur.e && v.last > cur.last)) out[k] = v;
  }
  return out;
}

// mergeSimulados - união pelos resultados distintos, em ordem de data
function mergeSimulados(a = [], b = []) {
  const seen = new Map();
  for (const r of [...a, ...b]) seen.set(`${r.at}|${r.dia}|${r.modo}`, r);
  return [...seen.values()].sort((x, y) => x.at.localeCompare(y.at)).slice(-MAX_SIMULADOS);
}

// uniqueName - "Ana" que já existe com outro id vira "Ana (2)"
function uniqueName(name, taken) {
  if (!taken.has(nameKey(name))) return name;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = [...name].slice(0, MAX_NAME_LENGTH - suffix.length).join('').trimEnd() + suffix;
    if (!taken.has(nameKey(candidate))) return candidate;
  }
}

// mergeStates - base (conta) + extra (navegador); perfis com o mesmo id somam o progresso
export function mergeStates(base, extra) {
  const profiles = base.profiles.map((p) => ({ ...p }));
  const data = {};
  for (const p of base.profiles) data[p.id] = base.data[p.id] ?? { done: {}, quiz: {}, simulados: [] };
  const taken = new Set(profiles.map((p) => nameKey(p.name)));
  for (const p of extra.profiles) {
    const mine = extra.data[p.id] ?? {};
    if (data[p.id]) {
      const cur = data[p.id];
      data[p.id] = {
        done: mergeDone(cur.done, mine.done),
        quiz: mergeQuiz(cur.quiz, mine.quiz),
        simulados: mergeSimulados(cur.simulados, mine.simulados),
      };
      continue;
    }
    const name = uniqueName(p.name, taken);
    taken.add(nameKey(name));
    profiles.push({ ...p, name });
    data[p.id] = { done: { ...(mine.done ?? {}) }, quiz: { ...(mine.quiz ?? {}) }, simulados: [...(mine.simulados ?? [])] };
  }
  const activeId = [extra.activeId, base.activeId].find((id) => id && data[id]) ?? profiles[0]?.id ?? null;
  return { ...base, profiles, data, activeId, prefs: { ...extra.prefs, ...base.prefs } };
}

// isEmpty - estado sem nenhum perfil
export function isEmpty(state) {
  return !state?.profiles?.length;
}
