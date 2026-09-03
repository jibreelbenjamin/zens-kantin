import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Ambil & ubah PIN kasir (dan pengaturan lain di app_settings). Admin-only. */
export async function GET() {
  try {
    const { admin } = await requireRole(["admin"]);
    const { data, error } = await admin.from("app_settings").select("*").order("key");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { key, value } = await request.json();
    if (key === "kasir_pin" && !/^\d{4}$/.test(value)) {
      return NextResponse.json({ error: "PIN harus tepat 4 digit angka." }, { status: 400 });
    }
    if (key === "kasir_lock_interval_minutes") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 60) {
        return NextResponse.json({ error: "Interval harus angka bulat 1-60 menit." }, { status: 400 });
      }
    }
    const { error } = await admin.from("app_settings").upsert({ key, value, updated_by: profile.id, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PENGATURAN_UBAH,
      deskripsi: `Mengubah pengaturan ${key}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
