import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Catat log "login" di sini (server-side, sesi sudah pasti aktif di
      // request ini) — sebelumnya login lewat Google TIDAK PERNAH tercatat
      // sama sekali. Hanya dicatat kalau profil SUDAH ADA sebelumnya (login
      // ulang) — pendaftaran pertama kali sudah dicatat sendiri dengan aksi
      // "daftar" oleh /api/auth/register, supaya tidak dobel.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createAdminClient();
        const { data: profile } = await admin.from("profiles").select("nama").eq("id", user.id).maybeSingle();
        if (profile) {
          await logActivity({
            admin, userId: user.id, namaUser: profile.nama,
            aksi: ACTIVITY_ACTIONS.LOGIN,
            deskripsi: "Masuk dengan Google",
            request,
          });
        }
      }
      return NextResponse.redirect(`${origin}/`);
    }

    // Dulu pesan error asli dari Supabase dibuang begitu saja — jadi kalau
    // gagal di production, satu-satunya petunjuk cuma "auth_callback_failed"
    // tanpa tahu sebabnya. Sekarang dicatat ke server log (kelihatan di
    // Vercel > Logs) DAN diteruskan ke halaman login lewat query param
    // "reason" supaya langsung kelihatan tanpa perlu bongkar log server.
    console.error("[auth/callback] exchangeCodeForSession gagal:", error.message);
    const reason = encodeURIComponent(error.message.slice(0, 200));
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed&reason=${reason}`);
  }

  console.error("[auth/callback] Tidak ada parameter 'code' pada callback URL.");
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed&reason=missing_code`);
}
