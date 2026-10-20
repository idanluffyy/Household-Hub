// Finance (saved in this phone's browser)
const FIN_KEY = 'hubFinance';

function defaultFinance() {
  return { version: 1, fixedIncome: null, templates: [], months: {} };
}

function loadFinance() {
  try {
    const f = JSON.parse(localStorage.getItem(FIN_KEY) || 'null');
    if (f && f.months) return Object.assign(defaultFinance(), f);
  } catch (err) {
    // ignore and start fresh
  }
  return defaultFinance();
}

let fin = loadFinance();
let finMonth = today().slice(0, 7);

function saveFin() {
  localStorage.setItem(FIN_KEY, JSON.stringify(fin));
}

// ---------- building blocks ----------
function makeFixedIncome(m) {
  return {
    id: newId(),
    kind: 'fixed',
    name: fin.fixedIncome.name,
    amount: fin.fixedIncome.amount,
    date: dateInMonth(m, fin.fixedIncome.day)
  };
}

function makeCommitment(t, m) {
  return {
    id: newId(),
    templateId: t.id,
    name: t.name,
    amount: t.amount,
    category: t.category,
    dueDate: dateInMonth(m, t.day),
    paidAmount: 0
  };
}

// Creates the month the first time it is opened, with fixed income and recurring items
function ensureMonth(m) {
  if (!fin.months[m]) {
    fin.months[m] = { generated: false, incomes: [], expenses: [], commitments: [] };
  }
  const mo = fin.months[m];
  if (!mo.generated) {
    mo.generated = true;
    if (fin.fixedIncome && m >= fin.fixedIncome.startMonth) {
      mo.incomes.push(makeFixedIncome(m));
    }
    fin.templates.forEach(t => {
      if (t.active && m >= t.startMonth) mo.commitments.push(makeCommitment(t, m));
    });
    saveFin();
  }
  return mo;
}

function isPaid(c) {
  return (c.paidAmount || 0) >= c.amount;
}

function monthTotals(m) {
  const mo = ensureMonth(m);
  const income = mo.incomes.reduce((s, x) => s + x.amount, 0);
  const paid = mo.commitments.reduce((s, c) => s + (c.paidAmount || 0), 0);
  const unpaid = mo.commitments.reduce((s, c) => s + Math.max(c.amount - (c.paidAmount || 0), 0), 0);
  const spent = paid + mo.expenses.reduce((s, x) => s + x.amount, 0);
  return { income: income, spent: spent, unpaid: unpaid, left: income - spent - unpaid };
}

// ---------- fixed income ----------
function saveFixedIncome(name, amount, day) {
  const cur = today().slice(0, 7);
  const startMonth = fin.fixedIncome ? fin.fixedIncome.startMonth : cur;
  fin.fixedIncome = { name: name, amount: amount, day: day, startMonth: startMonth };
  Object.keys(fin.months).forEach(m => {
    if (m < cur) return;
    const mo = fin.months[m];
    const existing = mo.incomes.find(x => x.kind === 'fixed');
    if (existing) {
      existing.name = name;
      existing.amount = amount;
      existing.date = dateInMonth(m, day);
    } else {
      mo.incomes.push(makeFixedIncome(m));
    }
  });
  ensureMonth(cur);
  saveFin();
}

function removeFixedIncome() {
  const cur = today().slice(0, 7);
  fin.fixedIncome = null;
  Object.keys(fin.months).forEach(m => {
    if (m >= cur) {
      fin.months[m].incomes = fin.months[m].incomes.filter(x => x.kind !== 'fixed');
    }
  });
  saveFin();
}

// ---------- commitments ----------
function addCommitment(name, amount, category, dueDate, recurring) {
  const m = dueDate.slice(0, 7);
  const mo = ensureMonth(m);
  const c = { id: newId(), name: name, amount: amount, category: category, dueDate: dueDate, paidAmount: 0 };
  if (recurring) {
    const t = {
      id: newId(),
      name: name,
      amount: amount,
      category: category,
      day: parseInt(dueDate.slice(8, 10), 10),
      startMonth: m,
      active: true
    };
    fin.templates.push(t);
    c.templateId = t.id;
    Object.keys(fin.months).forEach(k => {
      if (k > m) fin.months[k].commitments.push(makeCommitment(t, k));
    });
  }
  mo.commitments.push(c);
  saveFin();
}

function deleteCommitment(mo, c) {
  if (!confirm('Delete "' + c.name + '" from this month?')) return;
  mo.commitments = mo.commitments.filter(x => x.id !== c.id);
  if (c.templateId) {
    const t = fin.templates.find(x => x.id === c.templateId);
    if (t && t.active && confirm('This repeats every month.\n\nOK = also stop it in future months.\nCancel = keep it in future months.')) {
      t.active = false;
      Object.keys(fin.months).forEach(k => {
        if (k > finMonth) {
          fin.months[k].commitments = fin.months[k].commitments.filter(x => x.templateId !== t.id);
        }
      });
    }
  }
  saveFin();
  renderFinance();
}

// ---------- screens ----------
function renderFinSummary() {
  const t = monthTotals(finMonth);
  const box = document.getElementById('fin-summary');
  box.innerHTML = '';
  const rows = [
    ['Income', t.income, false],
    ['Spent (paid)', t.spent, false],
    ['To pay', t.unpaid, false],
    ['Left', t.left, t.left < 0]
  ];
  rows.forEach(r => {
    const row = el('div', 'sum-row');
    row.appendChild(el('span', '', r[0]));
    row.appendChild(el('strong', r[2] ? 'neg' : '', money(r[1])));
    box.appendChild(row);
  });
}

