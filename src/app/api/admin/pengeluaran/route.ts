import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { nama, nominal, keterangan, gambar_url } = await request.json();
    if (!nama || !nama.trim() || Number(nominal) < 0) {
      return NextResponse.json({ error: "Data pengeluaran khusus tidak valid." }, { status: 400 });
    }
    const { data, error } = await admin
      .from("expenses")
      .insert({
        user_id: profile.id, nama: nama.trim(), nominal: Number(nominal) || 0,
        keterangan: keterangan || null, gambar_url: gambar_url || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PENGELUARAN_KHUSUS,
      deskripsi: `Menambah pengeluaran khusus ${nama}`, request,
    });

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
