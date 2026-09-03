"use client";
import * as React from "react";
import { Check, PlusCircle } from "lucide-react";
import { type Column } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title: string;
  options: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[];
}

export function DataTableFacetedFilter<TData, TValue>({
  column, title, options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const selectedValues = new Set(column?.getFilterValue() as string[]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-2 h-3.5 w-3.5" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedValues.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">{selectedValues.size} dipilih</Badge>
                ) : (
                  options.filter((o) => selectedValues.has(o.value)).map((o) => (
                    <Badge variant="secondary" key={o.value} className="rounded-sm px-1 font-normal">{o.label}</Badge>
                  ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <div className="max-h-64 overflow-y-auto p-1">
          {options.map((option) => {
            const isSelected = selectedValues.has(option.value);
            return (
              <button
                key={option.value}
                onClick={() => {
                  if (isSelected) selectedValues.delete(option.value);
                  else selectedValues.add(option.value);
                  const filterValues = Array.from(selectedValues);
                  column?.setFilterValue(filterValues.length ? filterValues : undefined);
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-secondary"
              >
                <div
                  className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
