import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { isValidUsername } from "@/lib/utils";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/**
 * Edit nama & username milik user LAIN — khusus admin (lihat requireRole
 * di bawah). Sebelumnya tiap user bisa mengubah nama/username miliknya
 * sendiri lewat dialog "Akun Saya" (/api/account/profile, route itu sudah
 * dihapus) — sekarang kemampuan itu dipusatkan ke sini saja, dipicu dari
 * halaman Admin > Pengguna, supaya perubahan identitas akun selalu lewat
 * sepengetahuan/persetujuan admin.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);

    const { nama, username } = await request.json();
    const cleanNama = String(nama ?? "").trim();
    const cleanUsername = String(username ?? "").trim().toLowerCase();

    if (cleanNama.length < 2) {
      return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
    }
    if (!isValidUsername(cleanUsername)) {
      return NextResponse.json(
        { error: "Username 3-24 karakter, hanya huruf kecil, angka, dan underscore." },
        { status: 400 }
      );
    }

    const { data: target } = await admin.from("profiles").select("nama, username").eq("id", params.id).maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const { data: usernameTaken } = await admin
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .neq("id", params.id)
      .maybeSingle();
    if (usernameTaken) {
      return NextResponse.json({ error: "Username sudah dipakai, coba yang lain." }, { status: 400 });
    }

    const { error } = await admin
      .from("profiles")
      .update({ nama: cleanNama, username: cleanUsername })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Admin bertindak lewat service-role client (bukan sesi user target),
    // jadi log dicatat manual di sini dengan identitas ADMIN yang login
    // (bukan target), sama seperti route status/role di sebelahnya.
    const detailPerubahan =
      target.nama !== cleanNama && target.username !== cleanUsername
        ? `nama "${target.nama}" → "${cleanNama}", username @${target.username} → @${cleanUsername}`
        : target.username !== cleanUsername
          ? `username @${target.username} → @${cleanUsername}`
          : `nama "${target.nama}" → "${cleanNama}"`;

    await logActivity({
      admin,
      userId: profile.id,
      namaUser: profile.nama,
      aksi: ACTIVITY_ACTIONS.PROFIL_UBAH,
      deskripsi: `Mengubah profil ${target.nama} (${detailPerubahan})`,
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
