// アプリ起動・画面ルーター（otree-membershipのタブ方式を踏襲しつつ「戻る」スタックを追加）
import * as patients from './screens/patientList.js';
import * as sessions from './screens/sessionList.js';
import * as sessionDetail from './screens/sessionDetail.js';
import * as capture from './screens/capture.js';
import * as measure from './screens/measure.js';
import * as report from './screens/reportCompare.js';
import * as settings from './screens/settings.js';

const SCREENS = { patients, sessions, sessionDetail, capture, measure, report, settings };

const root = document.getElementById('app');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');

const stack = [];
let current = null;

export const DEMO = new URLSearchParams(location.search).has('demo');

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

const ctx = {
  nav, back, toast,
  setHeader(title, showBack) {
    titleEl.textContent = title;
    backBtn.style.display = showBack ? '' : 'none';
  },
};

export function nav(screen, params = {}, opts = {}) {
  if (current && !opts.replace) stack.push(current);
  if (opts.clearStack) stack.length = 0;
  current = { screen, params };
  render();
}

export function back() {
  const prev = stack.pop();
  if (prev) {
    current = prev;
    render();
  }
}

async function render() {
  // 画面離脱時のクリーンアップ（カメラ停止など）
  if (root._cleanup) { try { root._cleanup(); } catch {} root._cleanup = null; }
  root.innerHTML = '';
  const mod = SCREENS[current.screen];
  await mod.render(root, current.params, ctx);
  window.scrollTo(0, 0);
}

backBtn.addEventListener('click', back);

// アプリの更新案内。測定の途中で勝手に再読み込みしないよう、押されたときだけ更新する
function showUpdateBanner() {
  if (document.getElementById('updateBanner')) return;
  const el = document.createElement('div');
  el.id = 'updateBanner';
  el.innerHTML = '<span>アプリの新しいバージョンがあります</span><button class="primary small">更新する</button>';
  el.querySelector('button').addEventListener('click', () => location.reload());
  document.body.appendChild(el);
}

if ('serviceWorker' in navigator && !DEMO) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateBanner(); // 初回インストール時は案内不要
  });
}

nav('patients', {}, { clearStack: true });
