"use client";
import * as React from "react";
import { Info, MapPin, Monitor, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { ActivityLog } from "@/types/database";

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-secondary/40 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value || "Tidak diketahui"}</p>
      </div>
    </div>
  );
}

export function LogDetailDialog({ log, trigger }: { log: ActivityLog; trigger: React.ReactNode }) {
  const lokasi = [log.kota, log.wilayah, log.negara].filter(Boolean).join(", ");

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Info className="h-4 w-4" /> Detail Aktivitas</DialogTitle>
          <DialogDescription>{formatDate(log.created_at, true)} &middot; {log.nama_user ?? "Tidak diketahui"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {log.deskripsi && (
            <div className="rounded-lg border bg-secondary/40 p-3 text-sm">{log.deskripsi}</div>
          )}
          <Row icon={Wifi} label="Alamat IP" value={log.ip_address} />
          <Row icon={MapPin} label="Lokasi (kota, wilayah, negara)" value={lokasi || null} />
          <Row icon={Monitor} label="Perangkat" value={log.perangkat} />
          {log.user_agent && (
            <div className="rounded-lg border bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">User-Agent lengkap</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{log.user_agent}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">Tutup</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
