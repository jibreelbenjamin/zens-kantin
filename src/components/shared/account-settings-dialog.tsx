"use client";
import * as React from "react";
import { IdCard, KeyRound, Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { Separator } from "@/components/ui/separator";
import type { Profile } from "@/types/database";

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Pick<Profile, "nama" | "username" | "email">;
}

/**
 * Dulu dialog ini juga punya form "Edit Profil" (ubah nama & username)
 * yang bisa dipakai siapa saja untuk akunnya sendiri — sekarang fitur itu
 * DIHAPUS dari sini (jadi read-only) dan dipindah jadi kemampuan admin
 * saja lewat halaman Admin > Pengguna (lihat edit-profile-dialog.tsx di
 * sana). Nama & username tetap ditampilkan di sini sekadar informasi.
 */
export function AccountSettingsDialog({ open, onOpenChange, profile }: AccountSettingsDialogProps) {
  const email = profile.email;

  const [oldPassword, setOldPassword] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setOldPassword(""); setPassword(""); setConfirm("");
    }
  }, [open]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPassword) {
      toast.error("Masukkan password lama dulu untuk verifikasi.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password baru minimal 6 digit.");
      return;
    }
    if (password !== confirm) {
      toast.error("Konfirmasi password tidak sama.");
      return;
    }
    if (!email) {
      toast.error("Email akun tidak ditemukan.");
      return;
    }
    setSavingPassword(true);
    try {
      const supabase = createClient();
      // Verifikasi password LAMA dulu (re-auth) sebelum mengizinkan ganti
      // password — mencegah orang lain yang kebetulan sesinya masih login
      // sembarangan mengganti password tanpa tahu password sebelumnya.
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
      if (verifyError) {
        toast.error("Password lama salah.");
        setSavingPassword(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Jaga-jaga: beberapa versi Supabase Auth mengakhiri sesi yang sedang
      // aktif begitu password diganti (lihat catatan lebih detail di
      // /api/auth/register, yang mengalami ini secara nyata lewat jalur
      // admin). Login ulang pakai password BARU di sini murah & aman
      // dilakukan — kalau ternyata sesi lama masih hidup, panggilan ini
      // cuma jadi no-op yang menyegarkan sesi.
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password });
      if (reauthError) {
        console.error("Gagal menyegarkan sesi setelah ganti password:", reauthError.message);
      }
      toast.success("Password berhasil diganti.");
      setOldPassword(""); setPassword(""); setConfirm("");
    } catch (err: any) {
      toast.error("Gagal mengganti password", { description: err.message });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !savingPassword && onOpenChange(o)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Akun Saya</DialogTitle>
          <DialogDescription>{email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label className="flex items-center gap-1.5 text-sm font-medium"><IdCard className="h-3.5 w-3.5" /> Profil</Label>
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-secondary/40 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Nama</p>
              <p className="font-medium">{profile.nama}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Username</p>
              <p className="font-medium">@{profile.username}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Hanya admin yang bisa mengubah nama & username. Hubungi admin kalau perlu diperbarui.</p>
        </div>

        <Separator />

        <form id="account-password-form" onSubmit={changePassword} className="space-y-3">
          <FormFieldset disabled={savingPassword} className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium"><KeyRound className="h-3.5 w-3.5" /> Ganti Password</Label>
            <div className="space-y-1.5">
              <Label htmlFor="acc-old-password" className="text-xs font-normal text-muted-foreground">Password saat ini</Label>
              <PasswordInput id="acc-old-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-password" className="text-xs font-normal text-muted-foreground">Password baru</Label>
              <PasswordInput id="acc-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-confirm" className="text-xs font-normal text-muted-foreground">Konfirmasi password baru</Label>
              <PasswordInput id="acc-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
            </div>
          </FormFieldset>
        </form>

        {/* Tombol Tutup sengaja di-disable selagi savingPassword — supaya
            modal ini tidak bisa ditutup di tengah proses ganti password
            (baru boleh tertutup setelah selesai, sukses maupun gagal),
            konsisten dengan form modal lain di aplikasi ini. */}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm" disabled={savingPassword}>Tutup</Button>
          </DialogClose>
          <Button type="submit" form="account-password-form" size="sm" disabled={savingPassword}>
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />} Simpan Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
