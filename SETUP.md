# Setup Aplikasi Absensi Barbershop — Sistem Scan Kasir

Sistem absensi ini dirancang khusus untuk skenario di mana **Karyawan memiliki kartu QR fisik** dan **Kasir men-scan kartu tersebut** menggunakan kamera perangkat kasir (PC / Tablet) untuk mencatat absensi masuk & keluar secara otomatis.

## File Struktur
```
├── absen-kasir/
│   ├── dashboard.html   → Dashboard Admin + Scanner Kasir + Cetak Kartu
│   └── SETUP.md         → Panduan ini
```

---

## 1. Persiapan Database (Supabase)

Sistem ini menggunakan struktur tabel database yang sama dengan sistem absen utama Anda. Pastikan Anda sudah membuat tabel-tabel berikut di database Supabase Anda:
* `employees` (untuk daftar karyawan)
* `attendance` (untuk mencatat riwayat kehadiran)
* `settings` (untuk token WhatsApp Fonnte)

Jika belum, Anda dapat menjalankan SQL query berikut di SQL Editor Supabase Anda:

```sql
-- Karyawan
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  cabang TEXT DEFAULT 'Pusat',
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (Notifikasi WhatsApp Fonnte)
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Absensi
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  cabang TEXT DEFAULT 'Pusat',
  status TEXT NOT NULL DEFAULT 'hadir', -- 'hadir' (Masuk), 'keluar' (Keluar), 'izin', 'sakit', 'alpha'
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_text TEXT,
  qr_token TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Hubungkan Proyek Supabase Anda

Buka file `absen-kasir/dashboard.html` dan ganti konstanta berikut dengan konfigurasi Supabase Anda:
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

---

## 3. Cara Penggunaan Sistem Kasir

### A. Membuat & Mencetak Kartu QR Karyawan
1. Login ke `absen-kasir/dashboard.html` menggunakan email admin Anda.
2. Buka tab **Karyawan**.
3. Di sebelah kanan nama karyawan, klik tombol **"Cetak QR Card"**.
4. Sebuah modal pratinjau ID Card premium akan terbuka, menampilkan detail karyawan dan QR Code unik karyawan.
5. Klik **"Cetak Kartu"** untuk mencetaknya di kertas kartu ID Card. Anda juga bisa menyimpannya sebagai PDF.
6. Berikan kartu ini ke masing-masing karyawan.

### B. Proses Pemindaian (Scanning) oleh Kasir
1. Di komputer atau tablet toko/kasir, buka `absen-kasir/dashboard.html` dan pastikan kasir sudah login.
2. Pilih menu **"Scanner Kasir"** pada sidebar kiri.
3. Pilih nama **Cabang Toko** yang sedang aktif (misal: "Pusat", "Cabang BSD").
4. Klik tombol **"Aktifkan Kamera"** untuk membuka webcam kasir.
5. Saat karyawan datang untuk absen **Masuk** atau **Keluar**, kasir cukup mengarahkan kartu QR karyawan tersebut ke hadapan webcam.
6. Kamera akan mendeteksi QR Code secara otomatis:
   * **Masuk:** Jika karyawan belum absen hari ini, sistem langsung mencatat **Absen Masuk** dengan status `'hadir'` (diiringi suara *beep* sukses).
   * **Keluar:** Jika karyawan sudah absen masuk sebelumnya pada hari yang sama, sistem secara otomatis mencatat **Absen Keluar** dengan status `'keluar'`.
   * Peringatan akan muncul jika QR code tidak dikenali atau jika karyawan sudah absen masuk & keluar hari ini.

---

## 4. Keuntungan Sistem ini
* **Aman:** Karyawan tidak bisa men-scan QR code sendiri dari luar toko, karena proses scan dikontrol sepenuhnya oleh kasir di kasir cabang.
* **Cepat:** Karyawan tidak perlu mengetik nama atau ID, cukup menunjukkan kartu ke webcam kasir.
* **Auto-detect:** Sistem kasir secara cerdas membedakan absen masuk dan keluar berdasarkan log harian di database Supabase.
