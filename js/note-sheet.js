// Notes: floating + button, new/edit sheet, and sharing
const fabEl = document.getElementById('fab');
const fabBtn = document.getElementById('fab-btn');
const noteSheet = document.getElementById('note-sheet');
const sheetTitle = document.getElementById('sheet-title');

function updateFab() {
  const onNotes = document.getElementById('notes').classList.contains('active');
  fabEl.hidden = !onNotes;
  if (!onNotes) fabEl.classList.remove('open');
}

function openNoteSheet(title) {
  sheetTitle.textContent = title;
  noteSheet.hidden = false;
  document.body.style.overflow = 'hidden';
  fabEl.classList.remove('open');
}

function closeNoteSheet() {
  noteSheet.hidden = true;
  document.body.style.overflow = '';
}

// the + button and its type choices
fabBtn.addEventListener('click', () => {
  fabEl.classList.toggle('open');
});

document.addEventListener('click', e => {
  if (!fabEl.contains(e.target)) fabEl.classList.remove('open');
});

document.querySelectorAll('#fab-menu button').forEach(b => {
  b.addEventListener('click', () => {
    const type = b.dataset.new;
    resetNoteForm();
    ntType.value = type;
    updateNoteForm();
    // start in the category / collection you are looking at
    if (ntFilterCat.value) setSelect(ntCategory, ntFilterCat.value);
    if (ntFilterColl.value) setSelect(ntCollection, ntFilterColl.value);
    openNoteSheet('New ' + NOTE_TYPES[type].toLowerCase());
    ntTitle.focus();
  });
});

// closing the sheet
document.getElementById('sheet-close').addEventListener('click', resetNoteForm);
noteSheet.addEventListener('click', e => {
  if (e.target === noteSheet) resetNoteForm();
});

// show the + only on the Notes tab
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', updateFab));
document.getElementById('settings-btn').addEventListener('click', updateFab);
updateFab();

// share a note as text
function noteToText(n) {
  const parts = [];
  if (n.type === 'checklist') {
    parts.push(n.items.map(i => (i.checked ? '☑ ' : '☐ ') + i.text).join('\n'));
  }
  if (n.type === 'link' && n.url) parts.push(n.url);
  if (n.text) parts.push(n.text);
  return [n.title || '(No title)'].concat(parts).join('\n\n');
}

async function shareNote(n) {
  const text = noteToText(n);

  // send the attached files too, when this phone allows it
  if (n.attachments && n.attachments.length > 0 && navigator.canShare && typeof attFiles === 'function') {
    try {
      const files = await attFiles(n);
      if (files.length > 0 && navigator.canShare({ files: files })) {
        await navigator.share({ text: text, files: files });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ text: text });
    } catch (err) {
      // cancelled
    }
  } else if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      alert('Note copied. Paste it in WhatsApp or anywhere.');
    } catch (err) {
      alert(text);
    }
  } else {
    alert(text);
  }
}