// Home dashboard
function goToTab(name) {
  const btn = document.querySelector('nav button[data-tab="' + name + '"]');
  if (btn) btn.click();
}

function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
  const name = getSettings().me;
  return part + (name ? ', ' + name : '');
}

function daysBetween(fromDate, toDate) {
  const a = new Date(fromDate + 'T00:00:00');
  const b = new Date(toDate + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function dueLabel(c) {
  const d = daysBetween(today(), c.dueDate);
  if (d < 0) return 'Overdue by ' + (-d) + (d === -1 ? ' day' : ' days');
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return 'Due in ' + d + ' days';
}

// unpaid bills: overdue from last month, and due within 7 days
function dueSoon() {
  const t = today();
  const cur = t.slice(0, 7);
  const out = [];

  const prev = fin.months[shiftMonth(cur, -1)];
  if (prev) {
    prev.commitments.forEach(c => {
      if (!isPaid(c)) out.push(c);
    });
  }

  [cur, shiftMonth(cur, 1)].forEach(m => {
    ensureMonth(m).commitments.forEach(c => {
      if (isPaid(c)) return;
      if (daysBetween(t, c.dueDate) <= 7) out.push(c);
    });
  });

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function renderHome() {
  const t = today();
  const cur = t.slice(0, 7);

  document.getElementById('home-greeting').textContent = greeting();
  document.getElementById('home-date').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // money
  const totals = monthTotals(cur);
  const box = document.getElementById('home-money');
  box.innerHTML = '';
  box.appendChild(el('strong', '', monthLabel(cur)));
  [
    ['Income', totals.income, false],
    ['Spent (paid)', totals.spent, false],
    ['Still to pay', totals.unpaid, false],
    ['Left', totals.left, totals.left < 0]
  ].forEach(r => {
    const row = el('div', 'sum-row');
    row.appendChild(el('span', '', r[0]));
    row.appendChild(el('strong', r[2] ? 'neg' : '', money(r[1])));
    box.appendChild(row);
  });
  const openFin = el('button', 'link-btn', 'Open Finance');
  openFin.addEventListener('click', () => goToTab('finance'));
  box.appendChild(openFin);

  // bills due soon
  const dueBox = document.getElementById('home-due');
  dueBox.innerHTML = '';
  const dues = dueSoon();
  if (dues.length === 0) dueBox.appendChild(el('li', '', 'Nothing due in the next 7 days.'));
  dues.forEach(c => {
    const li = el('li');
    const info = el('div');
    info.appendChild(el('div', 'commit-name', c.name));
    info.appendChild(el(
      'div',
      'commit-meta' + (c.dueDate < t ? ' overdue' : ''),
      dueLabel(c) + ' · ' + c.dueDate
    ));
    const right = el('div', 'right');
    right.appendChild(el('strong', '', money(c.amount)));
    const paid = el('button', 'list-edit', 'Paid');
    paid.addEventListener('click', () => {
      c.paidAmount = c.amount;
      saveFin();
      renderFinance();
      renderHome();
    });
    right.appendChild(paid);
    li.append(info, right);
    dueBox.appendChild(li);
  });

  // lists
  const listBox = document.getElementById('home-lists');
  listBox.innerHTML = '';
  listData.lists.forEach(l => {
    const open = l.items.filter(i => !i.done).length;
    const li = el('li');
    li.appendChild(el('span', '', l.name));
    li.appendChild(el('strong', '', open === 0 ? 'All done' : open + ' left'));
    li.addEventListener('click', () => {
      listData.current = l.id;
      saveLists();
      renderList();
      goToTab('lists');
    });
    listBox.appendChild(li);
  });

  // pinned notes
  const noteBox = document.getElementById('home-notes');
  noteBox.innerHTML = '';
  const pinned = notes
    .filter(n => n.pinned && !n.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);
  if (pinned.length === 0) {
    noteBox.appendChild(el('li', '', 'No pinned notes yet. Pin a note to show it here.'));
  }
  pinned.forEach(n => {
    const li = el('li', 'home-note');
    li.appendChild(el('div', 'note-title', n.title || '(No title)'));
    let snippet = '';
    if (n.type === 'checklist') {
      snippet = n.items.filter(i => i.checked).length + ' of ' + n.items.length + ' done';
    } else if (n.type === 'link') {
      snippet = n.url ? domainOf(n.url) : '';
    } else {
      snippet = (n.text || '').slice(0, 80) + ((n.text || '').length > 80 ? '...' : '');
    }
    if (snippet) li.appendChild(el('div', 'commit-meta', snippet));
    li.addEventListener('click', () => goToTab('notes'));
    noteBox.appendChild(li);
  });
}

// refresh when you open Home, or come back to the app
document.querySelector('nav button[data-tab="home"]').addEventListener('click', renderHome);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderHome();
});

renderHome();

// live clock
function tickClock() {
  const clockEl = document.getElementById('home-time');
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}
tickClock();
setInterval(tickClock, 15000);