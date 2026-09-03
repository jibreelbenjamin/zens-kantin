import { Construction } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

// Halaman ini sengaja TIDAK mengecek sesi/role apa pun — dijangkau lewat
// middleware (lihat src/middleware.ts) yang me-rewrite SELURUH request ke
// sini selama env APP_LOCKDOWN=true, sebelum pengecekan auth apa pun
// dijalankan. Jadi berlaku untuk semua orang: admin, kasir, pelanggan,
// bahkan yang belum login sekalipun.
export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Construction className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-semibold">Sedang Pemeliharaan</h1>
        <p className="text-sm text-muted-foreground">
          {APP_NAME} sedang dalam pemeliharaan sementara. Semua akses (admin,
          kasir, maupun pelanggan) untuk sementara dinonaktifkan. Silakan coba
          lagi beberapa saat lagi.
        </p>
      </div>
    </div>
  );
}
