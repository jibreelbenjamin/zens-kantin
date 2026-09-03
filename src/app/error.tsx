"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Error runtime tertangkap oleh error.tsx:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-semibold">Terjadi Kesalahan</h1>
        <p className="text-sm text-muted-foreground">
          Maaf, ada yang tidak beres di sisi kami. Coba muat ulang halaman ini — kalau masih terjadi, hubungi admin.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={reset} className="w-full">
            <RefreshCcw className="h-4 w-4" /> Coba Lagi
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Kembali ke Beranda</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
