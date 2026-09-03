"use client";
import { DataTable, type ServerTableState } from "@/components/shared/data-table";
import { columns } from "./columns";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { formatRupiah } from "@/lib/utils";
import type { Expense } from "@/types/database";

export function ExpensesTable({
  data, total, server,
}: { data: Expense[]; total: number; server?: ServerTableState }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Total tercatat: <span className="font-semibold text-destructive">{formatRupiah(total)}</span>
      </p>
      <DataTable
        columns={columns}
        data={data}
        server={server}
        searchPlaceholder="Cari pengeluaran..."
        emptyMessage="Belum ada pengeluaran tercatat."
        toolbar={() => <ExpenseFormDialog />}
      />
    </div>
  );
}
