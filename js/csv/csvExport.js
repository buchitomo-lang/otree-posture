// CSV書き出し（otree-membership の exportBillingCsv パターンを踏襲:
// メモリ上で行を組み立て → UTF-8 BOM付き Blob → aタグクリックでダウンロード）
import { getItem, VIEWS, CATEGORIES, unitLabel } from '../models.js';
import * as db from '../db.js';

const HEADER = ['患者ID', '患者名', 'セッションID', '測定日', 'カメラ視点', 'カテゴリ', '項目キー', '項目名', '自動値', '最終値', '単位', '手動調整', '撮影時刻'];

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function rowsForSession(patient, session, measurements) {
  return measurements
    .map((m) => ({ m, item: getItem(m.itemKey) }))
    .filter(({ item }) => item)
    .sort((a, b) => a.item.key.localeCompare(b.item.key))
    .map(({ m, item }) => [
      patient.id, patient.name, session.id, session.date,
      VIEWS[item.view], CATEGORIES[item.category], item.key, item.label,
      m.autoValue ?? '', m.finalValue ?? '', unitLabel(item.unit),
      m.adjusted ? 'TRUE' : 'FALSE', m.capturedAt,
    ]);
}

function download(rows, filename) {
  const csv = '\uFEFF' + [HEADER, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function exportSessionCsv(patientId, sessionId) {
  const [patient, session, measurements] = await Promise.all([
    db.get('patients', patientId),
    db.get('sessions', sessionId),
    db.listMeasurements(sessionId),
  ]);
  download(rowsForSession(patient, session, measurements),
    `otree_posture_${patient.name}_${session.date}.csv`);
}

export async function exportPatientCsv(patientId) {
  const patient = await db.get('patients', patientId);
  const sessions = await db.listSessions(patientId);
  const rows = [];
  for (const s of [...sessions].reverse()) {
    rows.push(...rowsForSession(patient, s, await db.listMeasurements(s.id)));
  }
  download(rows, `otree_posture_${patient.name}_全セッション.csv`);
}
