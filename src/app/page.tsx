import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/onboarding");
  if (profile.status === "pending") redirect("/pending");
  if (profile.status === "block") redirect("/blocked");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "kasir") redirect("/kasir");
  redirect("/order");
}
