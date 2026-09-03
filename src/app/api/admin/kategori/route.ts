import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { nama } = await request.json();
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: "Nama kategori tidak boleh kosong." }, { status: 400 });
    }
    const { data, error } = await admin.from("categories").insert({ nama: nama.trim() }).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Kategori sudah ada." }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.KATEGORI_UBAH,
      deskripsi: `Menambah kategori ${nama}`, request,
    });

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
