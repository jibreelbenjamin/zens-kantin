#!/usr/bin/env node
// =====================================================================
// Zen's Kantin — Seeder data dummy dalam jumlah besar
// =====================================================================
// Mengisi database dengan data contoh yang REALISTIS & BANYAK — bukan
// cuma 2-3 baris asal-asalan — supaya dashboard, laporan, dan grafik
// langsung terlihat "hidup" seperti kantin yang sudah lama berjalan:
// puluhan produk, ratusan pengguna (kasir & pelanggan) dengan akun LOGIN
// SUNGGUHAN (lewat Supabase Auth, bukan cuma baris di tabel profiles),
// ribuan pesanan tersebar beberapa bulan ke belakang, riwayat stok masuk
// yang konsisten dengan stok akhir tiap produk, pengeluaran/pemasukan
// khusus, dan log aktivitas.
//
// CARA PAKAI
//   npm run db:seed
//   (atau langsung: node scripts/seed.mjs)
//
// Baca env dari .env / .env.local di root project — butuh minimal:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// (persis dua variabel yang sama dipakai aplikasi lewat createAdminClient()).
//
// SEMUA akun dummy yang dibuat memakai password yang SAMA — lihat
// CONFIG.DEFAULT_PASSWORD di bawah — supaya gampang dipakai coba-coba
// login sebagai kasir/pelanggan mana saja. Emailnya memakai domain
// "@seed.zenskantin.local" (tidak nyata & tidak akan dikirimi email apa
// pun) supaya gampang dibedakan dari akun asli.
//
// SIFAT SKRIP INI:
//   - Kategori, metode pembayaran, & produk: AMAN dijalankan berkali-kali
//     — yang sudah ada (dicocokkan lewat nama) TIDAK diduplikasi, cuma
//     yang belum ada yang ditambahkan.
//   - Pengguna, stok masuk, pesanan, pengeluaran, pemasukan, & log:
//     SELALU MENAMBAH data baru setiap dijalankan (tidak dicek duplikat)
//     — ini memang cara kerja normal seeder untuk data transaksi/riwayat.
//     Jalankan sekali saja kalau tidak mau datanya menumpuk terus.
// =====================================================================

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// 0. Muat .env / .env.local (tanpa dependency tambahan)
// ---------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

function loadEnvFile(filePath, { override = false } = {}) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (override || !(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(PROJECT_ROOT, ".env"));
loadEnvFile(path.join(PROJECT_ROOT, ".env.local"), { override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Sama seperti APP_NAME di src/lib/constants.ts — dipakai di pesan console
// biar konsisten kalau aplikasinya sudah di-rebrand lewat env ini.
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Zen's Kantin";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[seed] NEXT_PUBLIC_SUPABASE_URL dan/atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan.\n" +
      "        Pastikan file .env (lihat .env.example) sudah diisi di root project."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------
// 1. Konfigurasi jumlah data — ubah di sini kalau mau lebih besar/kecil
// ---------------------------------------------------------------------
const CONFIG = {
  MONTHS_BACK: 5, // rentang tanggal data historis (dari N bulan lalu s/d hari ini)
  KASIR_COUNT: 6,
  PELANGGAN_COUNT: 130,
  STOCK_ENTRIES_PER_PRODUCT: { min: 3, max: 7 },
  ORDER_GROUPS: 2200, // jumlah "transaksi" (satu checkout bisa berisi beberapa item)
  ITEMS_PER_GROUP: { min: 1, max: 3 },
  QTY_PER_ITEM: { min: 1, max: 4 },
  EXPENSE_COUNT: 70,
  INCOME_COUNT: 45,
  EXTRA_SAVED_CUSTOMERS: 20,
  ACTIVITY_LOG_SAMPLE_CAP: 500,
  DEFAULT_PASSWORD: "password123",
  BATCH_SIZE: 500,
  DB_CONCURRENCY: 8,
};

// ---------------------------------------------------------------------
// 2. Helper umum: RNG, tanggal, batching, konkurensi
// ---------------------------------------------------------------------
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}
function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function weightedPick(options) {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) {
    if (r < o.weight) return o.value;
    r -= o.weight;
  }
  return options[options.length - 1].value;
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return results;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

const NOW = new Date();
const RANGE_START = new Date(NOW);
RANGE_START.setMonth(RANGE_START.getMonth() - CONFIG.MONTHS_BACK);

function randomDayInRange() {
  const t = randomInt(RANGE_START.getTime(), NOW.getTime());
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Jam operasional kantin, dibobotkan lebih padat di jam makan siang —
// supaya sebaran waktu pesanan terlihat wajar, bukan rata sepanjang hari.
const HOUR_WEIGHTS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => ({
  value: h,
  weight: h === 12 ? 14 : h === 11 || h === 13 ? 10 : h === 10 || h === 14 ? 6 : h === 9 || h === 15 ? 4 : 2,
}));
function randomBusinessTimestamp(day) {
  const d = new Date(day);
  d.setHours(weightedPick(HOUR_WEIGHTS), randomInt(0, 59), randomInt(0, 59), 0);
  return d;
}

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_]/g, "");
}
function randomSuffix(len = 4) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[randomInt(0, chars.length - 1)];
  return s;
}
function makeUsername(nama) {
  const base = slugify(nama).slice(0, 18) || "user";
  return `${base}_${randomSuffix(4)}`.slice(0, 24);
}

