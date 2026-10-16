// Small helpers used by many files
function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function money(n) {
  return getSettings().currency + ' ' + Number(n).toFixed(2);
}

function newId() {
  return 'id' + Date.now() + Math.random().toString(36).slice(2, 7);
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function shiftMonth(key, n) {
  const parts = key.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(key) {
  const parts = key.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function daysInMonth(key) {
  const parts = key.split('-').map(Number);
  return new Date(parts[0], parts[1], 0).getDate();
}

function dateInMonth(key, day) {
  const d = Math.min(Math.max(parseInt(day, 10) || 1, 1), daysInMonth(key));
  return key + '-' + String(d).padStart(2, '0');
}