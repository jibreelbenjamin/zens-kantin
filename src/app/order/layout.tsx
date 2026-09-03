import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OrderLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (!profile || profile.role !== "pelanggan") redirect("/");

  return <>{children}</>;
}
