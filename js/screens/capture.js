// 撮影画面: カメラ + 位置合わせガイド + ライブ骨格表示 → 撮影で凍結して測定画面へ
// 端末内の既存写真を読み込んで測定することもできる
import { getGroup, VIEWS } from '../models.js';
import { initLandmarker, detectVideoFrame, isReady } from '../pose/landmarker.js';
import { importPhotoFile } from '../pose/photoImport.js';
import { drawSkeleton, drawAlignmentGuide } from '../overlays/drawing.js';
import { DEMO } from '../main.js';

export async function render(root, { patientId, sessionId, groupKey }, ctx) {
  const group = getGroup(groupKey);
  ctx.setHeader(`撮影: ${group.label}`, true);

  root.innerHTML = `
    <div class="card" style="padding:10px 16px">
      <b>${VIEWS[group.view]}</b>　<span class="hint">${group.pose}</span>
    </div>
    <div class="camwrap">
      ${DEMO ? '' : '<video id="cam" autoplay muted></video>'}
      <canvas class="overlay" id="ov"></canvas>
    </div>
    <div class="cambar noprint">
      <button class="secondary small" id="flipBtn" ${DEMO ? 'style="display:none"' : ''}>カメラ切替</button>
      <button class="shutter" id="shot" disabled>撮影</button>
      <button class="secondary small" id="pickBtn">写真を選択</button>
      <input type="file" id="pickFile" accept="image/*" style="display:none">
    </div>
    <div class="hint" id="status" style="text-align:center">${DEMO ? 'デモモード（合成データ）' : 'カメラを起動しています…'}</div>
  `;

  const ov = root.querySelector('#ov');
  const shotBtn = root.querySelector('#shot');
  const status = root.querySelector('#status');
  let lastPoints = null;
  let stream = null;
  let raf = 0;
  let facing = 'environment';

  const goMeasure = (photoBlob, width, height, points, source) => {
    ctx.nav('measure', { patientId, sessionId, groupKey, photoBlob, width, height, landmarks: points, source }, { replace: true });
  };

  function stopCamera() {
    cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  // ---- 既存写真の読み込み（カメラが使えない環境でも利用可能）----
  const pickFile = root.querySelector('#pickFile');
  root.querySelector('#pickBtn').addEventListener('click', () => pickFile.click());
  pickFile.addEventListener('change', async () => {
    const file = pickFile.files[0];
    pickFile.value = ''; // 同じ写真を選び直せるようにリセット
    if (!file) return;
    status.textContent = '写真を解析しています…';
    try {
      const { blob, width, height, points } = await importPhotoFile(file);
      stopCamera();
      goMeasure(blob, width, height, points, 'import');
    } catch (e) {
      status.innerHTML = `<span class="note-warn">写真を読み込めませんでした: ${e.message}</span>`;
    }
  });

  if (DEMO) {
    // プレビュー/開発用: カメラなしで合成ランドマークを使う
    const W = 720, H = 960;
    ov.width = W; ov.height = H;
    const c = ov.getContext('2d');
    const points = demoPoints(W, H);
    c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, W, H);
    drawAlignmentGuide(c, W, H);
    drawSkeleton(c, points, 1);
    shotBtn.disabled = false;
    shotBtn.addEventListener('click', () => {
      const snap = document.createElement('canvas');
      snap.width = W; snap.height = H;
      const sc = snap.getContext('2d');
      sc.fillStyle = '#d8d8d8'; sc.fillRect(0, 0, W, H);
      drawSkeleton(sc, points, 1, 'rgba(120,120,120,0.9)');
      snap.toBlob((blob) => goMeasure(blob, W, H, points, 'camera'), 'image/jpeg', 0.8);
    });
    return;
  }

  const video = root.querySelector('#cam');
  video.setAttribute('playsinline', 'true'); // iOS Safariで全画面再生になるのを防ぐ

  async function startCamera() {
    stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      status.innerHTML = `<span class="note-warn">カメラを起動できませんでした（${e.name}）。HTTPSでアクセスしているか、カメラ許可を確認してください。「写真を選択」から端末内の写真を読み込むこともできます。</span>`;
      return;
    }
    video.srcObject = stream;
    await video.play();
    ov.width = video.videoWidth;
    ov.height = video.videoHeight;
    status.textContent = 'AIモデルを読み込んでいます…';
    await initLandmarker();
    status.textContent = '患者さんを中央の線に合わせて「撮影」を押してください';
    shotBtn.disabled = false;
    loop();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!isReady() || video.readyState < 2) return;
    const points = detectVideoFrame(video, performance.now());
    if (points) lastPoints = points;
    const c = ov.getContext('2d');
    c.clearRect(0, 0, ov.width, ov.height);
    drawAlignmentGuide(c, ov.width, ov.height);
    if (points) drawSkeleton(c, points, 1);
  }

  shotBtn.addEventListener('click', () => {
    const snap = document.createElement('canvas');
    snap.width = video.videoWidth;
    snap.height = video.videoHeight;
    snap.getContext('2d').drawImage(video, 0, 0);
    const points = lastPoints; // 撮影瞬間の最新検出結果
    stopCamera();
    snap.toBlob((blob) => goMeasure(blob, snap.width, snap.height, points, 'camera'), 'image/jpeg', 0.8);
  });

  root.querySelector('#flipBtn').addEventListener('click', () => {
    facing = facing === 'environment' ? 'user' : 'environment';
    startCamera();
  });

  // iOS Safariはバックグラウンド移行でカメラを止めるため、復帰時に再起動する
  const onVis = () => { if (document.visibilityState === 'visible' && !stream) startCamera(); };
  document.addEventListener('visibilitychange', onVis);

  root._cleanup = () => {
    stopCamera();
    document.removeEventListener('visibilitychange', onVis);
  };

  startCamera();
}

// 開発・デモ用の合成ランドマーク（立位・正面の標準体型）
export function demoPoints(w, h) {
  const cx = w / 2;
  const P = (x, y) => ({ x: cx + x * w, y: y * h, visibility: 0.95 });
  const pts = new Array(33).fill(null).map(() => P(0, 0.5));
  pts[0] = P(0, 0.14);                                  // nose
  pts[2] = P(0.018, 0.13); pts[5] = P(-0.018, 0.13);    // eyes
  pts[7] = P(0.032, 0.145); pts[8] = P(-0.032, 0.145);  // ears
  pts[11] = P(0.095, 0.25); pts[12] = P(-0.095, 0.25);  // shoulders
  pts[13] = P(0.125, 0.38); pts[14] = P(-0.125, 0.38);  // elbows
  pts[15] = P(0.135, 0.50); pts[16] = P(-0.135, 0.50);  // wrists
  pts[17] = P(0.14, 0.545); pts[18] = P(-0.14, 0.545);  // pinky
  pts[19] = P(0.138, 0.535); pts[20] = P(-0.138, 0.535);// index
  pts[21] = P(0.13, 0.53); pts[22] = P(-0.13, 0.53);    // thumb
  pts[23] = P(0.062, 0.52); pts[24] = P(-0.062, 0.52);  // hips
  pts[25] = P(0.065, 0.70); pts[26] = P(-0.065, 0.70);  // knees
  pts[27] = P(0.07, 0.875); pts[28] = P(-0.07, 0.875);  // ankles
  pts[29] = P(0.075, 0.90); pts[30] = P(-0.075, 0.90);  // heels
  pts[31] = P(0.082, 0.915); pts[32] = P(-0.082, 0.915);// foot index
  return pts;
}
