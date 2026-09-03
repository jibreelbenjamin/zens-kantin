import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import type { createAdminClient } from "@/lib/supabase/server";
import { decryptPin, pinMatches } from "@/lib/pin-crypto";
import { sessionFingerprint, signUnlockToken } from "@/lib/kasir-token";
import {
  KASIR_UNLOCK_COOKIE, KASIR_IDLE_LOCK_MS, ACTIVITY_ACTIONS,
  KASIR_PIN_LOCKOUT_MAX_ATTEMPTS, KASIR_PIN_LOCKOUT_WINDOW_MINUTES,
  unlockCookieOptions,
} from "@/lib/constants";

/**
 * Verifikasi PIN kunci layar kasir. PIN tersimpan terenkripsi di
 * app_settings (lihat lib/pin-crypto.ts) dan tidak pernah diekspos ke
 * client: kasir hanya bisa memanggil endpoint ini dan menerima true/false.
 * Pencocokannya pun memakai perbandingan yang lama waktunya tetap, supaya
 * selisih waktu balasan tidak bisa dipakai menebak PIN digit per digit.
 *
 * Kalau valid, endpoint ini menerbitkan TOKEN bertanda tangan ke cookie
 * HttpOnly kasir_unlocked — inilah yang diverifikasi middleware sebelum
 * mengizinkan akses ke halaman kasir lain (lihat src/middleware.ts &
 * lib/kasir-token.ts). Token terikat ke akun, sesi login, dan versi PIN
 * yang berlaku, serta berumur sepanjang interval kunci yang admin atur.
 *
 * Jeda percobaan gagal dihitung di SINI (server) dari baris activity_logs
 * beraksi KASIR_PIN_GAGAL per user_id akun yang SEDANG LOGIN (lihat
 * KASIR_PIN_LOCKOUT_* di lib/constants.ts untuk alasan kenapa bukan
 * per-IP/localStorage). PIN itu sendiri TIDAK PERNAH disimpan di mana pun
 * sisi client — cuma dipegang sesaat di state React layar PIN lalu langsung
 * dikirim ke sini.
 */
export async function POST(request: Request) {
  try {
    const { admin, profile, user, supabase } = await requireRole(["kasir", "admin"]);

    const lockout = await checkPinLockout(admin, profile.id);
    if (lockout.locked) {
      return NextResponse.json(
        { valid: false, locked: true, retryAfterSeconds: lockout.retryAfterSeconds },
        { status: 429 }
      );
    }

    const { pin } = await request.json();
    const { data } = await admin
      .from("app_settings")
      .select("key,value")
      .in("key", ["kasir_pin", "kasir_lock_interval_minutes", "kasir_pin_version"]);

    const pinValue = decryptPin(data?.find((d) => d.key === "kasir_pin")?.value);
    const pinVersion = data?.find((d) => d.key === "kasir_pin_version")?.value ?? "";
    const intervalMinutes = Number(data?.find((d) => d.key === "kasir_lock_interval_minutes")?.value);
    const maxAgeSeconds = Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? Math.round(intervalMinutes * 60)
      : Math.round(KASIR_IDLE_LOCK_MS / 1000);

    const valid = pinMatches(pin, pinValue);

    if (!valid) {
      await logActivity({
        admin, userId: profile.id, namaUser: profile.nama,
        aksi: ACTIVITY_ACTIONS.KASIR_PIN_GAGAL,
        deskripsi: "Percobaan buka PIN kasir gagal",
        request,
      });
      return NextResponse.json({ valid: false });
    }

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama,
      aksi: ACTIVITY_ACTIONS.KASIR_DIBUKA,
      deskripsi: "Membuka kunci layar kasir dengan PIN",
      request,
    });

    const { data: { session } } = await supabase.auth.getSession();
    const token = await signUnlockToken({
      u: user.id,
      s: await sessionFingerprint(session?.access_token),
      p: pinVersion,
      e: Math.floor(Date.now() / 1000) + maxAgeSeconds,
      l: maxAgeSeconds,
    });

    const response = NextResponse.json({ valid: true });
    response.cookies.set(KASIR_UNLOCK_COOKIE, token, unlockCookieOptions(maxAgeSeconds));
    return response;
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

/**
 * Cek status jeda TANPA mengonsumsi percobaan — dipanggil layar PIN saat
 * pertama dimuat/di-refresh supaya cooldown yang masih berjalan tetap
 * akurat SETELAH refresh, tanpa localStorage: sumber kebenarannya baris
 * activity_logs di server, bukan penyimpanan di browser kasir yang gampang
 * dihapus/di-bypass.
 */
export async function GET() {
  try {
    const { admin, profile } = await requireRole(["kasir", "admin"]);
    const lockout = await checkPinLockout(admin, profile.id);
    return NextResponse.json({ locked: lockout.locked, retryAfterSeconds: lockout.retryAfterSeconds });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

async function checkPinLockout(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const since = new Date(Date.now() - KASIR_PIN_LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data } = await admin
    .from("activity_logs")
    .select("created_at")
    .eq("aksi", ACTIVITY_ACTIONS.KASIR_PIN_GAGAL)
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(KASIR_PIN_LOCKOUT_MAX_ATTEMPTS);
  const rows = data ?? [];

  if (rows.length < KASIR_PIN_LOCKOUT_MAX_ATTEMPTS) {
    return { locked: false as const, retryAfterSeconds: 0 };
  }
  const boundary = rows[rows.length - 1];
  const unlockAt = new Date(boundary.created_at).getTime() + KASIR_PIN_LOCKOUT_WINDOW_MINUTES * 60 * 1000;

  if (unlockAt > Date.now()) {
    return { locked: true as const, retryAfterSeconds: Math.ceil((unlockAt - Date.now()) / 1000) };
  }
  return { locked: false as const, retryAfterSeconds: 0 };
}
