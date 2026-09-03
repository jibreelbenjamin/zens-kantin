"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ColumnDef, type ColumnFiltersState, type PaginationState, type SortingState, type VisibilityState,
  flexRender, getCoreRowModel, getFacetedRowModel, getFacetedUniqueValues,
  getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
} from "@tanstack/react-table";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableViewOptions } from "./data-table-view-options";

/**
 * State tabel yang datang dari server (hasil `fetchTablePage`). Kalau prop ini
 * ada, DataTable beralih ke mode pagination sisi server: pencarian, urutan,
 * filter, dan halaman disimpan di URL lalu di-query ulang oleh server component,
 * jadi browser cuma memegang satu halaman data.
 */
export type ServerTableState = {
  rowCount: number;
  pageIndex: number;
  pageSize: number;
  q: string;
  sort: string | null;
  dir: "asc" | "desc";
  filters: Record<string, string[]>;
  sortColumns: string[];
  prefix: string;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  /** Render tambahan filter (mis. DataTableFacetedFilter) di toolbar kiri */
  toolbar?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode;
  emptyMessage?: string;
  server?: ServerTableState;
}

/** Cari string kueri di SEMUA nilai primitif baris (bukan cuma satu kolom). */
function globalFilterFn(row: { original: unknown }, _columnId: string, filterValue: string) {
  const query = filterValue.trim().toLowerCase();
  if (!query) return true;
  const values = Object.values(row.original as Record<string, unknown>);
  return values.some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "object") return false;
    return String(v).toLowerCase().includes(query);
  });
}

function columnId(column: ColumnDef<any, any>): string {
  return String(column.id ?? (column as { accessorKey?: string }).accessorKey ?? "");
}

export function DataTable<TData extends { id?: string | number }, TValue>({
  columns, data, searchPlaceholder = "Cari...", toolbar, emptyMessage = "Belum ada data.", server,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const prefix = server?.prefix ?? "";

  /** Tulis ulang query string; nilai null/array kosong berarti hapus parameter. */
  const setParams = React.useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        next.delete(key);
        if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
        else if (value !== null && value !== "") next.set(key, value);
      }
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router, searchParams]
  );

  const [sorting, setSorting] = React.useState<SortingState>(
    server?.sort ? [{ id: server.sort, desc: server.dir === "desc" }] : []
  );
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    server ? Object.entries(server.filters).map(([id, value]) => ({ id, value })) : []
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: server?.pageIndex ?? 0,
    pageSize: server?.pageSize ?? 10,
  });
  // Kotak pencarian dikelola lokal supaya ketikan tidak lag, baru dikirim ke
  // URL setelah pengguna berhenti mengetik.
  const [search, setSearch] = React.useState(server?.q ?? "");

  // Sidik jari state server: dipakai supaya sinkronisasi di bawah cuma jalan
  // saat URL/data benar-benar berubah, bukan tiap kali komponen render ulang.
  const serverKey = server
    ? [server.pageIndex, server.pageSize, server.q, server.sort, server.dir, JSON.stringify(server.filters)].join("|")
    : "";

  // Samakan lagi state tabel dengan URL setelah server selesai mengirim data
  // (mis. saat pengguna menekan tombol back browser).
  const serverRef = React.useRef(server);
  serverRef.current = server;
  React.useEffect(() => {
    const server = serverRef.current;
    if (!server) return;
    setPagination({ pageIndex: server.pageIndex, pageSize: server.pageSize });
    setSorting(server.sort ? [{ id: server.sort, desc: server.dir === "desc" }] : []);
    setColumnFilters(Object.entries(server.filters).map(([id, value]) => ({ id, value })));
    setSearch(server.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const serverQuery = server?.q ?? "";
  React.useEffect(() => {
    if (!serverRef.current || search === serverQuery) return;
    const timer = setTimeout(() => setParams({ [`${prefix}q`]: search || null, [`${prefix}page`]: null }), 350);
    return () => clearTimeout(timer);
  }, [search, serverQuery, prefix, setParams]);

  // Di mode server hanya kolom yang benar-benar ada di database yang bisa
  // diurutkan — kolom hasil hitungan (mis. "untung") tidak punya padanan SQL.
  const tableColumns = React.useMemo(() => {
    if (!server) return columns;
    return columns.map((c) => ({ ...c, enableSorting: server.sortColumns.includes(columnId(c)) }));
  }, [columns, server]);

  const table = useReactTable<TData>({
    data, columns: tableColumns,
    // Kunci baris berdasarkan id entitas asli (bukan index posisi) — supaya
    // form edit per baris (mis. dialog edit produk) tidak "nyangkut" data
    // lama saat urutan/isi baris berubah (mis. setelah tambah data baru).
    getRowId: (row: any) => String(row.id ?? row.key ?? JSON.stringify(row)),
    state: server
      ? { sorting, columnFilters, columnVisibility, pagination }
      : { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      if (!server) return;
      const first = next[0];
      setParams({
        [`${prefix}sort`]: first ? first.id : null,
        [`${prefix}dir`]: first ? (first.desc ? "desc" : "asc") : null,
        [`${prefix}page`]: null,
      });
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(next);
      if (!server) return;
      const updates: Record<string, string[] | null> = { [`${prefix}page`]: null };
      for (const id of new Set([...columnFilters.map((f) => f.id), ...next.map((f) => f.id)])) {
        const value = next.find((f) => f.id === id)?.value as string[] | undefined;
        updates[`${prefix}f_${id}`] = value?.length ? value.map(String) : null;
      }
      setParams(updates);
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      setPagination(next);
      if (!server) return;
      setParams({
        [`${prefix}page`]: next.pageIndex > 0 ? String(next.pageIndex + 1) : null,
        [`${prefix}per`]: next.pageSize === 10 ? null : String(next.pageSize),
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    manualPagination: !!server,
    manualSorting: !!server,
    manualFiltering: !!server,
    rowCount: server?.rowCount,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const isFiltered = server
    ? columnFilters.length > 0 || !!server.q || !!search
    : columnFilters.length > 0 || !!globalFilter;

  function resetFilters() {
    table.resetColumnFilters();
    setGlobalFilter("");
    setSearch("");
    if (!server) return;
    const updates: Record<string, null> = { [`${prefix}q`]: null, [`${prefix}page`]: null };
    for (const f of columnFilters) updates[`${prefix}f_${f.id}`] = null;
    setParams(updates);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={server ? search : globalFilter}
          onChange={(e) => (server ? setSearch(e.target.value) : setGlobalFilter(e.target.value))}
          className="h-8 w-full sm:w-56"
        />
        {toolbar?.(table)}
        {isFiltered && (
          <Button variant="ghost" size="sm" className="h-8 px-2 lg:px-3" onClick={resetFilters}>
            Reset <X className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
        <DataTableViewOptions table={table} />
      </div>
      <div className={cn("transition-opacity", isPending && "pointer-events-none opacity-60")}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {isFiltered ? "Tidak ada data yang cocok." : emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
