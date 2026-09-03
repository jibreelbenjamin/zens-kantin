"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  ChevronRight, Download, File, Folder, FolderOpen, HardDrive, Home, ImageIcon, Loader2, RefreshCw, Sparkles, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StorageImage } from "@/components/shared/storage-image";
import { formatBytes, formatDate, downloadImage, cn } from "@/lib/utils";

// Tipe di sini SENGAJA didefinisikan ulang (bukan import dari
// @/lib/file-manager) — file itu memakai createAdminClient (server-only)
// yang tidak boleh ikut ter-bundle ke client. Bentuknya tetap harus sama
// persis dengan yang dikirim API/server component.
interface StorageEntry {
  name: string;
  type: "folder" | "file";
  size: number;
  mimetype: string | null;
  updatedAt: string | null;
  publicUrl: string | null;
  isImage: boolean;
}
interface StorageListing {
  bucket: string;
  path: string;
  parent: string | null;
  entries: StorageEntry[];
  summary: { totalFiles: number; totalBytes: number; approximate: boolean };
}
interface OrphanFile {
  path: string;
  size: number;
  updatedAt: string | null;
  publicUrl: string | null;
  isImage: boolean;
}

function StorageSummaryCard({ summary, bucket }: { summary: StorageListing["summary"]; bucket: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <HardDrive className="h-4 w-4" /> Info Penyimpanan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{summary.approximate && "≥ "}{formatBytes(summary.totalBytes)}</span> terpakai
          </span>
          <span>
            <span className="font-medium text-foreground">{summary.approximate && "≥ "}{summary.totalFiles}</span> file
          </span>
          <span className="text-xs text-muted-foreground/70">bucket &quot;{bucket}&quot;</span>
        </div>
        {summary.approximate && (
          <p className="mt-1 text-xs text-muted-foreground/70">
            Jumlah file sangat banyak — angka di atas perkiraan minimum, bukan hitungan pasti.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Thumbnail({ entry }: { entry: StorageEntry }) {
  if (entry.type === "folder") return <Folder className="h-5 w-5 shrink-0 text-accent" />;
  if (entry.isImage && entry.publicUrl) {
    return (
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border bg-secondary/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail kecil di daftar, sengaja bukan next/image/StorageImage: entri ini baru saja difetch dari list(), jadi kalaupun sempat 404 (dihapus tepat setelah listing dimuat) cukup biarkan kosong, tidak perlu status "dihapus" penuh di sini */}
        <img src={entry.publicUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return <File className="h-5 w-5 shrink-0 text-muted-foreground" />;
}

export function FileManagerClient({ initial }: { initial: StorageListing | null }) {
  const [listing, setListing] = React.useState<StorageListing | null>(initial);
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<StorageEntry | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  // --- Bersihkan File Tidak Terpakai (orphan cleanup) ---
  const [scanningOrphans, setScanningOrphans] = React.useState(false);
  const [orphans, setOrphans] = React.useState<OrphanFile[] | null>(null);
  const [orphanSelected, setOrphanSelected] = React.useState<Set<string>>(new Set());
  const [orphanConfirmOpen, setOrphanConfirmOpen] = React.useState(false);
  const [orphanDeleting, setOrphanDeleting] = React.useState(false);

  const load = React.useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/file-manager?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat folder.");
      setListing(data);
      setSelected(new Set());
    } catch (err: any) {
      toast.error("Gagal memuat folder", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  function fullPath(entry: StorageEntry) {
    return listing && listing.path !== "." ? `${listing.path}/${entry.name}` : entry.name;
  }

  function toggleOne(entry: StorageEntry, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      const p = fullPath(entry);
      if (checked) next.add(p);
      else next.delete(p);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!listing) return;
    const files = listing.entries.filter((e) => e.type === "file");
    setSelected(checked ? new Set(files.map((e) => fullPath(e))) : new Set());
  }

  async function deletePaths(paths: string[], source: "manual" | "orphan_cleanup") {
    const res = await fetch("/api/admin/file-manager", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, source }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Gagal menghapus file.");
    return data as { deleted: string[] };
  }

  async function handleDeleteSelected() {
    if (!listing || selected.size === 0) return;
    setDeleting(true);
    try {
      await deletePaths(Array.from(selected), "manual");
      toast.success(selected.size > 1 ? `${selected.size} file dihapus.` : "File dihapus.");
      setConfirmOpen(false);
      await load(listing.path === "." ? "" : listing.path);
    } catch (err: any) {
      toast.error("Gagal menghapus file", { description: err.message });
    } finally {
      setDeleting(false);
    }
  }

  async function handleScanOrphans() {
    setScanningOrphans(true);
    try {
      const res = await fetch("/api/admin/file-manager/orphans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memindai.");
      const found: OrphanFile[] = data.orphans ?? [];
      if (found.length === 0) {
        toast.success("Tidak ada file tidak terpakai — penyimpanan sudah bersih.");
        return;
      }
      setOrphans(found);
      setOrphanSelected(new Set(found.map((f) => f.path)));
    } catch (err: any) {
      toast.error("Gagal memindai file tidak terpakai", { description: err.message });
    } finally {
      setScanningOrphans(false);
    }
  }

  function toggleOrphan(path: string, checked: boolean) {
    setOrphanSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  async function handleDeleteOrphans() {
    if (orphanSelected.size === 0) return;
    setOrphanDeleting(true);
    try {
      const result = await deletePaths(Array.from(orphanSelected), "orphan_cleanup");
      toast.success(`${result.deleted.length} file tidak terpakai dibersihkan.`);
      setOrphanConfirmOpen(false);
      setOrphans(null);
      if (listing) await load(listing.path === "." ? "" : listing.path);
    } catch (err: any) {
      toast.error("Gagal membersihkan file", { description: err.message });
    } finally {
      setOrphanDeleting(false);
    }
  }

  async function handleDownload(entry: StorageEntry) {
    if (!entry.publicUrl) return;
    setDownloading(true);
    try {
      await downloadImage(entry.publicUrl, entry.name);
    } catch {
      toast.error("Gagal mengunduh file.");
    } finally {
      setDownloading(false);
    }
  }

  if (!listing) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Tidak bisa memuat File Manager saat ini.
        </CardContent>
      </Card>
    );
  }

  const crumbs = listing.path === "." ? [] : listing.path.split("/");
  const fileEntries = listing.entries.filter((e) => e.type === "file");
  const allFilesSelected = fileEntries.length > 0 && selected.size === fileEntries.length;
  const someFilesSelected = selected.size > 0 && !allFilesSelected;
  const selectedNames = listing.entries
    .filter((e) => e.type === "file" && selected.has(fullPath(e)))
    .map((e) => e.name);

  return (
    <div className="space-y-4">
      <StorageSummaryCard summary={listing.summary} bucket={listing.bucket} />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <button
                onClick={() => load("")}
                disabled={loading}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Home className="h-3.5 w-3.5" /> Penyimpanan
              </button>
              {crumbs.map((c, i) => {
                const segPath = crumbs.slice(0, i + 1).join("/");
                const isLast = i === crumbs.length - 1;
                return (
                  <React.Fragment key={segPath}>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <button
                      onClick={() => load(segPath)}
                      disabled={loading || isLast}
                      className={cn(
                        "rounded px-1.5 py-0.5",
                        isLast ? "font-medium text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {c}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={loading || deleting}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus ({selected.size})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleScanOrphans} disabled={loading || scanningOrphans}>
                {scanningOrphans ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Cari File Tidak Terpakai
              </Button>
              <Button variant="outline" size="sm" onClick={() => load(listing.path === "." ? "" : listing.path)} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Muat Ulang
              </Button>
            </div>
          </div>

          <div className="relative">
            {/* Overlay loading yang kelihatan jelas saat pindah folder/reload
                — sebelumnya cuma ikon di tombol "Muat Ulang" yang berubah,
                gampang tidak kelihatan begitu klik folder di tabel (fokus
                mata ada di baris yang diklik, bukan tombol di pojok). */}
            {loading && (
              <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/70 pt-16 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                </div>
              </div>
            )}
            <Table className={cn(loading && "opacity-50")}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-9">
                    {/* Checkbox pilih-semua hanya menghitung FILE, folder tidak bisa dihapus dari sini. */}
                    <Checkbox
                      checked={allFilesSelected ? true : someFilesSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(!!v)}
                      disabled={fileEntries.length === 0 || loading}
                      aria-label="Pilih semua file"
                    />
                  </TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-28 text-right">Ukuran</TableHead>
                  <TableHead className="w-40">Terakhir Diubah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listing.parent !== null && (
                  <TableRow className="cursor-pointer" onClick={() => !loading && load(listing.parent as string)}>
                    <TableCell />
                    <TableCell colSpan={3} className="text-muted-foreground">
                      <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> ..</span>
                    </TableCell>
                  </TableRow>
                )}
                {listing.entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Folder kosong.</TableCell>
                  </TableRow>
                )}
                {listing.entries.map((entry) => {
                  const p = fullPath(entry);
                  return (
                    <TableRow
                      key={entry.name}
                      className="cursor-pointer"
                      onClick={() => {
                        if (loading) return;
                        if (entry.type === "folder") {
                          load(p);
                        } else {
                          setPreview(entry);
                        }
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {entry.type === "file" && (
                          <Checkbox
                            checked={selected.has(p)}
                            onCheckedChange={(v) => toggleOne(entry, !!v)}
                            disabled={loading}
                            aria-label={`Pilih ${entry.name}`}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Thumbnail entry={entry} />
                          <span className="truncate">{entry.name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {entry.type === "folder" ? "-" : formatBytes(entry.size)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.updatedAt ? formatDate(entry.updatedAt, true) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
            <DialogDescription>
              {preview && `${formatBytes(preview.size)}${preview.mimetype ? ` · ${preview.mimetype}` : ""}`} — mode lihat saja, tidak bisa diedit.
            </DialogDescription>
          </DialogHeader>
          {preview?.isImage && preview.publicUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-secondary/30">
              <StorageImage src={preview.publicUrl} alt={preview.name} fill sizes="512px" className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-secondary/30 p-8 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm">Jenis file ini tidak bisa dipratinjau.</p>
            </div>
          )}
          {/* DialogContent aplikasi ini defaultnya TIDAK bisa ditutup lewat
              klik di luar / Esc (lihat ui/dialog.tsx) & tidak ada tombol X
              bawaan — jadi tanpa tombol eksplisit di sini, modal pratinjau
              ini sebelumnya tidak bisa ditutup sama sekali.
              Tombol "Buka di Tab Baru" & "Salin URL" diganti jadi
              "Download" saja, sejajar dengan "Tutup" (justify-between)
              alih-alih ditumpuk di baris terpisah. */}
          <DialogFooter className="flex-row justify-between gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">Tutup</Button>
            </DialogClose>
            {preview?.publicUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => preview && handleDownload(preview)}
                disabled={downloading}
              >
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={selected.size > 1 ? `Hapus ${selected.size} file?` : "Hapus file ini?"}
        description={
          <span className="block space-y-2">
            <span className="block">
              Gambar yang dihapus <strong>tidak dapat dikembalikan</strong>. Data yang terkait dengan gambar ini
              (produk, pesanan, pembayaran, stok, dll.) <strong>tidak akan bisa diakses atau dilihat lagi</strong>{" "}
              setelah gambar dihapus — hanya gambarnya yang hilang, data lain tetap ada.
            </span>
            {selectedNames.length > 0 && (
              <span className="block max-h-28 overflow-y-auto rounded-md border bg-muted/50 p-2 text-xs">
                {selectedNames.map((n) => (
                  <span key={n} className="block truncate">{n}</span>
                ))}
              </span>
            )}
          </span>
        }
        confirmLabel="Ya, Hapus"
        destructive
        loading={deleting}
        onConfirm={handleDeleteSelected}
      />

      {/* Hasil pindaian "Cari File Tidak Terpakai" — daftar ditinjau dulu
          oleh admin (checkbox, boleh batalkan sebagian) sebelum benar-benar
          dihapus lewat modal konfirmasi kedua di bawah, sama seperti alur
          hapus manual. File yang muncul di sini sudah lolos jeda 24 jam
          (lihat ORPHAN_MIN_AGE_HOURS di lib/file-manager.ts) & sudah
          dipastikan tidak dirujuk data produk/pesanan/stok/pembayaran mana pun. */}
      <Dialog open={!!orphans} onOpenChange={(o) => !o && setOrphans(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>File Tidak Terpakai Ditemukan ({orphans?.length ?? 0})</DialogTitle>
            <DialogDescription>
              File di bawah ini sudah tidak dirujuk data produk/pesanan/stok/pembayaran mana pun (mis. sisa dari
              input yang ditarik lalu diinput ulang). Hapus centang kalau ada yang tidak ingin ikut dihapus.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
            {orphans?.map((o) => (
              <label key={o.path} className="flex cursor-pointer items-center gap-2.5 rounded-md p-1.5 hover:bg-secondary/50">
                <Checkbox checked={orphanSelected.has(o.path)} onCheckedChange={(v) => toggleOrphan(o.path, !!v)} />
                {o.isImage && o.publicUrl ? (
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border bg-secondary/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail kecil, lihat alasan yang sama di komponen Thumbnail di atas */}
                    <img src={o.publicUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <File className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{o.path}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatBytes(o.size)}{o.updatedAt && ` · ${formatDate(o.updatedAt, true)}`}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter className="flex-row justify-between gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">Batal</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setOrphanConfirmOpen(true)}
              disabled={orphanSelected.size === 0}
            >
              <Trash2 className="h-3.5 w-3.5" /> Hapus ({orphanSelected.size}) File Terpilih
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={orphanConfirmOpen}
        onOpenChange={setOrphanConfirmOpen}
        title={`Bersihkan ${orphanSelected.size} file tidak terpakai?`}
        description={
          <span className="block">
            File yang dihapus <strong>tidak dapat dikembalikan</strong>. File-file ini terdeteksi sudah tidak
            dirujuk data apa pun, jadi seharusnya aman — tapi tetap tidak bisa dibatalkan setelah dihapus.
          </span>
        }
        confirmLabel="Ya, Bersihkan"
        destructive
        loading={orphanDeleting}
        onConfirm={handleDeleteOrphans}
      />
    </div>
  );
}
