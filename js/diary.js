// Diary with PIN lock (saved in this phone's browser)
const PIN_KEY = 'hubDiaryPin';
const hasCrypto = !!(window.crypto && window.crypto.subtle);

function bytesToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

async function hashPin(pin, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return bytesToHex(bits);
}

function getPin() {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY) || 'null');
  } catch (err) {
    return null;
  }
}

let diary = [];
try {
  diary = JSON.parse(localStorage.getItem('diary') || '[]');
  if (!Array.isArray(diary)) diary = [];
} catch (err) {
  diary = [];
}
let editingDiaryId = null;
let diaryUnlocked = !getPin();
let wrongTries = 0;

const diaryForm = document.getElementById('diary-form');
const diaryDate = document.getElementById('diary-date');
const diaryMood = document.getElementById('diary-mood');
const diaryText = document.getElementById('diary-text');
const diarySave = document.getElementById('diary-save');
const diaryCancel = document.getElementById('diary-cancel');
const diaryListEl = document.getElementById('diary-list');
const diarySearch = document.getElementById('diary-search');
const diaryCount = document.getElementById('diary-count');
const otdCard = document.getElementById('onthisday');
const otdList = document.getElementById('onthisday-list');

const pinCurrent = document.getElementById('pin-current');
const pinNew = document.getElementById('pin-new');
const pinConfirm = document.getElementById('pin-confirm');
const pinMsg = document.getElementById('pin-msg');
const unlockPin = document.getElementById('unlock-pin');
const unlockMsg = document.getElementById('unlock-msg');
const unlockBtn = document.getElementById('unlock-btn');

function saveDiary() {
  localStorage.setItem('diary', JSON.stringify(diary));
}

// ---------- lock screen ----------
function updatePinForm() {
  const has = !!getPin();
  const state = document.getElementById('pin-state');
  if (!hasCrypto) {
    state.textContent = 'PIN is not supported in this browser.';
  } else if (has) {
    state.textContent = 'PIN is ON.';
  } else {
    state.textContent = 'PIN is OFF. Anyone who opens the app can read your diary.';
  }
  pinCurrent.hidden = !has;
  document.getElementById('pin-save').textContent = has ? 'Change PIN' : 'Set PIN';
  document.getElementById('pin-remove').hidden = !has;
  document.getElementById('lock-now').hidden = !has;
}

function applyDiaryLock() {
  const locked = !!getPin() && !diaryUnlocked;
  document.getElementById('diary-lock').hidden = !locked;
  document.getElementById('diary-content').hidden = locked;
  if (locked) {
    unlockPin.value = '';
    unlockMsg.textContent = '';
  }
  updatePinForm();
}

document.getElementById('unlock-form').addEventListener('submit', async e => {
  e.preventDefault();
  const cur = getPin();
  if (!cur) {
    diaryUnlocked = true;
    applyDiaryLock();
    renderDiary();
    return;
  }
  const h = await hashPin(unlockPin.value, cur.salt);
  if (h === cur.hash) {
    wrongTries = 0;
    diaryUnlocked = true;
    applyDiaryLock();
    renderDiary();
    return;
  }
  wrongTries++;
  unlockPin.value = '';
  if (wrongTries >= 5) {
    wrongTries = 0;
    unlockBtn.disabled = true;
    unlockMsg.textContent = 'Too many wrong tries. Please wait 30 seconds.';
    setTimeout(() => {
      unlockBtn.disabled = false;
      unlockMsg.textContent = '';
    }, 30000);
  } else {
    unlockMsg.textContent = 'Wrong PIN.';
  }
});

document.getElementById('lock-now').addEventListener('click', () => {
  diaryUnlocked = false;
  applyDiaryLock();
  renderDiary();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && getPin()) {
    diaryUnlocked = false;
    applyDiaryLock();
    renderDiary();
  }
});

document.getElementById('pin-forgot').addEventListener('click', () => {
  const typed = prompt(
    'If you forgot the PIN, the only way in is to ERASE the diary on this phone.\n' +
    '(A backup file you saved earlier still has a copy.)\n\n' +
    'Type ERASE to continue:'
  );
  if (typed !== 'ERASE') return;
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem('diary');
  diary = [];
  diaryUnlocked = true;
  applyDiaryLock();
  renderDiary();
});

