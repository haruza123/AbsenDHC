// ============================================================
// MODUL REKAPITULASI BULANAN, EXCEL (.XLS) & CETAK LAPORAN
// ============================================================

async function loadRekap() {
  const monthEl = document.getElementById('filter-month');
  const cabangEl = document.getElementById('filter-cabang-rekap');
  if (!monthEl) return;

  const month = monthEl.value;
  const cabang = cabangEl ? cabangEl.value : '';
  if (!month) return;

  const [year, mon] = month.split('-');
  const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
  
  let q = db.from('attendance').select('*')
    .gte('created_at', `${month}-01T00:00:00+07:00`)
    .lte('created_at', `${month}-${String(lastDay).padStart(2, '0')}T23:59:59+07:00`);
  if (cabang) q = q.eq('cabang', cabang);
  
  const { data } = await q;
  const empMap = {};
  
  (data || []).forEach(r => {
    const id = r.employee_id;
    if (!empMap[id]) {
      empMap[id] = {
        id,
        name: r.employee_name || '—',
        cabang: r.cabang || '—',
        hadir: 0, keluar: 0, izin: 0, sakit: 0, libur: 0, alpha: 0,
        terlambat: 0, total_mnt_telat: 0
      };
    }
    if (empMap[id][r.status] !== undefined) empMap[id][r.status]++;
    if (r.status === 'hadir' && r.notes) {
      const m = r.notes.match(/Terlambat (\d+) mnt/);
      if (m) {
        empMap[id].terlambat++;
        empMap[id].total_mnt_telat += parseInt(m[1]);
      }
    }
  });
  
  const emps = Object.values(empMap);
  window._rekapData = emps;
  const wrap = document.getElementById('rekap-wrap');
  if (!wrap) return;

  if (!emps.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Tidak ada data bulan ini</p></div>';
    return;
  }
  
  const tbody = emps.map(e => `<tr>
    <td><span class="id-chip">${escapeHtml(e.id)}</span></td>
    <td>${escapeHtml(e.name)}</td>
    <td><span class="badge b-gold">${escapeHtml(e.cabang)}</span></td>
    <td><span class="badge b-green">${e.hadir}</span></td>
    <td><span class="badge b-yellow" title="${formatMenitKeJam(e.total_mnt_telat)} total">${e.terlambat}x${e.terlambat > 0 ? ` <span style="font-size:10px;opacity:0.7;">(${formatMenitKeJam(e.total_mnt_telat)})</span>` : ''}</span></td>
    <td><span class="badge b-yellow">${e.izin}</span></td>
    <td><span class="badge b-blue">${e.sakit}</span></td>
    <td><span class="badge b-gold">${e.libur}</span></td>
    <td><span class="badge b-red">${e.alpha}</span></td>
    <td style="font-weight:600;color:var(--gold)">${e.hadir} Hari</td>
  </tr>`).join('');

  wrap.innerHTML = `<div class="table-card">
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Nama</th><th>Cabang</th>
          <th>Hadir</th><th>Terlambat</th><th>Izin</th>
          <th>Sakit</th><th>Libur</th><th>Alpha</th><th>Total Hadir</th>
        </tr>
      </thead>
      <tbody>${tbody}</tbody>
    </table>
  </div>`;
}

