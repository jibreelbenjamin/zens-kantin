"use client";
import { DataTable, type ServerTableState } from "@/components/shared/data-table";
import { DataTableFacetedFilter } from "@/components/shared/data-table-faceted-filter";
import { columns } from "./columns";
import type { Profile } from "@/types/database";

const ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Kasir", value: "kasir" },
  { label: "Pelanggan", value: "pelanggan" },
];
const STATUS_OPTIONS = [
  { label: "Aktif", value: "active" },
  { label: "Menunggu", value: "pending" },
  { label: "Diblokir", value: "block" },
];

export function UsersTable({ data, server }: { data: Profile[]; server?: ServerTableState }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      server={server}
      searchPlaceholder="Cari nama / username / email..."
      emptyMessage="Belum ada pengguna."
      toolbar={(table) => (
        <>
          <DataTableFacetedFilter column={table.getColumn("role")} title="Role" options={ROLE_OPTIONS} />
          <DataTableFacetedFilter column={table.getColumn("status")} title="Status" options={STATUS_OPTIONS} />
        </>
      )}
    />
  );
}
