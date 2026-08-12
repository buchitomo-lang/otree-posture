// 比較レポート画面: 今回・前回セッションを選んでプレビュー → 印刷 / PDF / CSV
import * as db from '../db.js';
import { buildReportHTML } from '../report/reportTemplate.js';
import { exportReportPdf } from '../report/pdfExport.js';
import { exportSessionCsv } from '../csv/csvExport.js';

export async function render(root, { patientId, sessionId }, ctx) {
  const patient = await db.get('patients', patientId);
  ctx.setHeader('比較レポート: ' + patient.name + ' さん', true);

  const sessions = (await db.listSessions(patientId)).filter((s) => s.status === 'completed' || s.id === sessionId);
  if (sessions.length === 0) {
    root.innerHTML = '<div class="empty">完了したセッションがありません。先に測定を完了してください。</div>';
    return;
  }

  let curId = sessionId ?? sessions[0].id;
  let pastId = sessions.find((s) => s.id !== curId)?.id ?? '';

  root.innerHTML = `
    <div class="card noprint">
      <div class="row">
        <label class="field grow" style="margin:0"><span>今回の測定</span>
          <select id="curSel">${options(sessions, curId)}</select>
        </label>
        <label class="field grow" style="margin:0"><span>比較する過去の測定</span>
          <select id="pastSel">
            <option value="">（比較なし・今回のみ）</option>
            ${options(sessions, pastId)}
          </select>
        </label>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="primary" id="printBtn">🖨 印刷（AirPrint）</button>
        <button class="primary" id="pdfBtn">PDF保存</button>
        <button class="secondary" id="csvBtn">CSV書き出し</button>
      </div>
    </div>
    <div class="report" id="reportArea"><div class="empty">読み込み中…</div></div>
  `;

  const urls = [];
  async function loadSessionData(id) {
    if (!id) return null;
    const [session, map, photos] = await Promise.all([
      db.get('sessions', id),
      db.getMeasurementMap(id),
      db.listPhotos(id),
    ]);
    for (const p of photos) {
      p._url = URL.createObjectURL(p.blob);
      urls.push(p._url);
    }
    return { session, map, photos };
  }

  async function draw() {
    const cur = await loadSessionData(curId);
    const past = pastId && pastId !== curId ? await loadSessionData(pastId) : null;
    root.querySelector('#reportArea').innerHTML = buildReportHTML({
      patient,
      curSession: cur.session, curMap: cur.map, curPhotos: cur.photos,
      pastSession: past?.session ?? null, pastMap: past?.map ?? {}, pastPhotos: past?.photos ?? [],
    });
  }
  await draw();

  root.querySelector('#curSel').addEventListener('change', (e) => { curId = e.target.value; draw(); });
  root.querySelector('#pastSel').addEventListener('change', (e) => { pastId = e.target.value; draw(); });

  root.querySelector('#printBtn').addEventListener('click', () => window.print());

  root.querySelector('#pdfBtn').addEventListener('click', async () => {
    ctx.toast('PDFを生成しています…');
    const cur = sessions.find((s) => s.id === curId);
    await exportReportPdf(root.querySelector('#reportArea'),
      `otree_report_${patient.name}_${cur.date}.pdf`);
    ctx.toast('PDFを保存しました');
  });

  root.querySelector('#csvBtn').addEventListener('click', async () => {
    await exportSessionCsv(patientId, curId);
    ctx.toast('CSVを書き出しました');
  });

  root._cleanup = () => urls.forEach((u) => URL.revokeObjectURL(u));
}

function options(sessions, selected) {
  return sessions
    .map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${s.date}${s.status !== 'completed' ? '（測定中）' : ''}</option>`)
    .join('');
}