// ---------- set / change / remove PIN ----------
document.getElementById('pin-form').addEventListener('submit', async e => {
  e.preventDefault();
  pinMsg.textContent = '';
  if (!hasCrypto) {
    pinMsg.textContent = 'PIN is not supported in this browser.';
    return;
  }
  const cur = getPin();
  if (cur) {
    const h = await hashPin(pinCurrent.value, cur.salt);
    if (h !== cur.hash) {
      pinMsg.textContent = 'Current PIN is wrong.';
      return;
    }
  }
  if (!/^\d{4,8}$/.test(pinNew.value)) {
    pinMsg.textContent = 'The PIN must be 4 to 8 digits.';
    return;
  }
  if (pinNew.value !== pinConfirm.value) {
    pinMsg.textContent = 'The two PINs do not match.';
    return;
  }
  const salt = randomSalt();
  const hash = await hashPin(pinNew.value, salt);
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt: salt, hash: hash }));
  pinCurrent.value = '';
  pinNew.value = '';
  pinConfirm.value = '';
  pinMsg.textContent = cur ? 'PIN changed.' : 'PIN is set. Remember it, it cannot be recovered.';
  updatePinForm();
});

document.getElementById('pin-remove').addEventListener('click', async () => {
  const cur = getPin();
  if (!cur) return;
  const p = prompt('Enter your PIN to remove it:');
  if (p === null) return;
  const h = await hashPin(p, cur.salt);
  if (h !== cur.hash) {
    pinMsg.textContent = 'Wrong PIN.';
    return;
  }
  localStorage.removeItem(PIN_KEY);
  pinMsg.textContent = 'PIN removed.';
  updatePinForm();
});

// ---------- diary entries ----------
function resetDiaryForm() {
  editingDiaryId = null;
  diaryDate.value = today();
  diaryMood.value = '';
  diaryText.value = '';
  diarySave.textContent = 'Save entry';
  diaryCancel.hidden = true;
}

function renderDiary() {
  otdList.innerHTML = '';
  diaryListEl.innerHTML = '';

  // when locked, nothing is drawn on the page
  if (getPin() && !diaryUnlocked) {
    otdCard.hidden = true;
    diaryCount.textContent = '';
    return;
  }

  // "On this day" from earlier years
  const md = today().slice(5);
  const year = today().slice(0, 4);
  const past = diary
    .filter(d => d.date.slice(5) === md && d.date.slice(0, 4) !== year)
    .sort((a, b) => b.date.localeCompare(a.date));
  otdCard.hidden = past.length === 0;
  past.forEach(d => {
    otdList.appendChild(el(
      'div',
      '',
      d.date.slice(0, 4) + ': ' + d.text.slice(0, 120) + (d.text.length > 120 ? '...' : '')
    ));
  });

  // all entries, newest first
  const q = diarySearch.value.trim().toLowerCase();
  const rows = diary
    .filter(d => !q ||
      d.text.toLowerCase().includes(q) ||
      (d.mood || '').toLowerCase().includes(q) ||
      d.date.includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));

  diaryCount.textContent = q
    ? rows.length + ' of ' + diary.length + ' entries'
    : diary.length + ' entries';

  if (rows.length === 0) {
    diaryListEl.appendChild(el('li', '', 'No entries to show.'));
    return;
  }

  rows.forEach(d => {
    const li = el('li');
    li.appendChild(el('div', 'diary-meta', d.date + (d.mood ? ' · ' + d.mood : '')));
    li.appendChild(el('div', 'diary-text', d.text));

    const actions = el('div', 'note-actions');

    const edit = el('button', '', 'Edit');
    edit.addEventListener('click', () => {
      editingDiaryId = d.id;
      diaryDate.value = d.date;
      diaryMood.value = d.mood || '';
      diaryText.value = d.text;
      diarySave.textContent = 'Save changes';
      diaryCancel.hidden = false;
      diaryForm.scrollIntoView();
    });

    const del = el('button', 'danger', 'Delete');
    del.addEventListener('click', () => {
      if (!confirm('Delete this entry?')) return;
      diary = diary.filter(x => x.id !== d.id);
      saveDiary();
      renderDiary();
    });

    actions.append(edit, del);
    li.appendChild(actions);
    diaryListEl.appendChild(li);
  });
}

diaryForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = diaryText.value.trim();
  if (!text) return;
  if (editingDiaryId) {
    const d = diary.find(x => x.id === editingDiaryId);
    if (d) {
      d.date = diaryDate.value;
      d.mood = diaryMood.value;
      d.text = text;
      d.updatedAt = Date.now();
    }
  } else {
    diary.push({
      id: newId(),
      date: diaryDate.value,
      mood: diaryMood.value,
      text: text,
      updatedAt: Date.now()
    });
  }
  saveDiary();
  resetDiaryForm();
  renderDiary();
});

diaryCancel.addEventListener('click', resetDiaryForm);
diarySearch.addEventListener('input', renderDiary);

// ---------- start ----------
resetDiaryForm();
applyDiaryLock();
renderDiary();