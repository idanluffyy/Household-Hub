// Edit note categories (saved in this phone's browser)
const CATS_KEY = 'hubNoteCategories';
const DEFAULT_NOTE_CATEGORIES = NOTE_CATEGORIES.slice();

function loadNoteCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATS_KEY) || 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch (err) {
    // ignore
  }
  // first time: the defaults, plus any category your notes already use
  const list = DEFAULT_NOTE_CATEGORIES.slice();
  notes.forEach(n => {
    if (n.category && !list.includes(n.category)) list.push(n.category);
  });
  return list;
}

function saveNoteCategories() {
  localStorage.setItem(CATS_KEY, JSON.stringify(NOTE_CATEGORIES));
}

// keep "Other" as the last one
NOTE_CATEGORIES = loadNoteCategories().filter(c => c !== 'Other').concat(['Other']);
if (localStorage.getItem(CATS_KEY) === null) saveNoteCategories();

function refreshCategorySelects() {
  const keepForm = ntCategory.value;
  const keepFilter = ntFilterCat.value;
  ntCategory.innerHTML = '';
  ntFilterCat.innerHTML = '';
  addOption(ntFilterCat, '', 'All categories');
  NOTE_CATEGORIES.forEach(c => {
    addOption(ntCategory, c, c);
    addOption(ntFilterCat, c, c);
  });
  setSelect(ntCategory, NOTE_CATEGORIES.includes(keepForm) ? keepForm : 'Other');
  setSelect(ntFilterCat, keepFilter);
}

function addNoteCategory(name) {
  const clean = String(name).trim();
  if (!clean) return false;
  if (NOTE_CATEGORIES.some(c => c.toLowerCase() === clean.toLowerCase())) return false;
  NOTE_CATEGORIES.splice(NOTE_CATEGORIES.indexOf('Other'), 0, clean);
  saveNoteCategories();
  refreshCategorySelects();
  renderCategoryManager();
  return true;
}

function renameNoteCategory(oldName) {
  const v = prompt('New name for "' + oldName + '":', oldName);
  if (v === null) return;
  const name = v.trim();
  if (!name || name === oldName) return;
  if (NOTE_CATEGORIES.some(c => c.toLowerCase() === name.toLowerCase())) {
    alert('That category already exists.');
    return;
  }
  NOTE_CATEGORIES[NOTE_CATEGORIES.indexOf(oldName)] = name;
  notes.forEach(n => {
    if (n.category === oldName) n.category = name;
  });
  saveNoteCategories();
  saveNotes();
  refreshCategorySelects();
  renderCategoryManager();
  renderNotes();
}

function deleteNoteCategory(name) {
  const count = notes.filter(n => n.category === name).length;
  const ask = count > 0
    ? 'Delete the category "' + name + '"? ' + count + ' note(s) will move to "Other".'
    : 'Delete the category "' + name + '"?';
  if (!confirm(ask)) return;
  NOTE_CATEGORIES = NOTE_CATEGORIES.filter(c => c !== name);
  notes.forEach(n => {
    if (n.category === name) n.category = 'Other';
  });
  saveNoteCategories();
  saveNotes();
  refreshCategorySelects();
  renderCategoryManager();
  renderNotes();
}

function renderCategoryManager() {
  const ul = document.getElementById('cat-list');
  ul.innerHTML = '';
  NOTE_CATEGORIES.forEach(c => {
    const count = notes.filter(n => !n.deletedAt && n.category === c).length;
    const li = el('li');
    li.appendChild(el('span', '', c + ' (' + count + ')'));
    if (c === 'Other') {
      li.appendChild(el('span', 'hint', 'default'));
    } else {
      const right = el('div', 'right');
      const ren = el('button', '', 'Rename');
      ren.addEventListener('click', () => renameNoteCategory(c));
      const del = el('button', 'danger', 'Delete');
      del.addEventListener('click', () => deleteNoteCategory(c));
      right.append(ren, del);
      li.appendChild(right);
    }
    ul.appendChild(li);
  });
}

document.getElementById('cat-form').addEventListener('submit', e => {
  e.preventDefault();
  const box = document.getElementById('cat-name');
  if (!addNoteCategory(box.value)) {
    if (box.value.trim()) alert('That category already exists.');
    return;
  }
  box.value = '';
});

// refresh the counts each time the box is opened
document.getElementById('cat-details').addEventListener('toggle', renderCategoryManager);

refreshCategorySelects();
renderCategoryManager();