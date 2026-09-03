import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin", "kasir"]);
    const { data: existing } = await admin.from("saved_customers").select("nama").eq("id", params.id).maybeSingle();
    const { error } = await admin.from("saved_customers").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama,
      aksi: ACTIVITY_ACTIONS.PELANGGAN_HAPUS,
      deskripsi: `Menghapus pelanggan tersimpan: ${existing?.nama ?? params.id}`,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
