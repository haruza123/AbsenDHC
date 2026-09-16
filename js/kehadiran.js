// ============================================================
// MODUL KEHADIRAN EVENT, STATISTIK & CHART
// ============================================================

async function loadKehadiran() {
  const eventEl = document.getElementById('filter-event-kehadiran');
  const wrap = document.getElementById('table-wrap');
  if (!eventEl || !wrap) return;

  const eventId = eventEl.value;
  if (!eventId) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Pilih event untuk melihat data kehadiran</p></div>';
    updateKehadiranStats(0, 0);
    return;
  }

  const { data: participants } = await db.from('participants').select('id, participant_id, name, email, phone, organization').eq('event_id', eventId);
  const { data: attended } = await db.from('attendance').select('participant_id, scanned_at').eq('event_id', eventId);

  const attendedMap = {};
  (attended || []).forEach(a => { attendedMap[a.participant_id] = a.scanned_at; });

  allRows = (participants || []).map(p => ({
    ...p,
    hadir: !!attendedMap[p.id],
    scanned_at: attendedMap[p.id] || null
  }));

  currentPage = 1;

  const totalP = allRows.length;
  const hadirCount = allRows.filter(r => r.hadir).length;
  updateKehadiranStats(hadirCount, totalP);
  renderKehadiranTable();
}

function updateKehadiranStats(hadir, total) {
  const sHadir = document.getElementById('s-hadir');
  const sBelum = document.getElementById('s-belum');
  const sTotal = document.getElementById('s-total');
  const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;

  if (sHadir) sHadir.textContent = hadir;
  if (sBelum) sBelum.textContent = total - hadir;
  if (sTotal) sTotal.textContent = total;

  updateDoughnut(hadir, total - hadir);
}

function filterTable() {
  currentPage = 1;
  renderKehadiranTable();
}

function renderKehadiranTable() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('filter-status-kehadiran')?.value || '';

  let filtered = allRows.filter(r =>
    (r.participant_id || '').toLowerCase().includes(q) ||
    (r.name || '').toLowerCase().includes(q) ||
    (r.organization || '').toLowerCase().includes(q)
  );

  if (statusFilter === 'hadir') filtered = filtered.filter(r => r.hadir);
  if (statusFilter === 'belum') filtered = filtered.filter(r => !r.hadir);

  const total = filtered.length;
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);
  const wrap = document.getElementById('table-wrap');
  if (!wrap) return;

  if (!rows.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Tidak ada data</p></div>';
    const pageInfo = document.getElementById('page-info');
    const pageBtns = document.getElementById('page-btns');
    if (pageInfo) pageInfo.textContent = '0 data';
    if (pageBtns) pageBtns.innerHTML = '';
    return;
  }

  const tbody = rows.map(r => {
    const statusBadge = r.hadir
      ? '<span class="badge b-green">✓ Hadir</span>'
      : '<span class="badge b-red">Belum</span>';
    const scanTime = r.scanned_at
      ? new Date(r.scanned_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit', ...tz })
      : '—';

    return `<tr>
      <td><span class="id-chip">${escapeHtml(r.participant_id)}</span></td>
      <td style="font-weight:500">${escapeHtml(r.name)}</td>
      <td style="font-size:12px">${escapeHtml(r.organization || '—')}</td>
      <td style="font-size:12px">${escapeHtml(r.email || '—')}</td>
      <td>${statusBadge}</td>
      <td style="font-size:12px">${scanTime}</td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table><thead><tr><th>ID</th><th>Nama</th><th>Organisasi</th><th>Email</th><th>Status</th><th>Waktu Scan</th></tr></thead><tbody>${tbody}</tbody></table>`;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageInfo = document.getElementById('page-info');
  const btns = document.getElementById('page-btns');

  if (pageInfo) pageInfo.textContent = `${start + 1}–${Math.min(start + PAGE_SIZE, total)} dari ${total}`;
  if (btns) {
    btns.innerHTML = '';
    for (let p = 1; p <= totalPages; p++) {
      const b = document.createElement('button');
      b.className = 'page-btn' + (p === currentPage ? ' active' : '');
      b.textContent = p;
      b.onclick = () => { currentPage = p; renderKehadiranTable(); };
      btns.appendChild(b);
    }
  }
}

function exportKehadiranExcel() {
  const eventEl = document.getElementById('filter-event-kehadiran');
  const eventName = eventEl ? eventEl.options[eventEl.selectedIndex].text : 'Event';

  if (!allRows.length) { alert('Tidak ada data untuk di-export.'); return; }

  let csv = '﻿';
  csv += `"REKAP KEHADIRAN - ${eventName}"\n`;
  csv += `"Diekspor: ${new Date().toLocaleString('id-ID', tz)}"\n\n`;
  csv += '"ID Peserta","Nama","Email","HP","Organisasi","Status","Waktu Scan"\n';

  allRows.forEach(r => {
    const scanTime = r.scanned_at ? new Date(r.scanned_at).toLocaleString('id-ID', tz) : '—';
    csv += `${escapeCsvCell(r.participant_id)},${escapeCsvCell(r.name)},${escapeCsvCell(r.email)},${escapeCsvCell(r.phone)},${escapeCsvCell(r.organization)},${escapeCsvCell(r.hadir ? 'Hadir' : 'Belum Hadir')},${escapeCsvCell(scanTime)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kehadiran-${eventName.replace(/\s+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== CHART =====
function updateDoughnut(hadir, belum) {
  const chartEl = document.getElementById('chartDoughnut');
  if (!chartEl) return;

  const isLight = document.documentElement.classList.contains('light-theme');
  const legendColor = isLight ? '#334155' : '#8a8580';
  const emptyColor = isLight ? '#e2e8f0' : '#1e1e1e';

  const totalVal = hadir + belum;
  const noData = totalVal === 0;
  const ctx = chartEl.getContext('2d');

  if (doughnutChart) doughnutChart.destroy();
  doughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Hadir', 'Belum Hadir'],
      datasets: [{
        data: noData ? [1] : [hadir, belum],
        backgroundColor: noData ? [emptyColor] : ['#27ae60', '#c0392b'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: legendColor, font: { size: 12 }, padding: 14 } },
        tooltip: { enabled: !noData }
      },
      cutout: '70%'
    }
  });
}

// ===== REALTIME =====
let realtimeChannel = null;
function setupRealtime() {
  if (realtimeChannel) return;
  realtimeChannel = db.channel('rt-attendance');
  realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
    loadKehadiran();
    if (typeof loadBelumScan === 'function') loadBelumScan();
  }).subscribe();
}