function formatMenitKeJam(menit) {
  if (!menit || menit <= 0) return '0 mnt';
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa} mnt`;
  if (sisa === 0) return `${jam} jam`;
  return `${jam} jam ${sisa} mnt`;
}

function exportExcel() {
  if (!window._rekapData || !window._rekapData.length) {
    alert('Tidak ada data rekap untuk diekspor. Pilih bulan terlebih dahulu.');
    return;
  }

  const emps = window._rekapData;
  const month = document.getElementById('filter-month').value || '';
  const cabang = document.getElementById('filter-cabang-rekap').value || 'Semua Cabang';
  const monthLabel = month ? new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '—';
  const downloadDate = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', ...tz });

  let totalHadir = 0, totalTelat = 0, totalMntTelat = 0, totalKeluar = 0, totalIzin = 0, totalSakit = 0, totalLibur = 0, totalAlpha = 0;

  const rowsHtml = emps.map((e, idx) => {
    totalHadir += (e.hadir || 0);
    totalTelat += (e.terlambat || 0);
    totalMntTelat += (e.total_mnt_telat || 0);
    totalKeluar += (e.keluar || 0);
    totalIzin += (e.izin || 0);
    totalSakit += (e.sakit || 0);
    totalLibur += (e.libur || 0);
    totalAlpha += (e.alpha || 0);

    const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaf6';
    return `
      <tr style="background-color: ${bg};">
        <td style="border: 1px solid #cccccc; text-align: center; padding: 6px;">${idx + 1}</td>
        <td style="border: 1px solid #cccccc; text-align: center; font-weight: bold; padding: 6px;">${escapeHtml(e.id)}</td>
        <td style="border: 1px solid #cccccc; padding: 6px;">${escapeHtml(e.name)}</td>
        <td style="border: 1px solid #cccccc; text-align: center; padding: 6px;">${escapeHtml(e.cabang)}</td>
        <td style="border: 1px solid #cccccc; text-align: right; padding: 6px;">${e.hadir || 0}</td>
        <td style="border: 1px solid #cccccc; text-align: right; padding: 6px;">${e.terlambat || 0}</td>
        <td style="border: 1px solid #cccccc; text-align: right; padding: 6px;">${formatMenitKeJam(e.total_mnt_telat)}</td>
        <td style="border: 1px solid #cccccc; text-align: right; padding: 6px;">${e.keluar || 0}</td>
        <td style="border: 1px solid #cccccc; text-align: right; padding: 6px;">${e.izin || 0}</td>
        <td style="border: 1px solid #cccccc; text-align: right; padding: 6px;">${e.sakit || 0}</td>
        <td style="border: 1px solid #cccccc; text-align: right; padding: 6px;">${e.libur || 0}</td>
        <td style="border: 1px solid #cccccc; text-align: right; padding: 6px; ${e.alpha > 0 ? 'color: #c0392b; font-weight: bold;' : ''}">${e.alpha || 0}</td>
        <td style="border: 1px solid #cccccc; text-align: right; font-weight: bold; background-color: #f7f1e5; padding: 6px;">${e.hadir || 0}</td>
      </tr>
    `;
  }).join('');

  const template = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Rekap Absensi</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #C9A96E; color: #000000; font-weight: bold; border: 1px solid #997A44; text-align: center; padding: 8px; }
        td { border: 1px solid #CCCCCC; padding: 6px; vertical-align: middle; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="13" style="font-size: 16pt; font-weight: bold; color: #8C6D37; text-align: center; height: 35px;">
            REKAPITULASI ABSENSI KARYAWAN — BHC PROFESSIONAL
          </td>
        </tr>
        <tr>
          <td colspan="13" style="font-size: 11pt; text-align: center; color: #555555; height: 22px;">
            Periode: <b>${monthLabel}</b> | Cabang: <b>${escapeHtml(cabang)}</b> | Diunduh: ${downloadDate}
          </td>
        </tr>
        <tr><td colspan="13" style="height: 10px;"></td></tr>
        <thead>
          <tr>
            <th style="width: 40px;">No</th>
            <th style="width: 90px;">ID Karyawan</th>
            <th style="width: 180px;">Nama Karyawan</th>
            <th style="width: 110px;">Cabang</th>
            <th style="width: 90px;">Hadir (Masuk)</th>
            <th style="width: 95px;">Terlambat (Kali)</th>
            <th style="width: 110px;">Total Waktu Telat</th>
            <th style="width: 95px;">Keluar (Pulang)</th>
            <th style="width: 70px;">Izin</th>
            <th style="width: 70px;">Sakit</th>
            <th style="width: 70px;">Libur</th>
            <th style="width: 70px;">Alpha</th>
            <th style="width: 100px;">Total Hari Hadir</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr style="background-color: #ECE5D8; font-weight: bold;">
            <td colspan="4" style="border: 1px solid #997A44; text-align: center; padding: 8px;">TOTAL KESELURUHAN</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px;">${totalHadir}</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px;">${totalTelat}</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px;">${formatMenitKeJam(totalMntTelat)}</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px;">${totalKeluar}</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px;">${totalIzin}</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px;">${totalSakit}</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px;">${totalLibur}</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px;">${totalAlpha}</td>
            <td style="border: 1px solid #997A44; text-align: right; padding: 8px; background-color: #DFD3BE;">${totalHadir}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rekap-absensi-${month || 'bulanan'}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printRekap() {
  if (!window._rekapData || !window._rekapData.length) {
    alert('Tidak ada data rekap untuk dicetak. Pilih bulan terlebih dahulu.');
    return;
  }
  const emps = window._rekapData;
  const month = document.getElementById('filter-month').value;
  const cabang = document.getElementById('filter-cabang-rekap').value || 'Semua Cabang';
  const monthLabel = month ? new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '—';

  const totalHadir = emps.reduce((s, e) => s + e.hadir, 0);
  const totalTerlambat = emps.reduce((s, e) => s + e.terlambat, 0);
  const totalIzin = emps.reduce((s, e) => s + e.izin, 0);
  const totalSakit = emps.reduce((s, e) => s + e.sakit, 0);
  const totalLibur = emps.reduce((s, e) => s + (e.libur || 0), 0);
  const totalAlpha = emps.reduce((s, e) => s + e.alpha, 0);
  const totalMntTelat = emps.reduce((s, e) => s + e.total_mnt_telat, 0);

  const rows = emps.map((e, i) => `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${i + 1}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">${escapeHtml(e.id)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;">${escapeHtml(e.name)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:center;">${escapeHtml(e.cabang)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;color:#27ae60;font-weight:700;">${e.hadir}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;color:#d4ac0d;font-weight:600;">${e.terlambat}x${e.terlambat > 0 ? ' (' + formatMenitKeJam(e.total_mnt_telat) + ')' : ''}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${e.izin}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${e.sakit}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${e.libur || 0}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;color:#c0392b;font-weight:600;">${e.alpha}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:13px;font-weight:700;color:#C9A96E;">${e.hadir} Hari</td>
  </tr>`).join('');

  const maxHadir = Math.max(...emps.map(e => e.hadir), 1);
  const bars = emps.map(e => {
    const pct = Math.round((e.hadir / maxHadir) * 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <div style="width:100px;font-size:11px;text-align:right;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(e.name)}</div>
      <div style="flex:1;background:#f0f0f0;border-radius:4px;height:18px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#C9A96E,#A07840);border-radius:4px;min-width:${e.hadir > 0 ? '20px' : '0'};"></div>
      </div>
      <div style="font-size:11px;font-weight:700;color:#333;width:30px;">${e.hadir}</div>
    </div>`;
  }).join('');

  const printWrap = document.getElementById('print-rekap-wrapper');
  printWrap.innerHTML = `
    <div style="font-family:'Inter',sans-serif;color:#111;padding:10px;max-width:900px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C9A96E;padding-bottom:12px;margin-bottom:20px;">
        <div>
          <h1 style="font-family:'Playfair Display',serif;font-size:22px;color:#111;margin:0 0 2px 0;">REKAP BULANAN ABSENSI</h1>
          <p style="font-size:12px;color:#666;margin:0;">BHC Professional — Attendance System</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px;font-weight:700;color:#111;">${monthLabel}</div>
          <div style="font-size:11px;color:#666;">Cabang: ${escapeHtml(cabang)}</div>
          <div style="font-size:10px;color:#999;margin-top:2px;">Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',...tz})}</div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="flex:1;min-width:100px;background:#f8f8f8;border-radius:8px;padding:12px;text-align:center;border-left:3px solid #27ae60;">
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Total Hadir</div>
          <div style="font-size:24px;font-weight:700;color:#27ae60;">${totalHadir}</div>
        </div>
        <div style="flex:1;min-width:100px;background:#f8f8f8;border-radius:8px;padding:12px;text-align:center;border-left:3px solid #d4ac0d;">
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Terlambat</div>
          <div style="font-size:24px;font-weight:700;color:#d4ac0d;">${totalTerlambat}x</div>
          <div style="font-size:10px;color:#999;">${formatMenitKeJam(totalMntTelat)} total</div>
        </div>
        <div style="flex:1;min-width:100px;background:#f8f8f8;border-radius:8px;padding:12px;text-align:center;border-left:3px solid #2980b9;">
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Izin / Sakit</div>
          <div style="font-size:24px;font-weight:700;color:#2980b9;">${totalIzin + totalSakit}</div>
        </div>
        <div style="flex:1;min-width:100px;background:#f8f8f8;border-radius:8px;padding:12px;text-align:center;border-left:3px solid #c0392b;">
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Alpha</div>
          <div style="font-size:24px;font-weight:700;color:#c0392b;">${totalAlpha}</div>
        </div>
        <div style="flex:1;min-width:100px;background:#f8f8f8;border-radius:8px;padding:12px;text-align:center;border-left:3px solid #C9A96E;">
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Karyawan</div>
          <div style="font-size:24px;font-weight:700;color:#C9A96E;">${emps.length}</div>
        </div>
      </div>

      <div style="margin-bottom:20px;padding:14px;background:#fafafa;border-radius:8px;border:1px solid #eee;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin-bottom:10px;font-weight:600;">Grafik Kehadiran per Karyawan</div>
        ${bars}
      </div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f5f0e8;">
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #C9A96E;text-align:center;">No</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #C9A96E;text-align:left;">ID</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #C9A96E;text-align:left;">Nama</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #C9A96E;text-align:center;">Cabang</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#27ae60;border-bottom:2px solid #C9A96E;text-align:center;">Hadir</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#d4ac0d;border-bottom:2px solid #C9A96E;text-align:center;">Terlambat</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #C9A96E;text-align:center;">Izin</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #C9A96E;text-align:center;">Sakit</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #C9A96E;text-align:center;">Libur</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#c0392b;border-bottom:2px solid #C9A96E;text-align:center;">Alpha</th>
            <th style="padding:10px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#C9A96E;border-bottom:2px solid #C9A96E;text-align:center;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f9f6f0;font-weight:700;">
            <td colspan="4" style="padding:10px;font-size:12px;text-align:right;border-top:2px solid #C9A96E;">TOTAL</td>
            <td style="padding:10px;text-align:center;font-size:12px;color:#27ae60;border-top:2px solid #C9A96E;">${totalHadir}</td>
            <td style="padding:10px;text-align:center;font-size:12px;color:#d4ac0d;border-top:2px solid #C9A96E;">${totalTerlambat}x (${formatMenitKeJam(totalMntTelat)})</td>
            <td style="padding:10px;text-align:center;font-size:12px;border-top:2px solid #C9A96E;">${totalIzin}</td>
            <td style="padding:10px;text-align:center;font-size:12px;border-top:2px solid #C9A96E;">${totalSakit}</td>
            <td style="padding:10px;text-align:center;font-size:12px;border-top:2px solid #C9A96E;">${totalLibur}</td>
            <td style="padding:10px;text-align:center;font-size:12px;color:#c0392b;border-top:2px solid #C9A96E;">${totalAlpha}</td>
            <td style="padding:10px;text-align:center;font-size:13px;color:#C9A96E;border-top:2px solid #C9A96E;">${totalHadir}</td>
          </tr>
        </tfoot>
      </table>

      <div style="display:flex;justify-content:space-between;margin-top:36px;padding-top:16px;border-top:1px solid #eee;">
        <div style="text-align:center;width:200px;">
          <div style="font-size:11px;color:#666;margin-bottom:50px;">Mengetahui</div>
          <div style="font-size:12px;font-weight:700;border-top:1px solid #777;padding-top:4px;">________________</div>
        </div>
        <div style="text-align:center;width:200px;">
          <div style="font-size:11px;color:#666;margin-bottom:50px;">Kasir / Admin BHC Professional</div>
          <div style="font-size:12px;font-weight:700;border-top:1px solid #777;padding-top:4px;">________________</div>
        </div>
      </div>
    </div>`;

  document.body.classList.remove('printing-card');
  document.body.classList.remove('printing-rapor');
  document.body.classList.add('printing-rekap');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-rekap'), 500);
}
