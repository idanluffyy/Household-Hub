const RCPT_KEY = 'hubReceipts';
const RCPT_CATEGORIES = ['Medical', 'Books', 'Sports', 'Lifestyle', 'Education', 'Insurance', 'Other'];

function getReceipts() {
  try {
    return JSON.parse(localStorage.getItem(RCPT_KEY) || '[]');
  } catch (err) {
    return [];
  }
}

function saveReceipts(list) {
  localStorage.setItem(RCPT_KEY, JSON.stringify(list));
}

const Receipts = {
  CLIENT_ID: '889225612639-uhnrc0r0ad24glnteklhg2enutvslmhc.apps.googleusercontent.com',
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
  token: null,
  photo: null,

  render(container) {
    container.innerHTML = `
      <h2>Receipts</h2>
      <p id="rcpt-status" class="hint">Not connected</p>
      <button id="rcpt-login">Connect Google Drive</button>
      <input type="file" id="rcpt-input" accept="image/*" capture="environment" hidden>
      <button id="rcpt-scan">📷 Scan receipt</button>
      <form id="rcpt-form" style="display:none">
        <img id="rcpt-preview" style="max-width:100%;border-radius:12px">
        <input id="rcpt-date" type="date" required>
        <input id="rcpt-shop" placeholder="Shop name" required>
        <input id="rcpt-amount" type="number" step="0.01" min="0.01" placeholder="Amount" required>
        <select id="rcpt-cat">
          ${RCPT_CATEGORIES.map(c => '<option>' + c + '</option>').join('')}
        </select>
        <label class="check"><input type="checkbox" id="rcpt-tax"> Tax relief</label>
        <button type="submit" id="rcpt-save">Save to Drive</button>
      </form>
    `;
    const status = container.querySelector('#rcpt-status');
    const login = container.querySelector('#rcpt-login');
    const input = container.querySelector('#rcpt-input');
    const form = container.querySelector('#rcpt-form');
    const img = container.querySelector('#rcpt-preview');
    const save = container.querySelector('#rcpt-save');

    login.onclick = () => {
      if (!window.google) {
        status.textContent = 'Google not loaded. Check internet.';
        return;
      }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPE,
        callback: (res) => {
          if (res.access_token) {
            this.token = res.access_token;
            status.textContent = '✅ Connected to Google Drive';
            login.style.display = 'none';
          } else {
            status.textContent = 'Login failed. Try again.';
          }
        }
      });
      client.requestAccessToken();
    };

    container.querySelector('#rcpt-scan').onclick = () => input.click();
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      this.photo = f;
      img.src = URL.createObjectURL(f);
      container.querySelector('#rcpt-date').value = today();
      form.style.display = 'flex';
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!this.token) {
        status.textContent = 'Connect Google Drive first.';
        return;
      }
      if (!this.photo) return;
      save.disabled = true;
      status.textContent = 'Saving...';
      try {
        const folderId = await this.getFolder();
        const file = await this.upload(folderId, this.photo);
        const list = getReceipts();
        list.push({
          id: newId(),
          date: container.querySelector('#rcpt-date').value,
          shop: container.querySelector('#rcpt-shop').value.trim(),
          amount: parseFloat(container.querySelector('#rcpt-amount').value),
          category: container.querySelector('#rcpt-cat').value,
          tax: container.querySelector('#rcpt-tax').checked,
          driveId: file.id,
          link: file.webViewLink
        });
        saveReceipts(list);
        status.textContent = '✅ Saved. Total receipts: ' + list.length;
        this.photo = null;
        form.reset();
        form.style.display = 'none';
        input.value = '';
      } catch (err) {
        if (err.message === 'AUTH') {
          this.token = null;
          login.style.display = 'inline-block';
          status.textContent = 'Session ended. Connect again.';
        } else {
          status.textContent = 'Failed: ' + err.message;
        }
      }
      save.disabled = false;
    };
  },

  async getFolder() {
    const headers = { Authorization: 'Bearer ' + this.token };
    const q = encodeURIComponent("name='Receipts' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    let r = await fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)', { headers });
    if (r.status === 401) throw new Error('AUTH');
    if (!r.ok) throw new Error('folder ' + r.status);
    const data = await r.json();
    if (data.files.length) return data.files[0].id;

    r = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Receipts', mimeType: 'application/vnd.google-apps.folder' })
    });
    if (r.status === 401) throw new Error('AUTH');
    if (!r.ok) throw new Error('create folder ' + r.status);
    return (await r.json()).id;
  },

  async upload(folderId, file) {
    const d = new Date();
    const time = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
    const ext = file.type.split('/')[1] || 'jpg';
    const meta = { name: 'receipt-' + today() + '-' + time + '.' + ext, parents: [folderId] };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file', file);

    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.token },
      body: form
    });
    if (r.status === 401) throw new Error('AUTH');
    if (!r.ok) throw new Error('upload ' + r.status);
    return r.json();
  }
};

Receipts.render(document.getElementById('receipts'));