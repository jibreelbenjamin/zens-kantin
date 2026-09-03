import { createClient } from "@/lib/supabase/server";
import { SavedCustomersManager } from "./saved-customers-manager";

export default async function PelangganPage() {
  const supabase = createClient();
  const { data: customers } = await supabase.from("saved_customers").select("*").order("nama");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pelanggan Tersimpan</h1>
        <p className="text-sm text-muted-foreground">
          Daftar nama untuk autocomplete saat kasir input pesanan langsung. Nama baru otomatis tersimpan tiap kasir mengetik nama baru.
        </p>
      </div>
      <SavedCustomersManager customers={customers ?? []} />
    </div>
  );
}
