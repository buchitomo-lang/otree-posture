// セッション詳細: 19撮影グループのチェックリスト・進捗・完了操作
import * as db from '../db.js';
import { GROUPS, VIEWS, itemsOfGroup, unitLabel, getItem } from '../models.js';
import { exportSessionCsv } from '../csv/csvExport.js';

export async function render(root, { patientId, sessionId }, ctx) {
  const [patient, session, mmap] = await Promise.all([
    db.get('patients', patientId),
    db.get('sessions', sessionId),
    db.getMeasurementMap(sessionId),
  ]);
  ctx.setHeader(`${patient.name} さん ${session.date}`, true);

  const doneGroup = (g) => itemsOfGroup(g.key).every((it) => mmap[it.key]);
  const doneCount = GROUPS.filter(doneGroup).length;
  const allDone = doneCount === GROUPS.length;

  root.innerHTML = `
    <div class="card">
      <div class="row">
        <div class="grow"><b>進捗: ${doneCount} / ${GROUPS.length}</b> グループ</div>
        <button class="secondary small" id="csvBtn">CSV書き出し</button>
        ${session.status !== 'completed'
          ? `<button class="primary small" id="doneBtn">${allDone ? 'セッションを完了' : '途中でも完了にする'}</button>`
          : '<span class="badge done">完了</span>'}
      </div>
    </div>
    <div id="groups"></div>
  `;

  const wrap = root.querySelector('#groups');
  let lastView = null;
  let nextTarget = null;
  for (const g of GROUPS) {
    if (g.view !== lastView) {
      lastView = g.view;
      const h = document.createElement('h2');
      h.textContent = VIEWS[g.view];
      wrap.appendChild(h);
    }
    const done = doneGroup(g);
    if (!done && !nextTarget) nextTarget = g.key;
    const items = itemsOfGroup(g.key);
    const vals = items
      .filter((it) => mmap[it.key])
      .map((it) => `${it.label}: ${mmap[it.key].finalValue ?? '—'}${shortUnit(it.unit)}`)
      .join('　');
    const card = document.createElement('div');
    card.className = 'card grouprow' + (done ? ' done' : '');
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div class="check">${done ? '✓' : ''}</div>
      <div class="grow">
        <div style="font-weight:600">${g.label}</div>
        <div class="hint">${done ? vals : '姿勢: ' + g.pose}</div>
      </div>
      <button class="${done ? 'secondary' : 'primary'} small">${done ? '再測定' : '測定'}</button>`;
    card.addEventListener('click', () => ctx.nav('capture', { patientId, sessionId, groupKey: g.key }));
    wrap.appendChild(card);
  }

  if (nextTarget && session.status !== 'completed') {
    const g = GROUPS.find((x) => x.key === nextTarget);
    const bar = document.createElement('div');
    bar.className = 'row';
    bar.style.marginTop = '8px';
    bar.innerHTML = `<button class="primary grow" style="padding:16px">▶ 次の測定: ${g.label}</button>`;
    bar.querySelector('button').addEventListener('click', () =>
      ctx.nav('capture', { patientId, sessionId, groupKey: nextTarget }));
    root.querySelector('.card').after(bar);
  }

  root.querySelector('#csvBtn').addEventListener('click', async () => {
    await exportSessionCsv(patientId, sessionId);
    ctx.toast('CSVを書き出しました');
  });

  root.querySelector('#doneBtn')?.addEventListener('click', async () => {
    session.status = 'completed';
    await db.put('sessions', session);
    ctx.toast('セッションを完了にしました');
    render(root, { patientId, sessionId }, ctx);
  });
}

function shortUnit(u) {
  return u === 'deg' ? '°' : u === 'pct' ? '%' : '';
}
