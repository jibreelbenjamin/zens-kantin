import type { Role, UserStatus, PaymentStatusType } from "@/lib/constants";

export type Profile = {
  id: string;
  email: string | null;
  nama: string;
  username: string;
  google_id: string | null;
  role: Role;
  status: UserStatus;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = {
  id: string;
  nama: string;
  is_active: boolean;
  tampilkan_info_pembayaran: boolean;
  tampilkan_teks: boolean;
  info_teks: string | null;
  tampilkan_gambar: boolean;
  info_gambar_url: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  nama: string;
  created_at: string;
};

export type Product = {
  id: string;
  nama: string;
  gambar_url: string | null;
  stok: number;
  modal: number;
  harga_jual: number;
  is_active: boolean;
  kategori_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  group_id: string;
  user_id: string | null;
  nama_pemesan: string;
  produk_id: string | null;
  nama_produk: string;
  qty: number;
  modal_satuan: number;
  harga_satuan: number;
  modal_total: number;
  harga_total: number;
  pembayaran_id: string | null;
  nama_pembayaran: string | null;
  status_pembayaran: PaymentStatusType;
  bukti_bayar_url: string | null;
  kasir_id: string | null;
  catatan: string | null;
  disampingkan: boolean;
  dikonfirmasi_pelanggan: boolean;
  dikonfirmasi_pelanggan_at: string | null;
  created_at: string;
  paid_at: string | null;
};

export type StockEntry = {
  id: string;
  user_id: string | null;
  produk_id: string | null;
  nama_produk: string;
  total_beli: number;
  qty: number;
  remaining_qty: number;
  harga_beli_satuan: number;
  gambar_url: string | null;
  created_at: string;
};

export type StockWriteoff = {
  id: string;
  user_id: string | null;
  produk_id: string | null;
  nama_produk: string;
  qty: number;
  kembalikan_kerugian: boolean;
  kerugian: number;
  keterangan: string | null;
  created_at: string;
};

export type SavedCustomer = {
  id: string;
  nama: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  user_id: string | null;
  nama_user: string | null;
  aksi: string;
  deskripsi: string | null;
  ip_address: string | null;
  user_agent: string | null;
  perangkat: string | null;
  kota: string | null;
  wilayah: string | null;
  negara: string | null;
  created_at: string;
};

export type AppSetting = {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
};

export type Expense = {
  id: string;
  user_id: string | null;
  nama: string;
  nominal: number;
  keterangan: string | null;
  gambar_url: string | null;
  created_at: string;
};

export type SpecialIncome = {
  id: string;
  user_id: string | null;
  nama: string;
  nominal: number;
  keterangan: string | null;
  gambar_url: string | null;
  created_at: string;
};

/**
 * Hasil `get_period_stats` (RPC) / `/api/export` — dipakai bareng oleh
 * kartu statistik Dashboard (bulan berjalan) & Laporan (periode pilihan).
 * `saldo` KUMULATIF sejak awal s/d akhir periode (bukan cuma dalam
 * rentang periode seperti kolom lain) — lihat catatan di migrasi v11.
 */
export type PeriodStats = {
  modal: number;
  pendapatan: number;
  pengeluaran: number;
  kerugian_stok: number;
  pemasukan_khusus: number;
  untung: number;
  saldo: number;
  pendapatan_pending: number;
  jumlah_pesanan: number;
  jumlah_pending: number;
  jumlah_dibatalkan: number;
};

export const EMPTY_PERIOD_STATS: PeriodStats = {
  modal: 0, pendapatan: 0, pengeluaran: 0, kerugian_stok: 0, pemasukan_khusus: 0,
  untung: 0, saldo: 0, pendapatan_pending: 0,
  jumlah_pesanan: 0, jumlah_pending: 0, jumlah_dibatalkan: 0,
};
