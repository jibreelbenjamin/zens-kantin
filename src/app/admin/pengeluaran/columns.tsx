"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { OrderProofDialog } from "@/components/shared/order-proof-dialog";
import { formatRupiah, formatDate } from "@/lib/utils";
import type { Expense } from "@/types/database";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { DeleteExpenseButton } from "./delete-expense-button";

export const columns: ColumnDef<Expense>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Waktu" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at, true)}</span>,
  },
  { accessorKey: "nama", header: ({ column }) => <DataTableColumnHeader column={column} title="Pengeluaran" /> },
  {
    accessorKey: "nominal",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nominal" />,
    cell: ({ row }) => <span className="tabular-figures font-medium text-destructive">−{formatRupiah(row.original.nominal)}</span>,
  },
  {
    accessorKey: "keterangan",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Keterangan" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.keterangan ?? "-"}</span>,
  },
  {
    id: "bukti",
    header: "Bukti",
    enableHiding: false,
    cell: ({ row }) => row.original.gambar_url ? <OrderProofDialog url={row.original.gambar_url} title={row.original.nama} /> : null,
  },
  {
    id: "actions",
    header: "Aksi",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <ExpenseFormDialog expense={row.original} />
        <DeleteExpenseButton id={row.original.id} nama={row.original.nama} />
      </div>
    ),
  },
];
