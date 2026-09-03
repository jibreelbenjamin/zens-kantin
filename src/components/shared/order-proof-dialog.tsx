"use client";
import * as React from "react";
import { Download, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { StorageImage } from "@/components/shared/storage-image";
import { downloadImage } from "@/lib/utils";

export function OrderProofDialog({ url, title, filename = "bukti.jpg" }: { url: string; title: string; filename?: string }) {
  const [downloading, setDownloading] = React.useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadImage(url, filename);
      toast.success("Gambar diunduh.");
    } catch {
      toast.error("Gagal mengunduh gambar.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Lihat bukti">
          <Receipt className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bukti</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
          <StorageImage src={url} alt="Bukti" fill sizes="380px" className="object-contain" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">Tutup</Button>
          </DialogClose>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Unduh Gambar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
