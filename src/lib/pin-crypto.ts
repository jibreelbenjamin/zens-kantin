import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Penyimpanan PIN kasir di app_settings.
 *
 * PIN tetap bisa DILIHAT & diubah admin kapan pun (itu memang kebutuhannya —
 * admin tidak boleh sampai terkunci gara-gara lupa PIN), tapi tidak lagi
 * tersimpan apa adanya di baris database: nilainya dienkripsi AES-256-GCM
 * dengan kunci turunan dari rahasia server. Bedanya terasa ketika isi tabel
 * sampai terbaca dari luar aplikasi — backup/dump database, kebocoran
 * kredensial Supabase, atau policy RLS yang salah pasang: yang terbaca cuma
 * ciphertext, bukan empat digit yang bisa langsung dipakai.
 *
 * Modul ini memakai `crypto` Node, jadi HANYA boleh diimpor dari Route
 * Handler / Server Component — bukan dari middleware (Edge) atau komponen
 * client.
 */

const PREFIX = "enc.v1.";

function secret(): string {
  const value = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("APP_SECRET (atau SUPABASE_SERVICE_ROLE_KEY) belum diisi — PIN kasir tidak bisa dienkripsi/dibaca.");
  }
  return value;
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  // scrypt sengaja dijalankan sekali lalu disimpan di memori proses: kunci
  // turunannya selalu sama untuk rahasia yang sama, dan menurunkannya ulang
  // tiap request cuma membuang waktu CPU (scrypt memang dibuat lambat).
  if (!cachedKey) cachedKey = scryptSync(secret(), "zens-kantin/kasir-pin", 32);
  return cachedKey;
}

export function encryptPin(pin: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64url")).join(".");
}

/**
 * Kebalikan encryptPin. Nilai yang TIDAK berawalan `enc.v1.` dianggap PIN
 * lama yang masih tersimpan apa adanya dan dikembalikan begitu saja — supaya
 * aplikasi yang datanya sudah terlanjur ada tetap jalan tanpa migrasi data;
 * barisnya ikut terenkripsi sendiri begitu admin menyimpan PIN berikutnya.
 * Mengembalikan null kalau nilainya rusak/tidak bisa didekripsi (mis. karena
 * APP_SECRET berganti setelah PIN tersimpan).
 */
export function decryptPin(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;

  const [ivPart, tagPart, dataPart] = stored.slice(PREFIX.length).split(".");
  if (!ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Pencocokan PIN yang lama waktunya tidak bergantung pada berapa digit awal
 * yang sudah benar — dengan `===`, selisih waktu antar tebakan bisa dipakai
 * menebak PIN digit per digit. Dibandingkan sebagai hash supaya panjang input
 * yang berbeda tidak ikut membocorkan panjang PIN.
 */
export function pinMatches(input: unknown, actual: string | null): boolean {
  if (!actual) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(String(input ?? "")), digest(actual));
}

/**
 * Penanda versi PIN — nilai acak baru dibuat setiap kali admin menyimpan PIN.
 * Nilai ini ikut ditandatangani ke dalam token pembuka kunci kasir, jadi
 * begitu PIN diganti, semua layar kasir yang sedang terbuka dengan PIN lama
 * langsung tidak sah lagi dan meminta PIN baru (lihat lib/kasir-token.ts).
 */
export function newPinVersion(): string {
  return randomBytes(9).toString("base64url");
}
