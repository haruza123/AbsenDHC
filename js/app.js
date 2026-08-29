// ============================================================
// APLIKASI UTAMA & NAVIGASI (APP.JS)
// ============================================================

function startApp() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';

  const today = new Date().toLocaleDateString('en-CA', tz);
  const filterDate = document.getElementById('filter-date');
  const filterMonth = document.getElementById('filter-month');
  const miDate = document.getElementById('mi-date');
  const todayLabel = document.getElementById('today-label');

  if (filterDate) filterDate.value = today;
  if (filterMonth) filterMonth.value = today.slice(0, 7);
  if (miDate) miDate.value = today;
  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...tz
    });
  }

  loadCabangList().then(() => {
    if (typeof loadBelumAbsen === 'function') loadBelumAbsen();
  });

  const scannerNavItem = document.querySelector('.nav-item[data-sec="scanner"]');
  showSection('scanner', scannerNavItem);
  
  if (typeof loadAbsensi === 'function') loadAbsensi();
  if (typeof loadChartLine === 'function') loadChartLine();
  if (typeof loadSettings === 'function') loadSettings();
  if (typeof setupRealtime === 'function') setupRealtime();
}

// ===== CABANG LIST (dari tabel cabang) =====
async function loadCabangList() {
  const { data } = await db.from('cabang').select('nama').order('nama');
  const unique = (data || []).map(r => r.nama).filter(Boolean);
  cabangList = unique;
  const selectors = [
    'filter-cabang-absensi', 'filter-cabang-rekap', 'filter-cabang-izin',
    'filter-cabang-karyawan', 'mi-cabang', 'mk-cabang', 'scanner-cabang', 'mek-cabang'
  ];

  selectors.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isSelect = el.tagName === 'SELECT';
    const isFilter = id.startsWith('filter') || id === 'scanner-cabang';
    const extra = isFilter
      ? '<option value="">Pilih Cabang...</option>'
      : (unique.length > 0 ? '' : '<option value="">— Belum ada cabang —</option>');

    if (isSelect) {
      const cur = el.value;
      el.innerHTML = extra + unique.map(c => `<option value="${c}">${c}</option>`).join('');
      if (cur && unique.includes(cur)) {
        el.value = cur;
      } else if (unique.length > 0 && !isFilter) {
        el.value = unique[0];
      }
    }
  });
}

// ===== NAVIGASI TAB =====
function showSection(name, el) {
  // Matikan kamera jika navigasi keluar dari Scanner Kasir
  if (name !== 'scanner' && typeof isScanning !== 'undefined' && isScanning && typeof toggleScanner === 'function') {
    toggleScanner();
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.nav-item[data-sec]').forEach(n => n.classList.toggle('active', n.dataset.sec === name));
  document.querySelectorAll('.bottom-nav-item[data-sec]').forEach(n => n.classList.toggle('active', n.dataset.sec === name));

  if (name === 'absensi' && typeof loadAbsensi === 'function') loadAbsensi();
  if (name === 'rekap' && typeof loadRekap === 'function') loadRekap();
  if (name === 'izin' && typeof loadIzinList === 'function') loadIzinList();
  if (name === 'cabang' && typeof loadCabang === 'function') loadCabang();
  if (name === 'karyawan' && typeof loadKaryawan === 'function') loadKaryawan();
  if (name === 'settings' && typeof loadSettings === 'function') loadSettings();
  if (name === 'rapor' && typeof loadRaporEmpList === 'function') loadRaporEmpList();
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

// Update preview saat tanggal modal izin berubah
['mi-date', 'mi-date-end'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', () => {
      if (typeof updateIzinPreview === 'function') updateIzinPreview();
    });
  }
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

// Tutup sidebar saat klik item menu di mobile
document.querySelectorAll('.nav-item[data-sec]').forEach(el => {
  el.addEventListener('click', () => {
    if (window.innerWidth <= 900) toggleSidebar();
  });
});

// Inisialisasi Auth saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
