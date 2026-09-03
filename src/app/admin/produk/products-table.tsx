"use client";
import * as React from "react";
import { DataTable, type ServerTableState } from "@/components/shared/data-table";
import { getColumns } from "./columns";
import { ProductFormDialog } from "./product-form-dialog";
import type { Category, Product } from "@/types/database";

export function ProductsTable({
  data, categories, server,
}: { data: Product[]; categories: Category[]; server?: ServerTableState }) {
  const columns = React.useMemo(() => getColumns(categories), [categories]);

  return (
    <DataTable
      columns={columns}
      data={data}
      server={server}
      searchPlaceholder="Cari produk..."
      emptyMessage="Belum ada produk. Tambahkan produk pertama kamu."
      toolbar={() => <ProductFormDialog categories={categories} />}
    />
  );
}
