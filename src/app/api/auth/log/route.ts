import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

/** Endpoint kecil untuk mencatat log login/logout dari client component. */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { aksi, deskripsi } = await request.json();
  const { data: profile } = await supabase.from("profiles").select("nama").eq("id", user.id).maybeSingle();

  // Pakai admin client: tabel activity_logs sengaja tidak punya RLS insert
  // policy untuk role authenticated (hanya bisa ditulis lewat server).
  const admin = createAdminClient();
  await logActivity({
    admin,
    userId: user.id,
    namaUser: profile?.nama ?? user.email ?? null,
    aksi,
    deskripsi: deskripsi ?? null,
    request,
  });

  return NextResponse.json({ ok: true });
}
