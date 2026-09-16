# Setup Sistem Absensi Event — BHC Professional

Sistem manajemen kehadiran peserta event/seminar menggunakan QR code. Admin membuat event, peserta mendaftar (pre-register atau on-site), mendapat QR code, lalu scan QR di hari H untuk mencatat kehadiran.

## File Struktur
```
├── index.html        → Dashboard Admin (login required)
├── scanner.html      → Mode Kios Scanner (tanpa login)
├── register.html     → Halaman Registrasi Publik Peserta
├── css/style.css     → Stylesheet
├── js/
│   ├── config.js     → Konfigurasi Supabase & variabel global
│   ├── auth.js       → Autentikasi admin
│   ├── app.js        → Navigasi & inisialisasi
│   ├── events.js     → CRUD event/acara
│   ├── peserta.js    → CRUD peserta & cetak QR tiket
│   ├── scanner.js    → Scanner QR & proses absensi
│   ├── kehadiran.js  → Data kehadiran, statistik & chart
│   ├── settings.js   → Pengaturan notifikasi WA
│   └── theme.js      → Toggle tema gelap/terang
├── logo-bhc.png      → Logo BHC Professional
└── SETUP.md          → Panduan ini
```

---

## 1. Buat Project Supabase Baru

1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Pilih nama project dan region terdekat
3. Catat **Project URL** dan **anon public key** dari Settings → API

---

## 2. Buat Tabel Database (SQL Editor)

Buka **Supabase Dashboard → SQL Editor** dan jalankan query berikut:

```sql
-- ==========================================
-- TABEL EVENT
-- ==========================================
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  location TEXT,
  max_participants INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TABEL PESERTA
-- ==========================================
CREATE TABLE IF NOT EXISTS participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  organization TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, event_id),
  UNIQUE(email, event_id)
);

-- ==========================================
-- TABEL KEHADIRAN
-- ==========================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, event_id)
);

-- ==========================================
-- TABEL SETTINGS
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Aktifkan Row Level Security (RLS)

Jalankan query berikut di SQL Editor:

```sql
-- Aktifkan RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- EVENTS: publik bisa baca (untuk register.html), admin kelola
-- ==========================================
CREATE POLICY "Allow read events for all" ON events
  FOR SELECT USING (true);

CREATE POLICY "Allow full access events for authenticated" ON events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- PARTICIPANTS: publik bisa baca & insert (registrasi), admin kelola
-- ==========================================
CREATE POLICY "Allow read participants for all" ON participants
  FOR SELECT USING (true);

CREATE POLICY "Allow insert participants for all" ON participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update participants for authenticated" ON participants
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow delete participants for authenticated" ON participants
  FOR DELETE TO authenticated USING (true);

-- ==========================================
-- ATTENDANCE: publik bisa baca & insert (scan kios), admin kelola
-- ==========================================
CREATE POLICY "Allow read attendance for all" ON attendance
  FOR SELECT USING (true);

CREATE POLICY "Allow insert attendance for all" ON attendance
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update attendance for authenticated" ON attendance
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow delete attendance for authenticated" ON attendance
  FOR DELETE TO authenticated USING (true);

-- ==========================================
-- SETTINGS: publik bisa baca, admin kelola
-- ==========================================
CREATE POLICY "Allow read settings for all" ON settings
  FOR SELECT USING (true);

CREATE POLICY "Allow full access settings for authenticated" ON settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 4. Aktifkan Realtime

Buka **Supabase Dashboard → Database → Replication** dan aktifkan realtime untuk tabel:
- `attendance`

Ini memungkinkan dashboard admin menampilkan update kehadiran secara live.

---

## 5. Buat User Admin

Buka **Supabase Dashboard → Authentication → Users → Add User**:
- Email: `admin@bhc.com` (atau email Anda)
- Password: (buat password kuat)

User ini digunakan untuk login ke dashboard admin (`index.html`).

---

## 6. Hubungkan ke Aplikasi

Edit file `js/config.js` dan ganti placeholder:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';  // ← ganti
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';                // ← ganti
```

---

## 7. Deploy / Hosting

Karena ini 100% static HTML/CSS/JS, bisa di-deploy ke:
- **GitHub Pages** (gratis)
- **Netlify** (gratis)
- **Vercel** (gratis)
- Atau buka langsung `index.html` di browser

---

## 8. Cara Penggunaan

### A. Admin: Membuat Event
1. Login ke `index.html` → menu **Kelola Event**
2. Klik **+ Tambah Event** → isi kode, nama, tanggal, lokasi, deskripsi, maks peserta
3. Event siap digunakan

### B. Peserta: Registrasi
1. Buka `register.html` (halaman publik, tanpa login)
2. Pilih event → isi data diri (nama, email, HP, organisasi)
3. Klik **Daftar Sekarang** → QR code muncul
4. Screenshot / cetak QR code untuk dibawa ke lokasi event

### C. Admin: Tambah Peserta Manual
1. Login → menu **Peserta**
2. Pilih event → klik **+ Tambah Peserta**
3. Isi data peserta → klik ikon QR untuk cetak tiket

### D. Scan QR di Hari H
1. Buka `scanner.html` (mode kios, tanpa login) atau gunakan Scanner di dashboard admin
2. Pilih event yang sedang berlangsung
3. Aktifkan kamera → arahkan QR peserta ke kamera
4. Sistem otomatis mencatat kehadiran:
   - **Peserta terdaftar & belum scan** → Kehadiran tercatat ✓
   - **Peserta sudah scan** → Notifikasi sudah hadir
   - **QR tidak valid** → Notifikasi error

### E. Pantau Kehadiran Live
1. Login → menu **Kehadiran**
2. Pilih event → lihat statistik real-time (hadir / belum hadir)
3. Export data ke CSV untuk laporan

---

## Format QR Code

```
EVENT_PST:{participant_id}:{event_id}
```

Contoh: `EVENT_PST:PST001:a1b2c3d4-e5f6-7890-abcd-ef1234567890`
