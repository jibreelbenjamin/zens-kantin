"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LogOut, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { useNewOrderAlert } from "@/hooks/use-new-order-alert";

const PIN_LENGTH = 4;

/** "125" -> "2:05", "8" -> "0:08" — dipakai buat cooldown yang sekarang bisa sampai beberapa menit. */
function formatCooldown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Ikon backspace/hapus — dibuat manual (bukan dari lucide) supaya gaya
 * goresannya konsisten dengan ikon lain di sekitarnya. */
function BackspaceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6.5-7L9 5Z" />
      <line x1="12.5" y1="9.5" x2="17.5" y2="14.5" />
      <line x1="17.5" y1="9.5" x2="12.5" y2="14.5" />
    </svg>
  );
}

export function PinLockScreen({ cashierName, next }: { cashierName: string; next: string }) {
  const router = useRouter();
  const [pin, setPin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [shake, setShake] = React.useState(false);
  const [checkingLock, setCheckingLock] = React.useState(true);
  // Sisa detik jeda — SELALU berasal dari respons server (GET saat layar
  // dibuka, atau POST kalau ternyata baru kena jeda), TIDAK PERNAH dari
  // localStorage (lihat catatan KASIR_PIN_LOCKOUT_* di lib/constants.ts).
  // Kalau halaman di-refresh selagi dijeda, angka ini "hilang" sesaat lalu
  // langsung dipulihkan lagi lewat GET di effect di bawah — bukan disimpan
  // di browser, jadi tidak bisa dibypass dengan clear storage/incognito.
  const [cooldown, setCooldown] = React.useState(0);
  const [confirmingLogout, setConfirmingLogout] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  // Layar PIN sengaja route terpisah yang TIDAK me-render apa pun dari
  // halaman kasir selagi terkunci (lihat komentar di /kasir/lock/page.tsx),
  // jadi notifikasi pesanan baru dari sana tidak pernah kedengaran di sini
  // sebelumnya. Pasang pendengar realtime + bunyi notifikasi ringan
  // khusus di layar ini — TANPA membocorkan detail pesanan apa pun,
  // cukup bunyi + toast singkat, biar kasir tahu ada pesanan masuk walau
  // sedang tidak di depan layar utamanya.
  const playNotificationSound = useNotificationSound();
  useNewOrderAlert(() => {
    playNotificationSound();
    toast.info("Pesanan baru masuk", { description: "Buka PIN untuk melihat detailnya." });
  });

  async function doLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      toast.error("Gagal keluar. Coba lagi.");
      setLoggingOut(false);
      setConfirmingLogout(false);
    }
  }

  // Tanya status jeda ke SERVER begitu layar ini dimuat/di-refresh — ini
  // pengganti pemulihan dari localStorage: sumber kebenarannya baris
  // activity_logs di server (GET /api/kasir/verify-pin, tidak mengonsumsi
  // percobaan), jadi cooldown yang masih berjalan tetap akurat & tidak
  // bisa "dihapus" begitu saja dari sisi kasir.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/kasir/verify-pin");
        const json = await res.json();
        if (!cancelled && json.locked) setCooldown(json.retryAfterSeconds ?? 0);
      } catch {
        // Abaikan — kalau cek gagal, kasir tetap bisa coba masukkan PIN;
        // server tetap akan menolak lewat respons 429 kalau memang dijeda.
      } finally {
        if (!cancelled) setCheckingLock(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = cooldown > 0;

  async function submit(value: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/kasir/verify-pin", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: value }),
      });
      const json = await res.json();
      if (json.valid) {
        toast.success("Layar dibuka.");
        // Cookie unlock sudah diset server-side oleh /api/kasir/verify-pin.
        // router.push ke halaman kasir tujuan — middleware akan melihat
        // cookie itu dan mengizinkan lewat.
        router.push(next);
        router.refresh();
        return;
      }
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 400);
      if (res.status === 429 && json.locked) {
        setCooldown(json.retryAfterSeconds ?? 0);
        toast.error(`Terlalu banyak percobaan. Coba lagi dalam ${formatCooldown(json.retryAfterSeconds ?? 0)}.`);
      } else {
        toast.error("PIN salah.");
      }
    } catch {
      toast.error("Gagal memverifikasi PIN. Periksa koneksi.");
    } finally {
      setLoading(false);
    }
  }

  function press(d: string) {
    if (loading || locked || checkingLock) return;
    const next = (pin + d).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  }

  function backspace() {
    if (locked || checkingLock) return;
    setPin((p) => p.slice(0, -1));
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-sidebar p-6 text-sidebar-foreground">
      <div className="absolute right-4 top-4">
        {!confirmingLogout ? (
          <button
            type="button"
            onClick={() => setConfirmingLogout(true)}
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </button>
        ) : (
          <div className="flex items-center gap-1.5 rounded-md bg-sidebar-accent/60 p-1 text-xs">
            <span className="px-1.5 text-sidebar-foreground/70">Yakin keluar?</span>
            <button
              type="button"
              onClick={doLogout}
              disabled={loggingOut}
              className="flex items-center gap-1 rounded bg-destructive px-2 py-1 font-medium text-destructive-foreground disabled:opacity-60"
            >
              {loggingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ya, keluar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingLogout(false)}
              disabled={loggingOut}
              className="rounded px-2 py-1 text-sidebar-foreground/70 hover:bg-sidebar-accent"
            >
              Batal
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sidebar-accent">
          <Lock className="h-6 w-6 text-accent" />
        </div>
        <p className="font-display text-lg font-semibold">Layar Terkunci</p>
        <p className="text-sm text-sidebar-foreground/60">Masukkan PIN 4 digit untuk melanjutkan sebagai {cashierName}</p>
      </div>

      {locked ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <TimerReset className="h-6 w-6 text-destructive" />
          <p className="text-sm text-sidebar-foreground/70">Terlalu banyak percobaan salah.</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{formatCooldown(cooldown)}</p>
        </div>
      ) : (
        <div className={cn("flex gap-3 transition-transform", shake && "animate-shake")}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} className={cn("h-3 w-3 rounded-full border border-sidebar-foreground/40", i < pin.length && "border-accent bg-accent")} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            disabled={loading || locked || checkingLock}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-sidebar-accent/60 text-xl font-medium transition-colors hover:bg-sidebar-accent active:scale-95 disabled:opacity-30"
          >
            {d}
          </button>
        ))}
        <button type="button" onClick={backspace} disabled={loading || locked || checkingLock} title="Hapus" className="flex h-16 w-16 items-center justify-center rounded-full text-sidebar-foreground/60 hover:bg-sidebar-accent/40 disabled:opacity-30">
          <BackspaceIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => press("0")}
          disabled={loading || locked || checkingLock}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-sidebar-accent/60 text-xl font-medium transition-colors hover:bg-sidebar-accent active:scale-95 disabled:opacity-30"
        >
          0
        </button>
        <div className="flex h-16 w-16 items-center justify-center">
          {(loading || checkingLock) && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
        </div>
      </div>
    </div>
  );
}
