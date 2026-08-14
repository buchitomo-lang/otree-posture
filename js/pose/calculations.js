// 33ランドマーク（MediaPipe Pose）のピクセル座標から各測定値を算出する純関数群。
// 座標系: 画像ピクセル、x右向き・y下向き。points[i] = {x, y, visibility}
// 注意: MediaPipeの left/right は「患者本人から見た左右」。
//       正面カメラ（非ミラー）では患者の右肩(12)は画像の左側に写る。

export const LM = {
  NOSE: 0,
  L_EYE: 2, R_EYE: 5,
  L_EAR: 7, R_EAR: 8,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_INDEX: 19, R_INDEX: 20,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
  L_HEEL: 29, R_HEEL: 30,
  L_FOOT: 31, R_FOOT: 32,
};

// 各ランドマークの表示名。左右はMediaPipeの規約どおり「患者さん本人から見た左右」
export const LANDMARK_NAMES = [
  '鼻', '左目頭', '左目', '左目尻', '右目頭', '右目', '右目尻',
  '左耳', '右耳', '口の左端', '口の右端',
  '左肩', '右肩', '左ひじ', '右ひじ', '左手首', '右手首',
  '左小指', '右小指', '左人差し指', '右人差し指', '左親指', '右親指',
  '左股関節', '右股関節', '左ひざ', '右ひざ', '左足首', '右足首',
  '左かかと', '右かかと', '左つま先', '右つま先',
];

// 対応する解剖学的名称。
// MediaPipeの公式仕様は ankle / shoulder のような一般名しか定義していないため、
// 「写真上で最も視認しやすい骨指標」として臨床で対応づけられている名称を併記する。
// Googleが保証する定義ではなく、あくまで目安。
export const LANDMARK_ANATOMY = [
  '鼻尖',                                                    // 0
  '内眼角', '瞳孔', '外眼角', '内眼角', '瞳孔', '外眼角',        // 1-6
  '耳珠', '耳珠',                                             // 7,8
  '口角', '口角',                                             // 9,10
  '肩峰', '肩峰',                                             // 11,12
  '上腕骨外側上顆', '上腕骨外側上顆',                           // 13,14
  '手関節中央', '手関節中央',                                  // 15,16
  '第5中手指節関節', '第5中手指節関節',                         // 17,18
  '第2中手指節関節', '第2中手指節関節',                         // 19,20
  '第1中手指節関節', '第1中手指節関節',                         // 21,22
  '大転子', '大転子',                                          // 23,24
  '大腿骨外側上顆', '大腿骨外側上顆',                           // 25,26
  '外果', '外果',                                              // 27,28
  '踵骨隆起', '踵骨隆起',                                       // 29,30
  '中足骨頭', '中足骨頭',                                       // 31,32
];

