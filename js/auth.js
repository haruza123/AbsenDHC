// ============================================================
// AUTENTIKASI & KONEKSI SUPABASE
// ============================================================

// Ping saat script dimuat & setiap 5 menit
pingSupabase();
setInterval(pingSupabase, 5 * 60 * 1000);

async function pingSupabase() {
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/health', {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    if (res.ok) {
      localStorage.setItem('sb_last_ping', new Date().toISOString());
      console.log('[Keep-Alive] Ping Supabase OK —', new Date().toLocaleTimeString('id-ID', tz));
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[Keep-Alive] Ping error:', e.message);
    return false;
  }
}

async function checkSupabasePaused() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(SUPABASE_URL + '/auth/v1/health', {
      headers: { 'apikey': SUPABASE_ANON_KEY },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.status === 540 || res.status === 503) return true;
    return false;
  } catch (e) {
    return false;
  }
}

async function initAuth() {
  const isPaused = await checkSupabasePaused();
  if (isPaused) {
    const err = document.getElementById('login-err');
    if (err) {
      err.innerHTML = '⚠️ <b>Database Supabase sedang di-pause</b> (Free Tier auto-pause setelah 7 hari idle).<br><br>Buka <a href="https://supabase.com/dashboard/projects" target="_blank" style="color:var(--gold);text-decoration:underline;">Supabase Dashboard</a> → klik project → <b>Restore</b>.<br><br>Setelah restore (±2 menit), refresh halaman ini.';
      err.style.display = 'block';
    }
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Masuk';
    }
    return;
  }
  const { data: { session } } = await db.auth.getSession();
  if (session && session.user) {
    loggedInUserEmail = session.user.email;
    appStarted = true;
    startApp();
  }
  db.auth.onAuthStateChange((_e, s) => {
    if (s && s.user) {
      loggedInUserEmail = s.user.email;
      if (!appStarted) { appStarted = true; startApp(); }
    }
  });
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-err');
  btn.disabled = true; btn.textContent = 'Masuk...';
  err.style.display = 'none';
  let signInResult;
  try {
    signInResult = await db.auth.signInWithPassword({ email, password: pass });
  } catch (networkErr) {
    const isPaused = await checkSupabasePaused();
    if (isPaused) {
      err.innerHTML = '⚠️ <b>Database sedang di-pause!</b><br>Buka <a href="https://supabase.com/dashboard/projects" target="_blank" style="color:var(--gold);text-decoration:underline;">Supabase Dashboard</a> → Restore project, lalu refresh.';
    } else {
      err.textContent = '❌ Gagal terhubung ke server. Periksa koneksi internet.';
    }
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Masuk';
    return;
  }
  const { error } = signInResult;
  if (error) {
    if (error.message && (error.message.includes('fetch') || error.message.includes('network') || error.status === 0)) {
      err.innerHTML = '⚠️ <b>Database tidak merespons.</b> Kemungkinan project Supabase di-pause.<br>Buka <a href="https://supabase.com/dashboard/projects" target="_blank" style="color:var(--gold);text-decoration:underline;">Supabase Dashboard</a> → Restore.';
    } else {
      err.textContent = '❌ Email atau password salah.';
    }
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Masuk';
  } else {
    document.getElementById('login-overlay').style.display = 'none';
    startApp();
  }
}

async function doLogout() {
  await db.auth.signOut();
  location.reload();
}
