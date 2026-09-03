import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PinLockScreen } from "./pin-lock-screen";

/**
 * Halaman PIN kasir — route TERPISAH (bukan overlay yang ditumpuk di atas
 * halaman kasir seperti sebelumnya). Middleware sudah menjamin siapa pun
 * yang belum memasukkan PIN benar akan diarahkan ke sini SEBELUM halaman
 * kasir manapun sempat mengambil/mengirim data pesanan — jadi tidak ada
 * apa pun yang bisa "dibongkar" lewat Inspect Element di baliknya.
 */
export default async function KasirLockPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("nama,role,status").eq("id", user.id).single();
  if (!profile || profile.role !== "kasir" || profile.status !== "active") redirect("/");

  const next = searchParams?.next && searchParams.next.startsWith("/kasir") ? searchParams.next : "/kasir";

  return <PinLockScreen cashierName={profile.nama} next={next} />;
}
