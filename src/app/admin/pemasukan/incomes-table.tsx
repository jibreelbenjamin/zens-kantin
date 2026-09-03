"use client";
import { DataTable, type ServerTableState } from "@/components/shared/data-table";
import { columns } from "./columns";
import { IncomeFormDialog } from "./income-form-dialog";
import { formatRupiah } from "@/lib/utils";
import type { SpecialIncome } from "@/types/database";

export function IncomesTable({
  data, total, server,
}: { data: SpecialIncome[]; total: number; server?: ServerTableState }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Total tercatat: <span className="font-semibold text-success">{formatRupiah(total)}</span>
      </p>
      <DataTable
        columns={columns}
        data={data}
        server={server}
        searchPlaceholder="Cari pemasukan..."
        emptyMessage="Belum ada pemasukan khusus tercatat."
        toolbar={() => <IncomeFormDialog />}
      />
    </div>
  );
}
