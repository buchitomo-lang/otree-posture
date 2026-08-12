// 患者さん向け比較レポートのHTML生成（O'Treeブランドスタイル）
import { GROUPS, ITEMS, VIEWS, unitLabel } from '../models.js';
import { esc } from '../screens/patientList.js';

// 変化の評価: 可動域は増加=改善、姿勢はゼロ（正中・鉛直）に近づく=改善
function judge(item, past, cur) {
  if (past == null || cur == null) return null;
  if (item.unit === 'ratio') return null;
  const d = cur - past;
  if (Math.abs(d) < 0.05) return null;
  if (item.category === 'rom') return d > 0 ? 'better' : 'worse';
  return Math.abs(cur) < Math.abs(past) ? 'better' : 'worse';
}

function fmt(v) {
  return v == null ? '—' : String(v);
}

// 姿勢グループの写真を並べて表示する対象
const PHOTO_GROUPS = ['g_front_posture', 'g_side_posture', 'g_seated_posture'];

export function buildReportHTML({ patient, curSession, curMap, curPhotos, pastSession, pastMap, pastPhotos }) {
  const hasPast = !!pastSession;
  let html = `
    <div class="rheader">
      <h2>姿勢・可動域測定レポート</h2>
      <div class="meta">
        <b>${esc(patient.name)} 様</b>
        測定日: ${curSession.date}
        ${hasPast ? `　（比較: ${pastSession.date} の測定結果）` : ''}
      </div>
    </div>`;

  for (const viewKey of Object.keys(VIEWS)) {
    const viewItems = ITEMS.filter((it) => it.view === viewKey && (curMap[it.key] || (hasPast && pastMap[it.key])));
    if (viewItems.length === 0) continue;
    html += `<h3 class="viewtitle">${VIEWS[viewKey]}</h3>`;

    // 姿勢写真の並列表示
    for (const gk of PHOTO_GROUPS) {
      const g = GROUPS.find((x) => x.key === gk && x.view === viewKey);
      if (!g) continue;
      const curPh = curPhotos.find((p) => p.groupKey === gk);
      const pastPh = hasPast ? pastPhotos.find((p) => p.groupKey === gk) : null;
      if (!curPh && !pastPh) continue;
      html += `<div class="photos">`;
      if (pastPh) html += `<figure><img src="${pastPh._url}"><figcaption>前回 ${pastSession.date}</figcaption></figure>`;
      if (curPh) html += `<figure><img src="${curPh._url}"><figcaption>今回 ${curSession.date}</figcaption></figure>`;
      html += `</div>`;
    }

    html += `<table class="rvals"><thead><tr>
      <th style="width:40%">測定項目</th>
      ${hasPast ? `<th style="text-align:right">前回</th>` : ''}
      <th style="text-align:right">今回</th>
      <th>単位</th>
      ${hasPast ? '<th>変化</th>' : ''}
    </tr></thead><tbody>`;

    for (const it of viewItems) {
      const cur = curMap[it.key]?.finalValue ?? null;
      const past = hasPast ? (pastMap[it.key]?.finalValue ?? null) : null;
      const j = hasPast ? judge(it, past, cur) : null;
      const delta = (past != null && cur != null) ? Math.round((cur - past) * 10) / 10 : null;
      html += `<tr>
        <td>${esc(it.label)}</td>
        ${hasPast ? `<td class="num">${fmt(past)}</td>` : ''}
        <td class="num"><b>${fmt(cur)}</b></td>
        <td>${unitLabel(it.unit)}</td>
        ${hasPast ? `<td>${delta == null ? '—'
          : `<span class="${j === 'better' ? 'delta-better' : j === 'worse' ? 'delta-worse' : ''}">${delta > 0 ? '+' : ''}${delta}${j === 'better' ? ' ↗改善' : j === 'worse' ? ' ↘' : ''}</span>`}</td>` : ''}
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `
    <div class="rfooter">
      <span>O'Tree Chiropractic</span>
      <span>発行日: ${new Date().toISOString().slice(0, 10)}</span>
    </div>`;
  return html;
}
