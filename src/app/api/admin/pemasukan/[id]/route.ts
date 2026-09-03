import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const body = await request.json();
    const allowed = ["nama", "nominal", "keterangan", "gambar_url"];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    const { error } = await admin.from("special_incomes").update(patch).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PEMASUKAN_KHUSUS,
      deskripsi: `Mengubah pemasukan khusus ${params.id}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { error } = await admin.from("special_incomes").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PEMASUKAN_KHUSUS,
      deskripsi: `Menghapus pemasukan khusus ${params.id}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
