const CACHE = 'household-hub-v14';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'js/common.js', 'js/settings.js', 'js/finance.js', 'js/calendar.js', 'js/chart.js', 'js/notes.js', 'js/diary.js', 'js/lists.js', 'js/backup.js', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});