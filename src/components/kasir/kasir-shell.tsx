"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Lock, Maximize, Minimize, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { useKasirLock } from "@/hooks/use-kasir-lock";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/shared/logout-button";
import { AccountSettingsDialog } from "@/components/shared/account-settings-dialog";
import { BrandIcon } from "@/components/shared/brand-icon";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { Profile } from "@/types/database";

const NAV = [
  { href: "/kasir", label: "Pesanan", icon: ClipboardList, exact: true },
  { href: "/kasir/produk", label: "Produk", icon: Package, exact: false },
];

export function KasirShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  // Layar PIN sekarang halaman terpisah (/kasir/lock) yang diarahkan lewat
  // middleware — bukan overlay yang ditumpuk di atas halaman ini lagi, jadi
  // konten di bawah TIDAK PERNAH ikut ter-render selama masih terkunci.
  // Hook ini hanya menjaga idle timer & tombol kunci manual.
  const { lockNow } = useKasirLock();
  const [accountOpen, setAccountOpen] = React.useState(false);
  const pathname = usePathname();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-sidebar px-3 text-sidebar-foreground sm:px-6">
        <div className="hidden items-center gap-2 font-display text-sm font-semibold md:flex">
          <BrandIcon className="h-[18px] w-[18px]" />
          <span className="whitespace-nowrap">{APP_NAME}</span>
        </div>
        <nav className="flex items-center gap-1 rounded-full bg-sidebar-accent/40 p-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                  active ? "bg-accent text-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost" size="icon" onClick={toggleFullscreen}
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            title={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost" size="icon" onClick={lockNow}
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            title="Kunci layar sekarang"
          >
            <Lock className="h-4 w-4" />
          </Button>
          <button onClick={() => setAccountOpen(true)} className="flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-sidebar-accent/50 sm:px-2">
            <UserAvatar nama={profile.nama} avatarUrl={profile.avatar_url} className="h-7 w-7" />
            <span className="hidden text-sm md:inline">{profile.nama}</span>
          </button>
          <LogoutButton size="sm" variant="ghost" className="text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
            <span className="hidden md:inline">Keluar</span>
          </LogoutButton>
        </div>
      </header>
      <main className="flex-1 p-3 sm:p-6">{children}</main>
      <AccountSettingsDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        profile={profile}
      />
    </div>
  );
}
