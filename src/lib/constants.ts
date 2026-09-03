// Nama/brand aplikasi — diambil dari env NEXT_PUBLIC_APP_NAME (lihat
// .env.example) supaya siapa pun yang deploy ulang aplikasi ini bisa ganti
// nama tanpa harus menyunting kode di banyak tempat. "Zen's Kantin" cuma
// nilai bawaan kalau env-nya tidak diisi.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Zen's Kantin";

export const ROLES = ["admin", "kasir", "pelanggan"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUS = ["active", "pending", "block"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

// "tidak_dibayar" dipertahankan di sini (v8, dipensiunkan di v10) — bukan
// dihapus total — supaya baris pesanan LAMA yang sudah kadung berstatus itu
// tetap valid secara tipe & tetap tampil rapi (lihat StatusBadge). Fitur
// untuk MEMBUAT status baru ini sudah dihapus total dari UI & API (lihat
// /api/orders/[id]/status), jadi tidak akan ada baris baru dengan status ini.
export const PAYMENT_STATUS = ["pending", "paid", "cancelled", "tidak_dibayar"] as const;
export type PaymentStatusType = (typeof PAYMENT_STATUS)[number];

// Batas idle kasir sebelum layar dikunci PIN (ms)
export const KASIR_IDLE_LOCK_MS = 3 * 60 * 1000;

// Nama cookie penanda kasir sudah memasukkan PIN dengan benar (HttpOnly,
// diset oleh /api/kasir/verify-pin, dihapus oleh /api/kasir/lock atau
// saat idle timeout). Umurnya mengikuti interval kunci yang admin atur
// (lihat get_lock_interval_minutes), jadi tetap otomatis terkunci lagi
// kalau memang tidak dipakai — bukan cuma "sekali PIN, selamanya login".
export const KASIR_UNLOCK_COOKIE = "kasir_unlocked";

// Jeda PIN kasir setelah terlalu banyak percobaan gagal — DIHITUNG SERVER-
// SIDE dari baris activity_logs beraksi KASIR_PIN_GAGAL, per user_id akun
// yang SEDANG LOGIN (bukan per alamat IP — satu warung/tablet kasir bisa
// berbagi IP/WiFi yang sama, jadi kalau dikunci per-IP satu kasir yang lupa
// PIN bisa ikut mengunci kasir lain di jaringan yang sama; dan BUKAN di
// localStorage — localStorage cuma kesepakatan di browser itu sendiri,
// gampang di-bypass dengan clear storage / mode incognito / panggil
// endpoint verify-pin langsung tanpa lewat UI). Lihat /api/kasir/verify-pin.
export const KASIR_PIN_LOCKOUT_WINDOW_MINUTES = 5;
export const KASIR_PIN_LOCKOUT_MAX_ATTEMPTS = 5;

// Umur sesi login (dipakai untuk cookie & pengingat di UI)
export const SESSION_MAX_AGE_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;

export const STORAGE_BUCKET = "kantin-images";

// Jeda login setelah terlalu banyak percobaan gagal (brute-force protection).
// Dihitung dari baris activity_logs beraksi LOGIN_GAGAL dalam jendela waktu
// ini — HANYA per username yang dicoba (v18: sebelumnya juga per alamat IP,
// dihapus karena 1) IP publik bisa dipakai bersama banyak orang di satu
// jaringan/WiFi/NAT, jadi lockout per-IP bisa ikut mengunci pengguna lain
// yang tidak salah apa-apa, dan 2) IP gampang berganti-ganti/dipalsukan
// lewat proxy, jadi tidak benar-benar menambah keamanan). Lihat /api/auth/login.
export const LOGIN_LOCKOUT_WINDOW_MINUTES = 5;
export const LOGIN_LOCKOUT_MAX_ATTEMPTS = 5;

export const ACTIVITY_ACTIONS = {
  LOGIN: "login",
  LOGIN_GAGAL: "login_gagal",
  LOGOUT: "logout",
  DAFTAR: "daftar",
  PROFIL_UBAH: "profil_ubah",
  USER_STATUS: "user_status_ubah",
  USER_ROLE: "user_role_ubah",
  USER_RESET_PASSWORD: "user_reset_password",
  PESANAN_MASUK: "pesanan_masuk",
  PEMBAYARAN: "pembayaran",
  PESANAN_DIBATALKAN: "pesanan_dibatalkan",
  PESANAN_TIDAK_DIBAYAR: "pesanan_tidak_dibayar",
  PESANAN_DISAMPINGKAN: "pesanan_disampingkan",
  KLAIM_BAYAR: "klaim_bayar",
  STOK_MASUK: "stok_masuk",
  STOK_DITARIK: "stok_ditarik",
  STOK_DIHAPUS: "stok_dihapus",
  STOK_HAPUS_DIBATALKAN: "stok_hapus_dibatalkan",
  PRODUK_TAMBAH: "produk_tambah",
  PRODUK_UBAH: "produk_ubah",
  PRODUK_HAPUS: "produk_hapus",
  KATEGORI_UBAH: "kategori_ubah",
  METODE_PEMBAYARAN: "metode_pembayaran_ubah",
  PENGATURAN_UBAH: "pengaturan_ubah",
  PENGELUARAN_KHUSUS: "pengeluaran_khusus",
  PEMASUKAN_KHUSUS: "pemasukan_khusus",
  PELANGGAN_TAMBAH: "pelanggan_tambah",
  PELANGGAN_HAPUS: "pelanggan_hapus",
  EXPORT_DATA: "export_data",
  FILE_HAPUS: "file_hapus",
  FILE_BERSIH_OTOMATIS: "file_bersih_otomatis",
  KASIR_PIN_GAGAL: "kasir_pin_gagal",
  KASIR_DIBUKA: "kasir_dibuka",
  KASIR_DIKUNCI: "kasir_dikunci",
  LAPORAN_BULANAN_DIKIRIM: "laporan_bulanan_dikirim",
} as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];
