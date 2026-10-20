// Calendar for Finance
const WEEK_STARTS_ON = 0; // 0 = Sunday, 1 = Monday
let calSelected = today();

function dayInfo(mo, date) {
  return {
    incomes: mo.incomes.filter(x => x.date === date),
    expenses: mo.expenses.filter(x => x.date === date),
    dues: mo.commitments.filter(c => c.dueDate === date)
  };
}

function addDayRow(ul, text, amount, onDelete) {
  const li = el('li');
  li.appendChild(el('span', '', text));
  const right = el('div', 'right');
  right.appendChild(el('strong', '', amount));
  if (onDelete) {
    const del = el('button', '', 'X');
    del.addEventListener('click', onDelete);
    right.appendChild(del);
  }
  li.appendChild(right);
  ul.appendChild(li);
}

function renderDayList(mo) {
  const info = dayInfo(mo, calSelected);
  document.getElementById('cal-day-title').textContent = calSelected;
  const dayExtra = info.incomes.filter(x => x.kind !== 'fixed').reduce((s, x) => s + x.amount, 0);
  const dayExp = info.expenses.reduce((s, x) => s + x.amount, 0);
  const daySum = document.getElementById('cal-day-summary');
  daySum.innerHTML = '';
  [
    ['Extra income', '+ ' + money(dayExtra), dayExtra > 0 ? 'pos' : ''],
    ['Expenses', '- ' + money(dayExp), dayExp > 0 ? 'neg' : '']
  ].forEach(r => {
    const row = el('div', 'sum-row');
    row.appendChild(el('span', '', r[0]));
    row.appendChild(el('strong', r[2], r[1]));
    daySum.appendChild(row);
  });
  const ul = document.getElementById('cal-day-list');
  ul.innerHTML = '';
  let count = 0;

  info.incomes.forEach(x => {
    count++;
    const isFixed = x.kind === 'fixed';
    addDayRow(
      ul,
      (isFixed ? 'Fixed income' : 'Extra income') + ' · ' + x.name,
      '+ ' + money(x.amount),
      isFixed ? null : () => {
        if (!confirm('Delete this income?')) return;
        mo.incomes = mo.incomes.filter(y => y.id !== x.id);
        saveFin();
        renderFinance();
      }
    );
  });

  info.expenses.forEach(x => {
    count++;
    addDayRow(
      ul,
      'Expense · ' + x.category + (x.name ? ' · ' + x.name : ''),
      '- ' + money(x.amount),
      () => {
        if (!confirm('Delete this expense?')) return;
        mo.expenses = mo.expenses.filter(y => y.id !== x.id);
        saveFin();
        renderFinance();
      }
    );
  });

  info.dues.forEach(c => {
    count++;
    addDayRow(ul, 'Due · ' + c.name + (isPaid(c) ? ' (paid)' : ''), money(c.amount), null);
  });

  if (count === 0) ul.appendChild(el('li', '', 'Nothing on this day.'));
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  const mo = ensureMonth(finMonth);

  if (!calSelected.startsWith(finMonth)) {
    calSelected = (finMonth === today().slice(0, 7)) ? today() : finMonth + '-01';
  }

  grid.innerHTML = '';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 0; i < 7; i++) {
    grid.appendChild(el('div', 'cal-wd', names[(i + WEEK_STARTS_ON) % 7]));
  }

  const parts = finMonth.split('-').map(Number);
  const first = new Date(parts[0], parts[1] - 1, 1).getDay();
  const offset = (first - WEEK_STARTS_ON + 7) % 7;
  for (let i = 0; i < offset; i++) grid.appendChild(el('div'));

  const total = daysInMonth(finMonth);
  for (let d = 1; d <= total; d++) {
    const date = finMonth + '-' + String(d).padStart(2, '0');
    const info = dayInfo(mo, date);

    let cls = 'cal-day';
    if (date === today()) cls += ' today';
    if (date === calSelected) cls += ' sel';

    const btn = el('button', cls);
    btn.appendChild(el('span', '', String(d)));
    const dots = el('span', 'dots');
    if (info.expenses.length) dots.appendChild(el('span', 'dot exp'));
    if (info.incomes.length) dots.appendChild(el('span', 'dot inc'));
    if (info.dues.length) dots.appendChild(el('span', 'dot due'));
    btn.appendChild(dots);

    btn.addEventListener('click', () => {
      calSelected = date;
      renderCalendar();
    });
    grid.appendChild(btn);
  }

  renderDayList(mo);
}

// ---------- add form ----------
const calType = document.getElementById('cal-type');
const calAmount = document.getElementById('cal-amount');
const calName = document.getElementById('cal-name');
const calCategory = document.getElementById('cal-category');

calType.addEventListener('change', () => {
  calCategory.hidden = calType.value === 'income';
});

document.getElementById('cal-form').addEventListener('submit', e => {
  e.preventDefault();
  const amount = parseFloat(calAmount.value);
  if (!(amount > 0)) return;
  const mo = ensureMonth(finMonth);
  const name = calName.value.trim();

  if (calType.value === 'income') {
    mo.incomes.push({
      id: newId(),
      kind: 'extra',
      name: name || 'Extra income',
      amount: amount,
      date: calSelected
    });
  } else {
    mo.expenses.push({
      id: newId(),
      name: name,
      amount: amount,
      category: calCategory.value,
      date: calSelected
    });
  }

  saveFin();
  calAmount.value = '';
  calName.value = '';
  renderFinance();
});

renderCalendar();