import { createClient } from "@/lib/supabase/server";
import { fetchTablePage, type SearchParams } from "@/lib/table-query";
import type { StockEntry, StockWriteoff } from "@/types/database";
import { StokTabs } from "./stok-tabs";

export default async function StokPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  // Dua tabel dalam satu halaman, jadi parameter URL-nya diberi awalan
  // ("m" untuk stok masuk, "h" untuk penghapusan) supaya tidak saling timpa.
  const [entries, writeoffs, { data: products }] = await Promise.all([
    fetchTablePage<StockEntry>(supabase, "stock_entries", searchParams, {
      prefix: "m",
      searchColumns: ["nama_produk"],
      sortColumns: ["created_at", "nama_produk", "qty", "total_beli", "harga_beli_satuan"],
      defaultSort: { column: "created_at", ascending: false },
    }),
    fetchTablePage<StockWriteoff>(supabase, "stock_writeoffs", searchParams, {
      prefix: "h",
      searchColumns: ["nama_produk", "keterangan"],
      sortColumns: ["created_at", "nama_produk", "qty", "kerugian", "keterangan"],
      filterColumns: ["kembalikan_kerugian"],
      defaultSort: { column: "created_at", ascending: false },
    }),
    supabase.from("products").select("id,nama,modal,stok").order("nama"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Manajemen Stok</h1>
        <p className="text-sm text-muted-foreground">Catat barang masuk dan penghapusan stok (rusak/hilang/kadaluarsa).</p>
      </div>
      <StokTabs
        entries={entries.rows}
        entriesServer={entries.server}
        writeoffs={writeoffs.rows}
        writeoffsServer={writeoffs.server}
        products={products ?? []}
        tab={searchParams.tab === "hapus" ? "hapus" : "masuk"}
      />
    </div>
  );
}
