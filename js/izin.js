// ============================================================
// MODUL IZIN, SAKIT, LIBUR & AUTO-ALPHA
// ============================================================

async function loadIzinList() {
  const cabangEl = document.getElementById('filter-cabang-izin');
  const cabang = cabangEl ? cabangEl.value : '';
  let q = db.from('attendance').select('*').in('status', ['izin', 'sakit', 'libur', 'alpha']).order('created_at', { ascending: false }).limit(100);
  if (cabang) q = q.eq('cabang', cabang);
  const { data } = await q;
  const wrap = document.getElementById('izin-wrap');
  if (!wrap) return;
  
  if (!(data || []).length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Belum ada data izin</p></div>';
    return;
  }
  
  const tbody = (data || []).map(r => {
    const date = new Date(r.created_at).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...tz });
    const bc = r.status === 'alpha' ? 'b-red' : r.status === 'sakit' ? 'b-blue' : r.status === 'libur' ? 'b-gold' : 'b-yellow';
    const bl = r.status === 'alpha' ? 'Alpha' : r.status === 'sakit' ? 'Sakit' : r.status === 'libur' ? 'Libur' : 'Izin';
    return `<tr>
      <td><span class="id-chip">${escapeHtml(r.employee_id)}</span></td>
      <td>${escapeHtml(r.employee_name || '—')}</td>
      <td><span class="badge b-gold">${escapeHtml(r.cabang || '—')}</span></td>
      <td>${date}</td>
      <td><span class="badge ${bc}">${bl}</span></td>
      <td style="color:var(--muted);font-size:12px">${escapeHtml(r.notes || '—')}</td>
      <td><button class="btn btn-danger" onclick="deleteIzin('${escapeHtml(r.id)}')">Hapus</button></td>
    </tr>`;
  }).join('');
  
  wrap.innerHTML = `<div class="table-card">
    <table>
      <thead>
        <tr><th>ID</th><th>Nama</th><th>Cabang</th><th>Tanggal</th><th>Status</th><th>Keterangan</th><th></th></tr>
      </thead>
      <tbody>${tbody}</tbody>
    </table>
  </div>`;
}

async function deleteIzin(id) { 
  if (!confirm('Hapus data izin?')) return; 
  await db.from('attendance').delete().eq('id', id); 
  loadIzinList(); 
}

function toggleIzinTarget() {
  const isSemua = document.getElementById('mi-target').value === 'semua';
  document.getElementById('mi-emp-fields').style.display = isSemua ? 'none' : 'block';
  updateIzinPreview();
}

function updateIzinPreview() {
  const dateStart = document.getElementById('mi-date').value;
  const dateEnd = document.getElementById('mi-date-end').value;
  const target = document.getElementById('mi-target').value;
  const preview = document.getElementById('mi-preview');
  if (!preview) return;
  if (!dateStart) { preview.style.display = 'none'; return; }
  const end = dateEnd || dateStart;
  const days = Math.round((new Date(end) - new Date(dateStart)) / 86400000) + 1;
  if (days <= 0) { preview.style.display = 'none'; return; }
  const who = target === 'semua' ? 'semua karyawan' : '1 karyawan';
  preview.textContent = `ℹ️ Akan membuat ${days} hari × ${who} = estimasi ${days} record (jika individual) atau lebih (jika massal).`;
  preview.style.display = 'block';
}

