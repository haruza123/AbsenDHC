// ============================================================
// MODUL TEMA (LIGHT / DARK MODE) DENGAN DEFAULT MOBILE TERANG
// ============================================================

(function() {
  // Tentukan tema awal:
  // 1. Cek penyimpanan lokal
  // 2. Jika belum ada dan dibuka di mobile (<= 900px), jadikan 'light' sebagai default
  // 3. Jika desktop dan belum ada preferensi, default ke 'dark'
  const savedTheme = localStorage.getItem('bhc_theme');
  const isMobile = window.innerWidth <= 900;
  const initialTheme = savedTheme || (isMobile ? 'light' : 'dark');

  if (initialTheme === 'light') {
    document.documentElement.classList.add('light-theme');
  } else {
    document.documentElement.classList.remove('light-theme');
  }
})();

function getCurrentTheme() {
  return document.documentElement.classList.contains('light-theme') ? 'light' : 'dark';
}

function updateThemeToggleButtons(theme) {
  const isLight = theme === 'light';
  const buttons = document.querySelectorAll('.theme-toggle-btn');
  
  buttons.forEach(btn => {
    const iconSpan = btn.querySelector('.theme-icon');
    const textSpan = btn.querySelector('.theme-text');
    
    const iconHtml = isLight
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    if (iconSpan) {
      iconSpan.innerHTML = iconHtml;
    } else {
      btn.innerHTML = iconHtml;
    }

    if (textSpan) {
      textSpan.textContent = isLight ? 'Mode Gelap' : 'Mode Terang';
    }

    const titleText = isLight ? 'Ganti ke Mode Gelap' : 'Ganti ke Mode Terang';
    btn.title = titleText;
    btn.setAttribute('aria-label', titleText);
  });

  const selectEl = document.getElementById('set-theme-select');
  if (selectEl) {
    selectEl.value = theme;
  }
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light-theme');
    if (document.body) document.body.classList.add('light-theme');
  } else {
    document.documentElement.classList.remove('light-theme');
    if (document.body) document.body.classList.remove('light-theme');
  }
  localStorage.setItem('bhc_theme', theme);
  updateThemeToggleButtons(theme);

  // Perbarui chart absensi jika sedang aktif
  if (typeof loadChartLine === 'function' && document.getElementById('chartLine')) {
    try { loadChartLine(); } catch(e) {}
  }
}

function toggleTheme() {
  const current = getCurrentTheme();
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
}

document.addEventListener('DOMContentLoaded', () => {
  const current = getCurrentTheme();
  applyTheme(current);
});
