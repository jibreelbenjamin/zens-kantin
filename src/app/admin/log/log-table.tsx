"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type ServerTableState } from "@/components/shared/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { DataTableFacetedFilter } from "@/components/shared/data-table-faceted-filter";
import { formatDate } from "@/lib/utils";
import type { ActivityLog } from "@/types/database";
import { LogDetailDialog } from "./log-detail-dialog";

const AKSI_LABEL: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  login: { label: "Login", variant: "secondary" },
  login_gagal: { label: "Login Gagal", variant: "destructive" },
  logout: { label: "Logout", variant: "secondary" },
  daftar: { label: "Daftar", variant: "warning" },
  profil_ubah: { label: "Profil Diubah", variant: "secondary" },
  user_status_ubah: { label: "Status Akun Diubah", variant: "success" },
  user_role_ubah: { label: "Role Diubah", variant: "success" },
  user_reset_password: { label: "Reset Password", variant: "warning" },
  pesanan_masuk: { label: "Pesanan Masuk", variant: "secondary" },
  pembayaran: { label: "Pembayaran", variant: "success" },
  pesanan_dibatalkan: { label: "Pesanan Dibatalkan", variant: "destructive" },
  pesanan_tidak_dibayar: { label: "Tidak Dibayar", variant: "destructive" },
  pesanan_disampingkan: { label: "Sampingkan Pesanan", variant: "secondary" },
  klaim_bayar: { label: "Klaim Sudah Bayar", variant: "warning" },
  stok_masuk: { label: "Stok Masuk", variant: "secondary" },
  stok_ditarik: { label: "Stok Ditarik Kembali", variant: "warning" },
  stok_dihapus: { label: "Stok Dihapus", variant: "destructive" },
  stok_hapus_dibatalkan: { label: "Hapus Stok Dibatalkan", variant: "secondary" },
  produk_tambah: { label: "Produk Ditambah", variant: "success" },
  produk_ubah: { label: "Produk Diubah", variant: "secondary" },
  produk_hapus: { label: "Produk Dihapus", variant: "destructive" },
  kategori_ubah: { label: "Kategori Diubah", variant: "secondary" },
  metode_pembayaran_ubah: { label: "Metode Pembayaran Diubah", variant: "secondary" },
  pengaturan_ubah: { label: "Pengaturan Diubah", variant: "secondary" },
  pengeluaran_khusus: { label: "Pengeluaran Khusus", variant: "warning" },
  pemasukan_khusus: { label: "Pemasukan Khusus", variant: "success" },
  pelanggan_tambah: { label: "Pelanggan Ditambah", variant: "success" },
  pelanggan_hapus: { label: "Pelanggan Dihapus", variant: "destructive" },
  export_data: { label: "Export Laporan", variant: "secondary" },
  file_hapus: { label: "File Dihapus", variant: "destructive" },
  file_bersih_otomatis: { label: "File Dibersihkan Otomatis", variant: "warning" },
  kasir_pin_gagal: { label: "PIN Kasir Gagal", variant: "destructive" },
  kasir_dibuka: { label: "Kasir Dibuka", variant: "secondary" },
  kasir_dikunci: { label: "Kasir Dikunci", variant: "secondary" },
  laporan_bulanan_dikirim: { label: "Laporan Bulanan Dikirim", variant: "success" },
};

const columns: ColumnDef<ActivityLog>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Waktu" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at, true)}</span>,
  },
  { accessorKey: "nama_user", header: ({ column }) => <DataTableColumnHeader column={column} title="Pengguna" /> },
  {
    accessorKey: "aksi",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Aksi" />,
    cell: ({ row }) => {
      const cfg = AKSI_LABEL[row.original.aksi] ?? { label: row.original.aksi, variant: "secondary" as const };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  { accessorKey: "deskripsi", header: ({ column }) => <DataTableColumnHeader column={column} title="Detail" /> },
  {
    id: "lokasi",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lokasi" />,
    cell: ({ row }) => {
      const { kota, negara } = row.original;
      const text = [kota, negara].filter(Boolean).join(", ");
      return <span className="text-sm text-muted-foreground">{text || "-"}</span>;
    },
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    cell: ({ row }) => (
      <LogDetailDialog
        log={row.original}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Detail aktivitas">
            <Info className="h-3.5 w-3.5" />
          </Button>
        }
      />
    ),
  },
];

function ResetButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function reset() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/log", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Log aktivitas direset.");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal reset", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Reset Log
        </Button>
      }
      title="Reset seluruh log aktivitas?"
      description="Semua riwayat log akan dihapus permanen. Log juga direset otomatis setiap awal bulan."
      confirmLabel="Ya, Reset"
      destructive
      loading={loading}
      onConfirm={reset}
    />
  );
}

const AKSI_OPTIONS = Object.entries(AKSI_LABEL).map(([value, { label }]) => ({ value, label }));

export function LogTable({ data, server }: { data: ActivityLog[]; server?: ServerTableState }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      server={server}
      searchPlaceholder="Cari pengguna / detail..."
      emptyMessage="Belum ada aktivitas tercatat."
      toolbar={(table) => (
        <>
          <DataTableFacetedFilter column={table.getColumn("aksi")} title="Aksi" options={AKSI_OPTIONS} />
          <div className="ml-auto"><ResetButton /></div>
        </>
      )}
    />
  );
}
