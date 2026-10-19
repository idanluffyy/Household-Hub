// Import notes from the "What Do I Know" app
function wdikHtmlToText(html) {
  if (!html) return '';
  const prepared = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6])>/gi, '\n');
  const doc = new DOMParser().parseFromString(prepared, 'text/html');
  return (doc.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wdikCategoryName(data, id) {
  const cat = (data.categories || []).find(c => c.id === id);
  return cat ? String(cat.name) : '';
}

function importWdik(data) {
  const existingIds = new Set(notes.map(n => n.id));

  // collections: reuse one with the same name, or create it
  const collMap = {};
  (data.collections || []).forEach(c => {
    const name = String(c.name || '').trim();
    if (!name) return;
    let hub = collections.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!hub) {
      hub = { id: newId(), name: name };
      collections.push(hub);
    }
    collMap[c.id] = hub.id;
  });

  let added = 0;
  let skipped = 0;
  let withoutFile = 0;

  data.items.forEach(it => {
    const id = 'wdik' + it.id;
    if (existingIds.has(id)) {
      skipped++;
      return;
    }

    const type = it.type === 'checklist' ? 'checklist' : (it.type === 'link' ? 'link' : 'note');

    const catName = wdikCategoryName(data, it.category);
    if (catName && !NOTE_CATEGORIES.includes(catName)) addNoteCategory(catName);
    const category = NOTE_CATEGORIES.includes(catName) ? catName : 'Other';
    const tags = parseTags((it.tags || []).join(','));
    if (catName && category === 'Other' && catName !== 'Other') {
      const extra = parseTags(catName)[0];
      if (extra && !tags.includes(extra)) tags.push(extra);
    }

    const parts = [];
    const content = wdikHtmlToText(it.content);
    if (content) parts.push(content);
    const desc = String(it.description || '').trim();
    if (desc) parts.push(desc);
    if (it.whatILearned) parts.push('What I learned: ' + String(it.whatILearned).trim());
    (it.links || []).forEach(l => {
      const u = typeof l === 'string' ? l : (l && l.url);
      if (u) parts.push(u);
    });
    if (it.type === 'image' || it.type === 'file') {
      const names = (it.attachments || []).map(a => a.filename).filter(Boolean);
      parts.push('[Attachment not included' + (names.length ? ': ' + names.join(', ') : '') + ']');
      withoutFile++;
    }

    const listItems = type === 'checklist'
      ? (it.checklistItems || [])
          .map(c => ({ id: newId(), text: String(c.text || '').trim(), checked: !!c.checked }))
          .filter(c => c.text)
      : [];

    notes.push({
      id: id,
      type: type,
      title: String(it.title || '').trim() || '(No title)',
      text: parts.join('\n\n'),
      url: type === 'link' ? String(it.url || '') : '',
      items: listItems,
      category: category,
      collectionId: collMap[it.collectionId] || '',
      tags: tags,
      pinned: !!it.pinned,
      favourite: !!it.favourite,
      createdAt: it.createdAt || Date.now(),
      updatedAt: it.updatedAt || it.createdAt || Date.now(),
      deletedAt: it.deletedAt || null
    });
    added++;
  });

  saveCollections();
  saveNotes();
  refreshCollectionSelects();
  renderNotes();
  if (typeof renderHome === 'function') renderHome();

  return { added: added, skipped: skipped, withoutFile: withoutFile };
}

document.getElementById('wdik-file').addEventListener('change', e => {
  const file = e.target.files[0];
  const msg = document.getElementById('wdik-msg');
  msg.textContent = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.items)) throw new Error('bad');

      let ask = 'Import ' + data.items.length + ' item(s) from What Do I Know? Your current notes stay.';
      const priv = data.items.filter(i => i.private).length;
      if (priv > 0) {
        ask += '\n\n' + priv + ' of them were private in the old app. Notes here have no PIN lock. Import them anyway?';
      }
      if (!confirm(ask)) return;

      const r = importWdik(data);
      let text = 'Done. Added ' + r.added + ' item(s).';
      if (r.skipped) text += ' Skipped ' + r.skipped + ' that were already imported.';
      if (r.withoutFile) text += ' ' + r.withoutFile + ' had a picture or file that could not come over.';
      msg.textContent = text;
    } catch (err) {
      msg.textContent = 'This does not look like a What Do I Know backup.';
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});