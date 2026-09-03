"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { formatRupiah, formatDate } from "@/lib/utils";
import type { StockEntry, StockWriteoff } from "@/types/database";

/**
 * Baris gabungan Input Stok (masuk) + Penghapusan Stok (keluar) — dipakai
 * KHUSUS di tabel Laporan (read-only, tanpa aksi apa pun). Manajemen
 * datanya sendiri-sendiri tetap di halaman Admin → Stok seperti biasa;
 * ini cuma tampilan "Distribusi Stok" gabungan supaya arus masuk & keluar
 * stok bisa dibaca dalam satu tabel yang sama.
 */
export type DistribusiStokRow = {
  id: string;
  created_at: string;
  jenis: "masuk" | "keluar";
  nama_produk: string;
  qty: number;
  nilai: number | null;
  keterangan: string | null;
};

export function buildDistribusiStokRows(entries: StockEntry[], writeoffs: StockWriteoff[]): DistribusiStokRow[] {
  const rows: DistribusiStokRow[] = [
    ...entries.map((e) => ({
      id: `entry-${e.id}`, created_at: e.created_at, jenis: "masuk" as const,
      nama_produk: e.nama_produk, qty: e.qty, nilai: e.total_beli, keterangan: null,
    })),
    ...writeoffs.map((w) => ({
      id: `writeoff-${w.id}`, created_at: w.created_at, jenis: "keluar" as const,
      nama_produk: w.nama_produk, qty: w.qty,
      nilai: w.kembalikan_kerugian ? w.kerugian : null,
      keterangan: w.keterangan,
    })),
  ];
  return rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export const distribusiStokColumns: ColumnDef<DistribusiStokRow>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Waktu" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at, true)}</span>,
  },
  { accessorKey: "nama_produk", header: ({ column }) => <DataTableColumnHeader column={column} title="Produk" /> },
  {
    accessorKey: "jenis",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Jenis" />,
    cell: ({ row }) => (
      <Badge variant={row.original.jenis === "masuk" ? "success" : "destructive"}>
        {row.original.jenis === "masuk" ? "Stok Masuk" : "Stok Keluar"}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
  },
  {
    accessorKey: "qty",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Jumlah" />,
    cell: ({ row }) => {
      const masuk = row.original.jenis === "masuk";
      return (
        <span className={`tabular-figures font-medium ${masuk ? "text-success" : "text-destructive"}`}>
          {masuk ? "+" : "−"}{row.original.qty}
        </span>
      );
    },
  },
  {
    accessorKey: "nilai",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nilai" />,
    cell: ({ row }) => {
      const { jenis, nilai } = row.original;
      if (nilai == null) {
        return <span className="text-sm text-muted-foreground">{jenis === "keluar" ? "Tidak dikembalikan" : "-"}</span>;
      }
      return (
        <span className={`tabular-figures ${jenis === "masuk" ? "text-destructive" : "text-success"}`}>
          {formatRupiah(nilai)}
        </span>
      );
    },
  },
  {
    accessorKey: "keterangan",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Keterangan" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.keterangan ?? "-"}</span>,
  },
];
