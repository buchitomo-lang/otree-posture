// 端末内にある既存の写真ファイルから測定する
// ファイル → 向き補正・リサイズしたcanvas → 静止画モードで姿勢推定
import { detectStillImage } from './landmarker.js';

// 長辺の上限。保存容量と処理速度のバランス（元写真が大きくても測定精度には影響しない）
const MAX_EDGE = 1600;

// iPhone/iPadの写真はEXIFに回転情報を持つため、向きを反映してデコードする
async function decode(file) {
  if (window.createImageBitmap) {
    try {
      return { src: await createImageBitmap(file, { imageOrientation: 'from-image' }), url: null };
    } catch {
      // createImageBitmap非対応・HEIC等でのデコード失敗時は img へフォールバック
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('この形式の画像は読み込めません'));
      img.src = url;
    });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { src: img, url };
}

export async function importPhotoFile(file) {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください');

  const { src, url } = await decode(file);
  const sw = src.naturalWidth || src.width;
  const sh = src.naturalHeight || src.height;
  if (!sw || !sh) throw new Error('画像のサイズを取得できませんでした');

  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(src, 0, 0, width, height);

  if (src.close) src.close();
  if (url) URL.revokeObjectURL(url);

  const points = await detectStillImage(canvas, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));

  return { blob, width, height, points };
}
