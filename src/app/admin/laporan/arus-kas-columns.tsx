"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { OrderProofDialog } from "@/components/shared/order-proof-dialog";
import { formatRupiah, formatDate } from "@/lib/utils";
import type { Expense, SpecialIncome } from "@/types/database";

/**
 * Baris gabungan Pemasukan Khusus + Pengeluaran Khusus — dipakai KHUSUS di
 * tabel Laporan (read-only, tanpa aksi edit/hapus). Manajemen datanya
 * sendiri-sendiri tetap di halaman Admin → Pemasukan Khusus / Pengeluaran
 * Khusus seperti biasa; ini cuma tampilan gabungan untuk dibaca sekilas.
 */
export type ArusKasRow = {
  id: string;
  created_at: string;
  jenis: "pemasukan" | "pengeluaran";
  nama: string;
  nominal: number;
  keterangan: string | null;
  gambar_url: string | null;
};

export function buildArusKasRows(incomes: SpecialIncome[], expenses: Expense[]): ArusKasRow[] {
  const rows: ArusKasRow[] = [
    ...incomes.map((i) => ({
      id: `income-${i.id}`, created_at: i.created_at, jenis: "pemasukan" as const,
      nama: i.nama, nominal: i.nominal, keterangan: i.keterangan, gambar_url: i.gambar_url,
    })),
    ...expenses.map((e) => ({
      id: `expense-${e.id}`, created_at: e.created_at, jenis: "pengeluaran" as const,
      nama: e.nama, nominal: e.nominal, keterangan: e.keterangan, gambar_url: e.gambar_url,
    })),
  ];
  return rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export const arusKasColumns: ColumnDef<ArusKasRow>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Waktu" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at, true)}</span>,
  },
  {
    accessorKey: "jenis",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Jenis" />,
    cell: ({ row }) => (
      <Badge variant={row.original.jenis === "pemasukan" ? "success" : "destructive"}>
        {row.original.jenis === "pemasukan" ? "Pemasukan Khusus" : "Pengeluaran Khusus"}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
  },
  { accessorKey: "nama", header: ({ column }) => <DataTableColumnHeader column={column} title="Nama" /> },
  {
    accessorKey: "nominal",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nominal" />,
    cell: ({ row }) => {
      const masuk = row.original.jenis === "pemasukan";
      return (
        <span className={`tabular-figures font-medium ${masuk ? "text-success" : "text-destructive"}`}>
          {masuk ? "+" : "−"}{formatRupiah(row.original.nominal)}
        </span>
      );
    },
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
];
