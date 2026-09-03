import { LoginForm } from "./login-form";
import { BrandIcon } from "@/components/shared/brand-icon";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10" />
        <div className="absolute -bottom-32 -left-10 h-80 w-80 rounded-full bg-primary-foreground/5" />
        <div className="relative flex items-center gap-2 font-display text-lg font-semibold">
          <BrandIcon className="h-5 w-5" />
          {APP_NAME}
        </div>
        <div className="relative space-y-3">
          <p className="font-display text-3xl font-semibold leading-snug">
            Kelola kantin, tanpa ribet.
          </p>
          <p className="max-w-sm text-sm text-sidebar-foreground/70">
            Satu aplikasi untuk pesanan, stok, dan laporan kantin — dari tablet
            pelanggan sampai meja kasir.
          </p>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">
          &copy; {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center lg:text-left">
            <div className="mb-4 flex items-center justify-center gap-2 font-display text-lg font-semibold lg:hidden">
              <BrandIcon className="h-5 w-5" />
              {APP_NAME}
            </div>
            <h1 className="font-display text-2xl font-semibold">Selamat datang</h1>
            <p className="text-sm text-muted-foreground">Masuk untuk melanjutkan ke {APP_NAME}.</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
