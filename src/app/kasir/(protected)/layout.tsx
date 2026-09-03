import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KasirShell } from "@/components/kasir/kasir-shell";
import type { Profile } from "@/types/database";

export default async function KasirLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "kasir") redirect("/");

  return <KasirShell profile={profile as Profile}>{children}</KasirShell>;
}
