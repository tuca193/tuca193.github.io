// sessão: quem está logado com google; sem internet, vale a última conta usada neste aparelho
import { onAuth } from './remote.js';

const SESSION_KEY = 'ssa2:sessao';
const WAIT_MS = 6000;

// accountKey - onde o progresso da conta fica guardado neste navegador
export const accountKey = (uid) => `ssa2:u:${uid}`;

const read = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
const remember = (s) => { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* sem storage */ } };
export const forget = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* sem storage */ } };

const toSession = (u) => ({ uid: u.uid, name: u.displayName || u.email?.split('@')[0] || 'Você', email: u.email || '', photo: u.photoURL || '' });

// resolveSession - espera o firebase dizer quem está logado; depois disso, trocar de conta recarrega o app
export function resolveSession() {
  return new Promise((resolve) => {
    let resolved;
    const finish = (s) => {
      if (resolved !== undefined) return;
      resolved = s;
      clearTimeout(timer);
      resolve(s);
    };
    // sem resposta a tempo (rede lenta, firebase bloqueado): segue com a última conta deste aparelho
    const timer = setTimeout(() => finish(read()), WAIT_MS);
    onAuth((u) => {
      const s = u ? toSession(u) : null;
      if (s) remember(s);
      else forget();
      if (resolved === undefined) finish(s);
      else if ((resolved?.uid ?? null) !== (s?.uid ?? null)) location.reload();
    }, () => finish(read()));
  });
}
