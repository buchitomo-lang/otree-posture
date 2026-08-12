# O'Tree 姿勢・可動域測定アプリ

患者さんの姿勢と可動域（ROM）をiPadのカメラ + AI姿勢推定（MediaPipe Pose）で測定し、
CSV保存・過去データとの比較レポート（PDF/印刷）まで行うPWA。

## 使い方（開発）

```bash
python3 -m http.server 8766 --directory ~/otree-posture
# → http://localhost:8766 を開く
# カメラなしで動作確認する場合: http://localhost:8766/?demo=1
```

## 院内での利用（iPad）

iPad Safari のカメラAPI（getUserMedia）は **HTTPS必須** のため、
GitHub Pages / Cloudflare Pages 等の静的ホスティングにデプロイして利用する。
初回読み込み後はService Workerが全アセット（AIモデル含む）をキャッシュするため、
オフラインでも動作する。ホーム画面に追加するとフルスクリーンで起動。

## 測定の仕組み

- 撮影グループ（19グループ）ごとに1枚撮影、または端末内の既存写真を読み込み
  （「写真を選択」ボタン／画面へのドラッグ＆ドロップ）
  → MediaPipe Pose の33ランドマークから自動計算
- 対応形式: JPEG / PNG / HEIC（HEICはSafariなら標準機能で、非対応ブラウザでは
  同梱の heic2any でJPEGへ変換してから解析。拡張子やファイル種別が不明でも
  先頭バイトから形式を判定する）
- 過去に撮った写真を取り込む場合は、セッション詳細画面の「測定日」を撮影日に変更しておくと
  比較レポートの日付が正しくなる
- 全項目で写真上の関節マーカーをドラッグ補正可能（値は即再計算）
- 2Dカメラで原理的に測れない項目（首の回旋・体幹回旋・背面タッチ）は
  手動確定が前提（`manualPrimary`）
- 距離系は体幹長（肩中点〜股関節中点）比の%で正規化（単眼カメラでは絶対cmが出ないため）

## データ

- すべて端末内 IndexedDB（`otree-posture-db`）に保存。サーバーなし
- stores: patients / sessions / measurements / photos
- 設定画面からJSONバックアップ書き出し・復元が可能（写真はbase64で内包）
- CSV: 1測定=1行のロング形式、UTF-8 BOM付き（Excel対応）

## 構成

- ビルド不要の vanilla JS + ES modules（otree-membershipと同じ方式）
- `js/models.js` … 測定項目レジストリ（26項目・19グループ）＝全画面の単一情報源
- `js/pose/calculations.js` … ランドマーク→数値の計算（純関数）
- `vendor/` … MediaPipe wasm+モデル / jsPDF / html2canvas をローカル同梱（CDN不使用）
