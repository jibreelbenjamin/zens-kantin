"use client";
import * as React from "react";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { FormFieldset } from "@/components/shared/form-fieldset";

export function ResetPasswordDialog({
  open, onOpenChange, userId, userName,
}: { open: boolean; onOpenChange: (open: boolean) => void; userId: string; userName: string }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) { setPassword(""); setConfirm(""); }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Password ${userName} berhasil direset.`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal reset password", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Reset Password</DialogTitle>
          <DialogDescription>Atur password baru untuk {userName}. Beritahu password ini ke yang bersangkutan secara langsung.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormFieldset disabled={loading} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Password baru</Label>
              <PasswordInput id="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Konfirmasi password</Label>
              <PasswordInput id="confirm-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
            </div>
          </FormFieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Simpan Password Baru
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
