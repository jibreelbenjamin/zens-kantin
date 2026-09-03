import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isValidUsername } from "@/lib/utils";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { newRegistrationAdminEmail } from "@/lib/mail-templates";

/**
 * Dipanggil sekali setelah login Google pertama kali (halaman onboarding).
 * Membuat baris profil (role pelanggan, status pending) dan men-set password
 * akun lewat service_role key supaya user bisa login cepat via username/password
 * berikutnya di tablet bersama.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const { nama, username, password } = await request.json();

  if (!nama || nama.trim().length < 2) {
    return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  if (!isValidUsername(cleanUsername)) {
    return NextResponse.json(
      { error: "Username 3-24 karakter, hanya huruf kecil, angka, dan underscore." },
      { status: 400 }
    );
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 digit." }, { status: 400 });
  }

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Profil sudah ada." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: usernameTaken } = await admin
    .from("profiles")
    .select("id")
    .eq("username", cleanUsername)
    .maybeSingle();
  if (usernameTaken) {
    return NextResponse.json({ error: "Username sudah dipakai, coba yang lain." }, { status: 400 });
  }

  const googleId = (user.identities ?? []).find((i: any) => i.provider === "google")?.id ?? null;

  const { error: insertError } = await admin.from("profiles").insert({
    id: user.id,
    email: user.email,
    nama: nama.trim(),
    username: cleanUsername,
    google_id: googleId,
    role: "pelanggan",
    status: "pending",
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(user.id, { password });
  if (pwError) {
    return NextResponse.json({ error: pwError.message }, { status: 400 });
  }

  // PENTING: mengganti password lewat Admin API di atas otomatis MENGAKHIRI
  // sesi yang sedang aktif (ini perilaku resmi Supabase Auth — ganti
  // password = sesi lama berakhir, lihat https://supabase.com/docs/guides/auth/sessions
  // dan supabase/auth#1579). Tanpa baris ini, response di bawah tetap
  // "sukses", tapi begitu client redirect ke /pending, middleware sudah
  // tidak melihat sesi manapun lagi (getUser() null) dan melempar balik ke
  // /login TANPA pesan error apa pun — persis seperti pendaftaran gagal
  // total, padahal datanya sudah kesimpan. Login ulang di sini pakai
  // password yang baru saja diset supaya sesi baru langsung aktif sebelum
  // response ini dikirim ke client.
  if (user.email) {
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (reauthError) {
      // Pendaftaran & password sudah tersimpan — kegagalan re-auth di sini
      // tidak menggagalkan seluruh pendaftaran, tapi dicatat supaya
      // kelihatan di log server kalau ini sampai terjadi.
      console.error("[auth/register] Gagal membuat sesi baru setelah ganti password:", reauthError.message);
    }
  }

  // Dulu dicatat otomatis lewat trigger DB (tidak punya akses IP/lokasi) —
  // sekarang dicatat di sini supaya log pendaftaran juga punya konteksnya.
  await logActivity({
    admin,
    userId: user.id,
    namaUser: nama.trim(),
    aksi: ACTIVITY_ACTIONS.DAFTAR,
    deskripsi: `Pendaftaran akun baru via Google (@${cleanUsername})`,
    request,
  });

  // Kabari semua admin aktif lewat email — supaya persetujuan akun baru
  // tidak harus ketahuan cuma dengan kebetulan buka halaman Admin > Pengguna.
  // Gagal kirim TIDAK menggagalkan pendaftaran (sendMail menelan errornya
  // sendiri) — akun tetap tersimpan apa pun hasil pengirimannya.
  const { data: admins } = await admin
    .from("profiles").select("email").eq("role", "admin").eq("status", "active").not("email", "is", null);
  const adminEmails = (admins ?? []).map((a) => a.email).filter((e): e is string => !!e);
  if (adminEmails.length > 0) {
    const { subject, html } = newRegistrationAdminEmail({ nama: nama.trim(), username: cleanUsername });
    await sendMail({ to: adminEmails, subject, html });
  }

  return NextResponse.json({ ok: true });
}
