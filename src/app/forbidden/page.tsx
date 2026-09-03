import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldX className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-semibold">Akses Ditolak</h1>
        <p className="text-sm text-muted-foreground">
          Kamu tidak punya izin untuk mengakses halaman ini.
        </p>
        <Button asChild className="w-full">
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
      </div>
    </div>
  );
}
