const CACHE = 'household-hub-v33';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'src/receipts.js', 'src/receipt-list.js', 'js/common.js', 'js/theme.js', 'js/settings.js', 'js/finance.js', 'js/calendar.js', 'js/chart.js', 'js/notes.js', 'js/categories.js', 'js/note-sheet.js', 'js/attachments.js', 'js/import-notes.js', 'js/lists.js', 'js/home.js', 'js/backup.js', 'manifest.json'];

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
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
