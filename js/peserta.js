// ============================================================
// MODUL DATA PESERTA & GENERATOR QR TIKET
// ============================================================

async function loadPeserta() {
  const eventEl = document.getElementById('filter-event-peserta');
  const eventId = eventEl ? eventEl.value : '';
  const wrap = document.getElementById('peserta-wrap');
  if (!wrap) return;

  if (!eventId) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><p>Pilih event untuk melihat daftar peserta</p></div>';
    return;
  }

  wrap.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat...</div>';

  let q = db.from('participants').select('*').eq('event_id', eventId).order('registered_at', { ascending: false });
  const { data } = await q;

  if (!(data || []).length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><p>Belum ada peserta terdaftar di event ini</p></div>';
    return;
  }

  const rows = (data || []).map(p => {
    const regDate = new Date(p.registered_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', ...tz });
    return `<tr>
      <td><span class="id-chip">${escapeHtml(p.participant_id)}</span></td>
      <td style="font-weight:500">${escapeHtml(p.name)}</td>
      <td style="font-size:12px">${escapeHtml(p.email || '—')}</td>
      <td style="font-size:12px">${escapeHtml(p.phone || '—')}</td>
      <td style="font-size:12px">${escapeHtml(p.organization || '—')}</td>
      <td style="color:var(--muted);font-size:12px">${regDate}</td>
      <td style="text-align:right;">
        <button class="btn btn-outline" style="font-size:11px;padding:5px 10px;margin-right:6px;" onclick="openParticipantCard('${p.id}')">🔲 QR</button>
        <button class="btn btn-outline" style="font-size:11px;padding:5px 10px;margin-right:6px;" onclick="editPeserta('${p.id}')">✏️ Edit</button>
        <button class="btn btn-danger" onclick="deletePeserta('${p.id}')">Hapus</button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table><thead><tr><th>ID</th><th>Nama</th><th>Email</th><th>HP</th><th>Organisasi</th><th>Terdaftar</th><th style="text-align:right;">Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function submitPeserta() {
  const pId = document.getElementById('mp-id').value.trim().toUpperCase();
  const name = document.getElementById('mp-name').value.trim();
  const email = document.getElementById('mp-email').value.trim();
  const phone = document.getElementById('mp-phone').value.trim();
  const org = document.getElementById('mp-org').value.trim();
  const eventId = document.getElementById('mp-event').value;
  const msg = document.getElementById('mp-status');

  if (!pId || !name || !eventId) {
    msg.className = 'save-msg err'; msg.textContent = 'ID Peserta, Nama, dan Event wajib diisi.'; msg.style.display = 'block';
    return;
  }

  const { error } = await db.from('participants').insert({
    participant_id: pId,
    name,
    email: email || null,
    phone: phone || null,
    organization: org || null,
    event_id: eventId
  });

  if (error) {
    msg.className = 'save-msg err';
    msg.textContent = error.message.includes('unique') ? 'ID Peserta sudah terdaftar di event ini.' : error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = `✓ ${name} terdaftar.`;
    ['mp-id', 'mp-name', 'mp-email', 'mp-phone', 'mp-org'].forEach(k => document.getElementById(k).value = '');
    loadPeserta();
    setTimeout(() => closeModal('peserta'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function editPeserta(id) {
  const { data: p, error } = await db.from('participants').select('*').eq('id', id).single();
  if (error || !p) { alert('Gagal memuat data peserta.'); return; }

  document.getElementById('mep-db-id').value = p.id;
  document.getElementById('mep-id').value = p.participant_id;
  document.getElementById('mep-name').value = p.name;
  document.getElementById('mep-email').value = p.email || '';
  document.getElementById('mep-phone').value = p.phone || '';
  document.getElementById('mep-org').value = p.organization || '';
  openModal('edit-peserta');
}

async function submitEditPeserta() {
  const dbId = document.getElementById('mep-db-id').value;
  const name = document.getElementById('mep-name').value.trim();
  const email = document.getElementById('mep-email').value.trim();
  const phone = document.getElementById('mep-phone').value.trim();
  const org = document.getElementById('mep-org').value.trim();
  const msg = document.getElementById('mep-status');

  if (!name) {
    msg.className = 'save-msg err'; msg.textContent = 'Nama wajib diisi.'; msg.style.display = 'block';
    return;
  }

  const { error } = await db.from('participants').update({
    name,
    email: email || null,
    phone: phone || null,
    organization: org || null
  }).eq('id', dbId);

  if (error) {
    msg.className = 'save-msg err'; msg.textContent = error.message;
  } else {
    msg.className = 'save-msg ok'; msg.textContent = '✓ Data peserta diperbarui.';
    loadPeserta();
    setTimeout(() => closeModal('edit-peserta'), 1200);
  }
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

async function deletePeserta(id) {
  if (!confirm('Hapus peserta ini?')) return;

  await db.from('attendance').delete().eq('participant_id', id);
  const { error } = await db.from('participants').delete().eq('id', id);
  if (error) { alert('Gagal menghapus: ' + error.message); return; }

  loadPeserta();
  if (typeof showToast === 'function') showToast('Peserta dihapus', 'success');
}

// ===== QR CARD GENERATOR =====
async function openParticipantCard(id) {
  const { data: p, error } = await db.from('participants').select('*, events(name, event_code, date, location)').eq('id', id).single();
  if (error || !p) { alert('Gagal memuat data peserta.'); return; }

  const ev = p.events;
  document.getElementById('card-name').textContent = p.name;
  document.getElementById('card-org').textContent = p.organization || '—';
  document.getElementById('card-id').textContent = p.participant_id;
  document.getElementById('card-event-name').textContent = ev ? ev.name : '—';
  document.getElementById('card-event-date').textContent = ev ? new Date(ev.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('card-avatar').textContent = initials;

  const qrContainer = document.getElementById('card-qrcode');
  qrContainer.innerHTML = '';

  const qrData = `EVENT_PST:${p.participant_id}:${p.event_id}`;

  new QRCode(qrContainer, {
    text: qrData,
    width: 120,
    height: 120,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  openModal('qr-card');
}

function printParticipantCard() {
  const name = document.getElementById('card-name').textContent;
  const org = document.getElementById('card-org').textContent;
  const pId = document.getElementById('card-id').textContent;
  const eventName = document.getElementById('card-event-name').textContent;
  const eventDate = document.getElementById('card-event-date').textContent;

  const qrImageSrc = document.querySelector('#card-qrcode img')?.src;
  if (!qrImageSrc) {
    const canvas = document.querySelector('#card-qrcode canvas');
    if (canvas) {
      triggerCardPrint(name, org, pId, eventName, eventDate, canvas.toDataURL("image/png"));
    } else {
      alert('QR Code belum selesai dibuat!');
    }
    return;
  }
  triggerCardPrint(name, org, pId, eventName, eventDate, qrImageSrc);
}

function triggerCardPrint(name, org, pId, eventName, eventDate, qrSrc) {
  document.body.classList.add('printing-card');
  const wrapper = document.getElementById('print-card-wrapper');

  wrapper.innerHTML = `
    <div class="id-card-print">
      <div style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 900; color: #C9A96E !important; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 2px;">BHC Professional</div>
      <div style="font-size: 10px; letter-spacing: 2px; color: #C9A96E !important; text-transform: uppercase; margin-top: 4px; font-weight: 600; margin-bottom: 15px;">Tiket Peserta Event</div>

      <div style="width: 50px; height: 1.5px; background: #C9A96E !important; margin: 15px auto 20px;"></div>

      <h3 style="font-family: 'Playfair Display', serif; font-size: 18px; color: #ffffff !important; font-weight: 700; margin-bottom: 4px;">${escapeHtml(name)}</h3>
      <div style="font-size: 12px; color: #888888 !important; margin-bottom: 6px;">${escapeHtml(org)}</div>
      <div style="font-family: monospace; font-size: 13px; background: #1a1a1a !important; color: #C9A96E !important; display: inline-block; padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(201,169,110,0.2) !important; font-weight: 600; margin-bottom: 10px;">${escapeHtml(pId)}</div>

      <div style="margin-top: 10px; font-size: 11px; color: #aaaaaa !important;">
        <div style="font-weight:700; color: #C9A96E !important;">${escapeHtml(eventName)}</div>
        <div>${escapeHtml(eventDate)}</div>
      </div>

      <div style="background: #ffffff !important; width: 140px; height: 140px; border-radius: 8px; margin: 20px auto; display: flex !important; align-items: center !important; justify-content: center !important; padding: 8px !important;">
        <img src="${qrSrc}" style="width: 124px; height: 124px;" />
      </div>

      <div style="font-size: 9px; color: #888888 !important; text-transform: uppercase; letter-spacing: 1px; line-height: 1.4; margin-top: 15px;">Tunjukkan QR ini saat registrasi di lokasi event</div>
    </div>
  `;

  window.print();
}
