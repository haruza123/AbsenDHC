// ============================================================
// MODUL PENGATURAN & NOTIFIKASI WA
// ============================================================

async function loadSettings() {
  const { data } = await db.from('settings').select('key,value');
  if (!data) return;
  const s = Object.fromEntries(data.map(r => [r.key, r.value]));

  const setFonnte = document.getElementById('set-fonnte');
  const setWaTarget = document.getElementById('set-wa-target');
  const setWaEnabled = document.getElementById('set-wa-enabled');

  if (setFonnte) setFonnte.value = s.fonnte_token || '';
  if (setWaTarget) setWaTarget.value = s.wa_target || '';
  if (setWaEnabled) setWaEnabled.value = s.wa_enabled || 'false';

  fonnteToken = s.fonnte_token || '';
  waTarget = s.wa_target || '';
  waEnabled = s.wa_enabled === 'true';
}

async function saveSettings() {
  const updates = [
    { key: 'fonnte_token', value: document.getElementById('set-fonnte').value.trim() },
    { key: 'wa_target', value: document.getElementById('set-wa-target').value.trim() },
    { key: 'wa_enabled', value: document.getElementById('set-wa-enabled').value },
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

function sendWA(participantName, eventName, time) {
  if (!waEnabled || !fonnteToken || !waTarget) return;

  const timeStr = new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', ...tz });
  const dateStr = new Date(time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz });
  const message = `📋 *Kehadiran Event*\n\n👤 ${participantName}\n📅 ${eventName}\n🕐 ${dateStr} ${timeStr}\n✅ Hadir`;

  fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { 'Authorization': fonnteToken },
    body: new URLSearchParams({ target: waTarget, message })
  }).catch(() => {});
}
