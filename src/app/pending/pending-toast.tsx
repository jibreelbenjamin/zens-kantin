"use client";
import * as React from "react";
import { toast } from "sonner";

/** Notifikasi bahwa akun sedang menunggu persetujuan admin — sekali saat halaman ini dibuka. */
export function PendingToast() {
  React.useEffect(() => {
    toast.info("Akun kamu sedang dalam proses persetujuan admin.");
  }, []);
  return null;
}
