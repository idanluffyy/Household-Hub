// Settings (saved in this phone's browser)
const DEFAULT_SETTINGS = { me: '', currency: 'RM' };

function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('hubSettings') || '{}');
    return Object.assign({}, DEFAULT_SETTINGS, saved);
  } catch (err) {
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

function saveSettings(s) {
  localStorage.setItem('hubSettings', JSON.stringify(s));
}

function applySettings() {
  document.getElementById('header-names').textContent = getSettings().me;
}

const settingsForm = document.getElementById('settings-form');
const setMe = document.getElementById('set-me');
const setCurrency = document.getElementById('set-currency');
const settingsMsg = document.getElementById('settings-msg');

function fillSettingsForm() {
  const s = getSettings();
  setMe.value = s.me;
  setCurrency.value = s.currency;
}

settingsForm.addEventListener('submit', e => {
  e.preventDefault();
  saveSettings({
    me: setMe.value.trim(),
    currency: setCurrency.value.trim() || 'RM'
  });
  applySettings();
  if (typeof renderFinance === 'function') renderFinance();
  settingsMsg.textContent = 'Saved.';
});

document.getElementById('settings-btn').addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('settings').classList.add('active');
  settingsMsg.textContent = '';
});

fillSettingsForm();
applySettings();

// Settings sections (Profile, Theme, Notes, Backup)
document.querySelectorAll('#set-subtabs button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#set-subtabs button').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.set-panel').forEach(p => p.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.panel).classList.add('active');
  });
});