"use client";
import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ComboboxItem = {
  value: string;
  label: string;
  /** Teks kecil tambahan di bawah label (mis. "stok 12"). */
  meta?: string;
  disabled?: boolean;
};

/**
 * Combobox sederhana (dropdown + pencarian) tanpa dependensi tambahan
 * (tidak pakai cmdk) — dibangun dari Popover + Input yang sudah ada.
 * Cocok untuk daftar panjang (mis. daftar produk) yang merepotkan kalau
 * dipilih lewat <select> biasa.
 */
export function Combobox({
  items,
  value,
  onChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyMessage = "Tidak ditemukan.",
  disabled,
  className,
}: {
  items: ComboboxItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = items.find((i) => i.value === value);
  const filtered = query.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="relative border-b p-2">
          <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.value}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40",
                item.value === value && "bg-secondary/70"
              )}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", item.value === value ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.meta && <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