async function submitIzin() {
  const target = document.getElementById('mi-target').value;
  const dateStart = document.getElementById('mi-date').value;
  const dateEnd = document.getElementById('mi-date-end').value || dateStart;
  const status = document.getElementById('mi-status').value;
  const cabang = document.getElementById('mi-cabang').value;
  const notes = document.getElementById('mi-notes').value.trim();

  if (!dateStart) { alert('Tanggal mulai wajib diisi.'); return; }
  if (new Date(dateEnd) < new Date(dateStart)) { alert('Tanggal selesai tidak boleh sebelum tanggal mulai.'); return; }

  const dates = [];
  let cur = new Date(dateStart + 'T00:00:00');
  const endD = new Date(dateEnd + 'T00:00:00');
  while (cur <= endD) {
    dates.push(cur.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
    cur.setDate(cur.getDate() + 1);
  }

  let employees = [];
  if (target === 'semua') {
    let q = db.from('employees').select('employee_id, name, cabang');
    if (cabang) q = q.eq('cabang', cabang);
    const { data, error: empErr } = await q;
    if (empErr) { alert('Gagal ambil data karyawan: ' + empErr.message); return; }
    employees = (data || []).map(e => ({ id: e.employee_id, name: e.name, cabang: e.cabang }));
    if (!employees.length) { alert('Tidak ada karyawan di cabang yang dipilih.'); return; }
  } else {
    const empId = document.getElementById('mi-id').value.trim().toUpperCase();
    const name = document.getElementById('mi-name').value.trim();
    if (!empId) { alert('ID Karyawan wajib diisi.'); return; }
    employees = [{ id: empId, name: name || null, cabang: cabang || null }];
  }

  const total = employees.length * dates.length;
  if (total > 10 && !confirm(`Akan menyimpan ${total} record (${employees.length} karyawan × ${dates.length} hari). Lanjutkan?`)) return;

  const inserts = [];
  for (const emp of employees) {
    for (const date of dates) {
      inserts.push({
        employee_id: emp.id,
        employee_name: emp.name || null,
        status,
        cabang: emp.cabang || cabang || null,
        notes: notes || null,
        created_at: date + 'T08:00:00+07:00'
      });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const { error } = await db.from('attendance').insert(inserts.slice(i, i + BATCH));
    if (error) { alert('Gagal simpan: ' + error.message); return; }
  }

  closeModal('izin');
  if (typeof loadAbsensi === 'function') loadAbsensi();
  loadIzinList();
  alert(`✓ ${total} data berhasil disimpan (${employees.length} karyawan × ${dates.length} hari).`);
}

async function autoMarkAlpha() {
  const date = document.getElementById('filter-date').value;
  const cabang = document.getElementById('filter-cabang-absensi').value;
  const label = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (!confirm(`Tandai Alpha otomatis untuk:\n📅 ${label}${cabang ? '\n🏪 Cabang: ' + cabang : ' (semua cabang)'}\n\nKaryawan yang belum ada catatan apapun hari itu akan ditandai Alpha.`)) return;

  let empQ = db.from('employees').select('employee_id, name, cabang');
  if (cabang) empQ = empQ.eq('cabang', cabang);
  const { data: allEmps, error: empErr } = await empQ;
  if (empErr) { alert('Gagal: ' + empErr.message); return; }

  let attQ = db.from('attendance').select('employee_id')
    .gte('created_at', date + 'T00:00:00+07:00')
    .lte('created_at', date + 'T23:59:59+07:00');
  if (cabang) attQ = attQ.eq('cabang', cabang);
  const { data: todayAtt } = await attQ;

  const recorded = new Set((todayAtt || []).map(r => r.employee_id));
  const unrecorded = (allEmps || []).filter(e => !recorded.has(e.employee_id));

  if (!unrecorded.length) { alert('✓ Semua karyawan sudah tercatat untuk tanggal tersebut.'); return; }

  const inserts = unrecorded.map(e => ({
    employee_id: e.employee_id,
    employee_name: e.name,
    cabang: e.cabang || 'Pusat',
    status: 'alpha',
    notes: 'Auto-tandai Alpha',
    created_at: date + 'T08:00:00+07:00'
  }));

  const { error } = await db.from('attendance').insert(inserts);
  if (error) { alert('Gagal: ' + error.message); return; }

  alert(`✓ ${unrecorded.length} karyawan ditandai Alpha:\n` + unrecorded.map(e => `• ${e.employee_id} — ${e.name}`).join('\n'));
  if (typeof loadAbsensi === 'function') loadAbsensi();
}

// ===== AUTO-ALPHA OTOMATIS (jam 22:00 WIB) =====
function checkAutoAlpha() {
  const now = new Date();
  const jakartaHour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta' }));
  const alreadyRan = localStorage.getItem('autoAlpha_' + new Date().toLocaleDateString('en-CA', tz));

  if (jakartaHour >= 22 && !alreadyRan) {
    runAutoAlpha();
  }
}

async function runAutoAlpha() {
  const today = new Date().toLocaleDateString('en-CA', tz);
  const flagKey = 'autoAlpha_' + today;
  if (localStorage.getItem(flagKey)) return;

  console.log('[Auto-Alpha] Menjalankan auto-alpha untuk', today);

  const { data: allEmps } = await db.from('employees').select('employee_id, name, cabang');
  if (!allEmps || !allEmps.length) return;

  const { data: todayAtt } = await db.from('attendance').select('employee_id')
    .gte('created_at', today + 'T00:00:00+07:00')
    .lte('created_at', today + 'T23:59:59+07:00');

  const recorded = new Set((todayAtt || []).map(r => r.employee_id));
  const unrecorded = allEmps.filter(e => !recorded.has(e.employee_id));

  if (unrecorded.length === 0) {
    console.log('[Auto-Alpha] Semua karyawan sudah tercatat, tidak ada alpha.');
    localStorage.setItem(flagKey, 'done_0');
    return;
  }

  const inserts = unrecorded.map(e => ({
    employee_id: e.employee_id,
    employee_name: e.name,
    cabang: e.cabang || 'Pusat',
    status: 'alpha',
    notes: 'Auto-Alpha (sistem otomatis jam 22:00)',
    created_at: today + 'T22:00:00+07:00'
  }));

  const { error } = await db.from('attendance').insert(inserts);
  if (error) {
    console.error('[Auto-Alpha] Gagal:', error.message);
    return;
  }

  localStorage.setItem(flagKey, 'done_' + unrecorded.length);
  console.log(`[Auto-Alpha] ${unrecorded.length} karyawan ditandai alpha:`, unrecorded.map(e => e.name).join(', '));

  if (typeof showToast === 'function') {
    showToast(`Auto-Alpha: ${unrecorded.length} karyawan ditandai alpha`, 'warning');
  }
}

setInterval(checkAutoAlpha, 10 * 60 * 1000);
setTimeout(checkAutoAlpha, 5000);
