// ============================================================
// MODUL KELOLA EVENT / ACARA (CRUD)
// ============================================================

async function loadEvents() {
  const wrap = document.getElementById('events-wrap');
  if (!wrap) return;

  wrap.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat...</div>';

  const { data, error } = await db.from('events').select('*').order('date', { ascending: false });

  if (error) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat: ${escapeHtml(error.message)}</p></div>`;
    return;
  }

  if (!(data || []).length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Belum ada event. Klik "+ Tambah Event" untuk membuat event baru.</p></div>';
    return;
  }

  const rows = data.map(e => {
    const dateStr = new Date(e.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const today = new Date(new Date().toLocaleDateString('en-CA', tz));
    const eventDate = new Date(e.date);
    const isUpcoming = eventDate >= today;
    const statusBadge = isUpcoming
      ? '<span class="badge b-green">Upcoming</span>'
      : '<span class="badge b-gold">Selesai</span>';

    return `<tr>
      <td><span class="id-chip">${escapeHtml(e.event_code)}</span></td>
      <td style="font-weight:500">${escapeHtml(e.name)}</td>
      <td>${dateStr}</td>
      <td>${escapeHtml(e.location || '—')}</td>
      <td>${e.max_participants || '∞'}</td>
      <td>${statusBadge}</td>
      <td style="text-align:right;">
        <button class="btn btn-outline" style="font-size:11px;padding:5px 10px;margin-right:6px;" onclick="editEvent('${e.id}')">✏️ Edit</button>
        <button class="btn btn-danger" onclick="deleteEvent('${e.id}')">Hapus</button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table><thead><tr><th>Kode</th><th>Nama Event</th><th>Tanggal</th><th>Lokasi</th><th>Maks</th><th>Status</th><th style="text-align:right;">Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function submitEvent() {
  const code = document.getElementById('me-code').value.trim().toUpperCase();
  const name = document.getElementById('me-name').value.trim();
  const date = document.getElementById('me-date').value;
  const location = document.getElementById('me-location').value.trim();
  const desc = document.getElementById('me-desc').value.trim();
  const maxP = document.getElementById('me-max').value;
  const msg = document.getElementById('me-status');

  if (!code || !name || !date) {
    msg.className = 'save-msg err'; msg.textContent = 'Kode, Nama, dan Tanggal wajib diisi.'; msg.style.display = 'block';
    return;
  }

  const { error } = await db.from('events').insert({
    event_code: code,
    name,
    date,
    location: location || null,
    description: desc || null,
    max_participants: maxP ? parseInt(maxP) : null
  });

  if (error) {
    msg.className = 'save-msg err';
    msg.textContent = error.message.includes('unique') ? 'Kode event sudah ada.' : error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = `✓ Event "${name}" ditambahkan.`;
    ['me-code', 'me-name', 'me-date', 'me-location', 'me-desc', 'me-max'].forEach(k => document.getElementById(k).value = '');
    loadEvents();
    loadEventList();
    setTimeout(() => closeModal('event'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function editEvent(id) {
  const { data: ev, error } = await db.from('events').select('*').eq('id', id).single();
  if (error || !ev) { alert('Gagal memuat event.'); return; }

  document.getElementById('mee-id').value = ev.id;
  document.getElementById('mee-code').value = ev.event_code;
  document.getElementById('mee-name').value = ev.name;
  document.getElementById('mee-date').value = ev.date;
  document.getElementById('mee-location').value = ev.location || '';
  document.getElementById('mee-desc').value = ev.description || '';
  document.getElementById('mee-max').value = ev.max_participants || '';
  openModal('edit-event');
}

async function submitEditEvent() {
  const id = document.getElementById('mee-id').value;
  const name = document.getElementById('mee-name').value.trim();
  const date = document.getElementById('mee-date').value;
  const location = document.getElementById('mee-location').value.trim();
  const desc = document.getElementById('mee-desc').value.trim();
  const maxP = document.getElementById('mee-max').value;
  const msg = document.getElementById('mee-status');

  if (!name || !date) {
    msg.className = 'save-msg err'; msg.textContent = 'Nama dan Tanggal wajib.'; msg.style.display = 'block';
    return;
  }

  const { error } = await db.from('events').update({
    name,
    date,
    location: location || null,
    description: desc || null,
    max_participants: maxP ? parseInt(maxP) : null
  }).eq('id', id);

  if (error) {
    msg.className = 'save-msg err'; msg.textContent = error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = '✓ Event diperbarui.';
    loadEvents();
    loadEventList();
    setTimeout(() => closeModal('edit-event'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function deleteEvent(id) {
  if (!confirm('Hapus event ini? Semua data peserta & kehadiran event ini juga akan dihapus.')) return;

  const { error: delAtt } = await db.from('attendance').delete().eq('event_id', id);
  if (delAtt) console.warn('Gagal hapus attendance:', delAtt.message);

  const { error: delPart } = await db.from('participants').delete().eq('event_id', id);
  if (delPart) console.warn('Gagal hapus participants:', delPart.message);

  const { error } = await db.from('events').delete().eq('id', id);
  if (error) { alert('Gagal menghapus event: ' + error.message); return; }

  loadEvents();
  loadEventList();
  if (typeof showToast === 'function') showToast('Event berhasil dihapus', 'success');
}
