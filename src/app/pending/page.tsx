import { Clock } from "lucide-react";
import { LogoutButton } from "@/components/shared/logout-button";
import { PendingToast } from "./pending-toast";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <PendingToast />
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-semibold">Menunggu persetujuan</h1>
        <p className="text-sm text-muted-foreground">
          Akun kamu sudah terdaftar dan sedang menunggu persetujuan admin kantin.
          Coba masuk lagi beberapa saat lagi.
        </p>
        <LogoutButton className="w-full" />
      </div>
    </div>
  );
}
