"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatRupiah, formatDate } from "@/lib/utils";
import type { StockEntry } from "@/types/database";
import { OrderProofDialog } from "@/components/shared/order-proof-dialog";
import { RetractStockButton } from "./retract-stock-button";

export const columns: ColumnDef<StockEntry>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Waktu" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at, true)}</span>,
  },
  { accessorKey: "nama_produk", header: ({ column }) => <DataTableColumnHeader column={column} title="Produk" /> },
  {
    accessorKey: "qty",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Jumlah" />,
    cell: ({ row }) => <span className="tabular-figures">+{row.original.qty}</span>,
  },
  {
    accessorKey: "total_beli",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total Harga Beli" />,
    cell: ({ row }) => <span className="tabular-figures font-medium">{formatRupiah(row.original.total_beli)}</span>,
  },
  {
    accessorKey: "harga_beli_satuan",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Modal / Item" />,
    cell: ({ row }) => <span className="tabular-figures text-muted-foreground">{formatRupiah(row.original.harga_beli_satuan)}</span>,
  },
  {
    id: "struk",
    header: "Struk",
    cell: ({ row }) => row.original.gambar_url ? <OrderProofDialog url={row.original.gambar_url} title={row.original.nama_produk} /> : null,
  },
  {
    id: "actions",
    header: "Aksi",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <RetractStockButton entry={row.original} />
      </div>
    ),
  },
];
