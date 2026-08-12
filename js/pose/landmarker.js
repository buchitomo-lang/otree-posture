// MediaPipe Pose Landmarker の初期化とライフサイクル管理
// ローカルにベンダリングした wasm / .task を使用（オフライン動作のため CDN 不使用）
import { FilesetResolver, PoseLandmarker } from '../../vendor/mediapipe/vision_bundle.mjs';

let landmarker = null;
let initPromise = null;
// ライブ映像(VIDEO)と静止画(IMAGE)でモードが異なる。モデルは1つを使い回して切り替える
let runningMode = 'VIDEO';
let switching = false;

export function initLandmarker() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: './vendor/mediapipe/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    runningMode = 'VIDEO';
    return landmarker;
  })();
  return initPromise;
}

async function setMode(mode) {
  if (runningMode === mode) return;
  await landmarker.setOptions({ runningMode: mode });
  runningMode = mode;
}

function toPixels(landmarks, w, h) {
  return landmarks.map((lm) => ({
    x: lm.x * w,
    y: lm.y * h,
    visibility: lm.visibility ?? 1,
  }));
}

// video フレームから検出。正規化座標(0-1)をピクセル座標へ変換して返す
export function detectVideoFrame(video, timestampMs) {
  if (!landmarker) return null;
  // 写真読み込み後にカメラへ戻った場合はVIDEOモードへ戻す（切替中の数フレームはnull）
  if (runningMode !== 'VIDEO') {
    if (!switching) {
      switching = true;
      setMode('VIDEO').finally(() => { switching = false; });
    }
    return null;
  }
  const result = landmarker.detectForVideo(video, timestampMs);
  if (!result.landmarks || result.landmarks.length === 0) return null;
  return toPixels(result.landmarks[0], video.videoWidth, video.videoHeight);
}

// 静止画（canvas / img / ImageBitmap）から検出
export async function detectStillImage(source, width, height) {
  await initLandmarker();
  await setMode('IMAGE');
  const result = landmarker.detect(source);
  if (!result.landmarks || result.landmarks.length === 0) return null;
  return toPixels(result.landmarks[0], width, height);
}

export function isReady() {
  return landmarker !== null;
}
