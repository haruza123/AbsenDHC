// ============================================================
// MODUL DATA KARYAWAN & GENERATOR ID CARD QR
// ============================================================

async function loadKaryawan() {
  const cabangEl = document.getElementById('filter-cabang-karyawan');
  const cabang = cabangEl ? cabangEl.value : '';
  let q = db.from('employees').select('*').order('employee_id');
  if (cabang) q = q.eq('cabang', cabang);
  const { data } = await q;
  const wrap = document.getElementById('karyawan-wrap');
  if (!wrap) return;
  
  if (!(data || []).length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><p>Belum ada karyawan</p></div>';
    return;
  }
  
  const rows = (data || []).map(e => `<tr>
    <td><span class="id-chip">${escapeHtml(e.employee_id)}</span></td>
    <td style="font-weight:500">${escapeHtml(e.name || '—')}</td>
    <td>${escapeHtml(e.role || '—')}</td>
    <td><span class="badge b-gold">${escapeHtml(e.cabang || '—')}</span></td>
    <td style="color:var(--muted);font-size:12px">${escapeHtml(e.email || '—')}</td>
    <td style="text-align: right;">
      <button class="btn btn-outline" style="font-size:11px; padding:5px 10px; margin-right: 6px;" onclick="openEmployeeCard('${escapeHtml(e.employee_id)}')">🔲 QR Card</button>
      <button class="btn btn-outline" style="font-size:11px; padding:5px 10px; margin-right: 6px;" onclick="editKaryawan('${escapeHtml(e.employee_id)}')">✏️ Edit</button>
      <button class="btn btn-danger" onclick="deleteKaryawan('${escapeHtml(e.id)}')">Hapus</button>
    </td>
  </tr>`).join('');
  
  wrap.innerHTML = `<table><thead><tr><th>ID</th><th>Nama</th><th>Jabatan</th><th>Cabang</th><th>Kontak</th><th style="text-align: right;">Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function submitKaryawan() {
  const id = document.getElementById('mk-id').value.trim().toUpperCase();
  const name = document.getElementById('mk-name').value.trim();
  const role = document.getElementById('mk-role').value.trim();
  const cabang = document.getElementById('mk-cabang').value;
  const contact = document.getElementById('mk-contact').value.trim();
  const msg = document.getElementById('mk-status');
  
  if (!id || !name) {
    msg.className = 'save-msg err'; msg.textContent = 'ID dan Nama wajib.'; msg.style.display = 'block';
    return;
  }
  
  const { error } = await db.from('employees').insert({
    employee_id: id,
    name,
    role: role || null,
    cabang: cabang || null,
    email: contact || null
  });
  
  if (error) {
    msg.className = 'save-msg err'; msg.textContent = error.message.includes('unique') ? 'ID sudah ada.' : error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = `✓ ${id} ditambahkan.`;
    ['mk-id', 'mk-name', 'mk-role', 'mk-contact'].forEach(k => document.getElementById(k).value = '');
    loadKaryawan();
    loadCabangList();
    setTimeout(() => closeModal('karyawan'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function deleteKaryawan(id) {
  try {
    // 1. Ambil detail data karyawan
    const { data: emp, error: getErr } = await db
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (getErr || !emp) {
      alert('Gagal mengambil data karyawan: ' + (getErr ? getErr.message : 'Karyawan tidak ditemukan'));
      return;
    }

    // 2. Konfirmasi penghapusan menyeluruh
    const confirmMsg = `Hapus karyawan "${emp.name}" (${emp.employee_id})?\n\n⚠️ PERINGATAN: Seluruh riwayat absensi, izin, dan data kehadiran karyawan ini juga akan dihapus secara permanen dari database.`;
    if (!confirm(confirmMsg)) return;

    // 3. Hapus seluruh data absensi dan izin milik karyawan ini
    const { error: delAttErr } = await db
      .from('attendance')
      .delete()
      .eq('employee_id', emp.employee_id);

    if (delAttErr) {
      console.warn('Gagal menghapus riwayat absensi:', delAttErr.message);
    }

    // 4. Hapus data karyawan dari tabel employees
    const { error: delEmpErr } = await db
      .from('employees')
      .delete()
      .eq('id', id);

    if (delEmpErr) {
      alert('Gagal menghapus karyawan: ' + delEmpErr.message);
      return;
    }

    // 5. Catat aktivitas penghapusan ke log audit settings
    try {
      const { data: settingData } = await db
        .from('settings')
        .select('value')
        .eq('key', 'deletion_history')
        .maybeSingle();

      let history = [];
      if (settingData && settingData.value) {
        try {
          history = JSON.parse(settingData.value);
        } catch (e) {
          history = [];
        }
      }

      history.unshift({
        deleted_at: new Date().toISOString(),
        admin_email: loggedInUserEmail || 'Unknown Admin',
        employee_id: emp.employee_id,
        employee_name: emp.name,
        status: 'HAPUS KARYAWAN',
        cabang: emp.cabang || '—',
        absensi_created_at: new Date().toISOString(),
        notes: 'Penghapusan akun karyawan & seluruh riwayat absensinya'
      });

      if (history.length > 200) history = history.slice(0, 200);

      await db.from('settings').upsert({
        key: 'deletion_history',
        value: JSON.stringify(history)
      }, { onConflict: 'key' });
    } catch (logErr) {
      console.warn('Gagal mencatat log penghapusan karyawan:', logErr);
    }

    // 6. Refresh semua tampilan terkait di dashboard
    loadKaryawan();
    loadCabangList();
    if (typeof loadAbsensi === 'function') loadAbsensi();
    if (typeof loadBelumAbsen === 'function') loadBelumAbsen();
    if (typeof loadRaporEmpList === 'function') loadRaporEmpList();
    if (typeof loadTotalKaryawan === 'function') loadTotalKaryawan();

    if (typeof showToast === 'function') {
      showToast(`Karyawan ${emp.name} dan seluruh datanya berhasil dihapus`, 'success');
    } else {
      alert(`✓ Karyawan ${emp.name} dan seluruh riwayat datanya telah berhasil dihapus.`);
    }

  } catch (err) {
    console.error('Terjadi kesalahan saat menghapus karyawan:', err);
    alert('Terjadi kesalahan saat menghapus data: ' + err.message);
  }
}

async function editKaryawan(empId) {
  try {
    const { data: emp, error } = await db
      .from('employees')
      .select('*')
      .eq('employee_id', empId)
      .single();
      
    if (error || !emp) {
      alert('Gagal mengambil data karyawan: ' + (error ? error.message : 'Karyawan tidak ditemukan'));
      return;
    }
    
    document.getElementById('mek-db-id').value = emp.id;
    document.getElementById('mek-id').value = emp.employee_id;
    document.getElementById('mek-name').value = emp.name || '';
    document.getElementById('mek-role').value = emp.role || '';
    document.getElementById('mek-contact').value = emp.email || '';
    document.getElementById('mek-cabang').value = emp.cabang || 'Pusat';
    
    openModal('edit-karyawan');
  } catch (err) {
    alert('Terjadi kesalahan: ' + err.message);
  }
}

async function submitEditKaryawan() {
  const dbId = document.getElementById('mek-db-id').value;
  const name = document.getElementById('mek-name').value.trim();
  const role = document.getElementById('mek-role').value.trim();
  const cabang = document.getElementById('mek-cabang').value;
  const contact = document.getElementById('mek-contact').value.trim();
  const msg = document.getElementById('mek-status');
  
  if (!name) {
    msg.className = 'save-msg err'; msg.textContent = 'Nama wajib diisi.'; msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
    return;
  }
  
  const { error } = await db
    .from('employees')
    .update({
      name,
      role: role || null,
      cabang: cabang || null,
      email: contact || null
    })
    .eq('id', dbId);
    
  if (error) {
    msg.className = 'save-msg err'; msg.textContent = error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = `✓ Data karyawan berhasil diperbarui.`;
    loadKaryawan();
    loadCabangList();
    setTimeout(() => closeModal('edit-karyawan'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

// ===== CARD GENERATOR (ID CARD QR) =====
async function openEmployeeCard(empId) {
  try {
    const { data: emp, error } = await db
      .from('employees')
      .select('*')
      .eq('employee_id', empId)
      .single();
      
    if (error || !emp) {
      alert('Gagal mengambil data karyawan: ' + (error ? error.message : 'Karyawan tidak ditemukan'));
      return;
    }
    
    document.getElementById('card-name').textContent = emp.name;
    document.getElementById('card-role').textContent = emp.role || 'Barber';
    document.getElementById('card-id').textContent = emp.employee_id;
    
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('card-avatar').textContent = initials;
    
    const qrContainer = document.getElementById('card-qrcode');
    qrContainer.innerHTML = '';
    
    const qrData = `BARBER_EMP:${emp.employee_id}`;
    
    new QRCode(qrContainer, {
      text: qrData,
      width: 120,
      height: 120,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });
    
    openModal('qr-card');
  } catch (err) {
    alert('Terjadi kesalahan: ' + err.message);
  }
}

function printEmployeeCard() {
  const name = document.getElementById('card-name').textContent;
  const role = document.getElementById('card-role').textContent;
  const empId = document.getElementById('card-id').textContent;
  const qrImageSrc = document.querySelector('#card-qrcode img')?.src;
  
  if (!qrImageSrc) {
    const canvas = document.querySelector('#card-qrcode canvas');
    if (canvas) {
      const src = canvas.toDataURL("image/png");
      triggerCardPrint(name, role, empId, src);
    } else {
      alert('QR Code belum selesai dibuat!');
    }
    return;
  }
  triggerCardPrint(name, role, empId, qrImageSrc);
}

function triggerCardPrint(name, role, empId, qrSrc) {
  document.body.classList.remove('printing-rapor');
  document.body.classList.remove('printing-rekap');
  document.body.classList.add('printing-card');
  const wrapper = document.getElementById('print-card-wrapper');
  
  wrapper.innerHTML = `
    <div class="id-card-print">
      <div style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 900; color: #C9A96E !important; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 2px;">BHC Professional</div>
      <div style="font-size: 10px; letter-spacing: 2px; color: #C9A96E !important; text-transform: uppercase; margin-top: 4px; font-weight: 600; margin-bottom: 15px;">Kartu ID Karyawan</div>
      
      <div style="width: 50px; height: 1.5px; background: #C9A96E !important; margin: 15px auto 20px;"></div>
      
      <h3 style="font-family: 'Playfair Display', serif; font-size: 18px; color: #ffffff !important; font-weight: 700; margin-bottom: 4px;">${escapeHtml(name)}</h3>
      <div style="font-size: 12px; color: #888888 !important; margin-bottom: 6px;">${escapeHtml(role)}</div>
      <div style="font-family: monospace; font-size: 13px; background: #1a1a1a !important; color: #C9A96E !important; display: inline-block; padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(201,169,110,0.2) !important; font-weight: 600; margin-bottom: 10px;">${escapeHtml(empId)}</div>
      
      <div style="background: #ffffff !important; width: 140px; height: 140px; border-radius: 8px; margin: 20px auto; display: flex !important; align-items: center !important; justify-content: center !important; padding: 8px !important;">
        <img src="${qrSrc}" style="width: 124px; height: 124px;" />
      </div>
      
      <div style="font-size: 9px; color: #888888 !important; text-transform: uppercase; letter-spacing: 1px; line-height: 1.4; margin-top: 15px;">Scan untuk Absen Masuk/Keluar<br><span style="color: #C9A96E !important;">Hanya untuk Dipindai Kasir</span></div>
    </div>
  `;
  
  window.print();
}
