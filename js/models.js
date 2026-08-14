// 測定項目レジストリ: アプリ全体（撮影・測定・CSV・レポート）の単一の情報源
import { LM } from './pose/calculations.js';

export const VIEWS = {
  front: '正面',
  side_right: '側面（右向き）',
  back: '背面',
  seated_side: '座位・側面',
};

export const CATEGORIES = { posture: '姿勢', rom: '可動域' };

export const UNITS = {
  deg: '°',
  pct: '%（体幹比）',
  ratio: '比',
};

// 撮影グループ: 1グループ = 1枚の写真。グループ内の全項目を同じ写真から測定する
export const GROUPS = [
  { key: 'g_front_posture', view: 'front', label: '立位姿勢（正面）', pose: '自然に立って正面を向く' },
  { key: 'g_front_lat_flex_r', view: 'front', label: '首の側屈（右）', pose: '首を右へ最大まで倒す' },
  { key: 'g_front_lat_flex_l', view: 'front', label: '首の側屈（左）', pose: '首を左へ最大まで倒す' },
  { key: 'g_front_rot_r', view: 'front', label: '首の回旋（右）', pose: '顔を右へ最大まで回す' },
  { key: 'g_front_rot_l', view: 'front', label: '首の回旋（左）', pose: '顔を左へ最大まで回す' },
  { key: 'g_side_posture', view: 'side_right', label: '立位姿勢（側面）', pose: '右向きで自然に立つ' },
  { key: 'g_side_neck_ext', view: 'side_right', label: '首の伸展', pose: '上を向いて首を最大まで反らす' },
  { key: 'g_side_neck_flex', view: 'side_right', label: '首の前屈', pose: '顎を引いて首を最大まで曲げる' },
  { key: 'g_side_arm_raise', view: 'side_right', label: '両手挙上', pose: '両手をまっすぐ上へ挙げる' },
  { key: 'g_side_full_ext', view: 'side_right', label: '両手挙上＋全身伸展', pose: '両手を挙げたまま全身を後ろへ反らす' },
  { key: 'g_side_trunk_flex', view: 'side_right', label: '前屈', pose: '膝を伸ばしたまま前屈する' },
  { key: 'g_back_scratch_head_r', view: 'back', label: '背面タッチ 上から右手', pose: '頭の後ろから右手で背中をタッチ' },
  { key: 'g_back_scratch_head_l', view: 'back', label: '背面タッチ 上から左手', pose: '頭の後ろから左手で背中をタッチ' },
  { key: 'g_back_scratch_waist_r', view: 'back', label: '背面タッチ 下から右手', pose: '腰の後ろから右手で背中をタッチ' },
  { key: 'g_back_scratch_waist_l', view: 'back', label: '背面タッチ 下から左手', pose: '腰の後ろから左手で背中をタッチ' },
  { key: 'g_back_rot_r', view: 'back', label: '体幹回旋（右）', pose: '両腕をわずかに開き右へ回旋' },
  { key: 'g_back_rot_l', view: 'back', label: '体幹回旋（左）', pose: '両腕をわずかに開き左へ回旋' },
  { key: 'g_seated_posture', view: 'seated_side', label: '座位姿勢（側面）', pose: '椅子に自然に座り右向き' },
  { key: 'g_seated_neck_ext', view: 'seated_side', label: '座位・首の伸展', pose: '座位のまま上を向いて首を反らす' },
];

