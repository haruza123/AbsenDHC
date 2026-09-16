// ============================================================
// MODUL SCANNER QR & LIVE STATUS KEHADIRAN EVENT
// ============================================================
let scannerTransitioning = false;

async function toggleScanner() {
  if (scannerTransitioning) return;
  scannerTransitioning = true;

  const btn = document.getElementById('btn-toggle-scanner');
  const placeholder = document.getElementById('scanner-placeholder');
  const container = document.getElementById('scanner-reader');
  const selectedEvent = document.getElementById('scanner-event').value;

  if (!selectedEvent) {
    alert('Silakan pilih event terlebih dahulu!');
    scannerTransitioning = false;
    return;
  }

  btn.disabled = true;

  if (isScanning) {
    try { await html5QrCode.stop(); } catch (err) { console.warn('Stop scanner:', err); }
    isScanning = false;
    html5QrCode = null;
    btn.textContent = '🎥 Aktifkan Kamera';
    btn.className = 'btn btn-gold';
    placeholder.style.display = 'flex';
    container.style.display = 'none';
    document.getElementById('scanner-laser').style.display = 'none';
    document.getElementById('scanner-zoom-container').style.display = 'none';
    btn.disabled = false;
    scannerTransitioning = false;
  } else {
    try {
      html5QrCode = new Html5Qrcode("scanner-reader");
      placeholder.style.display = 'none';
      container.style.display = 'block';
      document.getElementById('scanner-laser').style.display = 'block';

      const facingModeValue = document.getElementById('scanner-camera-facing').value;
      const isFrontCam = facingModeValue === 'user';

      const config = {
        fps: isFrontCam ? 30 : 24,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minDim * (isFrontCam ? 0.85 : 0.7));
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: isFrontCam ? 1.0 : 1.333333,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        disableFlip: false
      };

      await html5QrCode.start({ facingMode: facingModeValue }, config, onScanSuccess, onScanFailure);

      try {
        const track = getCameraVideoTrack();
        if (track) {
          const caps = (typeof track.getCapabilities === 'function') ? track.getCapabilities() : {};
          const adv = [];
          if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) adv.push({ focusMode: 'continuous' });
          if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) adv.push({ exposureMode: 'continuous' });
          if (adv.length > 0 && typeof track.applyConstraints === 'function') await track.applyConstraints({ advanced: adv });

          if (caps.zoom) {
            const zoomInput = document.getElementById('scanner-zoom');
            zoomInput.min = caps.zoom.min;
            zoomInput.max = caps.zoom.max;
            zoomInput.step = caps.zoom.step || 0.1;
            const settings = (typeof track.getSettings === 'function') ? track.getSettings() : {};
            zoomInput.value = settings.zoom || caps.zoom.min;
            document.getElementById('zoom-val').textContent = parseFloat(zoomInput.value).toFixed(1) + 'x';
            document.getElementById('scanner-zoom-container').style.display = 'block';
          } else {
            document.getElementById('scanner-zoom-container').style.display = 'none';
          }
        }
      } catch (e) { console.warn('[Scanner] Camera optimization:', e); }

      isScanning = true;
      btn.textContent = '🛑 Matikan Kamera';
      btn.className = 'btn btn-danger';
    } catch (err) {
      console.error('Gagal mengakses kamera:', err);
      showToast('Gagal mengakses kamera. Coba tutup aplikasi lain yang menggunakan kamera.', 'error');
      placeholder.style.display = 'flex';
      container.style.display = 'none';
      document.getElementById('scanner-laser').style.display = 'none';
      document.getElementById('scanner-zoom-container').style.display = 'none';
      html5QrCode = null;
    } finally {
      btn.disabled = false;
      scannerTransitioning = false;
    }
  }
}

function getCameraVideoTrack() {
  const videoElem = document.querySelector("#scanner-reader video");
  if (videoElem && videoElem.srcObject && typeof videoElem.srcObject.getVideoTracks === 'function') {
    const tracks = videoElem.srcObject.getVideoTracks();
    if (tracks && tracks.length > 0) return tracks[0];
  }
  return null;
}

async function onCameraFacingChange() {
  if (scannerTransitioning) return;
  if (isScanning) {
    await toggleScanner();
    await new Promise(resolve => setTimeout(resolve, 500));
    await toggleScanner();
  }
}

async function applyZoom(value) {
  try {
    const track = getCameraVideoTrack();
    if (track && typeof track.applyConstraints === 'function') {
      await track.applyConstraints({ advanced: [{ zoom: parseFloat(value) }] });
      const zoomVal = document.getElementById('zoom-val');
      if (zoomVal) zoomVal.textContent = parseFloat(value).toFixed(1) + 'x';
    }
  } catch (err) { console.warn('Gagal mengubah zoom:', err); }
}

