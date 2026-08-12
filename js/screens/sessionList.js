// 患者のセッション（来院回）一覧: 新規測定・再開・CSV・比較レポート
import * as db from '../db.js';
import { newId, GROUPS } from '../models.js';
import { exportSessionCsv, exportPatientCsv } from '../csv/csvExport.js';
import { esc } from './patientList.js';

export async function render(root, { patientId }, ctx) {
  const patient = await db.get('patients', patientId);
  ctx.setHeader(patient.name + ' さん', true);

  const sessions = await db.listSessions(patientId);
  const completed = sessions.filter((s) => s.status === 'completed');

  root.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <button class="primary grow" id="newBtn">＋ 新規測定を開始</button>
      <button class="secondary" id="reportBtn" ${completed.length === 0 ? 'disabled' : ''}>比較レポート</button>
      <button class="secondary" id="csvAllBtn" ${sessions.length === 0 ? 'disabled' : ''}>CSV（全回）</button>
    </div>
    <ul class="list" id="slist"></ul>
  `;

  const listEl = root.querySelector('#slist');
  if (sessions.length === 0) {
    listEl.innerHTML = '<div class="empty">まだ測定記録がありません</div>';
  }
  for (const s of sessions) {
    const ms = await db.listMeasurements(s.id);
    const doneGroups = new Set(ms.map((m) => m.groupKey)).size;
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="info">
        <div class="name">${s.date}</div>
        <div class="sub">${doneGroups} / ${GROUPS.length} グループ測定済み</div>
      </div>
      ${s.status === 'completed'
        ? '<span class="badge done">完了</span>'
        : '<span class="badge pink">測定中</span>'}
      <button class="secondary small csvBtn">CSV</button>
      <button class="danger small delBtn">削除</button>
      <span class="chev">›</span>`;
    li.addEventListener('click', () => ctx.nav('sessionDetail', { patientId, sessionId: s.id }));
    li.querySelector('.csvBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await exportSessionCsv(patientId, s.id);
      ctx.toast('CSVを書き出しました');
    });
    li.querySelector('.delBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`${s.date} の測定記録を削除しますか？（写真・数値もすべて削除されます）`)) return;
      await db.deleteSession(s.id);
      ctx.toast('削除しました');
      render(root, { patientId }, ctx);
    });
    listEl.appendChild(li);
  }

  root.querySelector('#newBtn').addEventListener('click', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const session = {
      id: newId('s'), patientId, date: today,
      status: 'in_progress', note: '', createdAt: new Date().toISOString(),
    };
    await db.put('sessions', session);
    ctx.nav('sessionDetail', { patientId, sessionId: session.id });
  });

  root.querySelector('#reportBtn').addEventListener('click', () => {
    ctx.nav('report', { patientId });
  });

  root.querySelector('#csvAllBtn').addEventListener('click', async () => {
    await exportPatientCsv(patientId);
    ctx.toast('全セッションのCSVを書き出しました');
  });
}
