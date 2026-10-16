// Chart for Finance
function shortMonth(key) {
  const p = key.split('-').map(Number);
  return new Date(p[0], p[1] - 1, 1).toLocaleString('en-GB', { month: 'short' });
}

// Reads the saved data only (does not create new months)
function chartTotals(m) {
  const mo = fin.months[m];
  if (!mo) return { income: 0, extra: 0, spent: 0 };
  const income = mo.incomes.reduce((s, x) => s + x.amount, 0);
  const extra = mo.incomes.filter(x => x.kind !== 'fixed').reduce((s, x) => s + x.amount, 0);
  const paid = mo.commitments.reduce((s, c) => s + (c.paidAmount || 0), 0);
  const spent = paid + mo.expenses.reduce((s, x) => s + x.amount, 0);
  return { income: income, extra: extra, spent: spent };
}

function barHeight(value, max) {
  if (value <= 0) return 0;
  return Math.max(2, Math.round(value / max * 150));
}

function renderChart() {
  const box = document.getElementById('chart-bars');
  if (!box) return;

  const keys = [];
  for (let i = 5; i >= 0; i--) keys.push(shiftMonth(finMonth, -i));
  const data = keys.map(k => Object.assign({ key: k }, chartTotals(k)));
  const max = Math.max(1, ...data.map(d => Math.max(d.income, d.spent)));

  // bars
  box.innerHTML = '';
  data.forEach(d => {
    const group = el('div', 'bar-group' + (d.key === finMonth ? ' current' : ''));
    const bars = el('div', 'bars');
    const inc = el('div', 'bar inc');
    inc.style.height = barHeight(d.income, max) + 'px';
    const sp = el('div', 'bar exp');
    sp.style.height = barHeight(d.spent, max) + 'px';
    bars.append(inc, sp);
    group.append(bars, el('div', 'bar-label', shortMonth(d.key)));
    group.addEventListener('click', () => setFinMonth(d.key));
    box.appendChild(group);
  });

  // table
  const table = document.getElementById('chart-table');
  table.innerHTML = '';
  const head = el('tr');
  ['Month', 'Income', 'Extra', 'Spent'].forEach(h => head.appendChild(el('th', '', h)));
  table.appendChild(head);
  data.slice().reverse().forEach(d => {
    const row = el('tr');
    row.appendChild(el('td', '', shortMonth(d.key)));
    row.appendChild(el('td', '', money(d.income)));
    row.appendChild(el('td', '', money(d.extra)));
    row.appendChild(el('td', '', money(d.spent)));
    table.appendChild(row);
  });

  // spending by category for the selected month
  document.getElementById('chart-cat-title').textContent = 'Spending by category · ' + monthLabel(finMonth);
  const ul = document.getElementById('chart-cats');
  ul.innerHTML = '';
  const mo = fin.months[finMonth];
  const byCat = {};
  if (mo) {
    mo.expenses.forEach(x => {
      byCat[x.category] = (byCat[x.category] || 0) + x.amount;
    });
    mo.commitments.forEach(c => {
      if (c.paidAmount > 0) byCat[c.category] = (byCat[c.category] || 0) + c.paidAmount;
    });
  }
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) {
    ul.appendChild(el('li', '', 'No spending this month.'));
    return;
  }
  const top = rows[0][1];
  rows.forEach(r => {
    const li = el('li', 'cat-row');
    const line = el('div', 'cat-top');
    line.appendChild(el('span', '', r[0]));
    line.appendChild(el('strong', '', money(r[1])));
    const track = el('div', 'cat-track');
    const fill = el('div', 'cat-fill');
    fill.style.width = Math.round(r[1] / top * 100) + '%';
    track.appendChild(fill);
    li.append(line, track);
    ul.appendChild(li);
  });
}

renderChart();