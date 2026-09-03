import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { role } = await request.json();
    if (!["admin", "kasir", "pelanggan"].includes(role)) {
      return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
    }
    if (params.id === profile.id && role !== "admin") {
      return NextResponse.json({ error: "Tidak bisa menurunkan role akun sendiri." }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update({ role }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.USER_ROLE,
      deskripsi: `Mengubah role ${params.id} menjadi ${role}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
