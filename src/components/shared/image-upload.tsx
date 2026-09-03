"use client";
import * as React from "react";
import { ImageUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { STORAGE_BUCKET } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StorageImage } from "@/components/shared/storage-image";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder: "products" | "orders" | "stock" | "payment";
  label?: string;
  optional?: boolean;
}

/** Upload gambar ke Supabase Storage — dikompres dulu di browser sebelum dikirim. */
export function ImageUpload({ value, onChange, folder, label, optional }: ImageUploadProps) {
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const compressed = await compressImage(file);
      const path = `${folder}/${generateId()}.jpg`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, compressed, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Gambar berhasil diunggah.");
    } catch (err: any) {
      toast.error("Gagal upload gambar", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label} {optional && <span className="text-muted-foreground font-normal">(opsional)</span>}</p>}
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-secondary/50">
          {value ? (
            <StorageImage src={value} alt="preview" fill sizes="80px" className="object-cover" showLabel={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageUp className="h-6 w-6" />
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
            {value ? "Ganti gambar" : "Pilih gambar"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onChange(null)}>
              <X className="mr-1 h-3.5 w-3.5" /> Hapus
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
