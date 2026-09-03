"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatRupiah, formatDate } from "@/lib/utils";
import type { StockWriteoff } from "@/types/database";
import { UndoWriteoffButton } from "./undo-writeoff-button";

export const writeoffColumns: ColumnDef<StockWriteoff>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Waktu" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at, true)}</span>,
  },
  { accessorKey: "nama_produk", header: ({ column }) => <DataTableColumnHeader column={column} title="Produk" /> },
  {
    accessorKey: "qty",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Jumlah" />,
    cell: ({ row }) => <span className="tabular-figures text-destructive">−{row.original.qty}</span>,
  },
  {
    accessorKey: "kembalikan_kerugian",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Jenis" />,
    cell: ({ row }) => (
      <Badge variant={row.original.kembalikan_kerugian ? "success" : "secondary"}>
        {row.original.kembalikan_kerugian ? "Kerugian Dikembalikan" : "Tetap Kerugian"}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
  },
  {
    accessorKey: "kerugian",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nilai Dikembalikan" />,
    cell: ({ row }) => (
      <span className="tabular-figures font-medium">
        {row.original.kembalikan_kerugian ? formatRupiah(row.original.kerugian) : "-"}
      </span>
    ),
  },
  {
    accessorKey: "keterangan",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Keterangan" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.keterangan ?? "-"}</span>,
  },
  {
    id: "actions",
    header: "Aksi",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <UndoWriteoffButton writeoff={row.original} />
      </div>
    ),
  },
];