// handles: 測定画面でドラッグ補正できるランドマーク番号
// manualPrimary: 自動推定が原理的に不正確なため手動確定を前提とする項目
export const ITEMS = [
  // ---- 正面・姿勢 ----
  { key: 'front_shoulder_height', group: 'g_front_posture', view: 'front', category: 'posture',
    label: '肩の高さ左右差', unit: 'deg', handles: [LM.L_SHOULDER, LM.R_SHOULDER],
    hint: '＋は右肩下がり／−は左肩下がり' },
  { key: 'front_head_tilt', group: 'g_front_posture', view: 'front', category: 'posture',
    label: '首の傾き', unit: 'deg', handles: [LM.L_EAR, LM.R_EAR, LM.L_SHOULDER, LM.R_SHOULDER],
    hint: '＋は右へ傾き／−は左へ傾き' },
  { key: 'front_torso_shift', group: 'g_front_posture', view: 'front', category: 'posture',
    label: '胴体のシフト', unit: 'pct', handles: [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ANKLE, LM.R_ANKLE],
    hint: '足首中心の鉛直線からの肩中心のずれ。＋は右へ' },
  { key: 'front_stance_width', group: 'g_front_posture', view: 'front', category: 'posture',
    label: '足の開き具合', unit: 'ratio', handles: [LM.L_ANKLE, LM.R_ANKLE, LM.L_HIP, LM.R_HIP],
    hint: '足首間距離÷腰幅。1.0で腰幅と同じ' },
  // ---- 正面・可動域 ----
  { key: 'front_neck_lat_flex_r', group: 'g_front_lat_flex_r', view: 'front', category: 'rom',
    label: '首の側屈（右）', unit: 'deg', handles: [LM.L_EAR, LM.R_EAR, LM.L_SHOULDER, LM.R_SHOULDER],
    hint: '正常参考値: 約40〜45°' },
  { key: 'front_neck_lat_flex_l', group: 'g_front_lat_flex_l', view: 'front', category: 'rom',
    label: '首の側屈（左）', unit: 'deg', handles: [LM.L_EAR, LM.R_EAR, LM.L_SHOULDER, LM.R_SHOULDER],
    hint: '正常参考値: 約40〜45°' },
  { key: 'front_neck_rot_r', group: 'g_front_rot_r', view: 'front', category: 'rom',
    label: '首の回旋（右）', unit: 'deg', manualPrimary: true,
    handles: [LM.NOSE, LM.L_EAR, LM.R_EAR],
    hint: '2Dカメラでは正確な回旋角を自動計測できません。目視で確認して入力してください（正常参考値: 約60〜80°）' },
  { key: 'front_neck_rot_l', group: 'g_front_rot_l', view: 'front', category: 'rom',
    label: '首の回旋（左）', unit: 'deg', manualPrimary: true,
    handles: [LM.NOSE, LM.L_EAR, LM.R_EAR],
    hint: '2Dカメラでは正確な回旋角を自動計測できません。目視で確認して入力してください（正常参考値: 約60〜80°）' },
  // ---- 側面・姿勢 ----
  { key: 'side_plumb_ear', group: 'g_side_posture', view: 'side_right', category: 'posture',
    label: '耳（頭）の前方偏位', unit: 'pct', handles: [LM.R_EAR, LM.R_ANKLE, LM.R_SHOULDER, LM.R_HIP],
    hint: 'くるぶし鉛直線からのずれ。＋は前方' },
  { key: 'side_plumb_shoulder', group: 'g_side_posture', view: 'side_right', category: 'posture',
    label: '肩の前方偏位', unit: 'pct', handles: [LM.R_SHOULDER, LM.R_ANKLE, LM.R_HIP],
    hint: 'くるぶし鉛直線からのずれ。＋は前方' },
  { key: 'side_plumb_hip', group: 'g_side_posture', view: 'side_right', category: 'posture',
    label: '股関節の前方偏位', unit: 'pct', handles: [LM.R_HIP, LM.R_ANKLE, LM.R_SHOULDER],
    hint: 'くるぶし鉛直線からのずれ。＋は前方' },
  { key: 'side_plumb_knee', group: 'g_side_posture', view: 'side_right', category: 'posture',
    label: '膝の前方偏位', unit: 'pct', handles: [LM.R_KNEE, LM.R_ANKLE, LM.R_HIP, LM.R_SHOULDER],
    hint: 'くるぶし鉛直線からのずれ。＋は前方' },
  // ---- 側面・可動域 ----
  { key: 'side_neck_ext', group: 'g_side_neck_ext', view: 'side_right', category: 'rom',
    label: '首の伸展', unit: 'deg', handles: [LM.R_EAR, LM.R_SHOULDER],
    hint: '肩→耳の鉛直からの角度（正常参考値: 約50〜60°）' },
  { key: 'side_neck_flex', group: 'g_side_neck_flex', view: 'side_right', category: 'rom',
    label: '首の前屈', unit: 'deg', handles: [LM.R_EAR, LM.R_SHOULDER],
    hint: '肩→耳の鉛直からの角度（正常参考値: 約45〜60°）' },
  { key: 'side_arm_raise', group: 'g_side_arm_raise', view: 'side_right', category: 'rom',
    label: '両手挙上', unit: 'deg', handles: [LM.R_WRIST, LM.R_SHOULDER, LM.R_HIP],
    hint: '股関節→肩→手首の角度。180°で真上（正常参考値: 約170〜180°）' },
  { key: 'side_full_ext', group: 'g_side_full_ext', view: 'side_right', category: 'rom',
    label: '両手挙上＋全身伸展', unit: 'deg', handles: [LM.R_SHOULDER, LM.R_ANKLE],
    hint: 'くるぶし→肩の鉛直からの後方傾斜角' },
  { key: 'side_trunk_flex', group: 'g_side_trunk_flex', view: 'side_right', category: 'rom',
    label: '前屈', unit: 'deg', handles: [LM.R_SHOULDER, LM.R_HIP],
    hint: '股関節→肩の鉛直からの角度。90°で水平' },
  // ---- 背面 ----
  { key: 'back_scratch_head_r', group: 'g_back_scratch_head_r', view: 'back', category: 'rom',
    label: '背面タッチ 上から右手（肩の屈曲・外旋）', unit: 'pct', manualPrimary: true,
    handles: [LM.R_INDEX, LM.L_SHOULDER, LM.R_SHOULDER],
    hint: '指先が首の付け根（C7）よりどれだけ下に届いたか（＋は下）。AIのマーカーは指のつけ根に付くため、写真上で指先までドラッグしてください' },
  { key: 'back_scratch_head_l', group: 'g_back_scratch_head_l', view: 'back', category: 'rom',
    label: '背面タッチ 上から左手（肩の屈曲・外旋）', unit: 'pct', manualPrimary: true,
    handles: [LM.L_INDEX, LM.L_SHOULDER, LM.R_SHOULDER],
    hint: '指先が首の付け根（C7）よりどれだけ下に届いたか（＋は下）。AIのマーカーは指のつけ根に付くため、写真上で指先までドラッグしてください' },
  { key: 'back_scratch_waist_r', group: 'g_back_scratch_waist_r', view: 'back', category: 'rom',
    label: '背面タッチ 下から右手（肩の伸展・内旋）', unit: 'pct', manualPrimary: true,
    handles: [LM.R_INDEX, LM.L_HIP, LM.R_HIP],
    hint: '指先が腰（股関節の高さ）よりどれだけ上に届いたか（＋は上）。AIのマーカーは指のつけ根に付くため、写真上で指先までドラッグしてください' },
  { key: 'back_scratch_waist_l', group: 'g_back_scratch_waist_l', view: 'back', category: 'rom',
    label: '背面タッチ 下から左手（肩の伸展・内旋）', unit: 'pct', manualPrimary: true,
    handles: [LM.L_INDEX, LM.L_HIP, LM.R_HIP],
    hint: '指先が腰（股関節の高さ）よりどれだけ上に届いたか（＋は上）。AIのマーカーは指のつけ根に付くため、写真上で指先までドラッグしてください' },
  { key: 'back_trunk_rot_r', group: 'g_back_rot_r', view: 'back', category: 'rom',
    label: '体幹回旋（右）', unit: 'deg', manualPrimary: true, handles: [],
    hint: '2Dカメラでは自動計測できません。目視で角度を入力してください（正常参考値: 約40〜45°）' },
  { key: 'back_trunk_rot_l', group: 'g_back_rot_l', view: 'back', category: 'rom',
    label: '体幹回旋（左）', unit: 'deg', manualPrimary: true, handles: [],
    hint: '2Dカメラでは自動計測できません。目視で角度を入力してください（正常参考値: 約40〜45°）' },
  // ---- 座位・側面 ----
  { key: 'seated_plumb_ear', group: 'g_seated_posture', view: 'seated_side', category: 'posture',
    label: '座位・頭の前方偏位', unit: 'pct', handles: [LM.R_EAR, LM.R_HIP, LM.R_SHOULDER],
    hint: '股関節鉛直線からのずれ。＋は前方' },
  { key: 'seated_plumb_shoulder', group: 'g_seated_posture', view: 'seated_side', category: 'posture',
    label: '座位・肩の前方偏位', unit: 'pct', handles: [LM.R_SHOULDER, LM.R_HIP],
    hint: '股関節鉛直線からのずれ。＋は前方' },
  { key: 'seated_neck_ext', group: 'g_seated_neck_ext', view: 'seated_side', category: 'rom',
    label: '座位・首の伸展', unit: 'deg', handles: [LM.R_EAR, LM.R_SHOULDER],
    hint: '肩→耳の鉛直からの角度' },
];

export function itemsOfGroup(groupKey) {
  return ITEMS.filter((it) => it.group === groupKey);
}
export function getItem(key) {
  return ITEMS.find((it) => it.key === key);
}
export function getGroup(key) {
  return GROUPS.find((g) => g.key === key);
}
export function unitLabel(unit) {
  return UNITS[unit] ?? unit;
}

export function newId(prefix) {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return prefix + '_' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
