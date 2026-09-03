import { createClient } from "@/lib/supabase/server";
import { fetchTablePage, sumColumn, type SearchParams, type TableQueryConfig } from "@/lib/table-query";
import type { SpecialIncome } from "@/types/database";
import { IncomesTable } from "./incomes-table";

const CONFIG: TableQueryConfig = {
  searchColumns: ["nama", "keterangan"],
  sortColumns: ["created_at", "nama", "nominal", "keterangan"],
  defaultSort: { column: "created_at", ascending: false },
};

export default async function PemasukanPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { rows, server, params } = await fetchTablePage<SpecialIncome>(supabase, "special_incomes", searchParams, CONFIG);
  const total = await sumColumn(supabase, "special_incomes", "nominal", params, CONFIG);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pemasukan Khusus</h1>
        <p className="text-sm text-muted-foreground">
          Catat pemasukan di luar penjualan produk (mis. jual barang bekas, sewa tempat, donasi). Ikut menambah keuntungan di Laporan.
        </p>
      </div>
      <IncomesTable data={rows} total={total} server={server} />
    </div>
  );
}
