// Service Worker: アプリ本体・AIモデル・ライブラリを全てキャッシュしてオフライン動作を実現
const CACHE = 'otree-posture-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/main.js',
  './js/db.js',
  './js/models.js',
  './js/pose/calculations.js',
  './js/pose/landmarker.js',
  './js/pose/photoImport.js',
  './js/overlays/drawing.js',
  './js/csv/csvExport.js',
  './js/screens/patientList.js',
  './js/screens/sessionList.js',
  './js/screens/sessionDetail.js',
  './js/screens/capture.js',
  './js/screens/measure.js',
  './js/screens/reportCompare.js',
  './js/screens/settings.js',
  './js/report/reportTemplate.js',
  './js/report/pdfExport.js',
  './vendor/mediapipe/vision_bundle.mjs',
  './vendor/mediapipe/pose_landmarker_lite.task',
  './vendor/mediapipe/wasm/vision_wasm_internal.js',
  './vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  './vendor/jspdf/jspdf.umd.min.js',
  './vendor/heic2any/heic2any.min.js',
  './vendor/html2canvas/html2canvas.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }))
  );
});
