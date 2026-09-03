import { ShieldAlert } from "lucide-react";
import { LogoutButton } from "@/components/shared/logout-button";

export default function BlockedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-semibold">Akun diblokir</h1>
        <p className="text-sm text-muted-foreground">
          Akses akun kamu telah dinonaktifkan oleh admin kantin. Hubungi admin jika
          menurut kamu ini keliru.
        </p>
        <LogoutButton className="w-full" />
      </div>
    </div>
  );
}