// ---------------------------------------------------------------------
// 3. Data referensi — nama, kategori, produk, dsb (khas kantin Indonesia)
// ---------------------------------------------------------------------
const FIRST_NAMES = [
  "Budi", "Siti", "Andi", "Dewi", "Agus", "Rina", "Eko", "Wulan", "Hendra", "Nita",
  "Rizky", "Putri", "Fajar", "Ayu", "Yusuf", "Indah", "Bayu", "Sri", "Dedi", "Lina",
  "Arif", "Nia", "Wahyu", "Fitri", "Doni", "Ratna", "Irfan", "Melati", "Taufik", "Yuni",
  "Hadi", "Diah", "Rian", "Sinta", "Anto", "Vina", "Fauzi", "Intan", "Gilang", "Maya",
  "Yoga", "Citra", "Rendra", "Wati", "Ilham", "Sari", "Adi", "Novi", "Reza", "Tika",
  "Dimas", "Retno", "Bagus", "Yulia", "Krisna", "Asri", "Surya", "Devi", "Rangga", "Nurul",
];
const LAST_NAMES = [
  "Saputra", "Wijaya", "Kusuma", "Pratama", "Santoso", "Wibowo", "Setiawan", "Hidayat",
  "Gunawan", "Susanto", "Permana", "Firmansyah", "Handoko", "Nugraha", "Kurniawan",
  "Ramadhan", "Utomo", "Suryanto", "Yulianto", "Iskandar", "Purnomo", "Prasetyo",
  "Halim", "Rahman", "Siregar", "Simanjuntak", "Situmorang", "Marpaung", "Hutagalung", "Simatupang",
];

