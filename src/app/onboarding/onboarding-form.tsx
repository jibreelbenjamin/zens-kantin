"use client";
import * as React from "react";
import Image from "next/image";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { FormFieldset } from "@/components/shared/form-fieldset";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { slugifyUsername, isValidUsername } from "@/lib/utils";

export function OnboardingForm({ defaultName, avatarUrl }: { defaultName: string; avatarUrl: string | null }) {
  const [nama, setNama] = React.useState(defaultName);
  const [username, setUsername] = React.useState(slugifyUsername(defaultName));
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [touchedUsername, setTouchedUsername] = React.useState(false);

  const usernameError = touchedUsername && username && !isValidUsername(username)
    ? "3-24 karakter: huruf kecil, angka, underscore saja."
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUsername(username)) {
      setTouchedUsername(true);
      return;
    }
    if (password.length < 6) {
      toast.error("Password minimal 6 digit.");
      return;
    }
    if (password !== confirm) {
      toast.error("Konfirmasi password tidak sama.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan profil.");
      // Toast "menunggu persetujuan" sengaja TIDAK ditampilkan di sini —
      // baris di bawah langsung hard-navigate ke /pending, jadi toast di
      // sini nyaris tidak sempat kelihatan. /pending sendiri sudah punya
      // toast serupa yang tampil andal begitu halamannya termuat (lihat
      // pending-toast.tsx), jadi cukup satu pesan saja di sana.
      // Hard navigation (bukan router.push) supaya middleware & seluruh
      // server component membaca ulang status profil yang baru saja dibuat,
      // menghindari redirect balik ke onboarding karena cache navigasi.
      window.location.href = "/pending";
    } catch (err: any) {
      toast.error("Gagal mendaftar", { description: err.message });
      setLoading(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {avatarUrl && (
        <div className="flex justify-center">
          <Image src={avatarUrl} alt="avatar" width={56} height={56} className="rounded-full border" />
        </div>
      )}
      <FormFieldset disabled={loading || cancelling} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nama">Nama lengkap</Label>
          <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} required minLength={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(slugifyUsername(e.target.value))}
            onBlur={() => setTouchedUsername(true)}
            placeholder="cth. budi_santoso"
            required
          />
          <p className="text-xs text-muted-foreground">Tanpa spasi/karakter spesial. Dipakai untuk masuk cepat di tablet.</p>
          {usernameError && <p className="text-xs font-medium text-destructive">{usernameError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Konfirmasi password</Label>
          <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading || cancelling}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Selesaikan pendaftaran
        </Button>
      </FormFieldset>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground" disabled={loading || cancelling}>
            <LogOut className="h-3.5 w-3.5" /> Batalkan Pendaftaran
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan pendaftaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Kamu akan keluar dari akun Google ini. Data yang sudah diisi tidak akan disimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Lanjutkan Mendaftar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />} Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
