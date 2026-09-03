import { createClient } from "@/lib/supabase/server";
import { OrderPageClient } from "./order-page-client";

export default async function OrderPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: products }, { data: paymentMethods }, { data: categories }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    // Ambil SEMUA produk (bukan cuma yang aktif) supaya perubahan status
    // tampil/sembunyi dari admin ikut ter-realtime di sisi client — status
    // aktif difilter saat render, bukan di query. Kolom `modal` sengaja
    // tidak diambil (rahasia dagang, tidak untuk pelanggan).
    supabase.from("products").select("id,nama,gambar_url,stok,harga_jual,is_active,kategori_id,created_at,updated_at").order("nama"),
    supabase.from("payment_methods").select("*").eq("is_active", true).order("created_at"),
    supabase.from("categories").select("*").order("nama"),
  ]);

  return (
    <OrderPageClient
      profile={profile!}
      products={products ?? []}
      paymentMethods={paymentMethods ?? []}
      categories={categories ?? []}
    />
  );
}
