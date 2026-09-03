"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Minus } from "lucide-react";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatRupiah, formatDate } from "@/lib/utils";
import type { Order } from "@/types/database";
import { OrderProofDialog } from "@/components/shared/order-proof-dialog";

export function getColumns(kasirMap: Record<string, string> = {}): ColumnDef<Order>[] {
  return [
    {
      accessorKey: "created_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Waktu" />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at, true)}</span>,
    },
    {
      accessorKey: "nama_pemesan",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Pelanggan" />,
    },
    {
      accessorKey: "nama_produk",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Produk" />,
      cell: ({ row }) => <span>{row.original.nama_produk} <span className="text-muted-foreground">×{row.original.qty}</span></span>,
    },
    {
      accessorKey: "nama_pembayaran",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Pembayaran" />,
      cell: ({ row }) => row.original.nama_pembayaran ?? <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "harga_total",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Harga" />,
      cell: ({ row }) => <span className="tabular-figures font-medium">{formatRupiah(row.original.harga_total)}</span>,
    },
    {
      accessorKey: "modal_total",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Modal" />,
      cell: ({ row }) => <span className="tabular-figures text-muted-foreground">{formatRupiah(row.original.modal_total)}</span>,
    },
    {
      id: "untung",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Untung" />,
      accessorFn: (row) => row.harga_total - row.modal_total,
      cell: ({ row }) => {
        const untung = row.original.harga_total - row.original.modal_total;
        return <span className={`tabular-figures font-medium ${untung >= 0 ? "text-success" : "text-destructive"}`}>{formatRupiah(untung)}</span>;
      },
    },
    {
      id: "kasir",
      accessorFn: (row) => (row.kasir_id ? kasirMap[row.kasir_id] ?? "-" : "-"),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Kasir" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.kasir_id ? kasirMap[row.original.kasir_id] ?? "-" : <Minus className="h-3.5 w-3.5" />}
        </span>
      ),
    },
    {
      accessorKey: "status_pembayaran",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      // Status pesanan cuma bisa diubah oleh kasir lewat halaman kasir —
      // di sini admin hanya bisa melihat (read-only) supaya tidak menimpa
      // alur konfirmasi pembayaran/pembatalan yang sedang berjalan di kasir.
      cell: ({ row }) => <StatusBadge value={row.original.status_pembayaran} />,
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      id: "bukti",
      header: "Bukti",
      enableHiding: false,
      cell: ({ row }) => row.original.bukti_bayar_url ? <OrderProofDialog url={row.original.bukti_bayar_url} title={`${row.original.nama_pemesan} · ${row.original.nama_produk}`} /> : null,
    },
  ];
}
