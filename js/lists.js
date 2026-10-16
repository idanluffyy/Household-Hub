// Lists (saved in this phone's browser)
const LISTS_KEY = 'hubLists';

function loadLists() {
  try {
    const saved = JSON.parse(localStorage.getItem(LISTS_KEY) || 'null');
    if (saved && Array.isArray(saved.lists) && saved.lists.length > 0) {
      if (!Array.isArray(saved.history)) saved.history = [];
      return saved;
    }
  } catch (err) {
    // ignore
  }
  // first time: convert the old single list
  const grocery = { id: newId(), name: 'Grocery', items: [] };
  try {
    const old = JSON.parse(localStorage.getItem('listItems') || '[]');
    if (Array.isArray(old)) {
      grocery.items = old
        .map(o => ({ id: newId(), text: String(o.text || ''), done: !!o.done, updatedAt: Date.now() }))
        .filter(o => o.text);
    }
  } catch (err) {
    // ignore
  }
  const todo = { id: newId(), name: 'To-do', items: [] };
  return { version: 1, current: grocery.id, lists: [grocery, todo], history: [] };
}

let listData = loadLists();

function saveLists() {
  localStorage.setItem(LISTS_KEY, JSON.stringify(listData));
}
if (localStorage.getItem(LISTS_KEY) === null) saveLists();

function currentList() {
  let l = listData.lists.find(x => x.id === listData.current);
  if (!l) {
    l = listData.lists[0];
    listData.current = l.id;
  }
  return l;
}

const lsSelect = document.getElementById('list-select');
const lsForm = document.getElementById('list-form');
const lsInput = document.getElementById('list-input');
const lsProgress = document.getElementById('list-progress');
const lsUl = document.getElementById('list-items');
const lsSuggest = document.getElementById('list-suggestions');

function addHistory(name) {
  const lower = name.toLowerCase();
  listData.history = listData.history.filter(h => h.toLowerCase() !== lower);
  listData.history.unshift(name);
  listData.history = listData.history.slice(0, 100);
}

function renderSuggestions() {
  lsSuggest.innerHTML = '';
  listData.history.forEach(h => {
    const o = document.createElement('option');
    o.value = h;
    lsSuggest.appendChild(o);
  });
}

function renderListSelect() {
  lsSelect.innerHTML = '';
  listData.lists.forEach(l => {
    const o = document.createElement('option');
    o.value = l.id;
    const open = l.items.filter(i => !i.done).length;
    o.textContent = l.name + ' (' + open + ')';
    lsSelect.appendChild(o);
  });
  lsSelect.value = currentList().id;
}

function renderList() {
  const l = currentList();
  renderListSelect();

  const done = l.items.filter(i => i.done).length;
  lsProgress.textContent = l.items.length === 0
    ? 'This list is empty.'
    : done + ' of ' + l.items.length + ' done';

  lsUl.innerHTML = '';
  const open = l.items.filter(i => !i.done);
  const finished = l.items.filter(i => i.done);

  function addRow(item) {
    const li = el('li', item.done ? 'done' : '');

    const label = el('label', 'list-label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = item.done;
    box.addEventListener('change', () => {
      item.done = box.checked;
      item.updatedAt = Date.now();
      saveLists();
      renderList();
    });
    label.append(box, el('span', '', item.text));

    const right = el('div', 'right');

    const edit = el('button', 'list-edit', 'Edit');
    edit.addEventListener('click', () => {
      const v = prompt('Edit item:', item.text);
      if (v === null || !v.trim()) return;
      item.text = v.trim();
      item.updatedAt = Date.now();
      saveLists();
      renderList();
    });

    const del = el('button', '', 'X');
    del.addEventListener('click', () => {
      l.items = l.items.filter(x => x.id !== item.id);
      saveLists();
      renderList();
    });

    right.append(edit, del);
    li.append(label, right);
    lsUl.appendChild(li);
  }

  open.forEach(addRow);
  if (finished.length > 0) {
    lsUl.appendChild(el('li', 'list-divider', 'Done'));
    finished.forEach(addRow);
  }
}

// ---------- add items ----------
lsForm.addEventListener('submit', e => {
  e.preventDefault();
  const l = currentList();
  const names = lsInput.value.split(',').map(s => s.trim()).filter(Boolean);
  names.forEach(name => {
    const exists = l.items.some(i => !i.done && i.text.toLowerCase() === name.toLowerCase());
    if (exists) return;
    l.items.push({ id: newId(), text: name, done: false, updatedAt: Date.now() });
    addHistory(name);
  });
  lsInput.value = '';
  saveLists();
  renderList();
  renderSuggestions();
  lsInput.focus();
});

// ---------- manage lists ----------
lsSelect.addEventListener('change', () => {
  listData.current = lsSelect.value;
  saveLists();
  renderList();
});

document.getElementById('list-new').addEventListener('click', () => {
  const name = prompt('Name of the new list:');
  if (!name || !name.trim()) return;
  const l = { id: newId(), name: name.trim(), items: [] };
  listData.lists.push(l);
  listData.current = l.id;
  saveLists();
  renderList();
});

document.getElementById('list-rename').addEventListener('click', () => {
  const l = currentList();
  const name = prompt('New name:', l.name);
  if (!name || !name.trim()) return;
  l.name = name.trim();
  saveLists();
  renderList();
});

document.getElementById('list-delete').addEventListener('click', () => {
  if (listData.lists.length <= 1) {
    alert('You need to keep at least one list.');
    return;
  }
  const l = currentList();
  if (!confirm('Delete the list "' + l.name + '" and everything in it?')) return;
  listData.lists = listData.lists.filter(x => x.id !== l.id);
  listData.current = listData.lists[0].id;
  saveLists();
  renderList();
});

document.getElementById('list-uncheck').addEventListener('click', () => {
  currentList().items.forEach(i => {
    i.done = false;
  });
  saveLists();
  renderList();
});

document.getElementById('list-clear').addEventListener('click', () => {
  const l = currentList();
  const count = l.items.filter(i => i.done).length;
  if (count === 0) return;
  if (!confirm('Remove ' + count + ' done item(s)?')) return;
  l.items = l.items.filter(i => !i.done);
  saveLists();
  renderList();
});

document.getElementById('list-share').addEventListener('click', async () => {
  const l = currentList();
  const open = l.items.filter(i => !i.done);
  if (open.length === 0) {
    alert('Nothing to share. Everything is done.');
    return;
  }
  const text = l.name + ':\n' + open.map(i => '- ' + i.text).join('\n');
  if (navigator.share) {
    try {
      await navigator.share({ text: text });
    } catch (err) {
      // cancelled
    }
  } else if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      alert('List copied. Paste it in WhatsApp or anywhere.');
    } catch (err) {
      alert(text);
    }
  } else {
    alert(text);
  }
});

renderList();
renderSuggestions();