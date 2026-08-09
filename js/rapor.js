// ============================================================
// MODUL RAPOR BULANAN KARYAWAN & CETAK SLIP
// ============================================================

async function loadRaporEmpList() {
  const { data } = await db.from('employees').select('employee_id, name, cabang').order('name');
  const sel = document.getElementById('rapor-emp');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Pilih Karyawan...</option>' +
    (data || []).map(e => `<option value="${e.employee_id}">${e.name} (${e.employee_id})</option>`).join('');
  if (cur) sel.value = cur;
  
  const monthEl = document.getElementById('rapor-month');
  if (monthEl && !monthEl.value) {
    monthEl.value = new Date().toLocaleDateString('en-CA', tz).slice(0, 7);
  }
}

async function loadRapor() {
  const empId = document.getElementById('rapor-emp').value;
  const month = document.getElementById('rapor-month').value;
  const wrap = document.getElementById('rapor-wrap');
  if (!wrap) return;

  if (!empId || !month) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Pilih karyawan dan bulan untuk melihat rapor</p></div>';
    return;
  }
  wrap.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat rapor...</div>';

  const [year, mon] = month.split('-');
  const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();

  const { data, error } = await db.from('attendance').select('*')
    .eq('employee_id', empId)
    .gte('created_at', `${month}-01T00:00:00+07:00`)
    .lte('created_at', `${month}-${String(lastDay).padStart(2, '0')}T23:59:59+07:00`)
    .order('created_at');

  if (error) {
    wrap.innerHTML = `<div class="empty-state"><p style="color:var(--red)">${error.message}</p></div>`;
    return;
  }

  const rows = data || [];
  const byDate = {};
  rows.forEach(r => {
    const d = new Date(r.created_at).toLocaleDateString('en-CA', tz);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  });

  let hadir = 0, terlambat = 0, totalMntTelat = 0, izin = 0, sakit = 0, libur = 0, alpha = 0;
  const statusMap = {};
  Object.entries(byDate).forEach(([date, recs]) => {
    const statuses = recs.map(r => r.status);
    if (statuses.includes('hadir')) {
      hadir++;
      const r = recs.find(x => x.status === 'hadir');
      const m = r.notes && r.notes.match(/Terlambat (\d+) mnt/);
      if (m) { terlambat++; totalMntTelat += parseInt(m[1]); }
      statusMap[date] = { status: 'hadir', notes: r.notes, late: m ? parseInt(m[1]) : 0 };
    } else if (statuses.includes('izin')) { izin++; statusMap[date] = { status: 'izin' }; }
    else if (statuses.includes('sakit')) { sakit++; statusMap[date] = { status: 'sakit' }; }
    else if (statuses.includes('libur')) { libur++; statusMap[date] = { status: 'libur' }; }
    else if (statuses.includes('alpha')) { alpha++; statusMap[date] = { status: 'alpha' }; }
    else if (statuses.includes('keluar')) { statusMap[date] = { status: 'keluar' }; }
  });

  const divisor = hadir + izin + sakit + alpha;
  const pctHadir = divisor > 0 ? Math.round((hadir / divisor) * 100) : 0;

  const firstDow = new Date(`${month}-01`).getDay();
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  let calCells = '<td></td>'.repeat(firstDow);
  let printCalCells = '<td></td>'.repeat(firstDow);

  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const dayData = statusMap[dateStr];
    let cellColor = 'rgba(255,255,255,0.02)';
    let cellLabel = '';
    let printBg = '#f9f9f9';
    let printLabel = '<span style="color:#bbb;font-size:9px;">—</span>';

    if (dayData) {
      if (dayData.status === 'hadir') {
        cellColor = dayData.late > 0 ? 'rgba(212,172,13,0.15)' : 'rgba(39,174,96,0.15)';
        cellLabel = dayData.late > 0 ? `<div style="font-size:9px;color:var(--yellow)">+${dayData.late}m</div>` : '<div style="font-size:9px;color:var(--green)">✓</div>';
        printBg = dayData.late > 0 ? '#fff9e6' : '#eafaf1';
        printLabel = dayData.late > 0 ? `<b style="color:#b7950b;font-size:9px;">+${dayData.late}m</b>` : '<b style="color:#27ae60;font-size:9px;">Hadir</b>';
      } else if (dayData.status === 'izin') { 
        cellColor = 'rgba(212,172,13,0.1)'; cellLabel = '<div style="font-size:9px;color:#e5c800">Izin</div>'; 
        printBg = '#fffde7'; printLabel = '<span style="color:#b7950b;font-size:9px;">Izin</span>';
      } else if (dayData.status === 'sakit') { 
        cellColor = 'rgba(41,128,185,0.1)'; cellLabel = '<div style="font-size:9px;color:#7ec8e3">Sakit</div>'; 
        printBg = '#ebf5fb'; printLabel = '<span style="color:#2980b9;font-size:9px;">Sakit</span>';
      } else if (dayData.status === 'libur') { 
        cellColor = 'rgba(201,169,110,0.1)'; cellLabel = '<div style="font-size:9px;color:var(--gold)">Libur</div>'; 
        printBg = '#fef9e7'; printLabel = '<span style="color:#8c6d37;font-size:9px;">Libur</span>';
      } else if (dayData.status === 'alpha') { 
        cellColor = 'rgba(192,57,43,0.15)'; cellLabel = '<div style="font-size:9px;color:#e57373">Alpha</div>'; 
        printBg = '#fdedec'; printLabel = '<b style="color:#c0392b;font-size:9px;">Alpha</b>';
      }
    }
    const dow = new Date(dateStr).getDay();
    if (dow === 0 || dow === 6) {
      cellColor = 'rgba(255,255,255,0.01)';
      if (!dayData) printBg = '#f2f2f2';
    }

    calCells += `<td style="text-align:center;padding:6px 4px;background:${cellColor};border-radius:6px;border:1px solid rgba(255,255,255,0.04);">
      <div style="font-size:11px;font-weight:600;color:var(--muted)">${d}</div>${cellLabel}
    </td>`;

    printCalCells += `<td style="text-align:center;padding:6px 4px;background:${printBg};border:1px solid #ddd;border-radius:4px;">
      <div style="font-size:10px;font-weight:600;color:#333;">${d}</div>${printLabel}
    </td>`;

    if ((firstDow + d) % 7 === 0 && d < lastDay) {
      calCells += '</tr><tr>';
      printCalCells += '</tr><tr>';
    }
  }

  const empOption = document.getElementById('rapor-emp').selectedOptions[0];
  const empName = empOption ? empOption.text : empId;
  const monthLabel = new Date(`${month}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  window._currentRaporData = {
    empId,
    empName,
    month,
    monthLabel,
    hadir,
    terlambat,
    totalMntTelat,
    izin,
    sakit,
    libur,
    alpha,
    pctHadir,
    printCalCells
  };

  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      <div class="stat-card sgreen"><div class="stat-label">Hadir</div><div class="stat-value">${hadir}</div><div class="stat-sub">${pctHadir}% dari total hari kerja tercatat</div></div>
      <div class="stat-card sgold"><div class="stat-label">Terlambat</div><div class="stat-value">${terlambat}</div><div class="stat-sub">${terlambat > 0 ? 'Total ' + formatMenitKeJam(totalMntTelat) : 'Selalu tepat waktu ✓'}</div></div>
      <div class="stat-card sblue"><div class="stat-label">Izin / Sakit / Libur</div><div class="stat-value">${izin + sakit + libur}</div><div class="stat-sub">${izin}× izin · ${sakit}× sakit · ${libur}× libur</div></div>
      <div class="stat-card sred"><div class="stat-label">Alpha</div><div class="stat-value">${alpha}</div><div class="stat-sub">${alpha === 0 ? 'Tidak ada alpha ✓' : 'Perlu perhatian'}</div></div>
    </div>
    <div class="chart-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div class="chart-title">${escapeHtml(empName)} — Kalender Kehadiran ${monthLabel}</div>
        <button class="btn btn-outline" style="font-size:11px;padding:6px 12px;" onclick="printRapor()">🖨️ Cetak Rapor Ini</button>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:separate;border-spacing:3px;">
          <thead><tr>${days.map(d => `<th style="text-align:center;font-size:10px;color:var(--muted);padding:4px;">${d}</th>`).join('')}</tr></thead>
          <tbody><tr>${calCells}</tr></tbody>
        </table>
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;font-size:11px;color:var(--muted);">
        <span>🟢 Hadir tepat</span><span>🟡 Terlambat</span><span>🔵 Sakit</span><span>✨ Libur</span><span>🔴 Alpha</span>
      </div>
    </div>`;
}

