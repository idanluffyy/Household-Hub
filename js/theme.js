// Theme: wallpaper and light/dark mode
const THEME_KEY = 'hubTheme';
const WALLPAPERS = [
  { id: 'aurora', name: 'Aurora', color: '#0f3d4a' },
  { id: 'sunset', name: 'Sunset', color: '#7b2d6b' },
  { id: 'ocean', name: 'Ocean', color: '#0a3a7a' },
  { id: 'forest', name: 'Forest', color: '#0f3d2b' },
  { id: 'midnight', name: 'Midnight', color: '#241a52' },
  { id: 'rose', name: 'Rose', color: '#6b1f55' }
];

function loadTheme() {
  try {
    const t = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    return { wallpaper: t.wallpaper || 'aurora', mode: t.mode || 'auto' };
  } catch (err) {
    return { wallpaper: 'aurora', mode: 'auto' };
  }
}

let theme = loadTheme();
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function saveTheme() {
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
}

function applyTheme() {
  const root = document.documentElement;
  root.dataset.wallpaper = theme.wallpaper;
  const dark = theme.mode === 'dark' || (theme.mode === 'auto' && darkQuery && darkQuery.matches);
  root.dataset.scheme = dark ? 'dark' : 'light';

  const wp = WALLPAPERS.find(w => w.id === theme.wallpaper) || WALLPAPERS[0];
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', wp.color);

  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.wallpaper === theme.wallpaper);
  });
  const modeSel = document.getElementById('theme-mode');
  if (modeSel) modeSel.value = theme.mode;
}

function buildSwatches() {
  const grid = document.getElementById('wallpaper-grid');
  if (!grid) return;
  grid.innerHTML = '';
  WALLPAPERS.forEach(w => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.wallpaper = w.id;
    b.textContent = w.name;
    b.addEventListener('click', () => {
      theme.wallpaper = w.id;
      saveTheme();
      applyTheme();
    });
    grid.appendChild(b);
  });
}

const themeModeSelect = document.getElementById('theme-mode');
if (themeModeSelect) {
  themeModeSelect.addEventListener('change', () => {
    theme.mode = themeModeSelect.value;
    saveTheme();
    applyTheme();
  });
}
if (darkQuery && darkQuery.addEventListener) {
  darkQuery.addEventListener('change', applyTheme);
}

buildSwatches();
applyTheme();