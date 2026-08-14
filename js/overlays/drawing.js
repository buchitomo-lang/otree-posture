// キャンバス描画: 骨格スケルトン / 位置合わせガイド / ドラッグハンドル
import { LM } from '../pose/calculations.js';

const BONES = [
  [LM.L_EAR, LM.L_SHOULDER], [LM.R_EAR, LM.R_SHOULDER],
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_SHOULDER, LM.L_ELBOW], [LM.L_ELBOW, LM.L_WRIST],
  [LM.R_SHOULDER, LM.R_ELBOW], [LM.R_ELBOW, LM.R_WRIST],
  [LM.L_SHOULDER, LM.L_HIP], [LM.R_SHOULDER, LM.R_HIP],
  [LM.L_HIP, LM.R_HIP],
  [LM.L_HIP, LM.L_KNEE], [LM.L_KNEE, LM.L_ANKLE],
  [LM.R_HIP, LM.R_KNEE], [LM.R_KNEE, LM.R_ANKLE],
];

export function drawSkeleton(ctx, points, scale, color = 'rgba(0,155,148,0.85)') {
  if (!points) return;
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  for (const [a, b] of BONES) {
    if ((points[a].visibility ?? 1) < 0.3 || (points[b].visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(points[a].x * scale, points[a].y * scale);
    ctx.lineTo(points[b].x * scale, points[b].y * scale);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  for (let i = 0; i < points.length; i++) {
    if ((points[i].visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(points[i].x * scale, points[i].y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 撮影ガイド: 中央鉛直線 + 3分割グリッド。毎回同じ立ち位置で撮るための目安
export function drawAlignmentGuide(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  for (const fx of [1 / 3, 2 / 3]) {
    ctx.beginPath(); ctx.moveTo(w * fx, 0); ctx.lineTo(w * fx, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h * fx); ctx.lineTo(w, h * fx); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(224,178,181,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  ctx.restore();
}

// ポインターが乗っている小さいマーカー（移動できない関節）を目立たせる
export function drawLandmarkHighlight(ctx, point, scale) {
  const x = point.x * scale, y = point.y * scale;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(224,178,181,0.45)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e0b2b5';
  ctx.stroke();
}

// 測定画面のドラッグハンドル（補正対象ランドマークを大きめの円で表示）
export function drawHandles(ctx, points, handleIdxs, scale, activeIdx = -1) {
  for (const i of handleIdxs) {
    const x = points[i].x * scale, y = points[i].y * scale;
    ctx.beginPath();
    ctx.arc(x, y, i === activeIdx ? 18 : 13, 0, Math.PI * 2);
    ctx.fillStyle = i === activeIdx ? 'rgba(224,178,181,0.6)' : 'rgba(0,155,148,0.35)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = i === activeIdx ? '#e0b2b5' : '#009b94';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}
