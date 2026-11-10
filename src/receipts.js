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
      <img id="rcpt-preview" style="display:none;max-width:100%;margin-top:12px;border-radius:12px">
      <button id="rcpt-save" style="display:none;margin-top:12px">Save to Drive</button>
    `;
    const status = container.querySelector('#rcpt-status');
    const login = container.querySelector('#rcpt-login');
    const input = container.querySelector('#rcpt-input');
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
      img.style.display = 'block';
      save.style.display = 'inline-block';
    };

    save.onclick = async () => {
      if (!this.token) {
        status.textContent = 'Connect Google Drive first.';
        return;
      }
      if (!this.photo) return;
      save.disabled = true;
      status.textContent = 'Saving...';
      try {
        const folderId = await this.getFolder();
        await this.upload(folderId, this.photo);
        status.textContent = '✅ Saved to Drive';
        this.photo = null;
        img.style.display = 'none';
        save.style.display = 'none';
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

    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.token },
      body: form
    });
    if (r.status === 401) throw new Error('AUTH');
    if (!r.ok) throw new Error('upload ' + r.status);
  }
};

Receipts.render(document.getElementById('receipts'));