"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/types/database";

function ApprovalRow({ user }: { user: Profile }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState<"active" | "block" | null>(null);

  async function setStatus(status: "active" | "block") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(status === "active" ? `${user.nama} diaktifkan.` : `${user.nama} diblokir.`);
      setConfirmStatus(null);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal memproses", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <UserAvatar nama={user.nama} avatarUrl={user.avatar_url} />
        <div>
          <p className="text-sm font-medium">{user.nama}</p>
          <p className="text-xs text-muted-foreground">@{user.username} · {user.email} · daftar {formatDate(user.created_at)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmStatus("block")}>
          <ShieldX className="h-3.5 w-3.5" /> Blokir
        </Button>
        <Button size="sm" onClick={() => setConfirmStatus("active")}>
          <Check className="h-3.5 w-3.5" /> Aktifkan
        </Button>
      </div>

      <ConfirmDialog
        open={!!confirmStatus}
        onOpenChange={(o) => !o && setConfirmStatus(null)}
        title={confirmStatus === "active" ? `Aktifkan akun ${user.nama}?` : `Blokir akun ${user.nama}?`}
        description={
          confirmStatus === "active"
            ? `${user.nama} akan bisa langsung memesan setelah diaktifkan.`
            : `${user.nama} tidak akan bisa masuk ke aplikasi sampai diaktifkan kembali.`
        }
        confirmLabel={confirmStatus === "active" ? "Ya, Aktifkan" : "Ya, Blokir"}
        destructive={confirmStatus === "block"}
        loading={loading}
        onConfirm={() => confirmStatus && setStatus(confirmStatus)}
      />
    </div>
  );
}

export function ApprovalList({ users }: { users: Profile[] }) {
  if (!users.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada pendaftaran yang menunggu. 🎉</p>;
  }
  return (
    <div className="divide-y">
      {users.map((u) => <ApprovalRow key={u.id} user={u} />)}
    </div>
  );
}
