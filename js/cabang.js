// ============================================================
// MODUL KELOLA CABANG (CRUD)
// ============================================================

async function loadCabang() {
  const wrap = document.getElementById('cabang-wrap');
  if (!wrap) return;

  const { data, error } = await db.from('cabang').select('*').order('nama');
  if (error) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat: ${escapeHtml(error.message)}</p></div>`;
    return;
  }

  if (!(data || []).length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">🏪</div><p>Belum ada cabang. Tambahkan cabang pertama.</p></div>';
    return;
  }

  const rows = (data || []).map(c => {
    const createdAt = new Date(c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', ...tz });
    return `<tr>
      <td style="font-weight:600; color:var(--gold-light);">${escapeHtml(c.nama)}</td>
      <td style="color:var(--muted); font-size:12px;">${escapeHtml(c.alamat || '—')}</td>
      <td style="color:var(--muted); font-size:12px;">${createdAt}</td>
      <td style="text-align:right;">
        <button class="btn btn-outline" style="font-size:11px; padding:5px 10px; margin-right:6px;" onclick="editCabang('${escapeHtml(c.id)}')">✏️ Edit</button>
        <button class="btn btn-danger" onclick="deleteCabang('${escapeHtml(c.id)}', '${escapeHtml(c.nama)}')">Hapus</button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table><thead><tr>
    <th>Nama Cabang</th><th>Alamat / Keterangan</th><th>Dibuat</th><th style="text-align:right;">Aksi</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

async function submitCabang() {
  const nama = document.getElementById('mc-nama').value.trim();
  const alamat = document.getElementById('mc-alamat').value.trim();
  const msg = document.getElementById('mc-status');

  if (!nama) {
    msg.className = 'save-msg err'; msg.textContent = 'Nama cabang wajib diisi.'; msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
    return;
  }

  const { error } = await db.from('cabang').insert({ nama, alamat: alamat || null });

  if (error) {
    msg.className = 'save-msg err';
    msg.textContent = error.message.includes('unique') ? 'Nama cabang sudah ada.' : error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = `✓ Cabang "${nama}" ditambahkan.`;
    document.getElementById('mc-nama').value = '';
    document.getElementById('mc-alamat').value = '';
    loadCabang();
    loadCabangList();
    setTimeout(() => closeModal('cabang'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function editCabang(id) {
  const { data, error } = await db.from('cabang').select('*').eq('id', id).single();
  if (error || !data) { alert('Gagal mengambil data cabang.'); return; }

  document.getElementById('mec-id').value = data.id;
  document.getElementById('mec-nama').value = data.nama;
  document.getElementById('mec-alamat').value = data.alamat || '';
  openModal('edit-cabang');
}

async function submitEditCabang() {
  const id = document.getElementById('mec-id').value;
  const nama = document.getElementById('mec-nama').value.trim();
  const alamat = document.getElementById('mec-alamat').value.trim();
  const msg = document.getElementById('mec-status');

  if (!nama) {
    msg.className = 'save-msg err'; msg.textContent = 'Nama cabang wajib diisi.'; msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
    return;
  }

  // Ambil nama lama untuk update referensi
  const { data: old } = await db.from('cabang').select('nama').eq('id', id).single();
  const oldNama = old ? old.nama : '';

  const { error } = await db.from('cabang').update({ nama, alamat: alamat || null }).eq('id', id);

  if (error) {
    msg.className = 'save-msg err';
    msg.textContent = error.message.includes('unique') ? 'Nama cabang sudah ada.' : error.message;
  } else {
    // Update nama cabang di employees & attendance jika berubah
    if (oldNama && oldNama !== nama) {
      await db.from('employees').update({ cabang: nama }).eq('cabang', oldNama);
      await db.from('attendance').update({ cabang: nama }).eq('cabang', oldNama);
    }
    msg.className = 'save-msg ok'; msg.textContent = `✓ Cabang berhasil diperbarui.`;
    loadCabang();
    loadCabangList();
    setTimeout(() => closeModal('edit-cabang'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function deleteCabang(id, nama) {
  // Cek apakah ada karyawan di cabang ini
  const { count } = await db.from('employees').select('*', { count: 'exact', head: true }).eq('cabang', nama);

  let confirmMsg = `Hapus cabang "${nama}"?`;
  if (count > 0) {
    confirmMsg += `\n\n⚠️ Ada ${count} karyawan yang terdaftar di cabang ini. Karyawan tersebut tidak akan dihapus, tapi kolom cabang mereka akan menjadi kosong.`;
  }
  if (!confirm(confirmMsg)) return;

  // Kosongkan cabang di employees
  if (count > 0) {
    await db.from('employees').update({ cabang: null }).eq('cabang', nama);
  }

  const { error } = await db.from('cabang').delete().eq('id', id);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }

  loadCabang();
  loadCabangList();
  if (typeof loadKaryawan === 'function') loadKaryawan();

  if (typeof showToast === 'function') {
    showToast(`Cabang "${nama}" berhasil dihapus.`, 'success');
  }
}
