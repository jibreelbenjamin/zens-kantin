import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/constants";

/**
 * Memastikan request datang dari user yang sudah login & berstatus aktif
 * dengan salah satu role yang diizinkan. Mengembalikan { user, profile, admin }
 * (admin = service-role client) supaya route handler bisa langsung menulis
 * data tanpa terganjal RLS. Melempar Response 401/403 kalau tidak memenuhi syarat.
 */
export async function requireRole(allowed: Role[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Belum login." }), { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.status !== "active" || !allowed.includes(profile.role)) {
    throw new Response(JSON.stringify({ error: "Tidak diizinkan." }), { status: 403 });
  }
  return { user, profile, supabase, admin: createAdminClient() };
}
