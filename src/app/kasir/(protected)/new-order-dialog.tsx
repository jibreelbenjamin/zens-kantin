"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerAutocomplete } from "@/components/shared/customer-autocomplete";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { StorageImage } from "@/components/shared/storage-image";
import { useRealtimeProducts } from "@/hooks/use-realtime-products";
import { formatRupiah, sortStockAware } from "@/lib/utils";
import type { PaymentMethod, Product } from "@/types/database";

export function NewOrderDialog({ products: initialProducts, paymentMethods }: { products: Product[]; paymentMethods: PaymentMethod[] }) {
  const router = useRouter();
  const products = useRealtimeProducts(initialProducts);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [nama, setNama] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [paymentId, setPaymentId] = React.useState(paymentMethods[0]?.id ?? "");

  React.useEffect(() => {
    if (!open) {
      setNama(""); setQuery(""); setCart({}); setPaymentId(paymentMethods[0]?.id ?? "");
    }
  }, [open, paymentMethods]);

  const productsById = React.useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const visibleProducts = React.useMemo(
    () => sortStockAware(products.filter((p) => p.is_active && p.nama.toLowerCase().includes(query.toLowerCase()))),
    [products, query]
  );
  const cartLines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: productsById[id], qty }))
    .filter((l) => l.product);
  const total = cartLines.reduce((s, l) => s + l.qty * l.product.harga_jual, 0);
  const selectedMethod = paymentMethods.find((m) => m.id === paymentId);
  const showPaymentInfo = !!selectedMethod?.tampilkan_info_pembayaran
    && ((selectedMethod.tampilkan_teks && selectedMethod.info_teks) || (selectedMethod.tampilkan_gambar && selectedMethod.info_gambar_url));

  function updateQty(id: string, delta: number) {
    setCart((prev) => {
      const stock = productsById[id]?.stok ?? 0;
      const next = Math.max(0, Math.min(stock, (prev[id] ?? 0) + delta));
      return { ...prev, [id]: next };
    });
  }

  async function submit() {
    if (!cartLines.length) {
      toast.error("Pilih minimal satu produk.");
      return;
    }
    if (!paymentId) {
      toast.error("Pilih metode pembayaran.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartLines.map((l) => ({ produk_id: l.product.id, qty: l.qty })),
          pembayaran_id: paymentId,
          nama_pemesan: nama || "Pelanggan Langsung",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat pesanan.");
      toast.success("Pesanan dibuat.");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal membuat pesanan", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><ShoppingBag className="h-4 w-4" /> Buat Pesanan</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Pesanan Langsung</DialogTitle>
          <DialogDescription>Untuk pelanggan yang memesan langsung di kasir tanpa akun.</DialogDescription>
        </DialogHeader>

        <FormFieldset disabled={loading} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nama-pemesan">Nama pemesan (opsional)</Label>
            <CustomerAutocomplete value={nama} onChange={setNama} disabled={loading} />
          </div>

          <div className="space-y-1.5">
            <Label>Produk</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari produk..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8 text-sm" />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {visibleProducts.map((p) => {
                const qty = cart[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.nama}</p>
                      <p className="tabular-figures text-xs text-muted-foreground">{formatRupiah(p.harga_jual)} · stok {p.stok}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground" onClick={() => updateQty(p.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-sm tabular-figures">{qty}</span>
                      <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={qty >= p.stok} onClick={() => updateQty(p.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!visibleProducts.length && <p className="py-6 text-center text-xs text-muted-foreground">Produk tidak ditemukan.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Metode Pembayaran</Label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentId(m.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${paymentId === m.id ? "border-primary bg-primary/5 text-primary" : "hover:bg-secondary"}`}
                >
                  {m.nama}
                </button>
              ))}
            </div>
            {/* Info pembayaran (mis. QRIS/rekening) milik metode terpilih —
                sama seperti yang dilihat pelanggan lewat PaymentInfoScreen,
                ditampilkan ringkas di sini supaya kasir bisa langsung
                perlihatkan ke pelanggan tanpa pindah halaman. */}
            {showPaymentInfo && selectedMethod && (
              <div className="space-y-2 rounded-lg border bg-secondary/40 p-3">
                {selectedMethod.tampilkan_gambar && selectedMethod.info_gambar_url && (
                  <div className="relative mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-md border bg-white">
                    <StorageImage src={selectedMethod.info_gambar_url} alt={`Info pembayaran ${selectedMethod.nama}`} fill sizes="160px" className="object-contain" />
                  </div>
                )}
                {selectedMethod.tampilkan_teks && selectedMethod.info_teks && (
                  <p className="whitespace-pre-line text-center text-xs text-foreground">{selectedMethod.info_teks}</p>
                )}
              </div>
            )}
          </div>
        </FormFieldset>

        <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-figures">{formatRupiah(total)}</span>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>Batal</Button>
          </DialogClose>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Buat Pesanan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
