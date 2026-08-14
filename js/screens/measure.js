// 測定画面: 凍結写真 + 関節マーカーのドラッグ補正 + 数値の手動入力 → 保存
import * as db from '../db.js';
import { getGroup, itemsOfGroup, newId, unitLabel } from '../models.js';
import { computeItem, LANDMARK_NAMES, LANDMARK_ANATOMY } from '../pose/calculations.js';
import { drawSkeleton, drawHandles, drawLandmarkHighlight } from '../overlays/drawing.js';
import { demoPoints } from './capture.js';
import { esc } from './patientList.js';

export async function render(root, params, ctx) {
  const { patientId, sessionId, groupKey, photoBlob, width, height, source = 'camera' } = params;
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
    ${detected ? '' : `<div class="note-warn" style="margin-bottom:10px">姿勢を自動検出できませんでした。${source === 'import' ? '全身が写っている写真だと検出しやすくなります。このまま続ける場合は、' : ''}写真上のマーカーを関節位置へドラッグして合わせてください。</div>`}
    ${items.some((it) => it.manualPrimary) ? '<div class="note-warn" style="margin-bottom:10px">この項目は自動計測が不正確です。数値は参考値として表示していますので、確認・修正のうえ確定してください。</div>' : ''}
    <div class="camwrap">
      <img class="frozen" id="photo" src="${photoURL}">
      <canvas class="overlay" id="ov" width="${width}" height="${height}"></canvas>
      <div class="lmtip" id="lmtip" hidden></div>
    </div>
    <div class="hint" style="text-align:center;margin:8px 0">
      ○マーカーをドラッグすると値が再計算されます<br>
      マーカーにポインターを合わせる（タッチの場合はタップ）と、どの部位かを表示します。左右は患者さんから見た左右です<br>
      （　）内は対応する解剖学的名称の目安です
    </div>
    <div class="card">
      <table class="vals">
        <thead><tr><th>項目</th><th style="text-align:right">値</th><th>単位</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="row noprint">
      <button class="secondary grow" id="retake">${source === 'import' ? '写真を選び直す' : '撮り直す'}</button>
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

  const tip = root.querySelector('#lmtip');
  let activeHandle = -1;   // ドラッグ中のハンドル
  let hoverIdx = -1;       // ポインターが乗っているランドマーク
  let tipTimer = 0;

  function draw() {
    octx.clearRect(0, 0, width, height);
    drawSkeleton(octx, points, 1, 'rgba(0,155,148,0.45)');
    if (hoverIdx >= 0 && !handleSet.includes(hoverIdx)) {
      drawLandmarkHighlight(octx, points[hoverIdx], 1);
    }
    drawHandles(octx, points, handleSet, 1, activeHandle >= 0 ? activeHandle : hoverIdx);
  }
  draw();

  // 各ハンドルが、この写真のどの測定項目に使われているかを示す
  function itemsUsing(idx) {
    return items.filter((it) => it.handles.includes(idx)).map((it) => it.label);
  }

  function showTip(idx, autoHide) {
    const r = ov.getBoundingClientRect();
    if (!r.width) return;
    const x = (points[idx].x / width) * r.width;
    const y = (points[idx].y / height) * r.height;
    const used = itemsUsing(idx);
    const anatomy = LANDMARK_ANATOMY[idx];
    tip.innerHTML = `<b>${esc(LANDMARK_NAMES[idx] ?? '関節')}</b>`
      + (anatomy ? `<span class="anat">（${esc(anatomy)}）</span>` : '')
      + (used.length ? `<div class="sub">ドラッグで補正: ${esc(used.join('・'))}</div>`
                     : '<div class="sub">この写真では計算に使いません</div>');
    tip.hidden = false;
    // 写真の上端に近いときは吹き出しを下側に出す
    tip.classList.toggle('below', y < 56);
    tip.style.left = Math.max(60, Math.min(r.width - 60, x)) + 'px';
    tip.style.top = y + 'px';
    clearTimeout(tipTimer);
    if (autoHide) tipTimer = setTimeout(hideTip, 2600);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    tip.hidden = true;
  }

  const toCanvas = (e) => {
    const r = ov.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (width / r.width), y: (e.clientY - r.top) * (height / r.height) };
  };

  // 一番近いマーカーを選ぶ。ハンドルは掴みやすいよう許容範囲を広げ、少しだけ優先する
  // （頭部のように点が密集する場所でも、明らかに近い小さいマーカーはきちんと選べる）
  function findLandmark(e) {
    const p = toCanvas(e);
    const scale = width / ov.getBoundingClientRect().width; // 画面px→写真px
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < points.length; i++) {
      const isHandle = handleSet.includes(i);
      if (!isHandle && (points[i].visibility ?? 1) < 0.3) continue; // 表示されていない点は対象外
      const d = Math.hypot(points[i].x - p.x, points[i].y - p.y);
      const limit = (isHandle ? 40 : 20) * scale;                   // 指タッチ許容半径
      if (d > limit) continue;
      const score = isHandle ? d - 10 * scale : d;                  // ハンドルへの優先分
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  ov.addEventListener('pointerdown', (e) => {
    const idx = findLandmark(e);
    if (idx < 0) { hoverIdx = -1; hideTip(); draw(); return; }
    hoverIdx = idx;
    if (handleSet.includes(idx)) {
      activeHandle = idx;
      ov.setPointerCapture(e.pointerId);
      showTip(idx, false);                 // ドラッグ中は出したままにする
    } else {
      showTip(idx, e.pointerType !== 'mouse'); // タッチは一定時間で自動的に消す
    }
    draw();
  });

  ov.addEventListener('pointermove', (e) => {
    if (activeHandle >= 0) {
      const p = toCanvas(e);
      points[activeHandle].x = p.x;
      points[activeHandle].y = p.y;
      points[activeHandle].visibility = 1;
      recompute();
      showTip(activeHandle, false);
      draw();
      return;
    }
    if (e.pointerType !== 'mouse') return;  // タッチではホバーが無いためタップのみ
    const idx = findLandmark(e);
    if (idx === hoverIdx) return;
    hoverIdx = idx;
    if (idx >= 0) showTip(idx, false); else hideTip();
    draw();
  });

  const endDrag = (e) => {
    if (activeHandle < 0) return;
    activeHandle = -1;
    if (e && e.pointerType === 'mouse') showTip(hoverIdx, false); else hideTip();
    draw();
  };
  ov.addEventListener('pointerup', endDrag);
  ov.addEventListener('pointercancel', endDrag);
  ov.addEventListener('pointerleave', () => {
    if (activeHandle >= 0) return;
    hoverIdx = -1;
    hideTip();
    draw();
  });

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
      blob: photoBlob, width, height, source, createdAt: new Date().toISOString(),
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
