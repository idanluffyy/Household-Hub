// Attachments for notes: photo, video, audio, files (saved in this phone's browser)
const ATT_DB = 'hubFiles';
const ATT_MAX_MB = 30;
const attUrlCache = new Map();

let attDraft = [];     // files shown in the form right now
let attAdded = [];     // added during this edit, not saved yet
let attRemoved = [];   // removed during this edit, not saved yet

let recRecorder = null;
let recStream = null;
let recChunks = [];
let recTimer = null;
let recStart = 0;
let recDiscard = false;

// ---------- storage (IndexedDB) ----------
function attDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ATT_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function attPut(id, blob) {
  const db = await attDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function attGet(id) {
  const db = await attDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('files', 'readonly').objectStore('files').get(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function attDelete(id) {
  const url = attUrlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    attUrlCache.delete(id);
  }
  try {
    const db = await attDb();
    await new Promise(resolve => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch (err) {
    // ignore
  }
}

function attDeleteMany(list) {
  (list || []).forEach(a => attDelete(a.id));
}

async function attUrl(id) {
  if (attUrlCache.has(id)) return attUrlCache.get(id);
  try {
    const blob = await attGet(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    attUrlCache.set(id, url);
    return url;
  } catch (err) {
    return null;
  }
}

async function attFiles(n) {
  const out = [];
  for (const a of (n.attachments || [])) {
    const blob = await attGet(a.id);
    if (blob) out.push(new File([blob], a.name, { type: a.mime || blob.type }));
  }
  return out;
}

// ---------- helpers ----------
function attKind(mime) {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

function attSize(bytes) {
  if (bytes < 1048576) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function attStamp() {
  const d = new Date();
  const p = x => String(x).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

function attResizeImage(file, maxSize) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 1500000) {
        resolve(file);
        return;
      }
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => resolve(b || file), 'image/jpeg', 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

// ---------- the note form ----------
function attRenderDraft() {
  const box = document.getElementById('att-draft');
  box.innerHTML = '';
  attDraft.forEach(a => box.appendChild(attItem(a, true)));
}

function attLoad(n) {
  attDraft = (n.attachments || []).slice();
  attAdded = [];
  attRemoved = [];
  attRenderDraft();
}

function attReset() {
  attAdded.forEach(id => attDelete(id));
  attDraft = [];
  attAdded = [];
  attRemoved = [];
  if (recRecorder) {
    recDiscard = true;
    recRecorder.stop();
  }
  attRenderDraft();
}

function attCommit() {
  attRemoved.forEach(id => attDelete(id));
  const list = attDraft.slice();
  attAdded = [];
  attRemoved = [];
  return list;
}

function attRemoveDraft(id) {
  attDraft = attDraft.filter(a => a.id !== id);
  if (attAdded.includes(id)) {
    attAdded = attAdded.filter(x => x !== id);
    attDelete(id);
  } else {
    attRemoved.push(id);
  }
  attRenderDraft();
}

async function attAddBlob(blob, name, mime) {
  try {
    let data = blob;
    let type = mime || blob.type || 'application/octet-stream';
    if (type.startsWith('image/') && type !== 'image/gif' && type !== 'image/svg+xml') {
      data = await attResizeImage(blob, 1600);
      if (data !== blob) {
        type = data.type || 'image/jpeg';
        name = name.replace(/\.[^./]+$/, '') + '.jpg';
      }
    }
    if (data.size > ATT_MAX_MB * 1048576) {
      alert('"' + name + '" is too big (' + attSize(data.size) + '). The limit is ' +
        ATT_MAX_MB + ' MB. Try a shorter clip or a smaller file.');
      return;
    }
    const id = newId();
    await attPut(id, data);
    attAdded.push(id);
    attDraft.push({ id: id, name: name, mime: type, size: data.size });
    attRenderDraft();
  } catch (err) {
    alert('Could not save "' + name + '". The phone may be out of space.');
  }
}

async function attAddFiles(files) {
  for (const f of files) {
    await attAddBlob(f, f.name || ('file-' + attStamp()), f.type);
  }
}

// ---------- showing a file ----------
function attItem(a, editable) {
  const kind = attKind(a.mime);
  const box = el('div', 'att-item');

  const head = el('div', 'att-head');
  head.appendChild(el('span', 'att-name', a.name + ' · ' + attSize(a.size)));
  if (editable) {
    const rm = el('button', 'att-remove', 'Remove');
    rm.type = 'button';
    rm.addEventListener('click', () => attRemoveDraft(a.id));
    head.appendChild(rm);
  }
  box.appendChild(head);

  if (kind === 'image') {
    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener';
    const img = document.createElement('img');
    img.alt = a.name;
    link.appendChild(img);
    box.appendChild(link);
    attUrl(a.id).then(url => {
      if (url) {
        img.src = url;
        link.href = url;
      }
    });
  } else {
    const label = kind === 'video' ? 'Play video' : (kind === 'audio' ? 'Play audio' : 'Open file');
    const open = el('button', 'att-open', label);
    open.type = 'button';
    open.addEventListener('click', async () => {
      const url = await attUrl(a.id);
      if (!url) {
        alert('This file could not be found on this phone.');
        return;
      }
      if (kind === 'video' || kind === 'audio') {
        const media = document.createElement(kind);
        media.controls = true;
        media.src = url;
        if (kind === 'video') media.setAttribute('playsinline', '');
        open.replaceWith(media);
        media.play().catch(() => {});
      } else {
        const dl = document.createElement('a');
        dl.href = url;
        dl.download = a.name;
        dl.click();
      }
    });
    box.appendChild(open);
  }
  return box;
}

function attBlock(n) {
  const wrap = el('div', 'att-wrap');
  (n.attachments || []).forEach(a => wrap.appendChild(attItem(a, false)));
  return wrap;
}

// ---------- audio recording ----------
async function attToggleRecord() {
  const btn = document.getElementById('att-audio-btn');
  const label = btn.querySelector('span');

  if (recRecorder) {
    recRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert('Audio recording is not supported in this browser.');
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert('The microphone is not allowed. Please allow it in your browser settings.');
    return;
  }

  recChunks = [];
  recDiscard = false;
  recRecorder = new MediaRecorder(recStream);
  recRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) recChunks.push(e.data);
  };
  recRecorder.onstop = async () => {
    clearInterval(recTimer);
    recStream.getTracks().forEach(t => t.stop());
    const type = recRecorder.mimeType || 'audio/webm';
    recRecorder = null;
    btn.classList.remove('recording');
    label.textContent = 'Audio';
    if (recDiscard) {
      recDiscard = false;
      return;
    }
    const ext = type.includes('mp4') ? '.m4a' : (type.includes('ogg') ? '.ogg' : '.webm');
    await attAddBlob(new Blob(recChunks, { type: type }), 'voice-' + attStamp() + ext, type);
  };

  recRecorder.start();
  recStart = Date.now();
  btn.classList.add('recording');
  label.textContent = 'Stop 0:00';
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    label.textContent = 'Stop ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }, 500);
}

// ---------- buttons ----------
document.getElementById('att-photo-btn').addEventListener('click', () => {
  document.getElementById('att-photo').click();
});
document.getElementById('att-video-btn').addEventListener('click', () => {
  document.getElementById('att-video').click();
});
document.getElementById('att-file-btn').addEventListener('click', () => {
  document.getElementById('att-file').click();
});
document.getElementById('att-audio-btn').addEventListener('click', attToggleRecord);

['att-photo', 'att-video', 'att-file'].forEach(id => {
  const input = document.getElementById(id);
  input.addEventListener('change', async () => {
    const files = Array.from(input.files);
    input.value = '';
    await attAddFiles(files);
  });
});

// draw the notes again, now that attachments are ready
if (typeof renderNotes === 'function') renderNotes();