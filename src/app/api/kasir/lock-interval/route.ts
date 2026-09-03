import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";

/** Ambil interval auto-kunci layar kasir (menit) dari pengaturan admin. */
export async function GET() {
  try {
    const { supabase } = await requireRole(["kasir", "admin"]);
    const { data, error } = await supabase.rpc("get_lock_interval_minutes");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ minutes: typeof data === "number" ? data : null });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
