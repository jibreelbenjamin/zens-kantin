import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Reset manual log aktivitas (selain reset otomatis bulanan lewat pg_cron). */
export async function DELETE(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { error } = await admin.from("activity_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PENGATURAN_UBAH,
      deskripsi: "Reset log aktivitas manual", request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