function renderIncomeList(mo) {
  const ul = document.getElementById('income-list');
  ul.innerHTML = '';
  if (mo.incomes.length === 0) {
    ul.appendChild(el('li', '', 'No income this month.'));
    return;
  }
  mo.incomes
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(x => {
      const li = el('li');
      li.appendChild(el('span', '', x.date + ' · ' + x.name + (x.kind === 'fixed' ? ' (fixed)' : '')));
      const right = el('div', 'right');
      right.appendChild(el('strong', '', money(x.amount)));
      const del = el('button', '', 'X');
      del.addEventListener('click', () => {
        if (!confirm('Delete this income?')) return;
        mo.incomes = mo.incomes.filter(y => y.id !== x.id);
        saveFin();
        renderFinance();
      });
      right.appendChild(del);
      li.appendChild(right);
      ul.appendChild(li);
    });
}

function renderCommitmentList(mo) {
  const ul = document.getElementById('commit-list');
  ul.innerHTML = '';
  if (mo.commitments.length === 0) {
    ul.appendChild(el('li', '', 'No commitments this month.'));
    return;
  }
  mo.commitments
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .forEach(c => {
      const paid = isPaid(c);
      const overdue = !paid && c.dueDate < today();
      const li = el('li', 'commit' + (paid ? ' paid' : ''));

      const top = el('div', 'commit-top');
      const info = el('div');
      info.appendChild(el('div', 'commit-name', c.name));
      const meta = c.dueDate + ' · ' + c.category + (c.templateId ? ' · Monthly' : '');
      info.appendChild(el('div', 'commit-meta' + (overdue ? ' overdue' : ''), meta + (overdue ? ' · OVERDUE' : '')));
      top.appendChild(info);
      top.appendChild(el('div', 'commit-amt', money(c.amount)));

      const actions = el('div', 'commit-actions');

      const toggle = el('button', '', paid ? 'Mark unpaid' : 'Mark paid');
      toggle.addEventListener('click', () => {
        c.paidAmount = paid ? 0 : c.amount;
        saveFin();
        renderFinance();
      });

      const edit = el('button', '', 'Change amount');
      edit.addEventListener('click', () => {
        const v = parseFloat(prompt('New amount for this month:', c.amount));
        if (!(v > 0)) return;
        c.amount = v;
        if (paid) c.paidAmount = v;
        saveFin();
        renderFinance();
      });

      const del = el('button', 'danger', 'Delete');
      del.addEventListener('click', () => deleteCommitment(mo, c));

      actions.append(toggle, edit, del);
      li.append(top, actions);
      ul.appendChild(li);
    });
}

function renderFinance() {
  const mo = ensureMonth(finMonth);
  document.getElementById('fin-month-label').textContent = monthLabel(finMonth);
  renderFinSummary();
  renderIncomeList(mo);
  renderCommitmentList(mo);
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof renderChart === 'function') renderChart();
}

function fillFixedForm() {
  const f = fin.fixedIncome;
  document.getElementById('fi-name').value = f ? f.name : '';
  document.getElementById('fi-amount').value = f ? f.amount : '';
  document.getElementById('fi-day').value = f ? f.day : '';
}

function setFinMonth(m) {
  finMonth = m;
  document.getElementById('commit-date').value = (m === today().slice(0, 7)) ? today() : m + '-01';
  renderFinance();
}

// ---------- events ----------
document.getElementById('fin-prev').addEventListener('click', () => setFinMonth(shiftMonth(finMonth, -1)));
document.getElementById('fin-next').addEventListener('click', () => setFinMonth(shiftMonth(finMonth, 1)));

document.querySelectorAll('#fin-subtabs button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#fin-subtabs button').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.panel).classList.add('active');
  });
});

document.getElementById('fixed-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('fi-name').value.trim();
  const amount = parseFloat(document.getElementById('fi-amount').value);
  const day = parseInt(document.getElementById('fi-day').value, 10);
  if (!name || !(amount > 0) || !(day >= 1 && day <= 31)) return;
  saveFixedIncome(name, amount, day);
  renderFinance();
  alert('Saved. It will be added automatically every month.');
});

document.getElementById('fi-remove').addEventListener('click', () => {
  if (!fin.fixedIncome) return;
  if (!confirm('Remove the fixed income from this month onward? Past months stay as they are.')) return;
  removeFixedIncome();
  fillFixedForm();
  renderFinance();
});

document.getElementById('commit-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('commit-name').value.trim();
  const amount = parseFloat(document.getElementById('commit-amount').value);
  const category = document.getElementById('commit-category').value;
  const date = document.getElementById('commit-date').value;
  const recurring = document.getElementById('commit-recurring').checked;
  if (!name || !(amount > 0) || !date) return;
  addCommitment(name, amount, category, date, recurring);
  document.getElementById('commit-name').value = '';
  document.getElementById('commit-amount').value = '';
  document.getElementById('commit-recurring').checked = false;
  renderFinance();
});

// ---------- start ----------
document.getElementById('commit-date').value = today();
fillFixedForm();
renderFinance();