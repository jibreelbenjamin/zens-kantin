"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { ProductImagePlaceholder } from "@/components/shared/product-image-placeholder";
import { StorageImage } from "@/components/shared/storage-image";
import { formatRupiah } from "@/lib/utils";
import type { Product } from "@/types/database";
import { ProductFormDialog } from "./product-form-dialog";
import { DeleteProductButton } from "./delete-product-button";
import { ProductActiveSwitch } from "./product-active-switch";
import type { Category } from "@/types/database";

export function getColumns(categories: Category[] = []): ColumnDef<Product>[] {
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.nama]));
  return [
    {
      accessorKey: "nama",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Produk" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border">
            {row.original.gambar_url ? (
              <StorageImage src={row.original.gambar_url} alt={row.original.nama} fill sizes="36px" className="object-cover" showLabel={false} />
            ) : (
              <ProductImagePlaceholder />
            )}
          </div>
          <span className="font-medium">{row.original.nama}</span>
        </div>
      ),
    },
    {
      id: "kategori",
      accessorFn: (row) => (row.kategori_id ? categoryMap[row.kategori_id] ?? "-" : "Tanpa Kategori"),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Kategori" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.kategori_id ? categoryMap[row.original.kategori_id] ?? "-" : "Tanpa Kategori"}
        </span>
      ),
    },
    {
      accessorKey: "stok",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Stok" />,
      cell: ({ row }) =>
        row.original.stok === 0 ? (
          <Badge variant="destructive">Stok Kosong</Badge>
        ) : (
          <span className="tabular-figures">
            {row.original.stok}
            {row.original.stok <= 5 && <Badge variant="warning" className="ml-2">menipis</Badge>}
          </span>
        ),
    },
    {
      accessorKey: "modal",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Modal" />,
      cell: ({ row }) => <span className="tabular-figures">{formatRupiah(row.original.modal)}</span>,
    },
    {
      accessorKey: "harga_jual",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Harga Jual" />,
      cell: ({ row }) => <span className="tabular-figures font-medium">{formatRupiah(row.original.harga_jual)}</span>,
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <ProductActiveSwitch id={row.original.id} isActive={row.original.is_active} />,
      filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
    },
    {
      id: "actions",
      header: "Aksi",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <ProductFormDialog product={row.original} categories={categories} />
          <DeleteProductButton id={row.original.id} nama={row.original.nama} />
        </div>
      ),
    },
  ];
}
