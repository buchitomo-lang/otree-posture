// 患者一覧・検索・新規登録
import * as db from '../db.js';
import { newId } from '../models.js';

export async function render(root, params, ctx) {
  ctx.setHeader("O'Tree 姿勢・可動域測定", false);

  root.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <input type="text" id="q" class="grow" placeholder="患者名・カナで検索" autocomplete="off">
      <button class="primary" id="addBtn">＋ 新規患者</button>
    </div>
    <ul class="list" id="plist"></ul>
    <div class="row noprint" style="justify-content:center;margin-top:20px">
      <button class="secondary small" id="settingsBtn">⚙ 設定・バックアップ</button>
    </div>
  `;

  const listEl = root.querySelector('#plist');
  let all = await db.listPatients();

  async function draw(filter = '') {
    const f = filter.trim();
    const shown = f
      ? all.filter((p) => (p.name || '').includes(f) || (p.kana || '').includes(f))
      : all;
    if (shown.length === 0) {
      listEl.innerHTML = `<div class="empty">${all.length === 0 ? 'まだ患者が登録されていません。「＋ 新規患者」から登録してください。' : '該当する患者がいません'}</div>`;
      return;
    }
    listEl.innerHTML = '';
    for (const p of shown) {
      const sessions = await db.listSessions(p.id);
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="info">
          <div class="name">${esc(p.name)}</div>
          <div class="sub">${esc(p.kana || '')}　測定 ${sessions.length} 回${sessions[0] ? '　最終: ' + sessions[0].date : ''}</div>
        </div>
        <span class="chev">›</span>`;
      li.addEventListener('click', () => ctx.nav('sessions', { patientId: p.id }));
      listEl.appendChild(li);
    }
  }
  await draw();

  root.querySelector('#q').addEventListener('input', (e) => draw(e.target.value));
  root.querySelector('#settingsBtn').addEventListener('click', () => ctx.nav('settings'));
  root.querySelector('#addBtn').addEventListener('click', () => showAddModal(root, ctx, async () => {
    all = await db.listPatients();
    await draw(root.querySelector('#q').value);
  }));
}

function showAddModal(root, ctx, onSaved) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal">
      <h2>新規患者の登録</h2>
      <label class="field"><span>氏名 *</span><input type="text" id="mName"></label>
      <label class="field"><span>フリガナ</span><input type="text" id="mKana"></label>
      <label class="field"><span>生年月日</span><input type="date" id="mBirth"></label>
      <label class="field"><span>性別</span>
        <select id="mSex">
          <option value="">未設定</option><option value="M">男性</option>
          <option value="F">女性</option><option value="other">その他</option>
        </select>
      </label>
      <div class="row" style="justify-content:flex-end;margin-top:8px">
        <button class="secondary" id="mCancel">キャンセル</button>
        <button class="primary" id="mSave">登録</button>
      </div>
    </div>`;
  document.body.appendChild(bg);
  bg.querySelector('#mCancel').addEventListener('click', () => bg.remove());
  bg.querySelector('#mSave').addEventListener('click', async () => {
    const name = bg.querySelector('#mName').value.trim();
    if (!name) { ctx.toast('氏名を入力してください'); return; }
    await db.put('patients', {
      id: newId('p'),
      name,
      kana: bg.querySelector('#mKana').value.trim(),
      birthDate: bg.querySelector('#mBirth').value || null,
      sex: bg.querySelector('#mSex').value || null,
      memo: '',
      createdAt: new Date().toISOString(),
    });
    bg.remove();
    ctx.toast('患者を登録しました');
    onSaved();
  });
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
