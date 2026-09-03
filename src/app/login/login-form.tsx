"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { Separator } from "@/components/ui/separator";
import { FormFieldset } from "@/components/shared/form-fieldset";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0 7.31 0 3.26 2.69 1.26 6.61l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export function LoginForm() {
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [pwLoading, setPwLoading] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  // Epoch ms kapan jeda login (lockout) berakhir — null kalau tidak sedang
  // dijeda. SENGAJA cuma di state React (in-memory), TIDAK di localStorage
  // (lihat catatan LOGIN_LOCKOUT_* di lib/constants.ts) — jadi kalau
  // halaman di-refresh selagi dijeda, tampilan cooldown ini memang hilang
  // sesaat, tapi keamanannya tidak bergantung padanya sama sekali: percobaan
  // login berikutnya tetap akan ditolak server dengan retryAfterSeconds
  // yang dihitung ulang secara akurat dari activity_logs, bukan dari apa
  // yang "diingat" browser.
  const [lockedUntil, setLockedUntil] = React.useState<number | null>(null);
  const [remainingSec, setRemainingSec] = React.useState(0);

  React.useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const diff = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemainingSec(diff);
      if (diff <= 0) setLockedUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // Kalau baru saja gagal login lewat Google (dilempar balik dari
  // /auth/callback dengan ?error=...&reason=...), tampilkan sebagai toast —
  // sebelumnya query param ini SAMA SEKALI tidak dibaca di sini, jadi
  // kegagalan di production tidak kelihatan apa-apa selain URL yang aneh.
  // Pakai window.location langsung (bukan useSearchParams) supaya tidak
  // perlu membungkus halaman ini dengan Suspense boundary tambahan.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      const reason = params.get("reason");
      toast.error(
        "Gagal menyelesaikan proses masuk dengan Google",
        { description: reason && reason !== "missing_code" ? reason : "Coba lagi, atau hubungi admin kalau terus terjadi." }
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleGoogle() {
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error("Gagal masuk dengan Google", { description: error.message });
      setGoogleLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true);
    try {
      // Login (termasuk cek jeda percobaan gagal & pencatatan log) sepenuhnya
      // ditangani server-side lewat satu route ini — lihat komentar di
      // /api/auth/login untuk alasannya (dulu log login sering tidak
      // tercatat karena balapan dengan timing cookie sesi).
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok || !data.session) {
        if (data.locked && data.retryAfterSeconds) {
          setLockedUntil(Date.now() + data.retryAfterSeconds * 1000);
        }
        throw new Error(data.error ?? "Username atau password salah.");
      }

      const supabase = createClient();
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (setSessionError) throw setSessionError;

      toast.success("Berhasil masuk.");
      // Hard navigation supaya middleware langsung membaca sesi baru.
      window.location.href = "/";
    } catch (err: any) {
      toast.error("Gagal masuk", { description: err.message });
      setPwLoading(false);
    }
  }

  const locked = !!lockedUntil && remainingSec > 0;

  return (
    <div className="space-y-5">
      <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={googleLoading}>
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
        Masuk dengan Google
      </Button>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
          atau dengan akun kantin
        </span>
      </div>

      <form onSubmit={handlePasswordLogin} className="space-y-3">
        <FormFieldset disabled={pwLoading || locked} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={pwLoading || locked}>
            {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Masuk
          </Button>
          {locked && (
            <p className="text-center text-xs font-medium text-destructive">
              Terlalu banyak percobaan gagal. Coba lagi dalam {String(Math.floor(remainingSec / 60)).padStart(2, "0")}:{String(remainingSec % 60).padStart(2, "0")}.
            </p>
          )}
        </FormFieldset>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Belum punya akun? Pilih <span className="font-medium text-foreground">Masuk dengan Google</span> — akun
        akan dibuat otomatis dan menunggu persetujuan admin.
      </p>
    </div>
  );
}
