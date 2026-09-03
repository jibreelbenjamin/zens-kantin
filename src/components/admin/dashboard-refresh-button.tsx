"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Tombol untuk memuat ulang statistik dashboard (server component) tanpa reload penuh halaman. */
export function DashboardRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
      {pending ? "Memuat..." : "Refresh"}
    </Button>
  );
}
