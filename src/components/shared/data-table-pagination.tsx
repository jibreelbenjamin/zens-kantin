"use client";
import { type Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function DataTablePagination<TData>({ table }: { table: Table<TData> }) {
  const selected = table.getFilteredSelectedRowModel().rows.length;
  // Di mode pagination server, jumlah baris datang dari `count` query (total
  // seluruh data yang cocok), bukan dari baris yang kebetulan ada di memori.
  const total = table.options.manualPagination
    ? table.getRowCount()
    : table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 py-2 text-xs sm:text-sm">
      <p className="text-muted-foreground">
        {selected > 0 ? `${selected}/${total} dipilih` : `${total} baris`}
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5">
        <div className="hidden items-center gap-1.5 sm:flex">
          <p className="text-muted-foreground">Baris/hal</p>
          <Select value={`${table.getState().pagination.pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger className="h-7 w-[64px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50, 100].map((ps) => (
                <SelectItem key={ps} value={`${ps}`}>{ps}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="whitespace-nowrap font-medium text-foreground">
          {table.getState().pagination.pageIndex + 1}/{Math.max(table.getPageCount(), 1)}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="hidden h-7 w-7 sm:inline-flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="hidden h-7 w-7 sm:inline-flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
