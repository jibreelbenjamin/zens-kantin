import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helper terpusat untuk mencatat log aktivitas. SEMUA insert ke tabel
 * activity_logs (di seluruh aplikasi) wajib lewat sini — supaya setiap
 * baris log konsisten punya IP, lokasi (kota/wilayah/negara), dan info
 * perangkat, bukan cuma sebagian.
 *
 * Kenapa dipindah dari trigger database ke sini (mulai v9): trigger di
 * dalam Postgres TIDAK punya akses ke HTTP request (IP, User-Agent) sama
 * sekali — satu-satunya tempat yang punya akses itu adalah Route Handler
 * Next.js tempat request masuk. Makanya pencatatan log dipindah ke sini,
 * dipanggil eksplisit dari tiap route setelah aksinya berhasil.
 */

interface LogActivityParams {
  /** Supabase client dengan service_role (lihat requireRole()). */
  admin: SupabaseClient;
  userId: string | null;
  namaUser: string | null;
  aksi: string;
  deskripsi?: string | null;
  /** Request asli — dari sinilah IP/User-Agent/lokasi diambil. */
  request?: Request | null;
}

export async function logActivity({ admin, userId, namaUser, aksi, deskripsi, request }: LogActivityParams) {
  const ctx = request ? await extractRequestContext(request) : null;

  const { error } = await admin.from("activity_logs").insert({
    user_id: userId,
    nama_user: namaUser,
    aksi,
    deskripsi: deskripsi ?? null,
    ip_address: ctx?.ip ?? null,
    user_agent: ctx?.userAgent ?? null,
    perangkat: ctx?.perangkat ?? null,
    kota: ctx?.kota ?? null,
    wilayah: ctx?.wilayah ?? null,
    negara: ctx?.negara ?? null,
  });

  if (error) {
    // Kegagalan mencatat log TIDAK BOLEH menggagalkan aksi utamanya
    // (mis. konfirmasi pembayaran tetap harus sukses walau lognya gagal
    // tersimpan) — cukup catat ke console server untuk observabilitas.
    console.error("Gagal mencatat log aktivitas:", error.message);
  }
}

interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  perangkat: string | null;
  kota: string | null;
  wilayah: string | null;
  negara: string | null;
}

async function extractRequestContext(request: Request): Promise<RequestContext> {
  const headers = request.headers;
  const ip = getClientIp(headers);
  const userAgent = headers.get("user-agent");
  const perangkat = parseDevice(userAgent);

  // Kalau di-deploy di Vercel, header geo ini sudah otomatis tersedia
  // (gratis, instan, tanpa panggilan API luar) — dipakai duluan kalau ada.
  let kota = decodeHeader(headers.get("x-vercel-ip-city"));
  let wilayah = headers.get("x-vercel-ip-country-region");
  let negara = headers.get("x-vercel-ip-country");

  if (!negara && ip && isLookupableIp(ip)) {
    const geo = await lookupIpGeo(ip);
    if (geo) {
      kota = geo.kota;
      wilayah = geo.wilayah;
      negara = geo.negara;
    }
  }

  return { ip, userAgent, perangkat, kota, wilayah, negara };
}

function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function isLookupableIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1") return false;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return false;
  return true;
}

async function lookupIpGeo(ip: string): Promise<{ kota: string | null; wilayah: string | null; negara: string | null } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { "User-Agent": "zens-kantin-activity-log" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    return {
      kota: data.city ?? null,
      wilayah: data.region ?? null,
      negara: data.country_name ?? null,
    };
  } catch {
    // Timeout/offline/rate-limit — log tetap tersimpan, cuma tanpa lokasi.
    return null;
  }
}

// Deteksi ringkas OS + browser dari User-Agent, tanpa library eksternal.
// Tidak perlu sempurna — cukup untuk konteks "dari perangkat apa".
function parseDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent;

  let os: string;
  if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else os = "Perangkat lain";

  let browser: string;
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/crios\//i.test(ua)) browser = "Chrome";
  else if (/fxios\//i.test(ua)) browser = "Firefox";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = "Safari";
  else browser = "Browser lain";

  return `${browser} di ${os}`;
}
