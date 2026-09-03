"use client";
import * as React from "react";
import Image, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";

type StorageImageProps = Omit<ImageProps, "onError"> & {
  /**
   * Tampilkan label teks di bawah ikon. Matikan untuk kontainer kecil
   * (mis. thumbnail 32-36px di tabel) yang tidak muat teks.
   */
  showLabel?: boolean;
};

/**
 * Pengganti next/image untuk semua gambar yang sumbernya file di Supabase
 * Storage (bucket kantin-images) — foto produk, bukti pembayaran, info
 * pembayaran, dst. File-file itu sekarang bisa dihapus lewat
 * Admin > File Manager (lihat file-manager-client.tsx), jadi <img> di
 * sini bisa gagal load (404) kapan pun meski kolom *_url di database
 * masih menunjuk ke path itu.
 *
 * Kalau gagal load, tampilkan status "gambar telah dihapus" yang jelas
 * — bukan ikon gambar rusak bawaan browser, dan sengaja beda dari
 * ProductImagePlaceholder (yang artinya "memang belum ada gambar").
 * Dipakai hanya untuk pola `fill` (semua pemanggil saat ini pakai
 * kontainer relative + Image fill), jadi fallback ini juga
 * `absolute inset-0` supaya pas mengisi kontainer yang sama.
 */
export function StorageImage({ className, showLabel = true, alt, ...props }: StorageImageProps) {
  const [failed, setFailed] = React.useState(false);

  // Kalau src berganti (mis. ganti produk di dialog yang sama), coba lagi.
  React.useEffect(() => {
    setFailed(false);
  }, [props.src]);

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted px-1 text-center text-muted-foreground">
        <ImageOff className="h-4 w-4 shrink-0" />
        {showLabel && <span className="text-[10px] leading-tight">Gambar telah dihapus</span>}
      </div>
    );
  }

  return <Image alt={alt} className={className} onError={() => setFailed(true)} {...props} />;
}
