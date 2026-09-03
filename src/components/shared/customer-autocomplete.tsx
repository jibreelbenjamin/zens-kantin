"use client";
import * as React from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { SavedCustomer } from "@/types/database";

/**
 * Combobox nama pemesan: input teks BEBAS (boleh ketik nama baru apa saja,
 * default "Pelanggan Langsung") DITAMBAH daftar dropdown nama pelanggan
 * yang sudah tersimpan — beda dari <Combobox> biasa di app ini yang cuma
 * bisa pilih dari daftar tetap, di sini mengetik bebas tetap harus bisa
 * jalan karena kasir sering input nama pelanggan baru yang belum tersimpan.
 * Tombol chevron di kanan buka/tutup daftar tanpa perlu mulai mengetik dulu.
 */
export function CustomerAutocomplete({
  value, onChange, placeholder = "Pelanggan Langsung", disabled,
}: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  const [customers, setCustomers] = React.useState<SavedCustomer[]>([]);
  const [open, setOpen] = React.useState(false);
  const [confirmTarget, setConfirmTarget] = React.useState<SavedCustomer | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch("/api/pelanggan")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setCustomers(json.data ?? []))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const suggestions = value.trim()
    ? customers.filter((c) => c.nama.toLowerCase().includes(value.toLowerCase()))
    : customers;

  async function confirmRemove() {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pelanggan/${confirmTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setCustomers((prev) => prev.filter((c) => c.id !== confirmTarget.id));
      toast.success(`"${confirmTarget.nama}" dihapus dari daftar.`);
      setConfirmTarget(null);
    } catch (err: any) {
      toast.error("Gagal menghapus", { description: err.message });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        aria-label="Buka daftar nama pelanggan tersimpan"
      >
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-secondary">
              <button type="button" className="flex-1 truncate text-left" onClick={() => { onChange(c.nama); setOpen(false); }}>
                {c.nama}
              </button>
              <button
                type="button"
                className="ml-2 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setConfirmTarget(c); }}
                title="Hapus dari daftar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
        title={`Hapus "${confirmTarget?.nama}" dari daftar?`}
        description="Nama ini tidak akan muncul lagi di saran autocomplete."
        confirmLabel="Ya, Hapus"
        destructive
        loading={deleting}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
