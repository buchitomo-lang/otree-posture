// MediaPipe Pose Landmarker の初期化とライフサイクル管理
// ローカルにベンダリングした wasm / .task を使用（オフライン動作のため CDN 不使用）
import { FilesetResolver, PoseLandmarker } from '../../vendor/mediapipe/vision_bundle.mjs';

let landmarker = null;
let initPromise = null;

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
    return landmarker;
  })();
  return initPromise;
}

// video フレームから検出。正規化座標(0-1)をピクセル座標へ変換して返す
export function detectVideoFrame(video, timestampMs) {
  if (!landmarker) return null;
  const result = landmarker.detectForVideo(video, timestampMs);
  if (!result.landmarks || result.landmarks.length === 0) return null;
  const w = video.videoWidth, h = video.videoHeight;
  return result.landmarks[0].map((lm) => ({
    x: lm.x * w,
    y: lm.y * h,
    visibility: lm.visibility ?? 1,
  }));
}

export function isReady() {
  return landmarker !== null;
}
