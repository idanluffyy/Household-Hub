// Notes v3: types, categories, collections, tags, trash (saved in this phone's browser)
const NOTES_KEY = 'hubNotes';
const COLL_KEY = 'hubCollections';
const NOTE_CATEGORIES = ['Home', 'Important', 'Finance', 'Vehicle', 'Health', 'Kids', 'Ideas', 'Learning', 'Other'];
const NOTE_TYPES = { note: 'Note', checklist: 'Checklist', link: 'Link' };

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTES_KEY) || 'null');
    if (Array.isArray(saved)) return saved;
  } catch (err) {
    // ignore
  }
  // convert notes from the first version
  try {
    const old = JSON.parse(localStorage.getItem('notes') || '[]');
    if (Array.isArray(old)) {
      return old.map(n => ({
        id: n.id ? 'old' + n.id : newId(),
        type: 'note',
        title: n.title || '',
        text: n.text || '',
        url: '',
        items: [],
        category: 'Other',
        collectionId: '',
        tags: [],
        pinned: !!n.pinned,
        favourite: false,
        createdAt: n.updated || Date.now(),
        updatedAt: n.updated || Date.now(),
        deletedAt: null
      }));
    }
  } catch (err) {
    // ignore
  }
  return [];
}

function loadCollections() {
  try {
    const c = JSON.parse(localStorage.getItem(COLL_KEY) || 'null');
    if (Array.isArray(c)) return c;
  } catch (err) {
    // ignore
  }
  return [];
}

let notes = loadNotes();
let collections = loadCollections();
let noteView = 'notes';
let noteEditId = null;
let noteTagFilter = '';

// make sure older notes have the newer fields
notes.forEach(n => {
  if (!Array.isArray(n.items)) n.items = [];
  if (!Array.isArray(n.tags)) n.tags = [];
  if (n.collectionId === undefined) n.collectionId = '';
});

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function saveCollections() {
  localStorage.setItem(COLL_KEY, JSON.stringify(collections));
}

if (localStorage.getItem(NOTES_KEY) === null && notes.length > 0) saveNotes();

const noteForm = document.getElementById('note-form');
const ntType = document.getElementById('note-type');
const ntTitle = document.getElementById('note-title');
const ntCategory = document.getElementById('note-category');
const ntCollection = document.getElementById('note-collection');
const ntTags = document.getElementById('note-tags');
const ntUrl = document.getElementById('note-url');
const ntText = document.getElementById('note-text');
const ntSave = document.getElementById('note-save');
const ntCancel = document.getElementById('note-cancel');
const ntSearch = document.getElementById('note-search');
const ntFilterCat = document.getElementById('note-filter-cat');
const ntFilterType = document.getElementById('note-filter-type');
const ntFilterColl = document.getElementById('note-filter-coll');

function addOption(select, value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  select.appendChild(o);
}

function setSelect(select, value) {
  select.value = value;
  if (select.selectedIndex === -1) select.selectedIndex = 0;
}

function fillCategories() {
  addOption(ntFilterCat, '', 'All categories');
  NOTE_CATEGORIES.forEach(c => {
    addOption(ntCategory, c, c);
    addOption(ntFilterCat, c, c);
  });
}

function refreshCollectionSelects() {
  const keepForm = ntCollection.value;
  const keepFilter = ntFilterColl.value;
  ntCollection.innerHTML = '';
  ntFilterColl.innerHTML = '';
  addOption(ntCollection, '', 'No collection');
  addOption(ntFilterColl, '', 'All collections');
  collections.forEach(c => {
    addOption(ntCollection, c.id, c.name);
    addOption(ntFilterColl, c.id, c.name);
  });
  setSelect(ntCollection, keepForm);
  setSelect(ntFilterColl, keepFilter);
}

function updateNoteForm() {
  const t = ntType.value;
  ntUrl.hidden = t !== 'link';
  ntText.rows = t === 'checklist' ? 6 : 4;
  if (t === 'checklist') ntText.placeholder = 'One item per line';
  else if (t === 'link') ntText.placeholder = 'Description (optional)';
  else ntText.placeholder = 'Write your note...';
}

function resetNoteForm() {
  noteEditId = null;
  ntType.value = 'note';
  ntTitle.value = '';
  setSelect(ntCategory, 'Other');
  setSelect(ntCollection, '');
  ntTags.value = '';
  ntUrl.value = '';
  ntText.value = '';
  ntSave.textContent = 'Add';
  ntCancel.hidden = true;
  updateNoteForm();
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (err) {
    return url;
  }
}

