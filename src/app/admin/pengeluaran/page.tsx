import { createClient } from "@/lib/supabase/server";
import { fetchTablePage, sumColumn, type SearchParams, type TableQueryConfig } from "@/lib/table-query";
import type { Expense } from "@/types/database";
import { ExpensesTable } from "./expenses-table";

const CONFIG: TableQueryConfig = {
  searchColumns: ["nama", "keterangan"],
  sortColumns: ["created_at", "nama", "nominal", "keterangan"],
  defaultSort: { column: "created_at", ascending: false },
};

export default async function PengeluaranPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { rows, server, params } = await fetchTablePage<Expense>(supabase, "expenses", searchParams, CONFIG);
  const total = await sumColumn(supabase, "expenses", "nominal", params, CONFIG);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pengeluaran Khusus</h1>
        <p className="text-sm text-muted-foreground">
          Catat pengeluaran operasional kantin (gas, galon, listrik, dll). Ikut dihitung sebagai pengurang di Laporan.
        </p>
      </div>
      <ExpensesTable data={rows} total={total} server={server} />
    </div>
  );
}
