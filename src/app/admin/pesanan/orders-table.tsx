"use client";
import * as React from "react";
import { DataTable, type ServerTableState } from "@/components/shared/data-table";
import { DataTableFacetedFilter } from "@/components/shared/data-table-faceted-filter";
import { getColumns } from "./columns";
import type { Order } from "@/types/database";

// "Tidak Dibayar" (v8) sudah dipensiunkan di v10 — tidak lagi jadi opsi
// filter karena tidak akan ada baris baru dengan status itu (baris lama,
// kalau ada, tetap tampil apa adanya lewat StatusBadge).
const STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Lunas", value: "paid" },
  { label: "Dibatalkan", value: "cancelled" },
];

export function OrdersTable({
  data, kasirMap = {}, paymentNames = [], server,
}: {
  data: Order[];
  kasirMap?: Record<string, string>;
  /** Daftar metode pembayaran dari server — opsi filter tidak lagi disimpulkan
   *  dari baris yang kebetulan tampil di halaman ini. */
  paymentNames?: string[];
  server?: ServerTableState;
}) {
  const columns = React.useMemo(() => getColumns(kasirMap), [kasirMap]);
  const paymentOptions = React.useMemo(
    () => paymentNames.map((n) => ({ label: n, value: n })),
    [paymentNames]
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      server={server}
      searchPlaceholder="Cari pelanggan / produk..."
      emptyMessage="Belum ada pesanan."
      toolbar={(table) => (
        <>
          <DataTableFacetedFilter column={table.getColumn("status_pembayaran")} title="Status" options={STATUS_OPTIONS} />
          {paymentOptions.length > 0 && (
            <DataTableFacetedFilter column={table.getColumn("nama_pembayaran")} title="Pembayaran" options={paymentOptions} />
          )}
        </>
      )}
    />
  );
}
