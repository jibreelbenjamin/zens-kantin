import { cn } from "@/lib/utils";

/** Logo/brand mark aplikasi — file svg yang sama dipakai sebagai favicon (lihat layout.tsx). */
export function BrandIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- svg statis kecil, tidak perlu optimisasi next/image
  return <img src="/icon.svg" alt="" className={cn("shrink-0", className)} />;
}