const deg = (rad) => rad * 180 / Math.PI;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function mid(p, i, j) {
  return { x: (p[i].x + p[j].x) / 2, y: (p[i].y + p[j].y) / 2 };
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 体幹長（肩中点〜股関節中点）: 距離系の値を正規化する基準
export function torsoLen(p) {
  return dist(mid(p, LM.L_SHOULDER, LM.R_SHOULDER), mid(p, LM.L_HIP, LM.R_HIP));
}

// ベクトル(from→to)の鉛直からの角度（度）。0=真上、+x側へ傾くと正
function angleFromVertical(from, to) {
  return deg(Math.atan2(to.x - from.x, from.y - to.y));
}

// 側面ビュー: 左右どちらの側がカメラに写っているか（visibilityの高い方）を選ぶ
export function pickSide(p) {
  const L = [LM.L_EAR, LM.L_SHOULDER, LM.L_HIP, LM.L_KNEE, LM.L_ANKLE];
  const R = [LM.R_EAR, LM.R_SHOULDER, LM.R_HIP, LM.R_KNEE, LM.R_ANKLE];
  const vis = (idx) => idx.reduce((s, i) => s + (p[i].visibility ?? 1), 0);
  return vis(R) >= vis(L)
    ? { ear: LM.R_EAR, shoulder: LM.R_SHOULDER, hip: LM.R_HIP, knee: LM.R_KNEE, ankle: LM.R_ANKLE, wrist: LM.R_WRIST }
    : { ear: LM.L_EAR, shoulder: LM.L_SHOULDER, hip: LM.L_HIP, knee: LM.L_KNEE, ankle: LM.L_ANKLE, wrist: LM.L_WRIST };
}

// 側面ビューの前方方向（+1: 画像右が前 / -1: 画像左が前）。鼻が耳より前に出ることを利用
function facingSign(p) {
  const s = pickSide(p);
  return p[LM.NOSE].x >= p[s.ear].x ? 1 : -1;
}

const round1 = (v) => Math.round(v * 10) / 10;

// ---- 正面・姿勢 ----

// 肩の高さ左右差（度）: +は患者の右肩が下がり
function frontShoulderHeight(p) {
  const dy = p[LM.R_SHOULDER].y - p[LM.L_SHOULDER].y;
  const dx = Math.abs(p[LM.R_SHOULDER].x - p[LM.L_SHOULDER].x);
  return round1(deg(Math.atan2(dy, dx)));
}

// 首の傾き（度）: 肩中点→耳中点の鉛直からの角度。+は患者の右へ傾き
function frontHeadTilt(p) {
  const a = angleFromVertical(mid(p, LM.L_SHOULDER, LM.R_SHOULDER), mid(p, LM.L_EAR, LM.R_EAR));
  return round1(-a); // 非ミラー画像では患者の右=画像の左(-x)なので符号反転
}

// 胴体シフト（体幹比%）: 足首中点の鉛直線に対する肩中点の水平ずれ。+は患者の右へ
function frontTorsoShift(p) {
  const sh = mid(p, LM.L_SHOULDER, LM.R_SHOULDER);
  const ak = mid(p, LM.L_ANKLE, LM.R_ANKLE);
  return round1(-(sh.x - ak.x) / torsoLen(p) * 100);
}

// 足の開き具合（比）: 足首間距離 ÷ 股関節幅。1.0で腰幅、大きいほど開いている
function frontStanceWidth(p) {
  const ankleW = Math.abs(p[LM.L_ANKLE].x - p[LM.R_ANKLE].x);
  const hipW = Math.abs(p[LM.L_HIP].x - p[LM.R_HIP].x);
  return hipW < 1 ? null : Math.round(ankleW / hipW * 100) / 100;
}

// ---- 正面・可動域 ----

// 首の側屈（度・絶対値）: 最大側屈時の 肩中点→耳中点 の鉛直からの角度
function frontNeckLatFlex(p) {
  return round1(Math.abs(angleFromVertical(mid(p, LM.L_SHOULDER, LM.R_SHOULDER), mid(p, LM.L_EAR, LM.R_EAR))));
}

// 首の回旋（度・推定）: 単一2Dカメラでは幾何的に正確な回旋角は出せないため、
// 鼻の耳中点からの水平ずれ÷耳間距離のasinによる参考値のみ。手動確定が前提
function frontNeckRotation(p) {
  const earSpan = Math.abs(p[LM.L_EAR].x - p[LM.R_EAR].x);
  if (earSpan < 2) return null;
  const off = p[LM.NOSE].x - mid(p, LM.L_EAR, LM.R_EAR).x;
  return round1(Math.abs(deg(Math.asin(clamp(2 * off / earSpan, -1, 1)))));
}

// ---- 側面・姿勢（プラムライン: 足首鉛直線からの水平ずれ、体幹比%、+=前方）----

function sidePlumb(p, landmarkName) {
  const s = pickSide(p);
  const ref = p[s.ankle];
  const lm = p[s[landmarkName]];
  return round1((lm.x - ref.x) / torsoLen(p) * 100 * facingSign(p));
}

// ---- 側面・可動域 ----

// 首の伸展/前屈（度）: 肩→耳ベクトルの鉛直からの角度（絶対値）
function sideNeckAngle(p) {
  const s = pickSide(p);
  return round1(Math.abs(angleFromVertical(p[s.shoulder], p[s.ear])));
}

// 両手挙上（度）: 股関節→肩 と 肩→手首 のなす角。180で真上
function sideArmRaise(p) {
  const s = pickSide(p);
  const a = Math.atan2(p[s.shoulder].y - p[s.hip].y, p[s.shoulder].x - p[s.hip].x);
  const b = Math.atan2(p[s.wrist].y - p[s.shoulder].y, p[s.wrist].x - p[s.shoulder].x);
  let d = Math.abs(deg(a - b));
  if (d > 180) d = 360 - d;
  return round1(180 - d);
}

// 全身の伸展（度）: 足首→肩ベクトルの鉛直からの角度（絶対値、後方への傾き）
function sideFullExtension(p) {
  const s = pickSide(p);
  return round1(Math.abs(angleFromVertical(p[s.ankle], p[s.shoulder])));
}

// 前屈（度）: 股関節→肩ベクトルの鉛直からの角度
function sideTrunkFlexion(p) {
  const s = pickSide(p);
  return round1(Math.abs(angleFromVertical(p[s.hip], p[s.shoulder])));
}

// ---- 背面 ----

// 頭の後ろから背面タッチ（体幹比%）: 指のマーカーがC7近似（肩中点）よりどれだけ下に届いたか。+=下に届く
// 注意: MediaPipeのindexは指先ではなく指のつけ根の関節。指先基準にするには手動ドラッグが前提
function backScratchDown(p, indexLm) {
  const c7 = mid(p, LM.L_SHOULDER, LM.R_SHOULDER);
  return round1((p[indexLm].y - c7.y) / torsoLen(p) * 100);
}

// 腰の後ろから背面タッチ（体幹比%）: 指のマーカーが股関節中点よりどれだけ上に届いたか。+=上に届く
function backScratchUp(p, indexLm) {
  const hip = mid(p, LM.L_HIP, LM.R_HIP);
  return round1((hip.y - p[indexLm].y) / torsoLen(p) * 100);
}

// 体幹回旋: 2D背面ビューからの自動推定は不可能（奥行き情報がないため）→ 常に手動入力
function trunkRotation() {
  return null;
}

// ---- 座位・側面 ----

// 座位プラムライン（体幹比%）: 股関節鉛直線からの水平ずれ、+=前方
function seatedPlumb(p, landmarkName) {
  const s = pickSide(p);
  const ref = p[s.hip];
  const lm = p[s[landmarkName]];
  return round1((lm.x - ref.x) / torsoLen(p) * 100 * facingSign(p));
}

// itemKey → 計算関数
export const CALC = {
  front_shoulder_height: frontShoulderHeight,
  front_head_tilt: frontHeadTilt,
  front_torso_shift: frontTorsoShift,
  front_stance_width: frontStanceWidth,
  front_neck_lat_flex_r: frontNeckLatFlex,
  front_neck_lat_flex_l: frontNeckLatFlex,
  front_neck_rot_r: frontNeckRotation,
  front_neck_rot_l: frontNeckRotation,
  side_plumb_ear: (p) => sidePlumb(p, 'ear'),
  side_plumb_shoulder: (p) => sidePlumb(p, 'shoulder'),
  side_plumb_hip: (p) => sidePlumb(p, 'hip'),
  side_plumb_knee: (p) => sidePlumb(p, 'knee'),
  side_neck_ext: sideNeckAngle,
  side_neck_flex: sideNeckAngle,
  side_arm_raise: sideArmRaise,
  side_full_ext: sideFullExtension,
  side_trunk_flex: sideTrunkFlexion,
  back_scratch_head_r: (p) => backScratchDown(p, LM.R_INDEX),
  back_scratch_head_l: (p) => backScratchDown(p, LM.L_INDEX),
  back_scratch_waist_r: (p) => backScratchUp(p, LM.R_INDEX),
  back_scratch_waist_l: (p) => backScratchUp(p, LM.L_INDEX),
  back_trunk_rot_r: trunkRotation,
  back_trunk_rot_l: trunkRotation,
  seated_plumb_ear: (p) => seatedPlumb(p, 'ear'),
  seated_plumb_shoulder: (p) => seatedPlumb(p, 'shoulder'),
  seated_neck_ext: sideNeckAngle,
};

// 計算実行（ランドマーク欠損・追跡失敗時はnullを返す）
export function computeItem(itemKey, points) {
  try {
    if (!points || points.length < 33) return null;
    const v = CALC[itemKey](points);
    return (v === null || !isFinite(v)) ? null : v;
  } catch {
    return null;
  }
}
