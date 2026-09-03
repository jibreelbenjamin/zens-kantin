import { createClient } from "@/lib/supabase/server";
import { fetchTablePage, type SearchParams } from "@/lib/table-query";
import type { Product } from "@/types/database";
import { ProductsTable } from "./products-table";

export default async function ProdukPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const [{ rows: products, server }, { data: categories }] = await Promise.all([
    fetchTablePage<Product>(supabase, "products", searchParams, {
      searchColumns: ["nama"],
      sortColumns: ["nama", "stok", "modal", "harga_jual", "is_active", "created_at"],
      filterColumns: ["is_active"],
      defaultSort: { column: "created_at", ascending: false },
    }),
    supabase.from("categories").select("*").order("nama"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Produk</h1>
        <p className="text-sm text-muted-foreground">Kelola daftar menu kantin: gambar, kategori, dan harga jual.</p>
      </div>
      <ProductsTable data={products} categories={categories ?? []} server={server} />
    </div>
  );
}
