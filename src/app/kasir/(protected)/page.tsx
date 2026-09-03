import { createClient } from "@/lib/supabase/server";
import { OrderQueue } from "./order-queue";

export default async function KasirPesananPage() {
  const supabase = createClient();
  const [{ data: orders }, { data: products }, { data: paymentMethods }] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("products").select("*").eq("is_active", true).order("nama"),
    supabase.from("payment_methods").select("*").eq("is_active", true).order("created_at"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Antrian Pesanan</h1>
        <p className="text-sm text-muted-foreground">Pesanan pelanggan masuk secara realtime. Konfirmasi setelah pembayaran diterima.</p>
      </div>
      <OrderQueue initialOrders={orders ?? []} products={products ?? []} paymentMethods={paymentMethods ?? []} />
    </div>
  );
}
