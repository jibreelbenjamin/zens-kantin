"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsFromName } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Avatar dengan fallback inisial nama yang selalu tampil kalau tidak ada
 * foto — AvatarImage hanya dirender kalau url-nya benar-benar ada, supaya
 * Radix AvatarFallback tidak pernah "nyangkut" kosong menunggu status
 * loading gambar yang sebenarnya tidak pernah ada.
 */
export function UserAvatar({
  nama, avatarUrl, className,
}: { nama: string; avatarUrl?: string | null; className?: string }) {
  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={nama} />}
      <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
        {initialsFromName(nama) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
