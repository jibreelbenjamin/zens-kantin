import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Admin mereset password akun kasir/admin/pelanggan lain. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { password } = await request.json();
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 digit." }, { status: 400 });
    }

    const { error } = await admin.auth.admin.updateUserById(params.id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: target } = await admin.from("profiles").select("nama").eq("id", params.id).single();
    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.USER_RESET_PASSWORD,
      deskripsi: `Reset password untuk ${target?.nama ?? params.id}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
