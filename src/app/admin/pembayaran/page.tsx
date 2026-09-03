import { createClient } from "@/lib/supabase/server";
import { PembayaranTable } from "./pembayaran-table";

export default async function PembayaranPage() {
  const supabase = createClient();
  const { data } = await supabase.from("payment_methods").select("*").order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Metode Pembayaran</h1>
        <p className="text-sm text-muted-foreground">Daftar metode pembayaran yang bisa dipilih pelanggan (mis. Tunai, QRIS, Transfer).</p>
      </div>
      <PembayaranTable data={data ?? []} />
    </div>
  );
}
