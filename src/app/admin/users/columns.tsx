"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { RowActions } from "./row-actions";

export const columns: ColumnDef<Profile>[] = [
  {
    accessorKey: "nama",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nama" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <UserAvatar nama={row.original.nama} avatarUrl={row.original.avatar_url} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.original.nama}</p>
          <p className="truncate text-xs text-muted-foreground">@{row.original.username}</p>
        </div>
      </div>
    ),
  },
  { accessorKey: "email", header: ({ column }) => <DataTableColumnHeader column={column} title="Email" /> },
  {
    accessorKey: "role",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    cell: ({ row }) => <StatusBadge value={row.original.role} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <StatusBadge value={row.original.status} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Terdaftar" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.created_at)}</span>,
  },
  {
    id: "actions",
    header: "Aksi",
    enableHiding: false,
    cell: ({ row }) => <RowActions user={row.original} />,
  },
];
