import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { KASIR_UNLOCK_COOKIE, ACTIVITY_ACTIONS } from "@/lib/constants";

/** Mengunci layar kasir manual (atau dipanggil saat idle timeout) — hapus cookie unlock. */
export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["kasir", "admin"]);
    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama,
      aksi: ACTIVITY_ACTIONS.KASIR_DIKUNCI,
      deskripsi: "Mengunci layar kasir",
      request,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(KASIR_UNLOCK_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