function parseTags(str) {
  const out = [];
  str.split(',').forEach(t => {
    const tag = t.trim().replace(/^#+/, '').toLowerCase().slice(0, 30);
    if (tag && !out.includes(tag)) out.push(tag);
  });
  return out.slice(0, 10);
}

function visibleNotes() {
  const q = ntSearch.value.trim().toLowerCase();
  const cat = ntFilterCat.value;
  const type = ntFilterType.value;
  const coll = ntFilterColl.value;
  return notes
    .filter(n => {
      if (noteView === 'trash') {
        if (!n.deletedAt) return false;
      } else {
        if (n.deletedAt) return false;
        if (noteView === 'favourites' && !n.favourite) return false;
      }
      if (cat && n.category !== cat) return false;
      if (type && n.type !== type) return false;
      if (coll && n.collectionId !== coll) return false;
      if (noteTagFilter && !n.tags.includes(noteTagFilter)) return false;
      if (q) {
        const hay = (n.title + ' ' + n.text + ' ' + n.url + ' ' + n.tags.join(' ') + ' ' +
          n.items.map(i => i.text).join(' ')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.updatedAt - a.updatedAt));
}

function renderCollections() {
  const ul = document.getElementById('coll-list');
  ul.innerHTML = '';
  if (collections.length === 0) {
    ul.appendChild(el('li', '', 'No collections yet.'));
    return;
  }
  collections.forEach(c => {
    const count = notes.filter(n => !n.deletedAt && n.collectionId === c.id).length;
    const li = el('li');
    li.appendChild(el('span', '', c.name + ' (' + count + ')'));
    const right = el('div', 'right');

    const ren = el('button', '', 'Rename');
    ren.addEventListener('click', () => {
      const v = prompt('New name:', c.name);
      if (!v || !v.trim()) return;
      c.name = v.trim();
      saveCollections();
      refreshCollectionSelects();
      renderNotes();
    });

    const del = el('button', 'danger', 'Delete');
    del.addEventListener('click', () => {
      if (!confirm('Delete the collection "' + c.name + '"? Your notes are kept. Only the collection is removed.')) return;
      collections = collections.filter(x => x.id !== c.id);
      notes.forEach(n => {
        if (n.collectionId === c.id) n.collectionId = '';
      });
      saveCollections();
      saveNotes();
      refreshCollectionSelects();
      renderNotes();
    });

    right.append(ren, del);
    li.appendChild(right);
    ul.appendChild(li);
  });
}

function renderNotes() {
  const ul = document.getElementById('note-list');
  ul.innerHTML = '';
  document.getElementById('empty-trash').hidden = noteView !== 'trash';

  const bar = document.getElementById('tag-filter-bar');
  bar.hidden = !noteTagFilter;
  document.getElementById('tag-filter-text').textContent = 'Tag: #' + noteTagFilter;

  renderCollections();

  const list = visibleNotes();
  if (list.length === 0) {
    ul.appendChild(el('li', '', noteView === 'trash' ? 'Trash is empty.' : 'Nothing here yet.'));
    return;
  }

  list.forEach(n => {
    const li = el('li', 'note-card' + (n.pinned ? ' pinned' : ''));

    const head = el('div', 'note-head');
    head.appendChild(el('div', 'note-title', (n.favourite ? '★ ' : '') + (n.title || '(No title)')));
    head.appendChild(el('div', 'note-tag', NOTE_TYPES[n.type] + ' · ' + n.category));
    li.appendChild(head);

    const coll = collections.find(c => c.id === n.collectionId);
    if (coll) li.appendChild(el('div', 'note-meta', 'Collection: ' + coll.name));

    if (n.type === 'link' && n.url) {
      if (/^https?:\/\//i.test(n.url)) {
        const a = el('a', 'note-link', domainOf(n.url));
        a.href = n.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
      } else {
        li.appendChild(el('div', 'note-text', n.url));
      }
    }

    if (n.type === 'checklist') {
      const done = n.items.filter(i => i.checked).length;
      li.appendChild(el('div', 'note-progress', done + ' of ' + n.items.length + ' done'));
      n.items.forEach(i => {
        const row = el('label', 'check-row' + (i.checked ? ' done' : ''));
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = i.checked;
        box.disabled = noteView === 'trash';
        box.addEventListener('change', () => {
          i.checked = box.checked;
          saveNotes();
          renderNotes();
        });
        row.append(box, el('span', '', i.text));
        li.appendChild(row);
      });
    }

    if (n.text) li.appendChild(el('div', 'note-text', n.text));

    if (n.tags.length > 0) {
      const chips = el('div', 'tag-row');
      n.tags.forEach(t => {
        const chip = el('button', 'tag-chip', '#' + t);
        chip.addEventListener('click', () => {
          noteTagFilter = t;
          renderNotes();
        });
        chips.appendChild(chip);
      });
      li.appendChild(chips);
    }

    const actions = el('div', 'note-actions');

    if (noteView === 'trash') {
      const restore = el('button', '', 'Restore');
      restore.addEventListener('click', () => {
        n.deletedAt = null;
        saveNotes();
        renderNotes();
      });
      const gone = el('button', 'danger', 'Delete forever');
      gone.addEventListener('click', () => {
        if (!confirm('Delete this forever?')) return;
        notes = notes.filter(x => x.id !== n.id);
        saveNotes();
        renderNotes();
      });
      actions.append(restore, gone);
    } else {
      const pin = el('button', '', n.pinned ? 'Unpin' : 'Pin');
      pin.addEventListener('click', () => {
        n.pinned = !n.pinned;
        saveNotes();
        renderNotes();
      });

      const star = el('button', '', n.favourite ? 'Unstar' : 'Star');
      star.addEventListener('click', () => {
        n.favourite = !n.favourite;
        saveNotes();
        renderNotes();
      });

      const edit = el('button', '', 'Edit');
      edit.addEventListener('click', () => {
        noteEditId = n.id;
        ntType.value = n.type;
        ntTitle.value = n.title;
        setSelect(ntCategory, n.category);
        setSelect(ntCollection, n.collectionId || '');
        ntTags.value = n.tags.join(', ');
        ntUrl.value = n.url || '';
        ntText.value = n.type === 'checklist' ? n.items.map(i => i.text).join('\n') : n.text;
        ntSave.textContent = 'Save changes';
        ntCancel.hidden = false;
        updateNoteForm();
        noteForm.scrollIntoView();
      });

      const del = el('button', 'danger', 'Delete');
      del.addEventListener('click', () => {
        n.deletedAt = Date.now();
        saveNotes();
        renderNotes();
      });

      actions.append(pin, star, edit, del);
    }

    li.appendChild(actions);
    ul.appendChild(li);
  });
}

noteForm.addEventListener('submit', e => {
  e.preventDefault();
  const type = ntType.value;
  const title = ntTitle.value.trim();
  if (!title) return;

  let url = ntUrl.value.trim();
  if (type === 'link' && url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

  const now = Date.now();
  let n = noteEditId ? notes.find(x => x.id === noteEditId) : null;
  if (!n) {
    n = {
      id: newId(),
      type: type,
      title: title,
      text: '',
      url: '',
      items: [],
      category: 'Other',
      collectionId: '',
      tags: [],
      pinned: false,
      favourite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    notes.push(n);
  }

  n.type = type;
  n.title = title;
  n.category = ntCategory.value;
  n.collectionId = ntCollection.value;
  n.tags = parseTags(ntTags.value);
  n.updatedAt = now;
  n.url = type === 'link' ? url : '';

  if (type === 'checklist') {
    const oldItems = n.items || [];
    n.items = ntText.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const prev = oldItems.find(i => i.text === s);
        return { id: prev ? prev.id : newId(), text: s, checked: prev ? prev.checked : false };
      });
    n.text = '';
  } else {
    n.text = ntText.value;
    n.items = [];
  }

  saveNotes();
  resetNoteForm();
  renderNotes();
});

ntType.addEventListener('change', updateNoteForm);
ntCancel.addEventListener('click', resetNoteForm);
ntSearch.addEventListener('input', renderNotes);
ntFilterCat.addEventListener('change', renderNotes);
ntFilterType.addEventListener('change', renderNotes);
ntFilterColl.addEventListener('change', renderNotes);

document.getElementById('tag-filter-clear').addEventListener('click', () => {
  noteTagFilter = '';
  renderNotes();
});

document.querySelectorAll('#note-views button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#note-views button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    noteView = b.dataset.view;
    renderNotes();
  });
});

document.getElementById('empty-trash').addEventListener('click', () => {
  const count = notes.filter(n => n.deletedAt).length;
  if (count === 0) return;
  if (!confirm('Delete ' + count + ' item(s) in the trash forever?')) return;
  notes = notes.filter(n => !n.deletedAt);
  saveNotes();
  renderNotes();
});

document.getElementById('coll-form').addEventListener('submit', e => {
  e.preventDefault();
  const nameBox = document.getElementById('coll-name');
  const name = nameBox.value.trim();
  if (!name) return;
  if (collections.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert('That collection already exists.');
    return;
  }
  collections.push({ id: newId(), name: name });
  saveCollections();
  nameBox.value = '';
  refreshCollectionSelects();
  renderNotes();
});

fillCategories();
refreshCollectionSelects();
resetNoteForm();
renderNotes();