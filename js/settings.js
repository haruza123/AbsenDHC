// ============================================================
// MODUL PENGATURAN, WA NOTIFIKASI & AUDIT LOG PENGHAPUSAN
// ============================================================

async function loadSettings() {
  const { data } = await db.from('settings').select('key,value');
  if (!data) return;
  const s = Object.fromEntries(data.map(r => [r.key, r.value]));
  
  const setFonnte = document.getElementById('set-fonnte');
  const setWaTarget = document.getElementById('set-wa-target');
  const setWaEnabled = document.getElementById('set-wa-enabled');
  const setJamMasuk = document.getElementById('set-jam-masuk');
  const setToleransi = document.getElementById('set-toleransi');

  if (setFonnte) setFonnte.value = s.fonnte_token || '';
  if (setWaTarget) setWaTarget.value = s.wa_target || '';
  if (setWaEnabled) setWaEnabled.value = s.wa_enabled || 'false';
  if (setJamMasuk) setJamMasuk.value = s.jam_masuk || '09:00';
  if (setToleransi) setToleransi.value = s.toleransi_menit || '0';

  fonnteToken = s.fonnte_token || '';
  waTarget = s.wa_target || '';
  waEnabled = s.wa_enabled === 'true';
  jamMasuk = s.jam_masuk || '09:00';
  toleransiMenit = parseInt(s.toleransi_menit || '0');
  
  loadDeletionLogs();
}

