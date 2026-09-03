"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, IdCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormFieldset } from "@/components/shared/form-fieldset";
import { isValidUsername } from "@/lib/utils";

export function EditProfileDialog({
  open, onOpenChange, userId, userNama, userUsername,
}: { open: boolean; onOpenChange: (open: boolean) => void; userId: string; userNama: string; userUsername: string }) {
  const router = useRouter();
  const [nama, setNama] = React.useState(userNama);
  const [username, setUsername] = React.useState(userUsername);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) { setNama(userNama); setUsername(userUsername); }
  }, [open, userNama, userUsername]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanNama = nama.trim();
    const cleanUsername = username.trim().toLowerCase();
    if (cleanNama.length < 2) {
      toast.error("Nama minimal 2 karakter.");
      return;
    }
    if (!isValidUsername(cleanUsername)) {
      toast.error("Username 3-24 karakter, hanya huruf kecil, angka, dan underscore.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: cleanNama, username: cleanUsername }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Profil berhasil diperbarui.");
      onOpenChange(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal menyimpan profil", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><IdCard className="h-4 w-4" /> Edit Profil</DialogTitle>
          <DialogDescription>Ubah nama & username untuk {userNama}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormFieldset disabled={loading} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-nama">Nama</Label>
              <Input id="edit-nama" value={nama} onChange={(e) => setNama(e.target.value)} minLength={2} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={username}
                autoCapitalize="none"
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
              />
            </div>
          </FormFieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
