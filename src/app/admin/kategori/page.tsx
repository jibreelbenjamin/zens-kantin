import { createClient } from "@/lib/supabase/server";
import { KategoriTable } from "./kategori-table";

export default async function KategoriPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("nama"),
    supabase.from("products").select("id,kategori_id"),
  ]);

  const countByCategory: Record<string, number> = {};
  for (const p of products ?? []) {
    if (p.kategori_id) countByCategory[p.kategori_id] = (countByCategory[p.kategori_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Kategori Produk</h1>
        <p className="text-sm text-muted-foreground">Kelompokkan menu kantin. Produk boleh tidak punya kategori.</p>
      </div>
      <KategoriTable categories={categories ?? []} countByCategory={countByCategory} />
    </div>
  );
}