async function saveSettings() {
  const updates = [
    { key: 'fonnte_token', value: document.getElementById('set-fonnte').value.trim() },
    { key: 'wa_target', value: document.getElementById('set-wa-target').value.trim() },
    { key: 'wa_enabled', value: document.getElementById('set-wa-enabled').value },
    { key: 'jam_masuk', value: document.getElementById('set-jam-masuk').value },
    { key: 'toleransi_menit', value: document.getElementById('set-toleransi').value },
  ];
  const msg = document.getElementById('save-msg-wa');
  const { error } = await db.from('settings').upsert(updates, { onConflict: 'key' });
  if (error) {
    msg.className = 'save-msg err'; msg.textContent = 'Gagal: ' + error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = '✓ Settings disimpan!';
    loadSettings();
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function loadDeletionLogs() {
  const wrap = document.getElementById('deletion-logs-wrap');
  if (!wrap) return;
  
  try {
    const { data, error } = await db
      .from('settings')
      .select('value')
      .eq('key', 'deletion_history')
      .maybeSingle();
      
    if (error) throw error;
    
    let logs = [];
    if (data && data.value) {
      logs = JSON.parse(data.value);
    }
    
    if (!logs.length) {
      wrap.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--muted); font-size: 13px;">Belum ada riwayat penghapusan.</div>';
      return;
    }
    
    const tbody = logs.map(log => {
      const deletedTime = new Date(log.deleted_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', ...tz });
      const recordTime = new Date(log.absensi_created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short', ...tz });
      let statusBadge = 'b-yellow';
      if (log.status === 'hadir') statusBadge = 'b-green';
      else if (log.status === 'keluar') statusBadge = 'b-blue';
      else if (log.status === 'alpha') statusBadge = 'b-red';
      
      return `<tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 10px; white-space: nowrap;">${deletedTime}</td>
        <td style="padding: 10px; color: var(--gold); font-weight: 500;">${escapeHtml(log.admin_email)}</td>
        <td style="padding: 10px;"><span class="id-chip">${escapeHtml(log.employee_id)}</span> ${escapeHtml(log.employee_name || '')}</td>
        <td style="padding: 10px;"><span class="badge ${statusBadge}">${escapeHtml(log.status)}</span></td>
        <td style="padding: 10px;">${escapeHtml(log.cabang || '—')}</td>
        <td style="padding: 10px; font-size: 11px; color: var(--muted);">${recordTime}</td>
      </tr>`;
    }).join('');
    
    wrap.innerHTML = `<table style="font-size: 12px; width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: var(--surface2); border-bottom: 1px solid var(--border);">
          <th style="padding: 10px; text-align: left; font-size: 9px; color: var(--muted); text-transform: uppercase;">Waktu Hapus</th>
          <th style="padding: 10px; text-align: left; font-size: 9px; color: var(--muted); text-transform: uppercase;">Admin</th>
          <th style="padding: 10px; text-align: left; font-size: 9px; color: var(--muted); text-transform: uppercase;">Karyawan</th>
          <th style="padding: 10px; text-align: left; font-size: 9px; color: var(--muted); text-transform: uppercase;">Status</th>
          <th style="padding: 10px; text-align: left; font-size: 9px; color: var(--muted); text-transform: uppercase;">Cabang</th>
          <th style="padding: 10px; text-align: left; font-size: 9px; color: var(--muted); text-transform: uppercase;">Waktu Absen</th>
        </tr>
      </thead>
      <tbody>
        ${tbody}
      </tbody>
    </table>`;
  } catch (err) {
    console.error('Gagal memuat log penghapusan:', err);
    wrap.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--red); font-size: 13px;">Gagal memuat: ${err.message}</div>`;
  }
}

async function sendDailyRecapWA() {
  if (!waEnabled || !fonnteToken || !waTarget) {
    alert('Aktifkan notifikasi WA dan isi token Fonnte di Settings terlebih dahulu.');
    return;
  }
  const date = document.getElementById('filter-date').value;
  const dateLabel = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const { data: att } = await db.from('attendance').select('*')
    .gte('created_at', date + 'T00:00:00+07:00')
    .lte('created_at', date + 'T23:59:59+07:00');

  const { data: emps } = await db.from('employees').select('employee_id, name');
  const totalEmp = (emps || []).length;

  const rows = att || [];
  const hadir = [...new Set(rows.filter(r => r.status === 'hadir').map(r => r.employee_id))];
  const keluar = [...new Set(rows.filter(r => r.status === 'keluar').map(r => r.employee_id))];
  const izin = [...new Set(rows.filter(r => r.status === 'izin').map(r => r.employee_id))];
  const sakit = [...new Set(rows.filter(r => r.status === 'sakit').map(r => r.employee_id))];
  const libur = [...new Set(rows.filter(r => r.status === 'libur').map(r => r.employee_id))];
  const alpha = [...new Set(rows.filter(r => r.status === 'alpha').map(r => r.employee_id))];

  const terlambatList = rows.filter(r => r.status === 'hadir' && r.notes && r.notes.includes('Terlambat'));
  const terlambatStr = terlambatList.length > 0
    ? '\n⚠️ *Terlambat:*\n' + terlambatList.map(r => {
        const m = r.notes.match(/Terlambat (\d+) mnt/);
        return `• ${r.employee_name} (+${m ? m[1] : '?'}mnt)`;
      }).join('\n')
    : '';

  const alphaList = rows.filter(r => r.status === 'alpha');
  const alphaStr = alpha.length > 0
    ? '\n🔴 *Alpha:*\n' + alphaList.map(r => `• ${r.employee_name}`).join('\n')
    : '';

  const msg = `💈 *REKAP HARIAN BHC PROFESSIONAL*\n📅 ${dateLabel}\n\n` +
    `✅ Hadir: ${hadir.length}/${totalEmp} karyawan\n` +
    `📤 Sudah Pulang: ${keluar.length}\n` +
    `📋 Izin: ${izin.length} · Sakit: ${sakit.length} · Libur: ${libur.length}\n` +
    `❌ Alpha: ${alpha.length}` +
    terlambatStr + alphaStr +
    `\n\n_Dikirim otomatis dari Sistem Absensi_`;

  try {
    await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': fonnteToken },
      body: new URLSearchParams({ target: waTarget, message: msg })
    });
    alert('✓ Rekap harian berhasil dikirim ke WA!');
  } catch (e) {
    alert('Gagal kirim WA: ' + e.message);
  }
}

function sendWA(empId, empName, time, status) {
  const typeStr = status === 'keluar' ? 'Absen Keluar 📤' : 'Absen Masuk 📥';
  const timeStr = new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', ...tz });
  const dateStr = new Date(time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz });
  const cabangVal = document.getElementById('scanner-cabang')?.value || 'Pusat';
  const message = `💈 *${typeStr}*\n\n👤 ${empId} — ${empName}\n🏪 Cabang: ${cabangVal}\n📅 ${dateStr}\n🕐 ${timeStr}\n📍 Perangkat Kasir`;
  
  fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { 'Authorization': fonnteToken },
    body: new URLSearchParams({ target: waTarget, message })
  }).catch(() => {});
}
