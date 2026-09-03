import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { nama, is_active } = await request.json();
    if (!nama || !nama.trim()) return NextResponse.json({ error: "Nama metode pembayaran wajib diisi." }, { status: 400 });

    const { data, error } = await admin.from("payment_methods").insert({ nama: nama.trim(), is_active: is_active ?? true }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.METODE_PEMBAYARAN,
      deskripsi: `Menambah metode pembayaran ${nama}`, request,
    });

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
