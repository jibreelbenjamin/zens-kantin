"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, UserCheck, Users, Package, Wallet, ClipboardList,
  PackagePlus, BarChart3, ScrollText, Settings, Menu, Receipt,
  Maximize, Minimize, Tags, UserSquare2, PanelLeftClose, PanelLeftOpen, PiggyBank, HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/shared/logout-button";
import { AccountSettingsDialog } from "@/components/shared/account-settings-dialog";
import { BrandIcon } from "@/components/shared/brand-icon";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useFullscreen } from "@/hooks/use-fullscreen";
import type { Profile } from "@/types/database";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/approval", label: "Approval Pendaftaran", icon: UserCheck },
  { href: "/admin/users", label: "Pengguna", icon: Users },
  { href: "/admin/produk", label: "Produk", icon: Package },
  { href: "/admin/kategori", label: "Kategori Produk", icon: Tags },
  { href: "/admin/pelanggan", label: "Pelanggan Tersimpan", icon: UserSquare2 },
  { href: "/admin/pembayaran", label: "Metode Pembayaran", icon: Wallet },
  { href: "/admin/pesanan", label: "Pesanan", icon: ClipboardList },
  { href: "/admin/stok", label: "Manajemen Stok", icon: PackagePlus },
  { href: "/admin/pengeluaran", label: "Pengeluaran Khusus", icon: Receipt },
  { href: "/admin/pemasukan", label: "Pemasukan Khusus", icon: PiggyBank },
  { href: "/admin/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/admin/log", label: "Log Aktivitas", icon: ScrollText },
  { href: "/admin/file-manager", label: "File Manager", icon: HardDrive },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
];

// Breakpoint ini HARUS sama dengan breakpoint "lg" Tailwind (1024px) yang
// dipakai di seluruh className di bawah — dipakai lewat matchMedia buat
// tahu kapan sidebar harus berperilaku sebagai drawer overlay (mobile) vs
// panel yang mendorong konten (desktop).
const MOBILE_QUERY = "(max-width: 1023px)";
function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV.map((item, i) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            style={{ animationDelay: `${i * 25}ms` }}
            className={cn(
              "flex animate-in items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium fade-in slide-in-from-left-2 fill-mode-both transition-colors duration-200",
              active ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileBlock({ profile, onOpenAccount }: { profile: Profile; onOpenAccount: () => void }) {
  return (
    <>
      <button
        onClick={onOpenAccount}
        className="mx-3 mt-4 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg bg-sidebar-accent/50 p-3 text-left transition-colors hover:bg-sidebar-accent"
      >
        <UserAvatar nama={profile.nama} avatarUrl={profile.avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile.nama}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">@{profile.username}</p>
        </div>
      </button>
      <div className="px-3 pt-2">
        <LogoutButton className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground" />
      </div>
    </>
  );
}

export function AdminShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = React.useState(false);

  // SATU state untuk buka/tutup sidebar, dipakai di SEMUA ukuran layar.
  // Dulu ada DUA implementasi terpisah (Sheet/radix khusus mobile dengan
  // state `open` sendiri, & <aside> biasa khusus desktop dengan state
  // `sidebarOpen` sendiri) — begitu sidebar dibuka di layar hp lalu layar
  // di-resize/diputar ke ukuran desktop, state Sheet mobile itu TIDAK ikut
  // ter-reset (React tidak tahu breakpoint CSS berubah), jadi overlay
  // mobile-nya tetap nyangkut kebuka & menumpuk di atas sidebar desktop.
  // Sekarang cuma ada satu <aside>, satu state, satu tombol buka/tutup —
  // yang berubah cuma gaya tampilannya lewat class Tailwind responsif
  // (overlay+backdrop di mobile, panel yang mendorong konten di desktop).
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  // Di layar kecil, sidebar harus mulai TERTUTUP (dipakai sebagai drawer di
  // atas konten). Dicek sekali lewat matchMedia setelah mount (bukan di
  // render pertama) supaya HTML awal dari server tetap sama dgn client
  // sebelum effect ini jalan — menghindari hydration mismatch.
  React.useLayoutEffect(() => {
    if (isMobileViewport()) setSidebarOpen(false);
  }, []);

  function closeIfMobile() {
    if (isMobileViewport()) setSidebarOpen(false);
  }

  return (
    // Root dikunci ke tinggi viewport (bukan min-h-screen + sticky) supaya
    // sidebar TIDAK IKUT scroll bareng konten & tidak pernah kepotong biar
    // sepanjang apa pun konten halaman admin — tiap panel (sidebar & main)
    // scroll independen lewat overflow-y-auto masing-masing.
    <div className="flex h-screen overflow-hidden bg-secondary/30">
      {/* Backdrop, khusus mobile — tap di luar sidebar utk menutupnya. */}
      <div
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Wrapper ini yang "mendorong" konten di desktop (lebarnya animasi
          64 <-> 0). Di mobile selalu w-0 — sidebar-nya jadi overlay lewat
          position fixed di bawah, jadi tidak butuh jatah lebar di layout. */}
      <div className={cn("w-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out", sidebarOpen && "lg:w-64")}>
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col bg-sidebar py-5 text-sidebar-foreground shadow-2xl transition-transform duration-300 ease-in-out",
            "lg:static lg:w-64 lg:shadow-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-4 flex shrink-0 items-center justify-between gap-2 px-6 font-display text-base font-semibold">
            <span className="flex items-center gap-2">
              <BrandIcon className="h-5 w-5" />
              {APP_NAME}
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Tutup sidebar"
              className="rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NavLinks pathname={pathname} onNavigate={closeIfMobile} />
          </div>
          <div className="shrink-0">
            <ProfileBlock
              profile={profile}
              onOpenAccount={() => {
                closeIfMobile();
                setAccountOpen(true);
              }}
            />
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="flex-1 truncate font-display text-sm font-semibold">{APP_NAME} — Admin</span>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-4 hidden items-center justify-between lg:flex">
            <div>
              {!sidebarOpen && (
                <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} className="gap-1.5 text-muted-foreground">
                  <PanelLeftOpen className="h-4 w-4" /> Buka Sidebar
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-muted-foreground">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            </Button>
          </div>
          {children}
        </main>
      </div>

      <AccountSettingsDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        profile={profile}
      />
    </div>
  );
}
