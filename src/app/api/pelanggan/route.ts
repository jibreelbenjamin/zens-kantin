import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Daftar pelanggan tersimpan (autocomplete nama pemesan) — admin & kasir. */
export async function GET() {
  try {
    const { supabase } = await requireRole(["admin", "kasir"]);
    const { data, error } = await supabase.from("saved_customers").select("*").order("nama", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin", "kasir"]);
    const { nama } = await request.json();
    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
    }
    const { data, error } = await admin
      .from("saved_customers")
      .insert({ nama: nama.trim() })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Nama sudah tersimpan." }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama,
      aksi: ACTIVITY_ACTIONS.PELANGGAN_TAMBAH,
      deskripsi: `Menambah pelanggan tersimpan: ${data.nama}`,
      request,
    });
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