function generateUniqueFullNames(count) {
  const combos = shuffle(FIRST_NAMES.flatMap((f) => LAST_NAMES.map((l) => `${f} ${l}`)));
  if (count <= combos.length) return combos.slice(0, count);
  // Kalau butuh lebih banyak dari jumlah kombinasi unik (jarang terjadi,
  // hanya kalau CONFIG di atas diperbesar jauh) — tambahkan angka acak
  // di belakang supaya tetap berbeda satu sama lain.
  const extra = Array.from({ length: count - combos.length }, () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${randomInt(2, 99)}`);
  return [...combos, ...extra];
}

// Nama pelanggan "walk-in" tanpa akun (dipakai kasir langsung saat checkout,
// tersimpan di tabel saved_customers) — sengaja dibuat beda gaya dari nama
// akun terdaftar di atas, supaya kelihatan wajar keduanya hidup berdampingan.
const WALK_IN_NAMES = [
  "Pak Slamet", "Bu Marni", "Pak Joko", "Bu Yanti", "Ujang", "Siti Aminah", "Pak Dulah",
  "Bu Ratih", "Mas Bejo", "Mbak Sri", "Pak Karto", "Bu Painem", "Kang Asep", "Teh Neneng",
  "Pak Bambang", "Bu Suparti", "Mas Wawan", "Mbak Lastri", "Pak Herman", "Bu Sumiati",
  "Kang Dadang", "Teh Ai", "Pak Sugeng", "Bu Kartini",
];

const CATEGORIES = ["Makanan Berat", "Minuman", "Snack & Gorengan", "Dessert", "Mie & Bakso", "Nasi & Lauk", "Roti & Kue"];

// { kategori, nama, harga } — harga jual dalam Rupiah, sudah dibulatkan
// wajar (kelipatan 500) khas harga jajanan kantin.
const PRODUCTS = [
  // Makanan Berat
  { kategori: "Makanan Berat", nama: "Nasi Goreng Spesial", harga: 15000 },
  { kategori: "Makanan Berat", nama: "Nasi Ayam Geprek", harga: 14000 },
  { kategori: "Makanan Berat", nama: "Nasi Rendang", harga: 18000 },
  { kategori: "Makanan Berat", nama: "Ayam Bakar", harga: 16000 },
  { kategori: "Makanan Berat", nama: "Nasi Ayam Penyet", harga: 14500 },
  { kategori: "Makanan Berat", nama: "Sate Ayam", harga: 17000 },
  { kategori: "Makanan Berat", nama: "Nasi Gudeg", harga: 13500 },
  { kategori: "Makanan Berat", nama: "Nasi Padang Rames", harga: 17500 },
  // Minuman
  { kategori: "Minuman", nama: "Es Teh Manis", harga: 4000 },
  { kategori: "Minuman", nama: "Es Jeruk", harga: 5000 },
  { kategori: "Minuman", nama: "Teh Tawar Hangat", harga: 3000 },
  { kategori: "Minuman", nama: "Es Kopi Susu", harga: 8000 },
  { kategori: "Minuman", nama: "Air Mineral", harga: 3500 },
  { kategori: "Minuman", nama: "Jus Alpukat", harga: 9000 },
  { kategori: "Minuman", nama: "Es Cincau", harga: 5000 },
  { kategori: "Minuman", nama: "Susu Coklat Dingin", harga: 7000 },
  // Snack & Gorengan
  { kategori: "Snack & Gorengan", nama: "Tahu Isi", harga: 2000 },
  { kategori: "Snack & Gorengan", nama: "Bakwan Sayur", harga: 2000 },
  { kategori: "Snack & Gorengan", nama: "Risoles", harga: 2500 },
  { kategori: "Snack & Gorengan", nama: "Pisang Goreng", harga: 2500 },
  { kategori: "Snack & Gorengan", nama: "Tempe Mendoan", harga: 2000 },
  { kategori: "Snack & Gorengan", nama: "Cireng", harga: 2000 },
  { kategori: "Snack & Gorengan", nama: "Combro", harga: 2500 },
  { kategori: "Snack & Gorengan", nama: "Lumpia Sayur", harga: 3000 },
  // Dessert
  { kategori: "Dessert", nama: "Es Campur", harga: 9000 },
  { kategori: "Dessert", nama: "Puding Coklat", harga: 6000 },
  { kategori: "Dessert", nama: "Es Buah", harga: 8000 },
  { kategori: "Dessert", nama: "Kolak Pisang", harga: 7000 },
  { kategori: "Dessert", nama: "Es Doger", harga: 8500 },
  { kategori: "Dessert", nama: "Rujak Buah", harga: 7500 },
  { kategori: "Dessert", nama: "Es Krim Goreng", harga: 10000 },
  { kategori: "Dessert", nama: "Klepon", harga: 4000 },
  // Mie & Bakso
  { kategori: "Mie & Bakso", nama: "Mie Ayam Bakso", harga: 13000 },
  { kategori: "Mie & Bakso", nama: "Bakso Urat", harga: 14000 },
  { kategori: "Mie & Bakso", nama: "Mie Goreng Jawa", harga: 12000 },
  { kategori: "Mie & Bakso", nama: "Bakso Beranak", harga: 16000 },
  { kategori: "Mie & Bakso", nama: "Mie Rebus Telur", harga: 11000 },
  { kategori: "Mie & Bakso", nama: "Kwetiau Goreng", harga: 13500 },
  { kategori: "Mie & Bakso", nama: "Mie Ayam Jamur", harga: 13500 },
  { kategori: "Mie & Bakso", nama: "Bakso Tahu", harga: 12500 },
  // Nasi & Lauk
  { kategori: "Nasi & Lauk", nama: "Nasi Uduk", harga: 10000 },
  { kategori: "Nasi & Lauk", nama: "Nasi Kuning", harga: 10500 },
  { kategori: "Nasi & Lauk", nama: "Nasi Pecel", harga: 9500 },
  { kategori: "Nasi & Lauk", nama: "Nasi Campur", harga: 13000 },
  { kategori: "Nasi & Lauk", nama: "Nasi Timbel", harga: 14000 },
  { kategori: "Nasi & Lauk", nama: "Nasi Liwet", harga: 12000 },
  { kategori: "Nasi & Lauk", nama: "Nasi Ayam Suwir", harga: 12500 },
  { kategori: "Nasi & Lauk", nama: "Nasi Sayur Asem", harga: 9000 },
  // Roti & Kue
  { kategori: "Roti & Kue", nama: "Roti Bakar Coklat", harga: 8000 },
  { kategori: "Roti & Kue", nama: "Donat Gula", harga: 3500 },
  { kategori: "Roti & Kue", nama: "Bolu Kukus", harga: 3000 },
  { kategori: "Roti & Kue", nama: "Roti Isi Sosis", harga: 6000 },
  { kategori: "Roti & Kue", nama: "Kue Lapis", harga: 4000 },
  { kategori: "Roti & Kue", nama: "Brownies Kukus", harga: 5000 },
  { kategori: "Roti & Kue", nama: "Roti Unyil", harga: 3000 },
  { kategori: "Roti & Kue", nama: "Pastel Isi", harga: 2500 },
];

const EXTRA_PAYMENT_METHODS = [
  { nama: "Transfer BCA", is_active: true },
  { nama: "Transfer BRI", is_active: true },
  { nama: "GoPay", is_active: true },
  { nama: "OVO", is_active: true },
  { nama: "Dana", is_active: false },
];

const EXPENSE_NAMES = [
  "Sewa Kios Bulanan", "Listrik & Air", "Gaji Kasir", "Beli Galon Air Mineral",
  "Perbaikan Kompor Gas", "Beli Tabung Gas LPG", "Service Kulkas", "Beli Peralatan Masak",
  "Internet & Wifi Kios", "Kebersihan & Sampah", "Seragam Kasir", "Print Struk & ATK",
  "Retribusi Kantin", "Ganti Selang Gas", "Servis Etalase", "Beli Plastik & Kemasan",
];
const INCOME_NAMES = [
  "Sewa Tempat ke Vendor Snack", "Jual Galon Kosong", "Bonus dari Supplier",
  "Titip Jual Produk Lain", "Hasil Jual Peralatan Bekas", "Event Bazar", "Sponsor Acara",
];

// ---------------------------------------------------------------------
// 4. Langkah-langkah seeding
// ---------------------------------------------------------------------

async function ensureCategories() {
  // categories.nama punya unique constraint -> aman pakai upsert
  // ignoreDuplicates supaya baris yang sudah ada tidak disentuh/diduplikasi.
  const rows = CATEGORIES.map((nama) => ({ nama }));
  const { error } = await supabase.from("categories").upsert(rows, { onConflict: "nama", ignoreDuplicates: true });
  if (error) throw new Error(`Gagal membuat kategori: ${error.message}`);

  const { data, error: fetchError } = await supabase.from("categories").select("id, nama").in("nama", CATEGORIES);
  if (fetchError) throw new Error(`Gagal mengambil kategori: ${fetchError.message}`);
  return Object.fromEntries(data.map((c) => [c.nama, c.id]));
}

async function ensurePaymentMethods() {
  // payment_methods.nama TIDAK punya unique constraint di skema, jadi
  // upsert onConflict tidak bisa dipakai di sini — cek manual dulu nama
  // yang sudah ada, baru insert yang belum ada saja.
  const wanted = EXTRA_PAYMENT_METHODS.map((p) => p.nama);
  const { data: existing, error: fetchError } = await supabase.from("payment_methods").select("id, nama, is_active");
  if (fetchError) throw new Error(`Gagal mengambil metode pembayaran: ${fetchError.message}`);

  const existingNames = new Set((existing ?? []).map((p) => p.nama));
  const toInsert = EXTRA_PAYMENT_METHODS.filter((p) => !existingNames.has(p.nama));
  if (toInsert.length) {
    const { error } = await supabase.from("payment_methods").insert(toInsert);
    if (error) throw new Error(`Gagal menambah metode pembayaran: ${error.message}`);
  }

  const { data: all, error: allError } = await supabase.from("payment_methods").select("id, nama, is_active");
  if (allError) throw new Error(`Gagal mengambil metode pembayaran: ${allError.message}`);
  return all;
}

async function ensureProducts(categoryMap) {
  const wantedNames = PRODUCTS.map((p) => p.nama);
  const { data: existing, error: fetchError } = await supabase.from("products").select("id, nama").in("nama", wantedNames);
  if (fetchError) throw new Error(`Gagal mengambil produk: ${fetchError.message}`);

  const existingNames = new Set((existing ?? []).map((p) => p.nama));
  const toInsert = PRODUCTS.filter((p) => !existingNames.has(p.nama)).map((p) => ({
    nama: p.nama,
    harga_jual: p.harga,
    kategori_id: categoryMap[p.kategori] ?? null,
    stok: 0,
    modal: 0,
    is_active: true,
  }));

  if (toInsert.length) {
    const { error } = await supabase.from("products").insert(toInsert);
    if (error) throw new Error(`Gagal menambah produk: ${error.message}`);
  }

  // Ambil ulang SEMUA produk yang relevan (lama + baru) — ini yang dipakai
  // langkah-langkah selanjutnya (stok masuk, pesanan, dst).
  const { data: all, error: allError } = await supabase
    .from("products")
    .select("id, nama, harga_jual, kategori_id, is_active")
    .in("nama", wantedNames);
  if (allError) throw new Error(`Gagal mengambil produk: ${allError.message}`);

  const priceMap = Object.fromEntries(PRODUCTS.map((p) => [p.nama, p.harga]));
  return all.map((p) => ({ ...p, harga_jual: Number(p.harga_jual ?? priceMap[p.nama] ?? 0) }));
}

async function ensureSavedCustomers() {
  const names = shuffle(WALK_IN_NAMES).slice(0, Math.min(CONFIG.EXTRA_SAVED_CUSTOMERS, WALK_IN_NAMES.length));
  const rows = names.map((nama) => ({ nama }));
  const { error } = await supabase.from("saved_customers").upsert(rows, { onConflict: "nama", ignoreDuplicates: true });
  if (error) throw new Error(`Gagal menambah pelanggan tersimpan: ${error.message}`);

  const { data, error: fetchError } = await supabase.from("saved_customers").select("nama");
  if (fetchError) throw new Error(`Gagal mengambil pelanggan tersimpan: ${fetchError.message}`);
  return (data ?? []).map((c) => c.nama);
}

async function fetchExistingActiveProfiles() {
  const { data, error } = await supabase.from("profiles").select("id, nama, username, role").eq("status", "active");
  if (error) throw new Error(`Gagal mengambil profil yang sudah ada: ${error.message}`);
  const list = data ?? [];
  return {
    kasirAdmin: list.filter((p) => p.role === "kasir" || p.role === "admin"),
    pelanggan: list.filter((p) => p.role === "pelanggan"),
  };
}

/**
 * Buat SATU akun dummy sungguhan: baris auth.users lewat Supabase Auth
 * Admin API (supaya bisa langsung login pakai username/password persis
 * seperti akun asli, konsisten dengan alur onboarding aplikasi) + baris
 * profiles yang berelasi ke situ.
 */
async function createDummyAccount({ nama, role, status }) {
  const username = makeUsername(nama);
  const email = `${username}@seed.zenskantin.local`;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: CONFIG.DEFAULT_PASSWORD,
    email_confirm: true,
  });
  if (authError || !authData?.user) {
    return { ok: false, error: authError?.message ?? "Gagal membuat akun auth." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    email,
    nama,
    username,
    role,
    status,
  });
  if (profileError) {
    // Bersihkan akun auth yang sudah kadung dibuat kalau insert profil gagal
    // (mis. tabrakan username yang sangat jarang terjadi) — supaya tidak
    // meninggalkan akun auth "yatim" tanpa profil.
    await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return { ok: false, error: profileError.message };
  }

  return { ok: true, id: authData.user.id, nama, username, role, status };
}

async function seedUsers() {
  const names = generateUniqueFullNames(CONFIG.KASIR_COUNT + CONFIG.PELANGGAN_COUNT);
  const kasirNames = names.slice(0, CONFIG.KASIR_COUNT);
  const pelangganNames = names.slice(CONFIG.KASIR_COUNT);

  const kasirJobs = kasirNames.map((nama) => ({ nama, role: "kasir", status: "active" }));
  // Sebagian besar pelanggan aktif, sebagian kecil pending/block — biar
  // realistis (halaman Approval Pendaftaran & filter status jadi ada isinya).
  const pelangganJobs = pelangganNames.map((nama) => ({
    nama,
    role: "pelanggan",
    status: weightedPick([
      { value: "active", weight: 85 },
      { value: "pending", weight: 10 },
      { value: "block", weight: 5 },
    ]),
  }));

  const allJobs = [...kasirJobs, ...pelangganJobs];
  console.log(`[seed] Membuat ${allJobs.length} akun dummy (${kasirJobs.length} kasir, ${pelangganJobs.length} pelanggan)...`);

  const results = await mapWithConcurrency(allJobs, CONFIG.DB_CONCURRENCY, createDummyAccount);

  const created = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.warn(`[seed] ${failed.length} akun gagal dibuat (dilewati). Contoh error: ${failed[0].error}`);
  }
  console.log(`[seed] ${created.length} akun berhasil dibuat.`);

  return {
    kasir: created.filter((r) => r.role === "kasir" && r.status === "active"),
    pelanggan: created.filter((r) => r.role === "pelanggan"),
    pelangganActive: created.filter((r) => r.role === "pelanggan" && r.status === "active"),
  };
}

// ---------------------------------------------------------------------
// 5. Stok masuk — riwayat pembelian stok per produk (FIFO, konsisten
//    dengan cara Postgres menghitung modal di aplikasi asli, lihat
//    function apply_stock_entry() & create_order_batch() di migration.sql)
// ---------------------------------------------------------------------

function buildStockEntriesForProduct(product, actorIds) {
  const n = randomInt(CONFIG.STOCK_ENTRIES_PER_PRODUCT.min, CONFIG.STOCK_ENTRIES_PER_PRODUCT.max);
  const baseCost = Math.max(500, Math.round((product.harga_jual * randomFloat(0.55, 0.75)) / 100) * 100);
  const days = Array.from({ length: n }, () => randomDayInRange()).sort((a, b) => a - b);

  return days.map((day) => {
    const qty = randomInt(20, 80);
    const noise = randomFloat(0.92, 1.08);
    const unitCost = Math.max(200, Math.round((baseCost * noise) / 50) * 50);
    return {
      produk_id: product.id,
      nama_produk: product.nama,
      total_beli: unitCost * qty,
      qty,
      user_id: actorIds.length ? pick(actorIds) : null,
      created_at: randomBusinessTimestamp(day).toISOString(),
    };
  });
}

async function seedStockEntries(products, actorIds) {
  console.log(`[seed] Membuat riwayat stok masuk untuk ${products.length} produk...`);
  const productStates = {};

  await mapWithConcurrency(products, CONFIG.DB_CONCURRENCY, async (product) => {
    const rows = buildStockEntriesForProduct(product, actorIds);
    const { data, error } = await supabase
      .from("stock_entries")
      .insert(rows)
      .select("id, qty, remaining_qty, harga_beli_satuan, created_at");

    if (error) {
      console.warn(`[seed] Gagal menambah stok untuk "${product.nama}": ${error.message}`);
      productStates[product.id] = { product, batches: [], totalStockedIn: 0 };
      return;
    }

    const sorted = [...data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const batches = sorted.map((row) => ({
      id: row.id,
      remaining: row.remaining_qty,
      originalQty: row.qty,
      unitCost: Number(row.harga_beli_satuan),
    }));
    productStates[product.id] = {
      product,
      batches,
      totalStockedIn: batches.reduce((s, b) => s + b.originalQty, 0),
    };
  });

  return productStates;
}

// Konsumsi FIFO — MUTASI batches (dipakai untuk pesanan 'paid'/'pending',
// yang benar-benar mengurangi stok jangka panjang).
function consumeFifo(batches, qty) {
  let toConsume = qty;
  let totalCost = 0;
  for (const b of batches) {
    if (toConsume <= 0) break;
    if (b.remaining <= 0) continue;
    const take = Math.min(b.remaining, toConsume);
    b.remaining -= take;
    totalCost += take * b.unitCost;
    toConsume -= take;
  }
  if (toConsume > 0) {
    const fallbackCost = batches.length ? batches[batches.length - 1].unitCost : 0;
    totalCost += toConsume * fallbackCost;
  }
  return round2(totalCost / qty);
}

// TIDAK memutasi batches — dipakai untuk pesanan 'cancelled', karena stok
// yang sempat "dipesan" otomatis kembali (net effect ke stok akhir = nol),
// jadi cukup estimasi modal rata-rata tanpa benar-benar mengonsumsi batch.
function averageUnitCost(batches) {
  const totalQty = batches.reduce((s, b) => s + b.originalQty, 0);
  if (totalQty === 0) return 0;
  const totalCost = batches.reduce((s, b) => s + b.originalQty * b.unitCost, 0);
  return round2(totalCost / totalQty);
}

function remainingCapacity(batches) {
  return batches.reduce((s, b) => s + Math.max(0, b.remaining), 0);
}

// ---------------------------------------------------------------------
// 6. Pesanan — bagian terbesar: ribuan baris pesanan tersebar beberapa
//    bulan, dikelompokkan per "transaksi checkout" (group_id sama),
//    dengan status & metode pembayaran acak yang realistis.
// ---------------------------------------------------------------------

function pickCustomer(pelangganPool, walkInNames) {
  const useAccount = pelangganPool.length > 0 && Math.random() < 0.7;
  if (useAccount) {
    const p = pick(pelangganPool);
    return { userId: p.id, nama: p.nama };
  }
  const names = walkInNames.length ? walkInNames : ["Pelanggan Langsung"];
  return { userId: null, nama: pick(names) };
}

function pickDistinctProducts(products, n) {
  const shuffled = shuffle(products);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

async function seedOrders({ products, productStates, pelangganPool, walkInNames, kasirPool, paymentMethods }) {
  const activePayments = paymentMethods.filter((p) => p.is_active);
  if (!activePayments.length) throw new Error("Tidak ada metode pembayaran aktif untuk membuat pesanan.");
  if (!kasirPool.length) throw new Error("Tidak ada akun kasir/admin aktif untuk mengonfirmasi pesanan.");

  console.log(`[seed] Menyusun ${CONFIG.ORDER_GROUPS} transaksi pesanan...`);

  const orderRows = [];
  const soldQty = {}; // produk_id -> qty terjual (paid + pending), dipakai buat koreksi stok akhir
  // Cache modal rata-rata per produk (dipakai berulang untuk pesanan
  // 'cancelled' tanpa perlu dihitung ulang tiap kali).
  const avgCostCache = {};

  for (let g = 0; g < CONFIG.ORDER_GROUPS; g++) {
    const day = randomDayInRange();
    const createdAt = randomBusinessTimestamp(day);
    const status = weightedPick([
      { value: "paid", weight: 75 },
      { value: "pending", weight: 12 },
      { value: "cancelled", weight: 13 },
    ]);
    const customer = pickCustomer(pelangganPool, walkInNames);
    const payment = pick(activePayments);
    const groupId = randomUUID();
    const itemCount = randomInt(CONFIG.ITEMS_PER_GROUP.min, CONFIG.ITEMS_PER_GROUP.max);
    const chosenProducts = pickDistinctProducts(products, itemCount);

    // Hanya pesanan 'paid' yang punya kasir_id & paid_at — persis seperti
    // function confirm_payment() di database (lihat migration.sql), yang
    // baru mengisi dua kolom itu saat pembayaran dikonfirmasi.
    const kasir = status === "paid" ? pick(kasirPool) : null;
    const paidAt = status === "paid" ? new Date(createdAt.getTime() + randomInt(2, 25) * 60 * 1000) : null;
    // Sebagian pesanan pelanggan (yang punya akun) sudah "dikonfirmasi
    // diterima" oleh pelanggannya sendiri — kolom ini opsional & terpisah
    // dari status pembayaran.
    const dikonfirmasiPelanggan = status === "paid" && customer.userId && Math.random() < 0.4;

    for (const product of chosenProducts) {
      const state = productStates[product.id];
      if (!state) continue;

      let qty = randomInt(CONFIG.QTY_PER_ITEM.min, CONFIG.QTY_PER_ITEM.max);
      let modalSatuan;

      if (status === "cancelled") {
        // Tidak mengonsumsi batch FIFO (lihat komentar averageUnitCost) —
        // tapi tetap butuh estimasi modal biar baris pesanan masuk akal.
        if (!(product.id in avgCostCache)) avgCostCache[product.id] = averageUnitCost(state.batches);
        modalSatuan = avgCostCache[product.id];
        if (modalSatuan === 0) continue; // produk tanpa riwayat stok sama sekali, lewati
      } else {
        const capacity = remainingCapacity(state.batches);
        if (capacity <= 0) continue; // stok produk ini sudah habis "terjual" di data dummy, lewati
        qty = Math.min(qty, capacity);
        modalSatuan = consumeFifo(state.batches, qty);
        soldQty[product.id] = (soldQty[product.id] ?? 0) + qty;
      }

      orderRows.push({
        group_id: groupId,
        user_id: customer.userId,
        nama_pemesan: customer.nama,
        produk_id: product.id,
        nama_produk: product.nama,
        qty,
        modal_satuan: modalSatuan,
        harga_satuan: product.harga_jual,
        pembayaran_id: payment.id,
        nama_pembayaran: payment.nama,
        status_pembayaran: status,
        kasir_id: kasir?.id ?? null,
        disampingkan: false,
        dikonfirmasi_pelanggan: !!dikonfirmasiPelanggan,
        dikonfirmasi_pelanggan_at: dikonfirmasiPelanggan ? paidAt.toISOString() : null,
        created_at: createdAt.toISOString(),
        paid_at: paidAt ? paidAt.toISOString() : null,
      });
    }
  }

  console.log(`[seed] Menyimpan ${orderRows.length} baris pesanan...`);
  for (const batch of chunk(orderRows, CONFIG.BATCH_SIZE)) {
    const { error } = await supabase.from("orders").insert(batch);
    if (error) throw new Error(`Gagal menyimpan pesanan: ${error.message}`);
  }

  return { orderRows, soldQty };
}

/**
 * Setelah semua baris pesanan tersimpan: koreksi products.stok (dikurangi
 * qty yang "terjual" lewat pesanan paid/pending — cancelled tidak
 * mengurangi karena stoknya otomatis kembali) & sinkronkan remaining_qty
 * tiap batch stock_entries yang tadi dikonsumsi FIFO di memori, supaya
 * angkanya konsisten kalau dicek manual di halaman Stok.
 */
async function syncStockAfterOrders(productStates, soldQty) {
  console.log("[seed] Menyinkronkan stok akhir & sisa batch FIFO...");

  const productsToAdjust = Object.values(productStates).filter((s) => (soldQty[s.product.id] ?? 0) > 0);

  // PENTING: ambil stok TERKINI dari database dulu (bukan pakai
  // totalStockedIn secara mentah) sebelum dikurangi soldQty. products.stok
  // pada titik ini sudah otomatis bertambah lewat trigger apply_stock_entry
  // saat stock_entries barusan disimpan (lihat migration.sql) — kalau
  // produknya SUDAH ADA dari run seeder sebelumnya (skrip ini aman
  // dijalankan berkali-kali untuk produk, lihat catatan di header file),
  // stok itu juga mencakup sisa dari run-run sebelumnya, bukan cuma dari
  // run saat ini. Mengurangi dari nilai TERKINI (bukan menimpa total absolut
  // hasil hitungan run ini saja) menjaga angka tetap benar di kedua kasus.
  const { data: currentProducts, error: fetchError } = await supabase
    .from("products")
    .select("id, stok")
    .in("id", productsToAdjust.map((s) => s.product.id));
  if (fetchError) {
    console.warn(`[seed] Gagal mengambil stok terkini, lewati sinkronisasi stok: ${fetchError.message}`);
  } else {
    const currentStokMap = Object.fromEntries((currentProducts ?? []).map((p) => [p.id, p.stok]));
    const productUpdates = productsToAdjust.map((s) => {
      const current = currentStokMap[s.product.id] ?? s.totalStockedIn;
      return { id: s.product.id, stok: Math.max(0, current - (soldQty[s.product.id] ?? 0)) };
    });

    await mapWithConcurrency(productUpdates, CONFIG.DB_CONCURRENCY, async (u) => {
      const { error } = await supabase.from("products").update({ stok: u.stok }).eq("id", u.id);
      if (error) console.warn(`[seed] Gagal memperbarui stok produk ${u.id}: ${error.message}`);
    });
  }

  const batchUpdates = [];
  for (const state of Object.values(productStates)) {
    for (const b of state.batches) {
      if (b.remaining !== b.originalQty) batchUpdates.push({ id: b.id, remaining_qty: b.remaining });
    }
  }
  await mapWithConcurrency(batchUpdates, CONFIG.DB_CONCURRENCY, async (u) => {
    const { error } = await supabase.from("stock_entries").update({ remaining_qty: u.remaining_qty }).eq("id", u.id);
    if (error) console.warn(`[seed] Gagal memperbarui sisa batch stok ${u.id}: ${error.message}`);
  });

  console.log(`[seed] ${productsToAdjust.length} produk & ${batchUpdates.length} batch stok disinkronkan.`);
}

// ---------------------------------------------------------------------
// 7. Pengeluaran & Pemasukan Khusus
// ---------------------------------------------------------------------

async function seedExpensesAndIncomes(actorIds) {
  console.log(`[seed] Membuat ${CONFIG.EXPENSE_COUNT} pengeluaran & ${CONFIG.INCOME_COUNT} pemasukan khusus...`);

  const expenseRows = Array.from({ length: CONFIG.EXPENSE_COUNT }, () => ({
    nama: pick(EXPENSE_NAMES),
    nominal: randomInt(30, 900) * 1000,
    keterangan: null,
    user_id: actorIds.length ? pick(actorIds) : null,
    created_at: randomBusinessTimestamp(randomDayInRange()).toISOString(),
  }));
  const incomeRows = Array.from({ length: CONFIG.INCOME_COUNT }, () => ({
    nama: pick(INCOME_NAMES),
    nominal: randomInt(20, 300) * 1000,
    keterangan: null,
    user_id: actorIds.length ? pick(actorIds) : null,
    created_at: randomBusinessTimestamp(randomDayInRange()).toISOString(),
  }));

  for (const batch of chunk(expenseRows, CONFIG.BATCH_SIZE)) {
    const { error } = await supabase.from("expenses").insert(batch);
    if (error) throw new Error(`Gagal menyimpan pengeluaran: ${error.message}`);
  }
  for (const batch of chunk(incomeRows, CONFIG.BATCH_SIZE)) {
    const { error } = await supabase.from("special_incomes").insert(batch);
    if (error) throw new Error(`Gagal menyimpan pemasukan: ${error.message}`);
  }
}

// ---------------------------------------------------------------------
// 8. Log Aktivitas — sampel secukupnya (dibatasi ACTIVITY_LOG_SAMPLE_CAP)
//    supaya halaman Log Aktivitas juga terisi wajar, bukan kosong.
// ---------------------------------------------------------------------

const DEVICE_POOL = ["Chrome di Android", "Chrome di Windows", "Safari di iOS", "Chrome di macOS", "Firefox di Windows", "Edge di Windows"];
const GEO_POOL = [
  { kota: "Jakarta", wilayah: "DKI Jakarta", negara: "Indonesia" },
  { kota: "Bandung", wilayah: "Jawa Barat", negara: "Indonesia" },
  { kota: "Surabaya", wilayah: "Jawa Timur", negara: "Indonesia" },
  { kota: "Semarang", wilayah: "Jawa Tengah", negara: "Indonesia" },
  { kota: "Yogyakarta", wilayah: "DI Yogyakarta", negara: "Indonesia" },
];

function buildLogRow({ userId, namaUser, aksi, deskripsi, createdAt }) {
  const geo = pick(GEO_POOL);
  return {
    user_id: userId,
    nama_user: namaUser,
    aksi,
    deskripsi,
    ip_address: `36.${randomInt(70, 90)}.${randomInt(1, 254)}.${randomInt(1, 254)}`,
    user_agent: null,
    perangkat: pick(DEVICE_POOL),
    kota: geo.kota,
    wilayah: geo.wilayah,
    negara: geo.negara,
    created_at: createdAt,
  };
}

async function seedActivityLogs({ createdUsers, orderRows }) {
  const logs = [];

  // Registrasi + login pertama untuk tiap akun baru — prioritas utama
  // (paling informatif kalau dilihat admin), dibuat dulu sebelum sampel lain.
  for (const u of createdUsers) {
    const registeredAt = randomBusinessTimestamp(randomDayInRange());
    logs.push(buildLogRow({
      userId: u.id, namaUser: u.nama, aksi: "daftar",
      deskripsi: `Pendaftaran akun baru (@${u.username})`, createdAt: registeredAt.toISOString(),
    }));
    if (u.status === "active") {
      const loginAt = new Date(registeredAt.getTime() + randomInt(1, 500) * 60 * 1000);
      logs.push(buildLogRow({
        userId: u.id, namaUser: u.nama, aksi: "login",
        deskripsi: "Masuk dengan username & password", createdAt: loginAt.toISOString(),
      }));
    }
    if (logs.length >= CONFIG.ACTIVITY_LOG_SAMPLE_CAP) break;
  }

  // Sisa kuota diisi sampel acak dari transaksi pesanan (masuk/bayar/batal).
  const remainingBudget = Math.max(0, CONFIG.ACTIVITY_LOG_SAMPLE_CAP - logs.length);
  const sample = shuffle(orderRows).slice(0, remainingBudget);
  for (const row of sample) {
    if (row.status_pembayaran === "cancelled") {
      logs.push(buildLogRow({
        userId: row.user_id, namaUser: row.nama_pemesan, aksi: "pesanan_dibatalkan",
        deskripsi: `Pesanan ${row.nama_produk} dibatalkan`, createdAt: row.created_at,
      }));
    } else if (row.status_pembayaran === "paid") {
      logs.push(buildLogRow({
        userId: row.kasir_id, namaUser: row.nama_pemesan, aksi: "pembayaran",
        deskripsi: `Pembayaran ${row.nama_produk} dikonfirmasi`, createdAt: row.paid_at ?? row.created_at,
      }));
    } else {
      logs.push(buildLogRow({
        userId: row.user_id, namaUser: row.nama_pemesan, aksi: "pesanan_masuk",
        deskripsi: `Pesanan baru: ${row.nama_produk} x${row.qty}`, createdAt: row.created_at,
      }));
    }
  }

  console.log(`[seed] Menyimpan ${logs.length} baris log aktivitas...`);
  for (const batch of chunk(logs, CONFIG.BATCH_SIZE)) {
    const { error } = await supabase.from("activity_logs").insert(batch);
    if (error) throw new Error(`Gagal menyimpan log aktivitas: ${error.message}`);
  }
}

// ---------------------------------------------------------------------
// 9. Orkestrasi utama
// ---------------------------------------------------------------------
async function main() {
  const startedAt = Date.now();
  console.log("=".repeat(70));
  console.log(`[seed] ${APP_NAME} — mulai seeding data dummy...`);
  console.log(`[seed] Rentang tanggal data: ${RANGE_START.toISOString().slice(0, 10)} s/d ${NOW.toISOString().slice(0, 10)}`);
  console.log("=".repeat(70));

  console.log("[seed] Menyiapkan kategori, metode pembayaran, & produk...");
  const categoryMap = await ensureCategories();
  const paymentMethods = await ensurePaymentMethods();
  const products = await ensureProducts(categoryMap);
  const walkInNames = await ensureSavedCustomers();
  console.log(`[seed] ${Object.keys(categoryMap).length} kategori, ${paymentMethods.length} metode pembayaran, ${products.length} produk siap.`);

  const { kasirAdmin: existingKasirAdmin, pelanggan: existingPelanggan } = await fetchExistingActiveProfiles();
  const created = await seedUsers();

  const kasirPool = [...existingKasirAdmin, ...created.kasir];
  const pelangganPool = [...existingPelanggan, ...created.pelangganActive];
  const actorIds = kasirPool.map((k) => k.id);

  const productStates = await seedStockEntries(products, actorIds);
  const totalStockedIn = Object.values(productStates).reduce((s, p) => s + p.totalStockedIn, 0);
  console.log(`[seed] Total ${totalStockedIn} unit stok masuk tercatat.`);

  const { orderRows, soldQty } = await seedOrders({
    products, productStates, pelangganPool, walkInNames, kasirPool, paymentMethods,
  });
  await syncStockAfterOrders(productStates, soldQty);

  await seedExpensesAndIncomes(actorIds);
  await seedActivityLogs({ createdUsers: created.pelanggan.concat(created.kasir), orderRows });

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log("=".repeat(70));
  console.log("[seed] Selesai! Ringkasan:");
  console.log(`  - Kategori          : ${Object.keys(categoryMap).length}`);
  console.log(`  - Metode pembayaran : ${paymentMethods.length}`);
  console.log(`  - Produk            : ${products.length}`);
  console.log(`  - Akun kasir baru   : ${created.kasir.length}`);
  console.log(`  - Akun pelanggan baru: ${created.pelanggan.length}`);
  console.log(`  - Baris stok masuk  : ${totalStockedIn} unit`);
  console.log(`  - Baris pesanan     : ${orderRows.length}`);
  console.log(`  - Pengeluaran/Pemasukan: ${CONFIG.EXPENSE_COUNT}/${CONFIG.INCOME_COUNT}`);
  console.log(`  - Waktu             : ${elapsedSec} detik`);
  console.log("-".repeat(70));
  console.log(`  Semua akun dummy pakai password: "${CONFIG.DEFAULT_PASSWORD}"`);
  console.log(`  Contoh username kasir   : ${created.kasir[0]?.username ?? "-"}`);
  console.log(`  Contoh username pelanggan: ${created.pelanggan[0]?.username ?? "-"}`);
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("[seed] GAGAL:", err.message ?? err);
  process.exit(1);
});
