# Zen's Kantin

Aplikasi manajemen kantin & kasir. Next.js 14 (App Router) + shadcn/ui +
Supabase (Auth, Database, Storage, Realtime).

Tiga role: **admin**, **kasir**, **pelanggan**. Pendaftaran hanya lewat
Google, lalu sekali saja mengisi nama/username/password supaya kasir &
pelanggan bisa login cepat di tablet bersama tanpa mengulang OAuth setiap
saat.

Dokumen ini ditulis sebagai **kondisi aplikasi saat ini** — bukan riwayat
antarversi. Semua yang tertulis di sini berlaku untuk kode yang ada di
repo sekarang.

---

## Daftar isi

1. [Fitur](#1-fitur)
2. [Persiapan](#2-persiapan)
3. [Inisialisasi Supabase](#3-inisialisasi-supabase)
4. [Isi `schema.sql` secara rinci](#4-isi-schemasql-secara-rinci)
5. [Model keamanan & RLS](#5-model-keamanan--rls)
6. [Setup Google OAuth](#6-setup-google-oauth)
7. [Environment variables](#7-environment-variables)
8. [Install & jalankan](#8-install--jalankan)
9. [Membuat akun admin pertama](#9-membuat-akun-admin-pertama)
10. [Mengisi data dummy (opsional)](#10-mengisi-data-dummy-opsional)
11. [Email & cron (opsional)](#11-email--cron-opsional)
12. [Keputusan desain](#12-keputusan-desain)
13. [Struktur folder](#13-struktur-folder)
14. [Deploy](#14-deploy)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Fitur

### Autentikasi & akun
- **Daftar lewat Google saja.** Setelah OAuth pertama, pengguna mengisi
  onboarding (nama, username, password) dan akun langsung dibuat dengan
  role `pelanggan` / status `pending`, menunggu persetujuan admin.
- **Login harian pakai username & password** — dirancang untuk tablet
  kasir/pelanggan yang dipakai bergantian. Password tetap disimpan di
  Supabase Auth (bukan tabel sendiri); username diterjemahkan ke email
  lewat function `get_email_by_username`, lalu `signInWithPassword` biasa.
- **Jeda percobaan login gagal**: 5 percobaan gagal per username dalam
  5 menit akan menjeda login username itu. Sisa jedanya dihitung ulang di
  server dari `activity_logs`, bukan dari yang "diingat" browser.
- **Sesi 30 hari**, disamakan dengan Refresh Token Expiry di Supabase.
- **Alur status akun**: `pending` → halaman menunggu persetujuan;
  `block` → halaman diblokir; `active` → masuk sesuai role.
- **Ganti password** wajib memverifikasi password lama. **Keluar akun**
  dari halaman pelanggan wajib password (mencegah pengguna iseng di
  tablet bersama).
- **Nama & username hanya bisa diubah admin** (lewat Admin → Pengguna);
  pengguna biasa cuma bisa ganti passwordnya sendiri.
- **Reset password oleh admin** untuk akun siapa pun.

### Pelanggan (`/order`)
- Katalog produk dengan filter kategori, pencarian, stok realtime, dan
  produk habis otomatis turun ke urutan paling bawah.
- Keranjang multi-produk; satu checkout menghasilkan satu `group_id`
  sehingga kasir mengonfirmasi/membatalkannya sekaligus.
- Halaman konfirmasi penuh sebelum pesanan dikirim (bukan modal kecil).
- **Info pembayaran** (teks dan/atau gambar, mis. nomor rekening atau
  kode QRIS) ditampilkan setelah checkout jika metode pembayarannya
  diatur begitu oleh admin, lengkap dengan tombol **Saya Sudah Membayar**
  yang menandai pesanan untuk kasir — konfirmasi final tetap di kasir.
- **Harga pokok (modal) tidak pernah terkirim ke browser pelanggan.**
- Kartu **Saldo** & **Pesanan Belum Dibayar** milik pelanggan sendiri.

### Kasir (`/kasir`)
- Antrian pesanan realtime (Supabase Realtime + polling cadangan +
  tombol Refresh manual), dengan suara notifikasi tiap pesanan baru.
- Aksi per pesanan: **Konfirmasi Bayar** (dengan unggah bukti bayar),
  **Batalkan**, atau **Sampingkan** — pesanan yang disampingkan tetap di
  tab Menunggu tapi dipisah ke bagian bawah supaya tidak mengacaukan
  antrian, dan bisa dikembalikan kapan saja.
- **Pesanan walk-in** untuk pelanggan tanpa akun; nama pemesan berupa
  combobox yang bisa memilih dari daftar Pelanggan Tersimpan atau
  mengetik nama baru.
- **Kunci layar PIN** (`/kasir/lock`): halaman terpisah yang digerbangi
  cookie HttpOnly di middleware, aktif otomatis setelah idle (interval
  diatur admin, default 3 menit) atau lewat tombol Kunci manual.
- Halaman produk khusus kasir (lihat stok & harga, tanpa akses modal
  penuh milik admin).

### Admin
- **Dashboard** — kartu statistik bulan berjalan: Saldo, Keuntungan Kotor,
  Keuntungan Bersih, Pengeluaran, dan Pesanan Belum Dibayar.
- **Pengguna & Approval Pendaftaran** — promosi role, blokir/aktifkan,
  ubah nama/username, reset password, setujui pendaftaran baru.
- **Produk & Kategori Produk** — produk boleh tanpa kategori. Field stok
  di form produk tidak bisa diisi manual; stok hanya berubah lewat
  Manajemen Stok atau penjualan.
- **Manajemen Stok** — tab **Input Stok** (modal per item = total beli ÷
  jumlah, bisa ditarik kembali) dan **Penghapusan Stok** untuk barang
  rusak/hilang/kadaluarsa, dengan pilihan dihitung sebagai kerugian atau
  sekadar koreksi. Penghapusan bisa dibatalkan dan stok kembali pulih.
- **Keuntungan FIFO** — jika satu produk punya beberapa batch stok dengan
  harga beli berbeda, modal tiap pesanan dihitung dari batch yang
  benar-benar terpakai (First In First Out), bukan harga terakhir.
- **Pesanan** — seluruh riwayat, filter status & metode pembayaran,
  pencarian di semua kolom.
- **Pengeluaran Khusus** & **Pemasukan Khusus** — biaya operasional (gas,
  galon, listrik) dan pemasukan di luar penjualan (jual barang bekas,
  sewa tempat, donasi). Keduanya ikut memengaruhi laporan.
- **Laporan** — navigasi periode mingguan/bulanan/tahunan dengan rentang
  tanggal, grafik tren pendapatan, produk terlaris, datatable **Arus Kas
  Khusus** (pemasukan + pengeluaran khusus) dan **Distribusi Stok**
  (input + penghapusan stok). **Ekspor Excel** (`.xlsx`, berformat: pita
  judul, header gelap, border, zebra, filter otomatis, angka rupiah) dan
  **Ekspor PDF**, keduanya menyertakan tren pendapatan & produk terlaris.
- **Metode Pembayaran** — aktif/nonaktif, plus pengaturan info pembayaran
  yang tampil ke pelanggan.
- **Pelanggan Tersimpan** — daftar nama langganan untuk pesanan walk-in.
- **Log Aktivitas** — mencatat aksi penting beserta alamat IP, lokasi
  (kota/wilayah/negara), dan perangkat/browser, dengan detail per baris.
  Bisa direset manual, dan otomatis dibersihkan tiap tanggal 1 kalau
  `pg_cron` tersedia.
- **File Manager (read-only)** — menjelajahi bucket Supabase Storage
  tempat semua foto diunggah, dengan thumbnail, pratinjau, dan ringkasan
  total ukuran serta jumlah file. Tidak ada unggah/ubah/hapus dari sini.
- **Pengaturan** — PIN kasir, interval kunci layar kasir, kirim laporan
  bulanan lewat email secara manual.

### Perilaku umum UI
- Semua modal form bersifat statis: tidak bisa ditutup lewat klik di luar
  atau Esc, hanya lewat tombol **Batal**, dan baru tertutup setelah
  prosesnya benar-benar selesai.
- Semua field form otomatis terkunci selama submit berjalan.
- Progress bar tipis di atas layar saat pindah halaman, dengan seluruh
  layar diredupkan & tidak bisa diklik selama transisi.
- Pencarian datatable mencari di semua kolom sekaligus.
- Semua aksi berbahaya memakai modal konfirmasi.
- Semua gambar dikompres di browser (maks 1024px, JPEG 72%) sebelum
  diunggah.
- **Mode Lockdown** (`APP_LOCKDOWN=true`) mematikan sementara seluruh
  akses aplikasi dan mengarahkan semua request ke halaman pemeliharaan.
- Nama/brand aplikasi mengikuti `NEXT_PUBLIC_APP_NAME`, tidak di-hardcode.

---

## 2. Persiapan

- Node.js 18.18+ (disarankan 20 LTS)
- Akun [Supabase](https://supabase.com) — paket gratis cukup untuk mulai
- Project di [Google Cloud Console](https://console.cloud.google.com)
  untuk OAuth

---

## 3. Inisialisasi Supabase

### 3.1 Buat project & jalankan skema

1. Buat project baru di Supabase.
2. Buka **SQL Editor** → tempel seluruh isi
   `supabase/migrations/schema.sql` → **Run**.

   Satu file ini membuat **seluruh** isi database: enum, tabel, indeks,
   RLS beserta policy-nya, helper function, function transaksi
   `SECURITY DEFINER` beserta grant-nya, trigger, bucket storage beserta
   policy-nya, publication realtime, data awal, dan penjadwalan
   pembersihan log. Rinciannya ada di [bagian 4](#4-isi-schemasql-secara-rinci).

   File ini **idempotent** — aman dijalankan ulang kapan saja di database
   yang sudah berisi data; tidak ada data yang terhapus atau terduplikasi.
   Setiap objek didefinisikan tepat satu kali dalam bentuk akhirnya.

   > **Lewat Prisma Migrate?** Isi `prisma/migrations/` sama persis dengan
   > file di atas. Cukup isi `DATABASE_URL` & `DIRECT_URL` di `.env`
   > ([bagian 7](#7-environment-variables)) lalu `npm run db:migrate`.
   > Prisma di sini murni alat migrasi supaya perubahan skema ke depan
   > tersusun rapi — query aplikasi tetap lewat `@supabase/supabase-js`,
   > bukan Prisma Client.
   >
   > `DIRECT_URL` harus memakai **Session pooler** atau **Direct
   > connection** (port `5432`) — semua DDL lewat sana. Transaction pooler
   > (`6543`) tidak mendukung DDL dan hanya cocok untuk `DATABASE_URL`.

### 3.2 Aktifkan Google sebagai provider

Buka **Authentication → Providers → Google**, aktifkan, lalu isi
**Client ID** & **Client Secret** dari Google Cloud Console
([bagian 6](#6-setup-google-oauth)).

### 3.3 Redirect URL

Di **Authentication → URL Configuration**, tambahkan:

```
http://localhost:3000/auth/callback
https://domain-produksi-kamu.com/auth/callback
```

### 3.4 Pengaturan Auth lain

- **Authentication → Sessions → Refresh Token Expiry**: set **30 hari**,
  supaya konsisten dengan umur cookie sesi aplikasi.
- **Authentication → Settings → Allow manual linking**: aktifkan kalau
  ingin fitur **Ganti Akun Google** di menu Akun Saya berfungsi. Tanpa
  ini, Supabase menolak menghubungkan akun Google kedua ke user yang sama.

### 3.5 Ambil kredensial

Dari **Project Settings → API**, salin `Project URL`, `anon public key`,
dan `service_role key` untuk [bagian 7](#7-environment-variables).

### 3.6 Extension opsional

Aktifkan **pg_cron** di **Database → Extensions** kalau ingin log
aktivitas terhapus otomatis setiap tanggal 1. Kalau paket Supabase kamu
tidak menyediakannya, `schema.sql` melewati blok itu tanpa error dan kamu
bisa memakai tombol **Reset Log** manual di Admin → Log Aktivitas.

---

## 4. Isi `schema.sql` secara rinci

Urutan di bawah mengikuti urutan bagian di dalam file.

### 4.1 Enum

| Enum | Nilai |
| --- | --- |
| `user_role` | `admin`, `kasir`, `pelanggan` |
| `user_status` | `active`, `pending`, `block` |
| `payment_status` | `pending`, `paid`, `cancelled`, `tidak_dibayar` |

`tidak_dibayar` dipertahankan di enum semata-mata supaya baris pesanan lama
yang terlanjur berstatus itu tetap valid dan tetap terhitung akurat di
laporan. UI & API sudah tidak bisa membuat baris baru dengan status ini —
kasir hanya punya aksi Konfirmasi Bayar, Batalkan, dan Sampingkan.

### 4.2 Tabel

| Tabel | Isi |
| --- | --- |
| `profiles` | Profil tiap akun, ber-PK sama dengan `auth.users.id` (`on delete cascade`). Menyimpan `email`, `nama`, `username` (unik), `google_id`, `role`, `status`, `avatar_url`. |
| `app_settings` | Key-value pengaturan aplikasi: `kasir_pin`, `kasir_lock_interval_minutes`. |
| `payment_methods` | Metode pembayaran + pengaturan info pembayaran ke pelanggan (`tampilkan_info_pembayaran`, `tampilkan_teks`, `info_teks`, `tampilkan_gambar`, `info_gambar_url`). |
| `categories` | Kategori produk (nama unik). |
| `products` | Produk: `stok`, `modal`, `harga_jual`, `gambar_url`, `is_active`, `kategori_id`. Semua kolom uang di-`check` tidak boleh negatif. |
| `orders` | Satu baris = satu produk dalam satu checkout. `group_id` menyatukan baris-baris dari satu checkout. `modal_total` & `harga_total` adalah kolom **generated** (`satuan × qty`). Penanda `dikonfirmasi_pelanggan` (klaim "saya sudah membayar") dan `disampingkan` (kasir menunda pesanan) tidak memengaruhi laporan sama sekali. |
| `stock_entries` | Batch stok masuk. `harga_beli_satuan` generated dari `total_beli ÷ qty`; `remaining_qty` dipakai untuk perhitungan modal FIFO. |
| `stock_writeoffs` | Penghapusan stok, dengan opsi `kembalikan_kerugian` & nilai `kerugian`. |
| `expenses` | Pengeluaran khusus. |
| `special_incomes` | Pemasukan khusus — struktur & pola RLS-nya sengaja identik dengan `expenses`. |
| `saved_customers` | Nama pelanggan tersimpan untuk pesanan walk-in. |
| `activity_logs` | Log aktivitas beserta `ip_address`, `user_agent`, `perangkat`, `kota`, `wilayah`, `negara`. |

Indeks dibuat untuk kolom yang sering difilter/diurutkan: status & role
profil, status/tanggal/user/group pesanan, FIFO stok
(`produk_id, created_at` untuk baris `remaining_qty > 0`), dan tanggal
pada tabel-tabel arus kas serta log.

### 4.3 Helper function untuk RLS

Ketiganya `SECURITY DEFINER` dengan `search_path = public`, supaya policy
di tabel `profiles` tidak memicu rekursi tak berujung saat membaca
`profiles` untuk mengecek role.

```sql
current_role_v() -> text      -- role milik auth.uid()
is_staff()       -> boolean   -- role admin atau kasir
is_admin()       -> boolean   -- role admin
```

### 4.4 Function transaksi (`SECURITY DEFINER`)

Semua function di bawah memvalidasi role di dalam badannya sendiri, dan
aksesnya dibatasi dengan `revoke all ... from public` lalu grant eksplisit.

| Function | Kegunaan |
| --- | --- |
| `get_email_by_username(text)` | Menerjemahkan username ke email untuk login. |
| `create_order_batch(jsonb, uuid, text)` | Satu checkout berisi banyak produk; menghitung modal FIFO dari `stock_entries.remaining_qty` dan mendukung pesanan walk-in. |
| `confirm_payment(uuid, text)` | Konfirmasi bayar satu pesanan. |
| `confirm_payment_batch(uuid[], text)` | Konfirmasi bayar satu grup checkout sekaligus. |
| `confirm_customer_paid(uuid)` | Klaim "Saya Sudah Membayar" dari pelanggan (penanda saja). |
| `retract_stock_entry(uuid)` | Menarik kembali input stok. |
| `create_stock_writeoff(uuid, integer, text)` | Mencatat penghapusan stok. |
| `delete_stock_writeoff(uuid)` | Membatalkan penghapusan stok; stok & kerugian dipulihkan. |
| `get_lock_interval_minutes()` | Interval kunci layar kasir tanpa perlu membuka seluruh `app_settings`. |
| `get_period_stats(timestamptz, timestamptz)` | Statistik satu periode untuk Dashboard & Laporan. |
| `get_monthly_summary(integer)` | Ringkasan beberapa bulan terakhir. |

Grant-nya:

```sql
-- dipanggil sebelum login, jadi anon perlu akses;
-- service_role dipakai oleh /api/auth/login yang berjalan di server
grant execute on function get_email_by_username(text)
  to anon, authenticated, service_role;

-- sisanya hanya untuk pengguna yang sudah login
grant execute on function create_order_batch(jsonb, uuid, text) to authenticated;
-- dan seterusnya untuk tiap function di tabel atas
```

> Perhatikan `service_role` pada `get_email_by_username`. Karena file ini
> menjalankan `revoke all ... from public` lebih dulu, default privileges
> Supabase ikut tercabut — tanpa grant eksplisit itu, route login
> server-side akan ditolak dengan `42501 permission denied for function`
> dan **semua login username/password gagal** meski password benar. Lihat
> [Troubleshooting](#15-troubleshooting).

### 4.5 Trigger

| Trigger | Tabel | Kegunaan |
| --- | --- | --- |
| `trg_profiles_updated_at` | `profiles` | Memperbarui `updated_at`. |
| `trg_products_updated_at` | `products` | Memperbarui `updated_at`. |
| `trg_stock_entry_apply` | `stock_entries` | Menambah stok produk & mengisi `remaining_qty` saat batch stok masuk. |
| `trg_order_cancel_stock` | `orders` | Mengembalikan stok saat pesanan dibatalkan. |

File ini juga **menghapus** trigger pencatatan log lama
(`trg_log_daftar`, `trg_log_pesanan`, `trg_log_pembayaran`) kalau masih
ada, karena seluruh pencatatan log sudah pindah ke level aplikasi.

### 4.6 Storage

Bucket publik `kantin-images` dibuat untuk foto produk, bukti bayar,
struk stok, dan lampiran arus kas. Policy-nya:

| Aksi | Aturan |
| --- | --- |
| `select` | Siapa pun boleh membaca (bucket memang publik, URL-nya dipakai langsung di `<img>` dan tombol unduh). |
| `insert` / `update` / `delete` | Hanya `auth.uid()` yang profilnya berstatus `active`. |

### 4.7 Realtime

Tabel `orders` dan `products` ditambahkan ke publication
`supabase_realtime`. Kalau gagal (mis. hak akses), file menampilkan
`NOTICE` dan kamu bisa menambahkannya manual lewat **Database →
Replication**.

### 4.8 Data awal

```
app_settings: kasir_pin = 8888
app_settings: kasir_lock_interval_minutes = 3
payment_methods: Tunai, QRIS
```

**Ganti PIN default `8888`** lewat Admin → Pengaturan sebelum dipakai
sungguhan.

### 4.9 Pembersihan log otomatis

Kalau extension `pg_cron` aktif, dijadwalkan job
`reset-activity-logs-monthly` (`0 0 1 * *`) yang mengosongkan
`activity_logs`. Kalau tidak, blok ini dilewati tanpa error.

---

## 5. Model keamanan & RLS

### 5.1 Prinsip

RLS di aplikasi ini fokus pada **SELECT** — siapa boleh membaca apa —
sebagai lapisan pertahanan tambahan, bukan sebagai satu-satunya
pengaman:

- **Tulis-menulis data sensitif** (`profiles`, `products`,
  `payment_methods`, `app_settings`, `stock_entries`, `expenses`,
  `special_incomes`) dilakukan lewat Route Handler Next.js dengan
  `service_role` key, yang memvalidasi role lebih dulu lewat
  `src/lib/supabase/require-role.ts` dan otomatis melewati RLS.
- **Pesanan** ditulis lewat function `SECURITY DEFINER` yang memvalidasi
  role di dalam function itu sendiri.
- `service_role` key **tidak pernah** menyentuh browser: hanya dipakai di
  `src/lib/supabase/server.ts` (`createAdminClient`) yang cuma diimpor
  dari `route.ts` dan Server Component, tidak pernah dari file
  `"use client"`.

RLS diaktifkan di seluruh 12 tabel publik.

### 5.2 Policy SELECT per tabel

| Tabel | Siapa boleh membaca |
| --- | --- |
| `profiles` | Profil sendiri (`id = auth.uid()`) atau staf (`is_staff()`) |
| `app_settings` | **Tidak ada policy sama sekali** — lihat 5.3 |
| `payment_methods` | Semua pengguna yang sudah login |
| `categories` | Semua pengguna yang sudah login |
| `products` | Semua pengguna yang sudah login |
| `orders` | Pesanan sendiri (`user_id = auth.uid()`) atau staf |
| `stock_entries` | Staf |
| `stock_writeoffs` | Staf |
| `expenses` | Admin |
| `special_incomes` | Admin |
| `saved_customers` | Staf |
| `activity_logs` | Admin |

### 5.3 Kenapa `app_settings` tidak punya policy

Tabel ini menyimpan PIN kasir dalam bentuk plaintext (disengaja, supaya
admin selalu bisa melihat & mengubahnya tanpa risiko lupa). Karena RLS
aktif tapi tidak ada satu pun policy, tidak ada role biasa yang bisa
membacanya — baik `anon` maupun `authenticated`, termasuk kasir sendiri.
Akses hanya lewat route server (`service_role`):

- Admin membaca/mengubah PIN lewat `/api/admin/pengaturan`.
- Kasir **memverifikasi** PIN lewat `/api/kasir/verify-pin`, yang hanya
  menjawab benar/salah — nilai PIN-nya tidak pernah dikirim ke browser.

### 5.4 Lapisan di luar database

- **Middleware** (`src/middleware.ts`) memeriksa sesi, status akun, mode
  lockdown, dan cookie `kasir_unlocked` **sebelum** halaman kasir mana
  pun sempat merender atau mengambil data — jadi selama PIN belum benar,
  tidak ada konten yang bisa dibongkar lewat Inspect Element.
- **Halaman pesan pelanggan** hanya menyeleksi kolom yang perlu, tanpa
  `modal`, supaya harga pokok tidak pernah terkirim ke browser pelanggan.
- **Endpoint cron** (`/api/cron/*`) tidak punya sesi Supabase, jadi
  diproteksi token `CRON_SECRET` lewat header `Authorization: Bearer`.
  Sifatnya *fail closed*: kalau `CRON_SECRET` kosong, endpoint dianggap
  tidak terautentikasi sama sekali.

---

## 6. Setup Google OAuth

1. Google Cloud Console → **APIs & Services → Credentials** → buat
   **OAuth client ID** tipe **Web application**.
2. **Authorized redirect URIs**: isi dengan URL callback **Supabase**,
   bukan URL aplikasi kamu:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   Supabase-lah yang menyelesaikan proses OAuth, lalu melempar balik ke
   `/auth/callback` di aplikasi.
3. Salin Client ID & Client Secret ke Supabase ([bagian 3.2](#32-aktifkan-google-sebagai-provider)).

---

## 7. Environment variables

Salin `.env.example` menjadi `.env`, lalu isi nilainya:

```bash
cp .env.example .env
```

Isi lengkapnya:

```ini
# --- Supabase (wajib) ---
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# --- Prisma Migrate (wajib hanya kalau memakai npm run db:migrate) ---
# DATABASE_URL -> Connection pooling (port 6543)
# DIRECT_URL   -> Connection string langsung (port 5432); dipakai untuk DDL
DATABASE_URL="postgresql://postgres:...@...:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:...@...:5432/postgres"

# --- Identitas & URL aplikasi ---
NEXT_PUBLIC_APP_NAME="Zen's Kantin"
APP_URL="http://localhost:3000"

# --- Mode pemeliharaan ---
APP_LOCKDOWN=false

# --- Email (opsional) ---
GMAIL_USER="akun@gmail.com"
GMAIL_APP_PASSWORD="xxxxxxxxxxxxxxxx"

# --- Cron (opsional) ---
CRON_SECRET="hasil dari: openssl rand -hex 32"
```

| Variabel | Keterangan |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari Project Settings → API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon public key; dipakai di browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Jangan pernah** dipakai di kode client. Sudah diisolasi di `src/lib/supabase/server.ts`. |
| `DATABASE_URL` / `DIRECT_URL` | Hanya untuk Prisma Migrate; tidak dipakai saat aplikasi berjalan. Semua DDL lewat `DIRECT_URL` (dideklarasikan sebagai `directUrl` di `prisma/schema.prisma`), jadi variabel itulah yang wajib memakai koneksi langsung port `5432` — transaction pooler tidak mendukung DDL. |
| `NEXT_PUBLIC_APP_NAME` | Nama/brand di seluruh UI — judul tab, halaman login/onboarding, sidebar, dan hasil ekspor laporan. |
| `APP_URL` | URL publik tanpa slash di akhir; dipakai untuk tautan absolut di dalam email. Kalau kosong, email tetap terkirim tanpa tombol tautan. |
| `APP_LOCKDOWN` | `true` mematikan seluruh akses aplikasi dan mengarahkan semua request ke halaman pemeliharaan. Butuh restart/redeploy agar terbaca. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP Gmail untuk email otomatis. Kalau kosong, fitur email nonaktif diam-diam (dicatat di log server) dan fitur lain tetap normal. |
| `CRON_SECRET` | Token untuk `/api/cron/*`. Kalau kosong, endpoint cron menolak semua request. |

**Mendapatkan `GMAIL_APP_PASSWORD`** (bukan password Gmail biasa):

1. Aktifkan [Verifikasi 2 Langkah](https://myaccount.google.com/signinoptions/two-step-verification)
   di akun Gmail pengirim.
2. Buka [App Passwords](https://myaccount.google.com/apppasswords), buat
   App Password baru dengan app **Mail**.
3. Salin 16 karakter yang muncul (boleh dengan atau tanpa spasi).

---

## 8. Install & jalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

Skrip lain yang tersedia:

```bash
npm run build          # build produksi
npm run start          # jalankan hasil build
npm run lint           # ESLint
npm run db:migrate     # prisma migrate deploy
npm run db:migrate:dev # prisma migrate dev
npm run db:generate    # prisma generate
npm run db:seed        # isi data dummy (lihat bagian 10)
```

---

## 9. Membuat akun admin pertama

1. Jalankan aplikasi, klik **Masuk dengan Google**, selesaikan onboarding
   (nama, username, password). Akun ini otomatis `pelanggan` / `pending`.
2. Di Supabase SQL Editor:
   ```sql
   update profiles set role = 'admin', status = 'active'
   where email = 'email_kamu@gmail.com';
   ```
3. Login ulang atau refresh — kamu akan diarahkan ke `/admin`.
4. Dari **Admin → Pengguna** kamu bisa mempromosikan akun lain menjadi
   `kasir`, dan dari **Admin → Approval Pendaftaran** menyetujui
   pendaftaran pelanggan baru.
5. Ganti PIN kasir default (`8888`) di **Admin → Pengaturan**.

---

## 10. Mengisi data dummy (opsional)

Untuk melihat aplikasi dengan data yang sudah "ramai" (demo/testing,
bukan produksi):

```bash
npm run db:seed
```

`scripts/seed.mjs` membaca `NEXT_PUBLIC_SUPABASE_URL` &
`SUPABASE_SERVICE_ROLE_KEY` dari `.env`, lalu membuat kategori, puluhan
produk, ratusan akun kasir/pelanggan sungguhan yang bisa langsung dipakai
login, riwayat stok masuk, ribuan pesanan tersebar beberapa bulan
terakhir, pengeluaran/pemasukan khusus, dan log aktivitas.

Semua akun dummy memakai password **`password123`** dengan email
berdomain palsu `@seed.zenskantin.local` supaya jelas dibedakan dari akun
asli. Username tiap akun ditampilkan di akhir output skrip.

Kategori, metode pembayaran, dan produk aman dijalankan berkali-kali
(tidak terduplikasi). Pengguna, pesanan, stok, arus kas khusus, dan log
akan **terus bertambah** tiap dijalankan — jalankan sekali saja kalau
tidak mau datanya menumpuk. Jumlah data diatur lewat `CONFIG` di awal
`scripts/seed.mjs`.

---

## 11. Email & cron (opsional)

### Email otomatis

Kalau `GMAIL_USER` & `GMAIL_APP_PASSWORD` terisi, aplikasi mengirim email
untuk: status akun disetujui/diblokir (ke klien), pendaftaran akun baru
(ke admin), dan laporan bulanan (ke admin). Implementasinya di
`src/lib/mail.ts` dan `src/lib/mail-templates.ts`.

### Endpoint cron

Dua endpoint dipanggil dari cron **sistem** (crontab di server), bukan
dari browser, dan diproteksi `CRON_SECRET`:

| Endpoint | Kegunaan |
| --- | --- |
| `/api/cron/cleanup-orphan-images` | Menghapus file di Storage yang tidak lagi dirujuk data mana pun. |
| `/api/cron/monthly-report` | Mengirim laporan bulanan ke admin lewat email. |

Contoh crontab:

Keduanya hanya menerima **POST**:

```cron
# Bersihkan gambar tak terpakai tiap hari jam 03:00
0 3 * * * curl -fsS -X POST https://domain-kamu.com/api/cron/cleanup-orphan-images -H "Authorization: Bearer TOKEN_CRON_SECRET_KAMU"

# Laporan bulanan tiap tanggal 1 jam 07:00
0 7 1 * * curl -fsS -X POST https://domain-kamu.com/api/cron/monthly-report -H "Authorization: Bearer TOKEN_CRON_SECRET_KAMU"
```

Laporan bulanan juga bisa dikirim manual kapan saja dari **Admin →
Pengaturan**.

---

## 12. Keputusan desain

- **Login username/password tetap 100% Supabase Auth.** Password disimpan
  di Supabase Auth lewat `service_role` saat onboarding, bukan di tabel
  sendiri. Login berikutnya menerjemahkan username → email lewat
  `get_email_by_username`, lalu `signInWithPassword` biasa.
- **Seluruh proses login dikerjakan di satu route server**
  (`/api/auth/login`): cek jeda, resolusi username, verifikasi password,
  dan pencatatan log (sukses maupun gagal) terjadi dalam satu request.
  Sebelumnya login dilakukan di browser lalu log dikirim lewat fetch
  terpisah, dan fetch itu sering gagal diam-diam karena cookie sesi belum
  sempat tersinkron. Token sesi dikembalikan ke client untuk
  `setSession()`, jadi tidak ada lagi ketergantungan pada timing cookie.
- **Kegagalan sistem dibedakan dari kredensial salah.** Error dari RPC
  maupun `signInWithPassword` diperiksa eksplisit; hanya status 400
  (`invalid_credentials`) yang dihitung sebagai percobaan gagal dan
  memakan jatah jeda. Masalah lain dijawab sebagai error 500 dengan pesan
  jelas dan dicatat ke log server, supaya pengguna tidak dituduh salah
  password — dan tidak ikut terkunci — gara-gara masalah infrastruktur.
- **Sesi 30 hari**: cookie sesi di-set `maxAge` 30 hari di
  `src/lib/supabase/{server,middleware}.ts`. Samakan dengan Refresh Token
  Expiry di dashboard Supabase supaya konsisten sampai level server.
- **PIN kasir plaintext**, disengaja — lihat [5.3](#53-kenapa-app_settings-tidak-punya-policy).
- **Kunci layar kasir adalah route terpisah**, bukan overlay. Overlay
  bisa dihapus lewat Inspect Element dan kontennya sudah terlanjur
  ter-render di belakangnya; dengan route terpisah + middleware, konten
  itu tidak pernah ikut ter-render sama sekali.
- **Log aktivitas dicatat di level aplikasi**, lewat helper terpusat
  `src/lib/activity-log.ts` — bukan trigger database, yang tidak punya
  akses ke request HTTP. Helper ini mengambil IP dari `x-forwarded-for`,
  lokasi dari header geo Vercel atau fallback lookup ke `ipapi.co`, dan
  perangkat dari User-Agent. Semuanya best-effort: gagal mengambil lokasi
  tidak menggagalkan aksi utamanya.
- **Realtime selalu punya cadangan.** Token akses browser berganti tiap
  ±1 jam tapi koneksi realtime Supabase tidak otomatis diberi tahu dan
  bisa diam-diam berhenti menerima event — karena itu ada polling
  cadangan dan tombol Refresh manual di halaman kasir & katalog produk.
- **Untung/rugi**: Pendapatan dihitung dari pesanan yang **sudah lunas**
  (`status_pembayaran = 'paid'`), sedangkan **modal dihitung sejak
  pesanan dibuat** — termasuk yang belum dibayar — supaya kerugian dari
  pesanan "kecolongan" langsung terlihat.
- **Modal produk tidak diinput manual**, sepenuhnya berasal dari total
  harga beli di Input Stok (modal per item = total ÷ jumlah).
- **Gambar dikompres di browser** (maks 1024px, JPEG 72%) sebelum
  diunggah lewat `src/lib/image-compress.ts`, supaya storage tidak cepat
  penuh. Semua tersimpan sebagai URL publik yang bisa dibuka/diunduh
  langsung dari datatable.
- **Font di-host sendiri** lewat `next/font/local` (berkas `.ttf` di
  `src/fonts/`, lisensi OFL disertakan), bukan `next/font/google`. Versi
  Google mewajibkan proses build menjangkau `fonts.googleapis.com` setiap
  kali layout dikompilasi ulang; di jaringan yang memblokir domain itu,
  kompilasi gagal berulang. Sekarang build & `next dev` berhasil total
  offline.
- **Ekspor Excel memakai `xlsx-js-style`**, bukan paket `xlsx` dari npm
  registry (yang punya kerentanan high severity tanpa versi tertambal di
  registry).
- **Next.js dipertahankan di 14.2.35**, patch terakhir untuk jalur 14.x
  yang menutup CVE-2025-55183/55184/67779. Perlu diketahui: Next.js 14
  sudah End-of-Life sejak Oktober 2025, jadi rilis keamanan berikutnya
  hanya akan sampai ke 15.x/16.x. Migrasi ke sana melibatkan breaking
  changes (API async, dsb.) yang sebaiknya dikerjakan & diuji terpisah.
  Alasan yang sama berlaku untuk jsPDF 2→4 dan jspdf-autotable 3→5 yang
  masih muncul di `npm audit`.

---

## 13. Struktur folder

```
src/
  app/
    login/ onboarding/ pending/ blocked/ auth/callback/  -> alur autentikasi
    order/                                               -> halaman pelanggan
    kasir/
      (protected)/  page.tsx, produk/                    -> halaman kasir
      lock/                                              -> layar kunci PIN
                                                            (route terpisah,
                                                             di luar grup
                                                             (protected))
    admin/        dashboard, users, approval, produk, kategori,
                  pembayaran, pesanan, stok, laporan, pengeluaran,
                  pemasukan, pelanggan, log, file-manager, pengaturan
    maintenance/ forbidden/                              -> halaman status
    api/                                                 -> Route Handlers
      auth/ admin/ kasir/ orders/ stok/ pelanggan/ export/ cron/
  components/
    ui/            -> primitif shadcn/ui (button, table, dialog, dst)
    shared/        -> DataTable generik, Combobox, image-upload, dst
    admin/ kasir/  -> shell & layout khusus role
  lib/
    supabase/      -> client browser/server/middleware + helper requireRole
    activity-log.ts-> pencatatan log terpusat (IP/lokasi/perangkat)
    constants.ts   -> konstanta bersama (jenis aksi log, ambang jeda login)
    table-query.ts -> pagination/pencarian/urut sisi server untuk DataTable
    cron-auth.ts   -> verifikasi CRON_SECRET
    excel.ts pdf.ts-> ekspor laporan
    mail.ts mail-templates.ts monthly-report.ts -> email
    file-manager.ts image-compress.ts utils.ts
  hooks/           -> use-idle-timer (kunci PIN kasir), use-realtime-orders
  fonts/           -> berkas font self-hosted + lisensi OFL
  middleware.ts    -> gerbang sesi, status akun, lockdown, kunci kasir
prisma/
  schema.prisma    -> model tabel (dokumentasi + prisma generate)
  migrations/      -> satu migrasi gabungan, isinya identik dengan schema.sql
supabase/migrations/
  schema.sql       -> seluruh skema, satu file, satu definisi per objek
scripts/
  seed.mjs         -> seeder data dummy
```

---

## 14. Deploy

Cara termudah: deploy ke [Vercel](https://vercel.com).

1. Tambahkan seluruh environment variable dari
   [bagian 7](#7-environment-variables) di project settings — kecuali
   `DATABASE_URL`/`DIRECT_URL` yang hanya dibutuhkan saat menjalankan
   migrasi.
2. Set `APP_URL` ke domain produksi (tanpa slash di akhir).
3. Tambahkan `https://domain-kamu.com/auth/callback` ke Redirect URL
   Supabase ([bagian 3.3](#33-redirect-url)).
4. Untuk Google, biasanya cukup satu Authorized redirect URI ke callback
   Supabase — Supabase yang menjembatani OAuth-nya.
5. Kalau ingin memakai cron, siapkan crontab di server mana pun yang bisa
   menjangkau domain produksi ([bagian 11](#11-email--cron-opsional)).

---

## 15. Troubleshooting

### Login Google berhasil, tapi login username/password selalu gagal

Gejala khasnya: pesan "Username atau password salah" atau "Tidak bisa
terhubung ke server saat memproses login" padahal kredensialnya benar,
sementara tombol **Masuk dengan Google** berfungsi normal. Google tidak
terpengaruh karena jalurnya tidak pernah memanggil
`get_email_by_username`.

Penyebab paling umum: role `service_role` tidak punya izin `execute` atas
function itu, sehingga route login server-side ditolak dengan
`42501 permission denied for function get_email_by_username`. Ini terjadi
kalau database pernah diinisialisasi dengan versi `schema.sql` yang
menjalankan `revoke all ... from public` tanpa ikut memberi grant ke
`service_role`.

Perbaikannya, jalankan sekali di **SQL Editor**:

```sql
grant execute on function get_email_by_username(text) to service_role;
```

Menjalankan ulang `schema.sql` yang sekarang juga sudah memperbaikinya.

Kalau masih gagal, periksa berurutan:

1. `SUPABASE_SERVICE_ROLE_KEY` benar-benar service_role key milik project
   yang sama dengan `NEXT_PUBLIC_SUPABASE_URL` (bukan anon key, bukan key
   dari project lain).
2. Akun yang dipakai punya baris di `profiles` dengan `username` dan
   `email` terisi:
   ```sql
   select username, email, role, status from profiles where username = 'username_kamu';
   ```
3. Log server (`console`) — kegagalan sistem dicatat dengan prefix
   `[api/auth/login]` beserta pesan aslinya.

### "Terlalu banyak percobaan gagal" padahal baru sekali salah

Jeda dihitung dari `activity_logs` per username: 5 percobaan gagal dalam
5 menit. Kalau sebelumnya ada kegagalan beruntun (termasuk akibat masalah
di atas), tunggu sampai jendela 5 menit lewat, atau bersihkan catatannya:

```sql
delete from activity_logs
where aksi = 'login_gagal' and nama_user = 'username_kamu';
```

### "permission denied for schema public" saat menjalankan `schema.sql`

Sejak PostgreSQL 15, hak `CREATE` di schema `public` tidak lagi otomatis
diberikan ke semua role. Kalau koneksi yang menjalankan `schema.sql`
bukan pemilik schema `public`, semua `create table`/`create function`
ditolak dengan pesan ini.

Paling sering terjadi lewat Prisma Migrate (`npm run db:migrate`) kalau
`DIRECT_URL` kosong atau menunjuk ke **Transaction pooler** (port `6543`)
— mode ini memang tidak mendukung DDL. Buka **Project Settings → Database
→ Connection string** dan isi `DIRECT_URL` dengan **Session pooler** atau
**Direct connection** (port `5432`).

Kalau masih muncul juga — termasuk saat paste langsung di SQL Editor yang
seharusnya berjalan sebagai role `postgres` — biasanya kepemilikan schema
`public` sempat berubah (project pernah di-restore dari backup, atau
self-hosted dengan skrip inisialisasi berbeda). Jalankan sekali, lalu
ulangi `schema.sql`:

```sql
grant all on schema public to postgres;
```

### Prisma bilang riwayat migrasinya "menyimpang"

Terjadi kalau database pernah dimigrasi dengan folder migrasi versi
sebelumnya. Tandai migrasi gabungan sebagai sudah diterapkan — perintah
ini tidak menjalankan SQL apa pun:

```bash
npx prisma migrate resolve --applied 20260826000001_consolidated
```

### Pesanan di kasir terasa "macet" / tidak update

Koneksi realtime Supabase bisa berhenti diam-diam saat token akses
browser diperbarui. Aplikasi sudah punya polling cadangan, tapi kamu bisa
menekan tombol **Refresh** di halaman kasir kapan saja. Pastikan juga
tabel `orders` & `products` ada di publication `supabase_realtime`
(**Database → Replication**).

### Email tidak terkirim

Fitur email nonaktif diam-diam kalau `GMAIL_USER` atau
`GMAIL_APP_PASSWORD` kosong — fitur lain tetap berjalan normal dan
kegagalannya dicatat di log server. Pastikan yang dipakai adalah **App
Password** 16 karakter, bukan password akun Gmail biasa
([bagian 7](#7-environment-variables)).

### Log aktivitas tidak terhapus otomatis tiap bulan

Berarti extension `pg_cron` tidak aktif di project Supabase kamu.
Aktifkan lewat **Database → Extensions** lalu jalankan ulang
`schema.sql`, atau pakai tombol **Reset Log** manual di Admin → Log
Aktivitas.

---

Dibuat dengan Next.js, shadcn/ui, dan Supabase. Selamat mengelola kantin! 🍱
