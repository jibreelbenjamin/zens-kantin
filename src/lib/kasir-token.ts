/**
 * Token pembuka kunci layar kasir — pengganti cookie penanda `kasir_unlocked=1`.
 *
 * Cookie penanda yang isinya cuma "1" tidak pernah benar-benar mengunci apa
 * pun: HttpOnly memang menghalangi JavaScript MEMBACA cookie itu, tapi tidak
 * menghalangi siapa pun MEMBUATNYA sendiri lewat DevTools > Application >
 * Cookies (atau lewat curl). Begitu cookie bernilai "1" ada, middleware
 * langsung percaya dan seluruh gerbang PIN terlewati tanpa perlu tahu PIN-nya.
 *
 * Token di sini ditandatangani HMAC-SHA256 dengan rahasia yang hanya ada di
 * server, jadi tidak bisa dibuat-buat dari sisi browser, dan isinya mengikat
 * pembukaan kunci ke:
 *   u — id akun kasir yang membuka (cookie yang disalin ke akun lain ditolak)
 *   s — sidik jari sesi login (cookie yang disalin ke browser/perangkat lain,
 *       yang otomatis punya sesi berbeda, ikut ditolak)
 *   p — versi PIN saat token dibuat (begitu admin mengganti PIN, semua token
 *       lama otomatis tidak berlaku — lihat get_kasir_pin_version di SQL)
 *   e — kapan token kedaluwarsa, l — umur penuh token (dipakai middleware
 *       untuk memperpanjang otomatis selama kasir masih aktif)
 *
 * Modul ini sengaja hanya memakai Web Crypto (bukan modul `crypto` Node),
 * karena dipanggil juga dari middleware yang berjalan di Edge Runtime.
 */

export type UnlockClaims = {
  /** id akun kasir */
  u: string;
  /** sidik jari sesi login */
  s: string;
  /** versi PIN saat token dibuat */
  p: string;
  /** epoch detik kedaluwarsa */
  e: number;
  /** umur penuh token (detik) */
  l: number;
};

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

/**
 * Rahasia penanda tangan. APP_SECRET adalah tempat yang benar untuk ini;
 * SUPABASE_SERVICE_ROLE_KEY dipakai sebagai cadangan supaya deployment yang
 * sudah jalan tidak langsung rusak begitu kode ini naik — keduanya sama-sama
 * hanya ada di server, tidak pernah ikut ke browser.
 */
function secret(): string {
  const value = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("APP_SECRET (atau SUPABASE_SERVICE_ROLE_KEY) belum diisi — token kunci kasir tidak bisa ditandatangani.");
  }
  return value;
}

function signingKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  return keyPromise;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function signature(payload: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

/** Perbandingan yang waktunya tidak bergantung isi — jangan diganti dengan `===`. */
function equalsConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signUnlockToken(claims: UnlockClaims): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  return `${payload}.${await signature(payload)}`;
}

/**
 * Mengembalikan klaim token kalau tanda tangannya sah, belum kedaluwarsa, dan
 * cocok dengan akun/sesi/versi PIN yang sedang berlaku — selain itu null
 * (artinya: perlakukan seperti terkunci).
 */
export async function verifyUnlockToken(
  token: string | undefined,
  expect: { userId: string; sessionId: string; pinVersion: string }
): Promise<UnlockClaims | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  if (!equalsConstantTime(sig, await signature(payload))) return null;

  let claims: UnlockClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return null;
  }

  if (typeof claims?.e !== "number" || claims.e * 1000 <= Date.now()) return null;
  if (claims.u !== expect.userId) return null;
  if (claims.s !== expect.sessionId) return null;
  if (claims.p !== expect.pinVersion) return null;
  return claims;
}

/**
 * Sidik jari sesi login: hash dari klaim `session_id` di dalam access token
 * Supabase. session_id tetap sama selama sesi login itu hidup (tidak ikut
 * berganti tiap token di-refresh), jadi cocok untuk mengikat token ini ke
 * satu sesi tanpa membuatnya kedaluwarsa tiap beberapa menit. Payload JWT-nya
 * cukup dibaca apa adanya — keaslian sesi sudah diverifikasi terpisah lewat
 * supabase.auth.getUser(); di sini token itu hanya dipakai sebagai penanda.
 */
export async function sessionFingerprint(accessToken: string | undefined | null): Promise<string> {
  if (!accessToken) return "";
  const payload = accessToken.split(".")[1];
  if (!payload) return "";
  let sessionId: string | undefined;
  try {
    sessionId = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)))?.session_id;
  } catch {
    return "";
  }
  if (!sessionId) return "";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(sessionId));
  return toBase64Url(new Uint8Array(digest)).slice(0, 16);
}