function printRapor() {
  const d = window._currentRaporData;
  if (!d) {
    alert('Silakan pilih karyawan dan muat rapor terlebih dahulu.');
    return;
  }

  const printWrap = document.getElementById('print-rapor-wrapper');
  if (!printWrap) return;

  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  printWrap.innerHTML = `
    <div style="font-family: 'Inter', sans-serif; color: #111; padding: 10px; max-width: 800px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #C9A96E; padding-bottom: 12px; margin-bottom: 16px;">
        <div>
          <h1 style="font-family: 'Playfair Display', serif; font-size: 22px; color: #111; margin: 0 0 2px 0;">LAPORAN KEHADIRAN KARYAWAN</h1>
          <p style="font-size: 12px; color: #666; margin: 0;">BHC Professional — Attendance & Performance System</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 700; color: #8C6D37;">Periode: ${d.monthLabel}</div>
          <div style="font-size: 10px; color: #888; margin-top: 2px;">Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      <div style="background: #fdfbf7; border: 1px solid #e8dec8; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.5px;">Karyawan</div>
          <div style="font-size: 15px; font-weight: 700; color: #111;">${escapeHtml(d.empName)}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.5px;">Tingkat Kehadiran</div>
          <div style="font-size: 20px; font-weight: 800; color: ${d.pctHadir >= 85 ? '#27ae60' : d.pctHadir >= 70 ? '#d4ac0d' : '#c0392b'};">${d.pctHadir}%</div>
        </div>
      </div>

      <!-- Ringkasan Statistik -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px;">
        <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; background: #fff;">
          <div style="font-size: 10px; color: #666; text-transform: uppercase;">Total Hadir</div>
          <div style="font-size: 18px; font-weight: 700; color: #27ae60; margin-top: 2px;">${d.hadir} Hari</div>
        </div>
        <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; background: #fff;">
          <div style="font-size: 10px; color: #666; text-transform: uppercase;">Terlambat</div>
          <div style="font-size: 18px; font-weight: 700; color: #d4ac0d; margin-top: 2px;">${d.terlambat}x</div>
          <div style="font-size: 9px; color: #888;">${d.terlambat > 0 ? formatMenitKeJam(d.totalMntTelat) : 'Tepat waktu'}</div>
        </div>
        <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; background: #fff;">
          <div style="font-size: 10px; color: #666; text-transform: uppercase;">Izin / Sakit / Libur</div>
          <div style="font-size: 18px; font-weight: 700; color: #2980b9; margin-top: 2px;">${d.izin + d.sakit + d.libur}</div>
          <div style="font-size: 9px; color: #888;">${d.izin} izn · ${d.sakit} skt · ${d.libur} lbr</div>
        </div>
        <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; background: #fff;">
          <div style="font-size: 10px; color: #666; text-transform: uppercase;">Alpha (Tanpa Ket.)</div>
          <div style="font-size: 18px; font-weight: 700; color: #c0392b; margin-top: 2px;">${d.alpha}</div>
        </div>
      </div>

      <!-- Tabel Kalender Detail -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; margin-bottom: 6px; color: #333;">Kalender Detail Harian (${d.monthLabel})</div>
        <table style="width: 100%; border-collapse: separate; border-spacing: 3px;">
          <thead>
            <tr>${days.map(day => `<th style="text-align: center; font-size: 10px; color: #666; padding: 4px; background: #f0f0f0; border-radius: 3px;">${day}</th>`).join('')}</tr>
          </thead>
          <tbody>
            <tr>${d.printCalCells}</tr>
          </tbody>
        </table>
      </div>

      <!-- Tanda Tangan -->
      <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; border-top: 1px solid #eee;">
        <div style="text-align: center; width: 200px;">
          <div style="font-size: 11px; color: #666; margin-bottom: 50px;">Karyawan Yang Bersangkutan</div>
          <div style="font-size: 12px; font-weight: 700; border-top: 1px solid #777; padding-top: 4px;">${escapeHtml(d.empName.split('(')[0].trim())}</div>
        </div>
        <div style="text-align: center; width: 200px;">
          <div style="font-size: 11px; color: #666; margin-bottom: 50px;">Manajemen / Kasir BHC Professional</div>
          <div style="font-size: 12px; font-weight: 700; border-top: 1px solid #777; padding-top: 4px;">( .................................... )</div>
        </div>
      </div>
    </div>
  `;

  document.body.classList.remove('printing-card');
  document.body.classList.remove('printing-rekap');
  document.body.classList.add('printing-rapor');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-rapor'), 500);
}
