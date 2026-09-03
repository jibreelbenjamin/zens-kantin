"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { IdCard, KeyRound, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { EditProfileDialog } from "./edit-profile-dialog";
import type { Profile } from "@/types/database";
import type { Role, UserStatus } from "@/lib/constants";

const STATUS_LABEL: Record<UserStatus, string> = { active: "Aktif", pending: "Pending", block: "Diblokir" };
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", kasir: "Kasir", pelanggan: "Pelanggan" };

export function RowActions({ user }: { user: Profile }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState<UserStatus | null>(null);
  const [confirmRole, setConfirmRole] = React.useState<Role | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [editProfileOpen, setEditProfileOpen] = React.useState(false);

  async function setStatus(status: UserStatus) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Status diperbarui.");
      setConfirmStatus(null);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function setRole(role: Role) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Role diperbarui.");
      setConfirmRole(null);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuItem disabled={user.status === "active"} onClick={() => setConfirmStatus("active")}>Aktifkan</DropdownMenuItem>
          <DropdownMenuItem disabled={user.status === "pending"} onClick={() => setConfirmStatus("pending")}>Jadikan Pending</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" disabled={user.status === "block"} onClick={() => setConfirmStatus("block")}>Blokir</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Role</DropdownMenuLabel>
          <DropdownMenuItem disabled={user.role === "admin"} onClick={() => setConfirmRole("admin")}>Jadikan Admin</DropdownMenuItem>
          <DropdownMenuItem disabled={user.role === "kasir"} onClick={() => setConfirmRole("kasir")}>Jadikan Kasir</DropdownMenuItem>
          <DropdownMenuItem disabled={user.role === "pelanggan"} onClick={() => setConfirmRole("pelanggan")}>Jadikan Pelanggan</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditProfileOpen(true)}>
            <IdCard className="mr-2 h-3.5 w-3.5" /> Edit Profil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetOpen(true)}>
            <KeyRound className="mr-2 h-3.5 w-3.5" /> Reset Password
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={!!confirmStatus}
        onOpenChange={(o) => !o && setConfirmStatus(null)}
        title={`Ubah status ${user.nama}?`}
        description={confirmStatus ? `Status akan diubah menjadi "${STATUS_LABEL[confirmStatus]}".` : ""}
        confirmLabel="Ya, Ubah"
        destructive={confirmStatus === "block"}
        loading={loading}
        onConfirm={() => confirmStatus && setStatus(confirmStatus)}
      />
      <ConfirmDialog
        open={!!confirmRole}
        onOpenChange={(o) => !o && setConfirmRole(null)}
        title={`Ubah role ${user.nama}?`}
        description={confirmRole ? `Role akan diubah menjadi "${ROLE_LABEL[confirmRole]}". Hak akses akan langsung berubah.` : ""}
        confirmLabel="Ya, Ubah"
        loading={loading}
        onConfirm={() => confirmRole && setRole(confirmRole)}
      />
      <ResetPasswordDialog open={resetOpen} onOpenChange={setResetOpen} userId={user.id} userName={user.nama} />
      <EditProfileDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        userId={user.id}
        userNama={user.nama}
        userUsername={user.username}
      />
    </>
  );
}
