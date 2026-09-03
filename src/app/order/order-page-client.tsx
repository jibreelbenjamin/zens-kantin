"use client";
import * as React from "react";
import { CheckCircle2, Loader2, Maximize, Minimize, Minus, Plus, Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { BrandIcon } from "@/components/shared/brand-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { RadioGroupPayment } from "./radio-group-payment";
import { ProductImagePlaceholder } from "@/components/shared/product-image-placeholder";
import { StorageImage } from "@/components/shared/storage-image";
import { LogoutButton } from "@/components/shared/logout-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useRealtimeProducts } from "@/hooks/use-realtime-products";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { cn, formatRupiah, sortStockAware } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import type { Category, PaymentMethod, Product, Profile } from "@/types/database";
import { PaymentInfoScreen } from "./payment-info-screen";

type PublicProduct = Omit<Product, "modal">;

const ALL_CATEGORIES = "__all__";
const NO_CATEGORY = "__none__";
const AUTO_RETURN_MS = 5000;

function SuccessScreen({ onDone }: { onDone: () => void }) {
  const [secondsLeft, setSecondsLeft] = React.useState(5);

  // onDone disimpan di ref (bukan dependency array efek di bawah) supaya
  // timer TIDAK ikut ke-reset kalau OrderPageClient re-render gara-gara
  // polling produk tiap ~4 detik (useRealtimeProducts) — sebelumnya ini
  // bikin auto-return "Pesan Lagi" nyaris tidak pernah sempat jalan
  // karena timer-nya keburu dibuat ulang dari awal sebelum genap 5 detik.
  const onDoneRef = React.useRef(onDone);
  React.useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  React.useEffect(() => {
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const timeout = setTimeout(() => onDoneRef.current(), AUTO_RETURN_MS);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary/30 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="font-display text-2xl font-semibold">Pesanan terkirim!</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Pesanan kamu sudah masuk ke kasir. Silakan tunggu dipanggil atau tunjukkan struk ke kasir.
      </p>
      <Button onClick={onDone}>Pesan Lagi ({secondsLeft})</Button>
    </div>
  );
}

/**
 * Konfirmasi pesanan di halaman TERSENDIRI (bukan modal/dialog kecil) —
 * ditampilkan sebelum pesanan benar-benar dikirim ke kasir, dan sebelum
 * layar informasi pembayaran (kalau metode yang dipilih mengaktifkannya).
 */
function OrderConfirmScreen({
  cartLines, totalHarga, paymentMethod, submitting, onBack, onConfirm,
}: {
  cartLines: { product: PublicProduct; qty: number }[];
  totalHarga: number;
  paymentMethod?: PaymentMethod;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary/30 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-xl font-semibold">Konfirmasi Pesanan</h1>
          <p className="text-sm text-muted-foreground">Periksa kembali pesanan kamu sebelum dikirim ke kasir.</p>
        </div>
        <div className="space-y-2.5 rounded-xl border bg-secondary/30 p-4">
          {cartLines.map((l) => (
            <div key={l.product.id} className="flex items-center justify-between text-sm">
              <span>{l.product.nama} <span className="text-muted-foreground">×{l.qty}</span></span>
              <span className="tabular-figures">{formatRupiah(l.qty * l.product.harga_jual)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2.5 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-figures">{formatRupiah(totalHarga)}</span>
          </div>
        </div>
        {paymentMethod && (
          <p className="text-center text-sm text-muted-foreground">
            Metode pembayaran: <span className="font-medium text-foreground">{paymentMethod.nama}</span>
          </p>
        )}
        <div className="space-y-2 pt-1">
          <Button size="lg" className="w-full" disabled={submitting} onClick={onConfirm}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Ya, Kirim Pesanan
          </Button>
          <Button size="lg" variant="outline" className="w-full" disabled={submitting} onClick={onBack}>
            Periksa Lagi
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OrderPageClient({
  profile, products: initialProducts, paymentMethods, categories,
}: { profile: Profile; products: PublicProduct[]; paymentMethods: PaymentMethod[]; categories: Category[] }) {
  const allProducts = useRealtimeProducts(initialProducts);
  const products = React.useMemo(() => allProducts.filter((p) => p.is_active), [allProducts]);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState(ALL_CATEGORIES);
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [paymentId, setPaymentId] = React.useState<string>(paymentMethods[0]?.id ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [paymentInfo, setPaymentInfo] = React.useState<{ groupId: string; method: PaymentMethod; total: number } | null>(null);

  const productsById = React.useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const filteredProducts = React.useMemo(() => {
    const matches = products.filter((p) => {
      const matchQuery = p.nama.toLowerCase().includes(query.toLowerCase());
      const matchCategory =
        activeCategory === ALL_CATEGORIES ||
        (activeCategory === NO_CATEGORY ? !p.kategori_id : p.kategori_id === activeCategory);
      return matchQuery && matchCategory;
    });
    // Produk stok habis ditaruh paling bawah, tidak diselip di antara yang masih ada.
    return sortStockAware(matches);
  }, [products, query, activeCategory]);

  // Kalau stok berkurang lewat realtime sampai lebih kecil dari qty di
  // keranjang (mis. kehabisan saat sedang dipilih), potong otomatis.
  React.useEffect(() => {
    setCart((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, qty] of Object.entries(prev)) {
        const stock = productsById[id]?.stok ?? 0;
        const clamped = Math.min(qty, stock);
        if (clamped !== qty) changed = true;
        if (clamped > 0) next[id] = clamped;
      }
      return changed ? next : prev;
    });
  }, [productsById]);

  const cartLines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: productsById[id], qty }))
    .filter((l) => l.product);

  const totalItems = cartLines.reduce((s, l) => s + l.qty, 0);
  const totalHarga = cartLines.reduce((s, l) => s + l.qty * l.product.harga_jual, 0);

  function updateQty(id: string, delta: number) {
    setCart((prev) => {
      const stock = productsById[id]?.stok ?? 0;
      const next = Math.max(0, Math.min(stock, (prev[id] ?? 0) + delta));
      return { ...prev, [id]: next };
    });
  }

  async function submitOrder() {
    if (!cartLines.length) return;
    if (!paymentId) {
      toast.error("Pilih metode pembayaran dulu.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartLines.map((l) => ({ produk_id: l.product.id, qty: l.qty })),
          pembayaran_id: paymentId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat pesanan.");

      const createdOrders = (json.orders ?? []) as { group_id: string }[];
      const groupId = createdOrders[0]?.group_id;
      const selectedMethod = paymentMethods.find((m) => m.id === paymentId);

      setCart({});
      setSheetOpen(false);
      setConfirming(false);

      // Kalau metode pembayaran ini diatur admin untuk menampilkan info
      // pembayaran (teks/gambar) ke pelanggan, tampilkan layar itu dulu
      // (dengan tombol "Saya Sudah Membayar") sebelum pesanan dianggap
      // selesai. Kalau tidak, langsung ke layar sukses seperti biasa.
      if (selectedMethod?.tampilkan_info_pembayaran && groupId) {
        setPaymentInfo({ groupId, method: selectedMethod, total: totalHarga });
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      toast.error("Gagal membuat pesanan", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (paymentInfo) {
    return (
      <PaymentInfoScreen
        groupId={paymentInfo.groupId}
        method={paymentInfo.method}
        total={paymentInfo.total}
        onDone={() => setPaymentInfo(null)}
      />
    );
  }

  if (success) {
    return <SuccessScreen onDone={() => setSuccess(false)} />;
  }

  if (confirming) {
    return (
      <OrderConfirmScreen
        cartLines={cartLines}
        totalHarga={totalHarga}
        paymentMethod={paymentMethods.find((m) => m.id === paymentId)}
        submitting={submitting}
        onBack={() => setConfirming(false)}
        onConfirm={submitOrder}
      />
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2 font-display text-base font-semibold text-primary">
          <BrandIcon className="h-5 w-5" /> <span className="hidden sm:inline">{APP_NAME}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          <UserAvatar nama={profile.nama} avatarUrl={profile.avatar_url} className="h-8 w-8" />
          <span className="hidden text-sm font-medium lg:inline">{profile.nama}</span>
          <LogoutButton size="sm" variant="ghost" requirePasswordFor={profile.email ?? undefined} />
        </div>
      </header>

      <div className="space-y-3 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari produk..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setActiveCategory(ALL_CATEGORIES)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  activeCategory === ALL_CATEGORIES ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"
                )}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    activeCategory === c.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"
                  )}
                >
                  {c.nama}
                </button>
              ))}
              <button
                onClick={() => setActiveCategory(NO_CATEGORY)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  activeCategory === NO_CATEGORY ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"
                )}
              >
                Tanpa Kategori
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((p) => {
            const qty = cart[p.id] ?? 0;
            const habis = p.stok === 0;
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="relative aspect-square w-full">
                  {p.gambar_url ? (
                    <StorageImage src={p.gambar_url} alt={p.nama} fill sizes="220px" className="object-cover" />
                  ) : (
                    <ProductImagePlaceholder />
                  )}
                  {habis && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Badge variant="destructive">Stok Habis</Badge>
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{p.nama}</p>
                    {!habis && (
                      <Badge variant={p.stok <= 5 ? "warning" : "secondary"} className="shrink-0 text-[10px]">
                        sisa {p.stok}
                      </Badge>
                    )}
                  </div>
                  <p className="tabular-figures text-sm font-semibold text-primary">{formatRupiah(p.harga_jual)}</p>
                  {qty === 0 ? (
                    <Button
                      className="h-10 w-full text-sm font-semibold"
                      disabled={habis}
                      onClick={() => updateQty(p.id, 1)}
                    >
                      Tambah
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-label="Kurangi jumlah"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-destructive/30 text-destructive transition-colors hover:border-destructive hover:bg-destructive/10 active:scale-95"
                        onClick={() => updateQty(p.id, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="tabular-figures min-w-[1.5rem] text-center text-base font-semibold">{qty}</span>
                      <button
                        type="button"
                        aria-label="Tambah jumlah"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 text-primary transition-colors hover:border-primary hover:bg-primary/10 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                        disabled={qty >= p.stok}
                        onClick={() => updateQty(p.id, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!filteredProducts.length && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              {query ? "Produk tidak ditemukan." : "Belum ada produk tersedia saat ini."}
            </p>
          )}
        </div>
      </div>

      {totalItems > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="lg" className="mx-auto flex w-full max-w-md items-center justify-between">
                <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> {totalItems} item</span>
                <span className="tabular-figures">{formatRupiah(totalHarga)}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Ringkasan Pesanan</SheetTitle>
                <SheetDescription>Periksa pesanan kamu sebelum dikirim ke kasir.</SheetDescription>
              </SheetHeader>
              <div className="my-4 space-y-3">
                {cartLines.map((l) => (
                  <div key={l.product.id} className="flex items-center justify-between text-sm">
                    <span>{l.product.nama} <span className="text-muted-foreground">×{l.qty}</span></span>
                    <span className="tabular-figures">{formatRupiah(l.qty * l.product.harga_jual)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-figures">{formatRupiah(totalHarga)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Metode Pembayaran</Label>
                <RadioGroupPayment methods={paymentMethods} value={paymentId} onChange={setPaymentId} />
                <p className="pt-1 text-xs text-muted-foreground">
                  Bukti pembayaran (mis. screenshot QRIS) ditunjukkan langsung ke kasir saat pesanan dikonfirmasi.
                </p>
              </div>

              <SheetFooter className="mt-6">
                <Button
                  size="lg"
                  className="w-full"
                  disabled={submitting}
                  onClick={() => {
                    if (!paymentId) {
                      toast.error("Pilih metode pembayaran dulu.");
                      return;
                    }
                    setSheetOpen(false);
                    setConfirming(true);
                  }}
                >
                  Lanjut ke Konfirmasi
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}