function onScanSuccess(decodedText) {
  const now = Date.now();
  if (now - lastScanTime < SCAN_COOLDOWN) return;

  lastScanTime = now;
  triggerScannerCooldown(SCAN_COOLDOWN);

  let participantId = decodedText.trim();
  let eventIdFromQr = null;

  if (decodedText.startsWith('EVENT_PST:')) {
    const parts = decodedText.split(':');
    participantId = parts[1];
    eventIdFromQr = parts[2] || null;
  }

  participantId = participantId.trim().toUpperCase();
  processAttendanceScan(participantId, eventIdFromQr);
}

function onScanFailure(error) {
  if (error && !error.toString().includes('No MultiFormat Readers')) {
    console.warn('[Scanner]', error);
  }
}

function showScanError(msg) {
  document.getElementById('scan-result-empty').style.display = 'none';
  document.getElementById('scan-result-card').style.display = 'none';
  const errorBox = document.getElementById('scan-result-error');
  document.getElementById('scan-result-error-msg').textContent = msg;

  const flash = document.getElementById('scanner-flash');
  if (flash) { flash.className = ''; void flash.offsetWidth; flash.classList.add('flash-error'); }

  errorBox.className = '';
  void errorBox.offsetWidth;
  errorBox.classList.add('animate-pop-in', 'error-glow');
  errorBox.style.display = 'block';

  showToast(msg, 'error');
  setTimeout(resetScannerResultView, 5000);
}

function showScanSuccess(participantId, name, org, eventName) {
  document.getElementById('scan-result-empty').style.display = 'none';
  document.getElementById('scan-result-error').style.display = 'none';
  const card = document.getElementById('scan-result-card');
  const badge = document.getElementById('scan-result-status-badge');
  const avatar = document.getElementById('scan-result-avatar');

  document.getElementById('scan-result-name').textContent = name;
  document.getElementById('scan-result-id').textContent = participantId;
  document.getElementById('scan-result-time').textContent = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit', ...tz });
  document.getElementById('scan-result-event').textContent = eventName;

  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  avatar.textContent = initials;

  badge.textContent = '✓ Hadir';
  badge.className = 'badge b-green';
  avatar.style.borderColor = 'var(--green)';
  avatar.style.color = '#5dca87';

  const flash = document.getElementById('scanner-flash');
  if (flash) { flash.className = ''; void flash.offsetWidth; flash.classList.add('flash-success'); }

  card.className = '';
  void card.offsetWidth;
  card.classList.add('animate-pop-in', 'success-glow');
  card.style.display = 'block';

  showToast(`✅ <b>${escapeHtml(name)}</b> — Hadir`, 'success');
  setTimeout(resetScannerResultView, 5000);
}

