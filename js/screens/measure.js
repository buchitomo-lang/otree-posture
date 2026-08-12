// 測定画面: 凍結写真 + 関節マーカーのドラッグ補正 + 数値の手動入力 → 保存
import * as db from '../db.js';
import { getGroup, itemsOfGroup, newId, unitLabel } from '../models.js';
import { computeItem } from '../pose/calculations.js';
import { drawSkeleton, drawHandles } from '../overlays/drawing.js';
import { demoPoints } from './capture.js';
import { esc } from './patientList.js';

export async function render(root, params, ctx) {
  const { patientId, sessionId, groupKey, photoBlob, width, height } = params;
  const group = getGroup(groupKey);
  const items = itemsOfGroup(groupKey);
  ctx.setHeader(`測定: ${group.label}`, true);

  // 検出失敗時は標準位置のマーカーを置き、ドラッグで合わせてもらう
  const detected = !!params.landmarks;
  const points = params.landmarks
    ? params.landmarks.map((p) => ({ ...p }))
    : demoPoints(width, height);

  // 撮影時点の自動値（レコードに残す）
  const autoValues = {};
  for (const it of items) {
    autoValues[it.key] = detected ? computeItem(it.key, points) : null;
  }
  // 現在値: ドラッグ or 手入力で更新される
  const current = {};
  const manualTyped = {};
  for (const it of items) current[it.key] = autoValues[it.key];

  const handleSet = [...new Set(items.flatMap((it) => it.handles))];
  const photoURL = URL.createObjectURL(photoBlob);

  root.innerHTML = `
    ${detected ? '' : '<div class="note-warn" style="margin-bottom:10px">姿勢を自動検出できませんでした。写真上のマーカーを関節位置へドラッグして合わせてください。</div>'}
    ${items.some((it) => it.manualPrimary) ? '<div class="note-warn" style="margin-bottom:10px">この項目は自動計測が不正確です。数値は参考値として表示していますので、確認・修正のうえ確定してください。</div>' : ''}
    <div class="camwrap">
      <img class="frozen" id="photo" src="${photoURL}">
      <canvas class="overlay" id="ov" width="${width}" height="${height}"></canvas>
    </div>
    <div class="hint" style="text-align:center;margin:8px 0">○マーカーをドラッグすると値が再計算されます</div>
    <div class="card">
      <table class="vals">
        <thead><tr><th>項目</th><th style="text-align:right">値</th><th>単位</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="row noprint">
      <button class="secondary grow" id="retake">撮り直す</button>
      <button class="primary grow" id="save">確定して保存</button>
    </div>
  `;

  const rowsEl = root.querySelector('#rows');
  for (const it of items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(it.label)}<div class="hint">${esc(it.hint || '')}</div></td>
      <td class="num"><input class="valinput" type="number" step="0.1" inputmode="decimal"
        data-key="${it.key}" value="${current[it.key] ?? ''}" placeholder="—"></td>
      <td>${unitLabel(it.unit)}</td>`;
    rowsEl.appendChild(tr);
  }
  rowsEl.addEventListener('input', (e) => {
    const key = e.target.dataset?.key;
    if (!key) return;
    manualTyped[key] = true;
    current[key] = e.target.value === '' ? null : parseFloat(e.target.value);
  });

  const ov = root.querySelector('#ov');
  const octx = ov.getContext('2d');

  function recompute() {
    for (const it of items) {
      if (manualTyped[it.key]) continue; // 手入力済みはドラッグで上書きしない
      current[it.key] = computeItem(it.key, points);
      const input = rowsEl.querySelector(`input[data-key="${it.key}"]`);
      if (input) input.value = current[it.key] ?? '';
    }
  }

  let activeHandle = -1;
  function draw() {
    octx.clearRect(0, 0, width, height);
    drawSkeleton(octx, points, 1, 'rgba(0,155,148,0.45)');
    drawHandles(octx, points, handleSet, 1, activeHandle);
  }
  draw();

  const toCanvas = (e) => {
    const r = ov.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (width / r.width), y: (e.clientY - r.top) * (height / r.height) };
  };
  ov.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    let best = -1, bestD = 40 * (width / ov.getBoundingClientRect().width); // 指タッチ許容半径
    for (const i of handleSet) {
      const d = Math.hypot(points[i].x - p.x, points[i].y - p.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) {
      activeHandle = best;
      ov.setPointerCapture(e.pointerId);
      draw();
    }
  });
  ov.addEventListener('pointermove', (e) => {
    if (activeHandle < 0) return;
    const p = toCanvas(e);
    points[activeHandle].x = p.x;
    points[activeHandle].y = p.y;
    points[activeHandle].visibility = 1;
    recompute();
    draw();
  });
  const endDrag = () => { if (activeHandle >= 0) { activeHandle = -1; draw(); } };
  ov.addEventListener('pointerup', endDrag);
  ov.addEventListener('pointercancel', endDrag);

  root.querySelector('#retake').addEventListener('click', () => {
    ctx.nav('capture', { patientId, sessionId, groupKey }, { replace: true });
  });

  root.querySelector('#save').addEventListener('click', async () => {
    // 再測定なら既存レコード・旧写真を差し替える
    const existing = await db.getMeasurementMap(sessionId);
    const oldPhotoId = items.map((it) => existing[it.key]?.photoId).find(Boolean);
    if (oldPhotoId) await db.del('photos', oldPhotoId);

    const photo = {
      id: newId('ph'), sessionId, groupKey, view: group.view,
      blob: photoBlob, width, height, createdAt: new Date().toISOString(),
    };
    await db.put('photos', photo);

    const now = new Date().toISOString();
    for (const it of items) {
      await db.put('measurements', {
        id: existing[it.key]?.id ?? newId('m'),
        sessionId,
        itemKey: it.key,
        groupKey,
        view: it.view,
        category: it.category,
        autoValue: autoValues[it.key],
        finalValue: current[it.key],
        unit: it.unit,
        adjusted: current[it.key] !== autoValues[it.key],
        landmarksSnapshot: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), visibility: Math.round((p.visibility ?? 1) * 100) / 100 })),
        photoId: photo.id,
        capturedAt: now,
      });
    }
    URL.revokeObjectURL(photoURL);
    ctx.toast('保存しました');
    ctx.nav('sessionDetail', { patientId, sessionId }, { replace: true });
  });

  root._cleanup = () => URL.revokeObjectURL(photoURL);
}
