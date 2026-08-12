// 端末内にある既存の写真ファイルから測定する
// ファイル → 形式判定 → 向き補正・リサイズしたcanvas → 静止画モードで姿勢推定
import { detectStillImage } from './landmarker.js';

// 長辺の上限。保存容量と処理速度のバランス（元写真が大きくても測定精度には影響しない）
const MAX_EDGE = 1600;

const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?|avif)$/i;

// 先頭バイトから実際の形式を判定する。
// HEICはブラウザによってファイル種別が空欄で渡されるため、拡張子やMIMEに頼れない
async function sniffFormat(file) {
  let buf;
  try {
    buf = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  } catch {
    return null;
  }
  const ascii = (s, e) => String.fromCharCode.apply(null, buf.slice(s, e));
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (ascii(1, 4) === 'PNG') return 'png';
  if (ascii(0, 3) === 'GIF') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  // HEIC/HEIF/AVIF は ISO base media 形式（先頭に ftyp ボックス）
  if (ascii(4, 8) === 'ftyp') return 'heic';
  if (ascii(0, 2) === 'BM') return 'bmp';
  if (ascii(0, 2) === 'II' || ascii(0, 2) === 'MM') return 'tiff';
  return null;
}

function looksLikeHeic(file, format) {
  return format === 'heic' || /hei[cf]|avif/i.test(file.type) || /\.(heic|heif|avif)$/i.test(file.name);
}

// ブラウザ標準のデコード。iPhone/iPadの写真はEXIFに回転情報を持つため向きを反映する
async function decodeNative(blob) {
  if (window.createImageBitmap) {
    try {
      return { src: await createImageBitmap(blob, { imageOrientation: 'from-image' }), url: null };
    } catch {
      // 未対応形式・オプション非対応の場合は img 経由へ
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { src: img, url };
}

// HEIC変換ライブラリは1.3MBあるため、HEICを読み込むときだけ遅延読み込みする
let heicLoader = null;
function loadHeic2any() {
  if (window.heic2any) return Promise.resolve(window.heic2any);
  if (heicLoader) return heicLoader;
  heicLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './vendor/heic2any/heic2any.min.js';
    s.onload = () => (window.heic2any
      ? resolve(window.heic2any)
      : reject(new Error('HEIC変換の準備に失敗しました')));
    s.onerror = () => reject(new Error('HEIC変換の準備に失敗しました'));
    document.head.appendChild(s);
  });
  return heicLoader;
}

async function decodeHeic(file) {
  const heic2any = await loadHeic2any();
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return decodeNative(Array.isArray(out) ? out[0] : out);
}

export async function importPhotoFile(file, onProgress = () => {}) {
  const format = await sniffFormat(file);
  const isHeic = looksLikeHeic(file, format);

  // 種別・拡張子・先頭バイトのいずれかで画像と判断できなければ弾く
  if (!format && !file.type.startsWith('image/') && !IMAGE_EXT.test(file.name)) {
    throw new Error('画像ファイル（JPEG / PNG / HEIC）を選んでください');
  }

  let decoded = null;
  try {
    // Safari（iPad/Mac）はHEICを標準で解読できるので、まず標準デコードを試す
    onProgress(isHeic ? 'HEIC写真を読み込んでいます…' : '写真を読み込んでいます…');
    decoded = await decodeNative(file);
  } catch {
    if (!isHeic) {
      throw new Error('この画像を読み込めませんでした。JPEG / PNG / HEIC の写真をお試しください');
    }
    // HEIC非対応のブラウザ（Chrome等）ではライブラリでJPEGへ変換してから読み込む
    onProgress('HEIC写真を変換しています（少し時間がかかります）…');
    try {
      decoded = await decodeHeic(file);
    } catch (e) {
      throw new Error('HEIC写真を変換できませんでした（' + (e.message || 'エラー') + '）');
    }
  }

  const { src, url } = decoded;
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

  onProgress('姿勢を解析しています…');
  const points = await detectStillImage(canvas, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));

  return { blob, width, height, points };
}
