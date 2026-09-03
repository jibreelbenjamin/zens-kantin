"use client";
import * as React from "react";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PasswordInput } from "@/components/shared/password-input";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { useFullscreen } from "@/hooks/use-fullscreen";

interface LogoutButtonProps extends ButtonProps {
  /**
   * Kalau diisi, keluar akun butuh verifikasi password (bukan cuma modal
   * konfirmasi biasa) — dipakai di halaman pelanggan (tablet bersama) supaya
   * pengguna iseng tidak bisa asal keluar dari akun orang lain.
   */
  requirePasswordFor?: string; // email
}

export function LogoutButton({ children, requirePasswordFor, ...props }: LogoutButtonProps) {
  const { exit } = useFullscreen();
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) { setPassword(""); setError(null); }
  }, [open]);

  async function doLogout() {
    await fetch("/api/auth/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "logout", deskripsi: "Keluar dari aplikasi" }),
    }).catch(() => {});
    const supabase = createClient();
    await supabase.auth.signOut();
    await exit();
    toast.success("Berhasil keluar.");
    window.location.href = "/login";
  }

  async function handleSimpleLogout() {
    setLoading(true);
    await doLogout();
  }

  async function handleVerifiedLogout(e: React.FormEvent) {
    e.preventDefault();
    if (!requirePasswordFor) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: requirePasswordFor, password,
      });
      if (signInError) {
        setError("Password salah.");
        setLoading(false);
        return;
      }
      await doLogout();
    } catch {
      setError("Gagal memverifikasi password.");
      setLoading(false);
    }
  }

  if (requirePasswordFor) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" {...props}>
            <LogOut className="h-4 w-4" />
            {children ?? "Keluar"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verifikasi untuk keluar</DialogTitle>
            <DialogDescription>Masukkan password akun ini untuk keluar. Ini mencegah orang lain iseng mengeluarkan akunmu.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVerifiedLogout} className="space-y-3">
            <FormFieldset disabled={loading} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="logout-password">Password</Label>
                <PasswordInput id="logout-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
                {error && <p className="text-xs font-medium text-destructive">{error}</p>}
              </div>
            </FormFieldset>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={loading}>Batal</Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={loading || !password}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Ya, Keluar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" {...props}>
          <LogOut className="h-4 w-4" />
          {children ?? "Keluar"}
        </Button>
      }
      title="Keluar dari akun?"
      description="Kamu perlu masuk lagi untuk mengakses aplikasi."
      confirmLabel={loading ? "Memproses..." : "Ya, Keluar"}
      destructive
      loading={loading}
      onConfirm={handleSimpleLogout}
    />
  );
}
