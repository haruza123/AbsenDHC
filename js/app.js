// ============================================================
// APLIKASI UTAMA & NAVIGASI (APP.JS)
// ============================================================

function startApp() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';

  loadEventList().then(() => {
    if (typeof loadBelumScan === 'function') loadBelumScan();
  });

  const scannerNavItem = document.querySelector('.nav-item[data-sec="scanner"]');
  showSection('scanner', scannerNavItem);

  if (typeof loadKehadiran === 'function') loadKehadiran();
  if (typeof loadSettings === 'function') loadSettings();
  if (typeof setupRealtime === 'function') setupRealtime();
}

// ===== EVENT LIST (populate dropdowns) =====
async function loadEventList() {
  const { data } = await db.from('events').select('id, event_code, name, date').order('date', { ascending: false });
  eventList = data || [];

  const selectors = [
    'filter-event-kehadiran', 'filter-event-peserta',
    'scanner-event', 'mp-event'
  ];

  selectors.forEach(elId => {
    const el = document.getElementById(elId);
    if (!el) return;

    const isFilter = elId.startsWith('filter') || elId === 'scanner-event';
    const cur = el.value;
    const placeholder = isFilter ? '<option value="">Pilih Event...</option>' : '<option value="">Pilih Event...</option>';

    el.innerHTML = placeholder + eventList.map(e => {
      const dateStr = new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      return `<option value="${e.id}">${escapeHtml(e.name)} (${dateStr})</option>`;
    }).join('');

    if (cur && eventList.some(e => e.id === cur)) {
      el.value = cur;
    }
  });
}

// ===== NAVIGASI TAB =====
function showSection(name, el) {
  if (name !== 'scanner' && typeof isScanning !== 'undefined' && isScanning && typeof toggleScanner === 'function') {
    toggleScanner();
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.nav-item[data-sec]').forEach(n => n.classList.toggle('active', n.dataset.sec === name));
  document.querySelectorAll('.bottom-nav-item[data-sec]').forEach(n => n.classList.toggle('active', n.dataset.sec === name));

  if (name === 'kehadiran' && typeof loadKehadiran === 'function') loadKehadiran();
  if (name === 'events' && typeof loadEvents === 'function') loadEvents();
  if (name === 'peserta' && typeof loadPeserta === 'function') loadPeserta();
  if (name === 'settings' && typeof loadSettings === 'function') loadSettings();
}

// ===== MODAL MANAGER =====
function openModal(name) {
  const modal = document.getElementById('modal-' + name);
  if (modal) modal.classList.add('show');
}

function closeModal(name) {
  const modal = document.getElementById('modal-' + name);
  if (modal) modal.classList.remove('show');
}

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target === el) el.classList.remove('show');
  });
});

// ===== HAMBURGER & SIDEBAR MOBILE =====
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('hamburger');
  if (!sidebar) return;

  const isOpen = sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show', isOpen);
  if (btn) btn.classList.toggle('open', isOpen);
}

document.querySelectorAll('.nav-item[data-sec]').forEach(el => {
  el.addEventListener('click', () => {
    if (window.innerWidth <= 900) toggleSidebar();
  });
});

// Inisialisasi Auth
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
