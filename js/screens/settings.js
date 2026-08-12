// 設定: バックアップ書き出し / 復元 / データ削除
import * as db from '../db.js';

export async function render(root, params, ctx) {
  ctx.setHeader('設定・バックアップ', true);

  const patients = await db.getAll('patients');
  const sessions = await db.getAll('sessions');
  const photos = await db.getAll('photos');
  const photoMB = Math.round(photos.reduce((s, p) => s + (p.blob?.size ?? 0), 0) / 1024 / 1024 * 10) / 10;

  root.innerHTML = `
    <div class="card">
      <h2>データの状況</h2>
      <p>患者 ${patients.length} 名 ／ 測定セッション ${sessions.length} 回 ／ 写真 ${photos.length} 枚（約 ${photoMB} MB）</p>
      <p class="hint">データはすべてこの端末のブラウザ内（IndexedDB）に保存されています。端末の故障や誤操作に備え、定期的にバックアップを書き出して安全な場所に保管してください。</p>
    </div>
    <div class="card">
      <h2>バックアップ</h2>
      <div class="row">
        <button class="primary" id="exportBtn">バックアップを書き出す</button>
        <button class="secondary" id="importBtn">バックアップから復元</button>
        <input type="file" id="importFile" accept=".json" style="display:none">
      </div>
      <p class="hint">写真を含むため、ファイルサイズが大きくなる場合があります。復元は同じIDのデータを上書きします。</p>
    </div>
    <div class="card">
      <h2>アプリ情報</h2>
      <p class="hint">O'Tree 姿勢・可動域測定 v1.0<br>
      カメラが起動しない場合: HTTPSでアクセスしているか、Safariの設定でカメラが許可されているかを確認してください。</p>
    </div>
  `;

  root.querySelector('#exportBtn').addEventListener('click', async () => {
    ctx.toast('バックアップを作成しています…');
    const json = await db.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `otree_posture_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    ctx.toast('バックアップを書き出しました');
  });

  const fileInput = root.querySelector('#importFile');
  root.querySelector('#importBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!confirm('バックアップを復元しますか？ 同じIDの既存データは上書きされます。')) return;
    try {
      const result = await db.importBackup(await file.text());
      ctx.toast(`復元しました（患者${result.patients}名・セッション${result.sessions}回）`);
      render(root, params, ctx);
    } catch (e) {
      alert('復元に失敗しました: ' + e.message);
    }
  });
}
