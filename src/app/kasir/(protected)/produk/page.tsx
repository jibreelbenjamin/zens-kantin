import { createClient } from "@/lib/supabase/server";
import { ProdukReadonlyGrid } from "./produk-readonly-grid";

export default async function KasirProdukPage() {
  const supabase = createClient();
  const { data: products } = await supabase.from("products").select("*").order("nama");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Daftar Produk</h1>
        <p className="text-sm text-muted-foreground">Referensi menu & stok kantin (tampilan saja, tidak bisa diubah dari sini).</p>
      </div>
      <ProdukReadonlyGrid products={products ?? []} />
    </div>
  );
}
