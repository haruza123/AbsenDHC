// ============================================================
// MODUL JADWAL PER ROLE (JAM MASUK & TOLERANSI PER JABATAN)
// ============================================================

let jadwalRoleCache = [];

async function loadJadwalRoleCache() {
  const { data } = await db.from('jadwal_role').select('*').order('nama_role');
  jadwalRoleCache = data || [];
}

function getJadwalForRole(roleName) {
  if (!roleName || !jadwalRoleCache.length) return null;
  return jadwalRoleCache.find(j => j.nama_role.toLowerCase() === roleName.toLowerCase()) || null;
}

async function loadJadwal() {
  const wrap = document.getElementById('jadwal-wrap');
  if (!wrap) return;

  const { data, error } = await db.from('jadwal_role').select('*').order('nama_role');
  if (error) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat: ${escapeHtml(error.message)}</p></div>`;
    return;
  }

  jadwalRoleCache = data || [];

  if (!jadwalRoleCache.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">⏰</div><p>Belum ada jadwal role. Semua karyawan menggunakan jam kerja default dari Settings.</p></div>';
    return;
  }

  const rows = jadwalRoleCache.map(j => {
    return `<tr>
      <td style="font-weight:600; color:var(--gold-light);">${escapeHtml(j.nama_role)}</td>
      <td style="font-size:14px; font-weight:600;">${escapeHtml(j.jam_masuk)}</td>
      <td style="color:var(--muted);">${j.toleransi_menit} menit</td>
      <td style="text-align:right;">
        <button class="btn btn-outline" style="font-size:11px; padding:5px 10px; margin-right:6px;" onclick="editJadwal('${escapeHtml(j.id)}')">✏️ Edit</button>
        <button class="btn btn-danger" onclick="deleteJadwal('${escapeHtml(j.id)}', '${escapeHtml(j.nama_role)}')">Hapus</button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table><thead><tr>
    <th>Role / Jabatan</th><th>Jam Masuk</th><th>Toleransi</th><th style="text-align:right;">Aksi</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <p style="font-size:11px; color:var(--muted); margin-top:12px; padding:0 4px;">Role yang tidak terdaftar di sini akan menggunakan jam kerja default dari Settings (${escapeHtml(jamMasuk)} + ${toleransiMenit} menit toleransi).</p>`;
}

async function submitJadwal() {
  const nama = document.getElementById('mj-nama').value.trim();
  const jam = document.getElementById('mj-jam').value;
  const tol = parseInt(document.getElementById('mj-toleransi').value) || 0;
  const msg = document.getElementById('mj-status');

  if (!nama || !jam) {
    msg.className = 'save-msg err'; msg.textContent = 'Nama role dan jam masuk wajib diisi.'; msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
    return;
  }

  const { error } = await db.from('jadwal_role').insert({ nama_role: nama, jam_masuk: jam, toleransi_menit: tol });

  if (error) {
    msg.className = 'save-msg err';
    msg.textContent = error.message.includes('unique') ? 'Role ini sudah ada.' : error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = `✓ Jadwal untuk "${nama}" ditambahkan.`;
    document.getElementById('mj-nama').value = '';
    document.getElementById('mj-jam').value = '09:00';
    document.getElementById('mj-toleransi').value = '0';
    loadJadwal();
    loadJadwalRoleCache();
    if (typeof loadRoleList === 'function') loadRoleList();
    setTimeout(() => closeModal('jadwal'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function editJadwal(id) {
  const { data, error } = await db.from('jadwal_role').select('*').eq('id', id).single();
  if (error || !data) { alert('Gagal mengambil data jadwal.'); return; }

  document.getElementById('mej-id').value = data.id;
  document.getElementById('mej-nama').value = data.nama_role;
  document.getElementById('mej-jam').value = data.jam_masuk;
  document.getElementById('mej-toleransi').value = data.toleransi_menit;
  openModal('edit-jadwal');
}

async function submitEditJadwal() {
  const id = document.getElementById('mej-id').value;
  const nama = document.getElementById('mej-nama').value.trim();
  const jam = document.getElementById('mej-jam').value;
  const tol = parseInt(document.getElementById('mej-toleransi').value) || 0;
  const msg = document.getElementById('mej-status');

  if (!nama || !jam) {
    msg.className = 'save-msg err'; msg.textContent = 'Nama role dan jam masuk wajib diisi.'; msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
    return;
  }

  const { error } = await db.from('jadwal_role').update({ nama_role: nama, jam_masuk: jam, toleransi_menit: tol }).eq('id', id);

  if (error) {
    msg.className = 'save-msg err';
    msg.textContent = error.message.includes('unique') ? 'Role ini sudah ada.' : error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = `✓ Jadwal berhasil diperbarui.`;
    loadJadwal();
    loadJadwalRoleCache();
    if (typeof loadRoleList === 'function') loadRoleList();
    setTimeout(() => closeModal('edit-jadwal'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function deleteJadwal(id, nama) {
  if (!confirm(`Hapus jadwal untuk role "${nama}"?\n\nKaryawan dengan role ini akan menggunakan jam kerja default dari Settings.`)) return;

  const { error } = await db.from('jadwal_role').delete().eq('id', id);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }

  loadJadwal();
  loadJadwalRoleCache();

  if (typeof showToast === 'function') {
    showToast(`Jadwal role "${nama}" berhasil dihapus.`, 'success');
  }
}
