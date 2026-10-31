// banco remoto (firestore): alterações nas questões e log, sincronizados em tempo real

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const CONFIG = {
  apiKey: 'AIzaSyDsu_HSgoHdeFWSkk2yfh7iC6JLUu65U-8',
  authDomain: 'projetossa2-database.firebaseapp.com',
  projectId: 'projetossa2-database',
  storageBucket: 'projetossa2-database.firebasestorage.app',
  messagingSenderId: '197863802508',
  appId: '1:197863802508:web:778c2b006277c8f2f75da9',
};
export const ADMIN_EMAIL = 'arthursoaresa620@gmail.com';
const FIRST_SNAPSHOT_MS = 4000;
const LOG_LIMIT = 200;

let sdk = null;
const overrides = new Map();
const listeners = new Set();
let status = 'connecting';
let firstSnapshot = null;

// connect - carrega o sdk uma vez
function connect() {
  if (!sdk) {
    sdk = Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-firestore.js`),
      import(`${SDK}/firebase-auth.js`),
    ]).then(([app, fs, auth]) => {
      const instance = app.initializeApp(CONFIG);
      return { fs, auth, db: fs.getFirestore(instance), authApi: auth.getAuth(instance) };
    });
    sdk.catch(() => { sdk = null; });
  }
  return sdk;
}

function emit() {
  listeners.forEach((fn) => fn({ status, overrides }));
}

// watchOverrides - começa a ouvir as alterações; resolve na primeira leitura (ou no tempo limite)
export function watchOverrides() {
  if (firstSnapshot) return firstSnapshot;
  firstSnapshot = new Promise((resolve) => {
    const timer = setTimeout(resolve, FIRST_SNAPSHOT_MS);
    const done = () => { clearTimeout(timer); resolve(); };
    const fail = () => { status = 'offline'; emit(); done(); };
    connect().then(({ fs, db }) => {
      fs.onSnapshot(fs.collection(db, 'overrides'), (snap) => {
        overrides.clear();
        snap.forEach((d) => overrides.set(d.id, d.data()));
        status = 'online';
        emit();
        done();
      }, fail);
    }).catch(fail);
  });
  return firstSnapshot;
}

export function currentOverrides() {
  return overrides;
}

// onOverrides - avisa a cada mudança vinda de qualquer aparelho; devolve a função de parar
export function onOverrides(fn) {
  listeners.add(fn);
  watchOverrides();
  fn({ status, overrides });
  return () => listeners.delete(fn);
}

// onLog - últimas entradas do log, as mais novas primeiro
export function onLog(fn, onError) {
  let off = () => {};
  let stopped = false;
  connect().then(({ fs, db }) => {
    if (stopped) return;
    const q = fs.query(fs.collection(db, 'log'), fs.orderBy('at', 'desc'), fs.limit(LOG_LIMIT));
    off = fs.onSnapshot(q, (snap) => fn(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))), onError);
  }).catch(onError);
  return () => { stopped = true; off(); };
}

// onAdmin - quem está logado com google neste aparelho (null se ninguém)
export function onAdmin(fn) {
  let off = () => {};
  connect().then(({ auth, authApi }) => { off = auth.onAuthStateChanged(authApi, (u) => fn(u)); }).catch(() => fn(null));
  return () => off();
}

export async function signInAdmin() {
  const { auth, authApi } = await connect();
  const res = await auth.signInWithPopup(authApi, new auth.GoogleAuthProvider());
  return res.user;
}

export async function signOutAdmin() {
  const { auth, authApi } = await connect();
  await auth.signOut(authApi);
}

// device - descrição curta do aparelho para o log
function device() {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'outro';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  return `${br} · ${os}`;
}

// commit - grava a alteração da questão e a linha do log na mesma operação
export async function commit({ questao, override, entry }) {
  const { fs, db } = await connect();
  const batch = fs.writeBatch(db);
  batch.set(fs.doc(db, 'overrides', questao), { ...override, at: fs.serverTimestamp() });
  batch.set(fs.doc(fs.collection(db, 'log')), { ...entry, questao, at: fs.serverTimestamp(), dispositivo: device() });
  await batch.commit();
}