function resetScannerResultView() {
  const now = Date.now();
  if (now - lastScanTime >= 4900) {
    document.getElementById('scan-result-empty').style.display = 'block';
    document.getElementById('scan-result-card').style.display = 'none';
    document.getElementById('scan-result-error').style.display = 'none';
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.style.pointerEvents = 'auto';
  toast.style.background = 'var(--surface)';
  toast.style.color = 'var(--text)';
  toast.style.padding = '14px 18px';
  toast.style.borderRadius = '12px';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '500';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
  toast.style.border = '1px solid var(--border)';

  let borderCol = 'var(--gold)';
  let icon = '🔔';
  if (type === 'success') { borderCol = 'var(--green)'; icon = '✅'; }
  else if (type === 'error') { borderCol = 'var(--red)'; icon = '❌'; }
  else if (type === 'warning') { borderCol = 'var(--yellow)'; icon = '⚠️'; }

  toast.style.borderLeft = `4px solid ${borderCol}`;
  toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><span style="flex: 1; line-height: 1.4;">${message}</span>`;

  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-20px) scale(0.95)';
  toast.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  container.appendChild(toast);

  setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0) scale(1)'; }, 10);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function submitManualScan() {
  const input = document.getElementById('manual-participant-id');
  const pId = input.value.trim().toUpperCase();
  if (!pId) { alert('Masukkan ID Peserta!'); return; }
  triggerScannerCooldown(SCAN_COOLDOWN);
  processAttendanceScan(pId, null);
  input.value = '';
}

async function processAttendanceScan(participantId, eventIdFromQr) {
  const selectedEventId = document.getElementById('scanner-event').value;
  if (!selectedEventId) {
    showScanError('Silakan pilih event terlebih dahulu.');
    playAudioTone(false);
    return;
  }

  try {
    const { data: participant, error: pErr } = await db
      .from('participants')
      .select('id, participant_id, name, organization, event_id, events(name)')
      .eq('participant_id', participantId)
      .eq('event_id', selectedEventId)
      .single();

    if (pErr || !participant) {
      showScanError(`Peserta "${participantId}" tidak terdaftar di event ini.`);
      playAudioTone(false);
      return;
    }

    const { data: existing } = await db
      .from('attendance')
      .select('id')
      .eq('participant_id', participant.id)
      .eq('event_id', selectedEventId);

    if (existing && existing.length > 0) {
      showScanError(`${participant.name} sudah tercatat hadir.`);
      playAudioTone(false);
      return;
    }

    const { error: insertErr } = await db.from('attendance').insert({
      participant_id: participant.id,
      event_id: selectedEventId
    });

    if (insertErr) throw insertErr;

    playAudioTone(true);
    const eventName = participant.events ? participant.events.name : '—';
    showScanSuccess(participantId, participant.name, participant.organization, eventName);

    if (typeof loadKehadiran === 'function') loadKehadiran();
    loadBelumScan();

  } catch (err) {
    showScanError('Gagal mencatat kehadiran: ' + (err.message || err));
    playAudioTone(false);
  }
}

// ===== PANEL BELUM SCAN =====
async function loadBelumScan() {
  const eventEl = document.getElementById('scanner-event');
  const wrap = document.getElementById('belum-scan-wrap');
  if (!eventEl || !wrap) return;

  const eventId = eventEl.value;
  if (!eventId) {
    wrap.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Pilih event untuk melihat data</div>';
    return;
  }

  wrap.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat...</div>';

  const { data: allParticipants } = await db.from('participants').select('id, participant_id, name, organization').eq('event_id', eventId);
  const { data: scanned } = await db.from('attendance').select('participant_id').eq('event_id', eventId);

  const scannedIds = new Set((scanned || []).map(a => a.participant_id));
  const sudahHadir = (allParticipants || []).filter(p => scannedIds.has(p.id));
  const belumHadir = (allParticipants || []).filter(p => !scannedIds.has(p.id));

  const totalP = (allParticipants || []).length;
  if (!totalP) {
    wrap.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Belum ada peserta terdaftar di event ini</div>';
    return;
  }

  const pct = Math.round((sudahHadir.length / totalP) * 100);

  let html = `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;">
        <span style="color:var(--muted);">Kehadiran</span>
        <span style="color:var(--gold);font-weight:700;">${sudahHadir.length}/${totalP} (${pct}%)</span>
      </div>
      <div style="width:100%;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--green),#5dca87);border-radius:4px;transition:width 0.5s;"></div>
      </div>
    </div>
  `;

  if (sudahHadir.length > 0) {
    html += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--green);font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <span style="width:8px;height:8px;background:var(--green);border-radius:50%;display:inline-block;"></span> Sudah Hadir (${sudahHadir.length})
    </div>`;
    sudahHadir.forEach(p => {
      const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(39,174,96,0.06);border:1px solid rgba(39,174,96,0.15);border-radius:8px;margin-bottom:6px;">
        <div style="width:32px;height:32px;border-radius:50%;background:rgba(39,174,96,0.15);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${initials}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
          <div style="font-size:10px;color:var(--muted);">${escapeHtml(p.participant_id)} · ${escapeHtml(p.organization || '—')}</div>
        </div>
        <span class="badge b-green" style="font-size:9px;flex-shrink:0;">Hadir</span>
      </div>`;
    });
  }

  if (belumHadir.length > 0) {
    html += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--red);font-weight:600;margin:12px 0 8px;display:flex;align-items:center;gap:6px;">
      <span style="width:8px;height:8px;background:var(--red);border-radius:50%;display:inline-block;"></span> Belum Hadir (${belumHadir.length})
    </div>`;
    belumHadir.forEach(p => {
      const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.15);border-radius:8px;margin-bottom:6px;">
        <div style="width:32px;height:32px;border-radius:50%;background:rgba(192,57,43,0.15);color:#e57373;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${initials}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
          <div style="font-size:10px;color:var(--muted);">${escapeHtml(p.participant_id)} · ${escapeHtml(p.organization || '—')}</div>
        </div>
        <span class="badge b-red" style="font-size:9px;flex-shrink:0;">Belum</span>
      </div>`;
    });
  }

  if (belumHadir.length === 0) {
    html += '<div style="text-align:center;padding:16px;color:var(--green);font-size:13px;font-weight:600;">✓ Semua peserta sudah hadir!</div>';
  }

  wrap.innerHTML = html;
}

setInterval(() => {
  const eventEl = document.getElementById('scanner-event');
  if (eventEl && eventEl.value) loadBelumScan();
}, 2 * 60 * 1000);

document.addEventListener('DOMContentLoaded', () => {
  const scanEvent = document.getElementById('scanner-event');
  if (scanEvent) scanEvent.addEventListener('change', () => loadBelumScan());
});
