const ReceiptList = {
  year: String(new Date().getFullYear()),
  month: '',
  MONTHS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  init(container) {
    const box = el('div');
    box.innerHTML = `
      <h3>My receipts</h3>
      <div class="row">
        <select id="rl-year"></select>
        <select id="rl-month"></select>
      </div>
      <div class="card" id="rl-summary"></div>
      <button id="rl-export">Export year to CSV</button>
      <ul id="rl-list"></ul>
    `;
    container.appendChild(box);
    box.querySelector('#rl-export').onclick = () => this.exportCsv();

    const monthSel = box.querySelector('#rl-month');
    monthSel.appendChild(new Option('All months', ''));
    this.MONTHS.forEach((m, i) => {
      monthSel.appendChild(new Option(m, String(i + 1).padStart(2, '0')));
    });

    box.querySelector('#rl-year').onchange = (e) => {
      this.year = e.target.value;
      this.refresh();
    };
    monthSel.onchange = (e) => {
      this.month = e.target.value;
      this.refresh();
    };
  },

  async exportCsv() {
    const rows = getReceipts()
      .filter(r => r.date.startsWith(this.year))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length === 0) {
      alert('No receipts for ' + this.year);
      return;
    }
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = ['Date,Shop,Amount,Category,Tax relief,Photo link'];
    rows.forEach(r => {
      lines.push([r.date, q(r.shop), r.amount.toFixed(2), r.category, r.tax ? 'Yes' : 'No', q(r.link || '')].join(','));
    });
    const name = 'receipts-' + this.year + '.csv';
    const file = new File(['\ufeff' + lines.join('\n')], name, { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
      } catch (err) {
        // cancelled
      }
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },

  refresh() {
    const all = getReceipts();
    const yearSel = document.getElementById('rl-year');
    const monthSel = document.getElementById('rl-month');
    const summary = document.getElementById('rl-summary');
    const ul = document.getElementById('rl-list');

    const years = new Set(all.map(r => r.date.slice(0, 4)));
    years.add(String(new Date().getFullYear()));
    years.add(this.year);
    yearSel.innerHTML = '';
    Array.from(years).sort().reverse().forEach(y => {
      yearSel.appendChild(new Option(y, y));
    });
    yearSel.value = this.year;
    monthSel.value = this.month;

    const inYear = all.filter(r => r.date.startsWith(this.year));
    const shown = inYear
      .filter(r => !this.month || r.date.slice(5, 7) === this.month)
      .sort((a, b) => b.date.localeCompare(a.date));

    const taxTotal = inYear.filter(r => r.tax).reduce((s, r) => s + r.amount, 0);
    const shownTotal = shown.reduce((s, r) => s + r.amount, 0);

    summary.innerHTML = '';
    summary.appendChild(el('div', '', 'Tax relief ' + this.year + ': ' + money(taxTotal)));
    summary.appendChild(el('div', 'hint', shown.length + ' receipts shown · ' + money(shownTotal)));

    ul.innerHTML = '';
    if (shown.length === 0) {
      ul.appendChild(el('li', '', 'No receipts.'));
      return;
    }
    shown.forEach(r => {
      const li = el('li', 'commit');

      const top = el('div', 'commit-top');
      const info = el('div');
      info.appendChild(el('div', 'commit-name', r.shop));
      info.appendChild(el('div', 'commit-meta', r.date + ' · ' + r.category + (r.tax ? ' · Tax relief' : '')));
      top.appendChild(info);
      top.appendChild(el('div', 'commit-amt', money(r.amount)));

      const actions = el('div', 'commit-actions');
      if (r.link) {
        const view = el('button', '', 'View photo');
        view.addEventListener('click', () => window.open(r.link, '_blank'));
        actions.appendChild(view);
      }
      const del = el('button', 'danger', 'Delete');
      del.addEventListener('click', () => {
        if (!confirm('Delete this record? The photo stays in Google Drive.')) return;
        saveReceipts(getReceipts().filter(x => x.id !== r.id));
        this.refresh();
      });
      actions.appendChild(del);

      li.appendChild(top);
      li.appendChild(actions);
      ul.appendChild(li);
    });
  }
};

ReceiptList.init(document.getElementById('receipts'));
ReceiptList.refresh();