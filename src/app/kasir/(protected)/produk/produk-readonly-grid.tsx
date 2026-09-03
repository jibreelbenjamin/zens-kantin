"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProductImagePlaceholder } from "@/components/shared/product-image-placeholder";
import { StorageImage } from "@/components/shared/storage-image";
import { useRealtimeProducts } from "@/hooks/use-realtime-products";
import { formatRupiah, sortStockAware } from "@/lib/utils";
import type { Product } from "@/types/database";

export function ProdukReadonlyGrid({ products: initialProducts }: { products: Product[] }) {
  const products = useRealtimeProducts(initialProducts);
  const [q, setQ] = React.useState("");
  const filtered = sortStockAware(products.filter((p) => p.nama.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Cari produk..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="relative aspect-square w-full">
              {p.gambar_url ? (
                <StorageImage src={p.gambar_url} alt={p.nama} fill sizes="200px" className="object-cover" />
              ) : (
                <ProductImagePlaceholder />
              )}
              {!p.is_active && <Badge variant="secondary" className="absolute left-2 top-2">Disembunyikan</Badge>}
            </div>
            <div className="space-y-1 p-3">
              <p className="truncate text-sm font-medium">{p.nama}</p>
              <div className="flex items-center justify-between">
                <span className="tabular-figures text-sm font-semibold text-primary">{formatRupiah(p.harga_jual)}</span>
                <Badge variant={p.stok === 0 ? "destructive" : p.stok <= 5 ? "warning" : "secondary"}>{p.stok} stok</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!filtered.length && <p className="py-16 text-center text-sm text-muted-foreground">Produk tidak ditemukan.</p>}
    </div>
  );
}
