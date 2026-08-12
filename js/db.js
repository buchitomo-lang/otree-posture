// IndexedDB ラッパー（Promiseベース）
// stores: patients / sessions / measurements / photos
const DB_NAME = 'otree-posture-db';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('patients')) {
        db.createObjectStore('patients', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('patientId', 'patientId');
      }
      if (!db.objectStoreNames.contains('measurements')) {
        const m = db.createObjectStore('measurements', { keyPath: 'id' });
        m.createIndex('sessionId', 'sessionId');
        m.createIndex('sessionItem', ['sessionId', 'itemKey'], { unique: true });
      }
      if (!db.objectStoreNames.contains('photos')) {
        const p = db.createObjectStore('photos', { keyPath: 'id' });
        p.createIndex('sessionId', 'sessionId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}
function prom(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, obj) {
  const db = await openDB();
  await prom(tx(db, store, 'readwrite').put(obj));
  return obj;
}
export async function get(store, id) {
  const db = await openDB();
  return prom(tx(db, store, 'readonly').get(id));
}
export async function del(store, id) {
  const db = await openDB();
  return prom(tx(db, store, 'readwrite').delete(id));
}
export async function getAll(store) {
  const db = await openDB();
  return prom(tx(db, store, 'readonly').getAll());
}
export async function getAllByIndex(store, indexName, value) {
  const db = await openDB();
  return prom(tx(db, store, 'readonly').index(indexName).getAll(value));
}

// ---- ドメイン操作 ----

export async function listPatients() {
  const list = await getAll('patients');
  return list.sort((a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
}

export async function listSessions(patientId) {
  const list = await getAllByIndex('sessions', 'patientId', patientId);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listMeasurements(sessionId) {
  return getAllByIndex('measurements', 'sessionId', sessionId);
}

export async function getMeasurementMap(sessionId) {
  const list = await listMeasurements(sessionId);
  const map = {};
  for (const m of list) map[m.itemKey] = m;
  return map;
}

export async function listPhotos(sessionId) {
  return getAllByIndex('photos', 'sessionId', sessionId);
}

// セッション削除（測定値・写真も連鎖削除）
export async function deleteSession(sessionId) {
  const ms = await listMeasurements(sessionId);
  for (const m of ms) await del('measurements', m.id);
  const ps = await listPhotos(sessionId);
  for (const p of ps) await del('photos', p.id);
  await del('sessions', sessionId);
}

// 患者削除（全セッション連鎖削除）
export async function deletePatient(patientId) {
  const ss = await listSessions(patientId);
  for (const s of ss) await deleteSession(s.id);
  await del('patients', patientId);
}

// ---- バックアップ / 復元 ----

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function dataURLToBlob(url) {
  return (await fetch(url)).blob();
}

export async function exportBackup() {
  const [patients, sessions, measurements, photos] = await Promise.all([
    getAll('patients'), getAll('sessions'), getAll('measurements'), getAll('photos'),
  ]);
  const photosEncoded = [];
  for (const p of photos) {
    photosEncoded.push({ ...p, blob: await blobToDataURL(p.blob) });
  }
  return JSON.stringify({
    app: 'otree-posture', version: 1, exportedAt: new Date().toISOString(),
    patients, sessions, measurements, photos: photosEncoded,
  });
}

export async function importBackup(json) {
  const data = JSON.parse(json);
  if (data.app !== 'otree-posture') throw new Error('otree-postureのバックアップファイルではありません');
  for (const p of data.patients) await put('patients', p);
  for (const s of data.sessions) await put('sessions', s);
  for (const m of data.measurements) await put('measurements', m);
  for (const ph of data.photos) {
    await put('photos', { ...ph, blob: await dataURLToBlob(ph.blob) });
  }
  return { patients: data.patients.length, sessions: data.sessions.length };
}
