// Backup v2 (safer export and import)
const BACKUP_META_KEYS = ['hubLastBackup'];

function getBackupData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (BACKUP_META_KEYS.includes(key)) continue;
    data[key] = localStorage.getItem(key);
  }
  return data;
}

function makeBackupFile() {
  const backup = {
    app: 'Household Hub',
    version: 2,
    exportedAt: Date.now(),
    data: getBackupData()
  };
  const name = 'household-hub-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  return { name: name, json: JSON.stringify(backup, null, 2) };
}

function markBackupDone() {
  localStorage.setItem('hubLastBackup', String(Date.now()));
  updateBackupStatus();
}

function downloadBackup() {
  const f = makeBackupFile();
  const blob = new Blob([f.json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  a.click();
  URL.revokeObjectURL(url);
  markBackupDone();
}

async function shareBackup() {
  const f = makeBackupFile();
  const file = new File([f.json], f.name, { type: 'text/plain' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Household Hub backup' });
      markBackupDone();
    } catch (err) {
      // cancelled
    }
  } else {
    alert('Sharing is not supported here. The file will be saved instead.');
    downloadBackup();
  }
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      const data = (obj && obj.app === 'Household Hub' && obj.data) ? obj.data : obj;
      if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('bad');
      const keys = Object.keys(data);
      if (keys.length === 0 || !keys.every(k => typeof data[k] === 'string')) throw new Error('bad');
      if (!confirm('This will replace all current data on this phone (' + keys.length + ' items). Continue?')) return;
      const last = localStorage.getItem('hubLastBackup');
      localStorage.clear();
      keys.forEach(k => localStorage.setItem(k, data[k]));
      if (last) localStorage.setItem('hubLastBackup', last);
      location.reload();
    } catch (err) {
      alert('This file is not a valid backup.');
    }
  };
  reader.readAsText(file);
}

function daysSinceBackup() {
  const t = parseInt(localStorage.getItem('hubLastBackup') || '0', 10);
  if (!t) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function updateBackupStatus() {
  const days = daysSinceBackup();
  let text;
  if (days === null) text = 'Last backup: never';
  else if (days === 0) text = 'Last backup: today';
  else text = 'Last backup: ' + days + ' day(s) ago';
  document.getElementById('backup-status').textContent = text;

  const hasData = Object.keys(getBackupData()).length > 0;
  const banner = document.getElementById('backup-banner');
  banner.hidden = !(hasData && (days === null || days >= 7));
  banner.textContent = 'Time to back up your data. ' + text + '. Tap here.';
}

function updateProtectionStatus() {
  const el = document.getElementById('storage-status');
  if (!(navigator.storage && navigator.storage.persist)) {
    el.textContent = 'Storage protection: not supported on this browser';
    return;
  }
  navigator.storage.persisted().then(already => {
    if (already) {
      el.textContent = 'Storage protection: ON';
      return;
    }
    navigator.storage.persist().then(granted => {
      el.textContent = 'Storage protection: ' +
        (granted ? 'ON' : 'OFF (install the app to your home screen to improve this)');
    });
  });
}

document.getElementById('export-btn').addEventListener('click', downloadBackup);
document.getElementById('share-btn').addEventListener('click', shareBackup);
document.getElementById('import-file').addEventListener('change', e => {
  importBackup(e.target.files[0]);
  e.target.value = '';
});
document.getElementById('backup-banner').addEventListener('click', () => {
  document.getElementById('settings-btn').click();
  document.querySelector('#set-subtabs button[data-panel="set-backup"]').click();
});

updateBackupStatus();
updateProtectionStatus();