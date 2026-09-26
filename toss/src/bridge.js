// 토스 미니앱 전용 연결 코드
// 1) 기록을 토스 저장소(Storage)에도 보관하고, 앱을 켤 때 브라우저 저장소가 비어 있으면 되살린다.
// 2) 유튜브 같은 바깥 링크는 토스 규칙대로 Device.openURL로 연다.
import { Device, Storage } from '@apps-in-toss/web-framework';

const KEYS = ['plate-log-v1', 'plate-log-theme'];
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

window.__persist = (key, value) => { try { Storage.setItem(key, value).catch(() => {}); } catch (e) {} };

async function restore() {
  for (const key of KEYS) {
    try {
      const saved = await timeout(Storage.getItem(key), 1500);
      let local = null; try { local = localStorage.getItem(key); } catch (e) {}
      if (saved && !local) localStorage.setItem(key, saved);
      else if (local && !saved) window.__persist(key, local);
    } catch (e) { /* 토스 밖(일반 브라우저)에서는 건너뜀 */ }
  }
  try { const t = localStorage.getItem('plate-log-theme'); if (t === 'light' || t === 'dark') document.documentElement.classList.add('app-' + t); } catch (e) {}
}

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="http"]');
  if (!a) return;
  e.preventDefault();
  timeout(Device.openURL(a.href), 3000).catch(() => window.open(a.href, '_blank', 'noopener'));
}, true);

restore().finally(() => window.__startApp && window.__startApp());
