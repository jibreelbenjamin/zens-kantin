import { cn } from "@/lib/utils";

/** Placeholder abu-abu (grayscale) dipakai di mana pun gambar produk kosong — pakai brand mark svg yang sama dengan favicon/sidebar. */
export function ProductImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-muted grayscale", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- svg statis kecil, tidak perlu next/image */}
      <img src="/icon.svg" alt="" className="h-1/2 w-1/2 opacity-40" />
    </div>
  );
}
