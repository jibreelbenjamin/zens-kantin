import { createClient } from "@/lib/supabase/server";
import { fetchTablePage, type SearchParams } from "@/lib/table-query";
import type { ActivityLog } from "@/types/database";
import { LogTable } from "./log-table";

export default async function LogPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { rows: logs, server } = await fetchTablePage<ActivityLog>(supabase, "activity_logs", searchParams, {
    searchColumns: ["nama_user", "deskripsi", "kota", "negara"],
    sortColumns: ["created_at", "nama_user", "aksi", "deskripsi"],
    filterColumns: ["aksi"],
    defaultSort: { column: "created_at", ascending: false },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Log Aktivitas</h1>
        <p className="text-sm text-muted-foreground">
          Riwayat login, pendaftaran, approval, pesanan, dan pembayaran. Direset otomatis setiap awal bulan.
        </p>
      </div>
      <LogTable data={logs} server={server} />
    </div>
  );
}
