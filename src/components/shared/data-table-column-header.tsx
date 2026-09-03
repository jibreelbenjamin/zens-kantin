"use client";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";
import { type Column } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column, title, className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-secondary">
          <span>{title}</span>
          {column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-3.5 w-3.5" />
          ) : column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 h-3.5 w-3.5" />
          ) : (
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
          <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Urutkan Naik
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
          <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Urutkan Turun
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
          <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Sembunyikan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
