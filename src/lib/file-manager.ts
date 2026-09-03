import { createAdminClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/constants";

/**
 * Helper untuk fitur "File Manager" di Admin (lihat
 * src/app/api/admin/file-manager/route.ts). Aksi yang ada:
 * - listStorage: jelajah/lihat isi bucket (read-only).
 * - deleteStorageFiles: hapus FILE (bukan folder) yang dipilih.
 * - scanOrphanFiles: cari file yang sudah tidak dirujuk data apa pun
 *   (lihat catatan di atas fungsinya) — dipakai tombol "Cari File Tidak
 *   Terpakai" & cron pembersihan otomatis.
 * Tidak ada endpoint untuk upload atau ganti nama, walau teknisnya bisa
 * lewat service-role client.
 *
 * PENTING: ini menjelajahi PENYIMPANAN APLIKASI (Supabase Storage —
 * bucket tempat foto produk/pesanan/stok/pembayaran diunggah lewat
 * ImageUpload), BUKAN source code / filesystem server. Karena itu tidak
 * ada risiko path-traversal ke file sistem sungguhan seperti kalau ini
 * membaca folder lokal — Storage API dari Supabase secara alami sudah
 * terkurung di dalam bucket yang diminta.
 *
 * Menghapus file di sini TIDAK menyentuh baris data (produk, pesanan,
 * pembayaran, dst.) yang kolom *_url-nya menunjuk ke file tersebut —
 * baris itu tetap ada, hanya saja gambarnya sudah tidak bisa dimuat.
 * Tempat-tempat yang menampilkan gambar itu memakai komponen
 * StorageImage (src/components/shared/storage-image.tsx) supaya
 * menunjukkan status "gambar telah dihapus" alih-alih gambar rusak.
 *
 * Setiap penghapusan (manual maupun otomatis) WAJIB dicatat lewat
 * logActivity oleh pemanggil (route handler) — lihat ACTIVITY_ACTIONS.FILE_HAPUS
 * & FILE_BERSIH_OTOMATIS di lib/constants.ts.
 */

export interface StorageEntry {
  name: string;
  type: "folder" | "file";
  size: number;
  mimetype: string | null;
  updatedAt: string | null;
  publicUrl: string | null;
  isImage: boolean;
}

export interface StorageListing {
  bucket: string;
  path: string;
  parent: string | null;
  entries: StorageEntry[];
  summary: { totalFiles: number; totalBytes: number; approximate: boolean };
}

export interface OrphanFile {
  path: string;
  size: number;
  updatedAt: string | null;
  publicUrl: string | null;
  isImage: boolean;
}

function isImageMime(mimetype: string | null, name: string) {
  if (mimetype) return mimetype.startsWith("image/");
  return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(name);
}

// Batas jumlah objek yang ditelusuri rekursif saat menghitung total ukuran
// bucket — jaga-jaga performa kalau suatu saat isinya sangat banyak. Kalau
// kelampaui, totalnya diberi tanda "perkiraan" (bukan angka final).
const SUMMARY_FILE_CAP = 5000;

async function computeBucketSummary(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string
): Promise<{ totalFiles: number; totalBytes: number; approximate: boolean }> {
  let totalFiles = 0;
  let totalBytes = 0;
  let approximate = false;

  async function walk(prefix: string): Promise<void> {
    if (approximate) return;
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (error || !data) return;
    for (const entry of data) {
      if (approximate) return;
      const isFolder = entry.id === null;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (isFolder) {
        await walk(entryPath);
      } else {
        totalFiles += 1;
        if (totalFiles > SUMMARY_FILE_CAP) {
          approximate = true;
          return;
        }
        totalBytes += entry.metadata?.size ?? 0;
      }
    }
  }

  await walk("");
  return { totalFiles, totalBytes, approximate };
}

/**
 * Dipakai BERSAMA oleh route API (/api/admin/file-manager) & halaman
 * server admin/file-manager (buat render pertama tanpa round-trip fetch
 * ke diri sendiri) — satu implementasi listing, dua pemanggil.
 */
export async function listStorage(rawPath: string): Promise<StorageListing | { error: string; status: number }> {
  const admin = createAdminClient();
  const bucket = STORAGE_BUCKET;

  const path = (rawPath ?? "").replace(/^\/+|\/+$/g, "");

  const { data, error } = await admin.storage.from(bucket).list(path, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) {
    return { error: `Gagal membaca penyimpanan: ${error.message}`, status: 500 };
  }
  if (!data) {
    return { error: "Folder tidak ditemukan.", status: 404 };
  }

  // Supabase Storage kadang menyisipkan placeholder ".emptyFolderPlaceholder"
  // (dibuat otomatis untuk folder kosong) — tidak relevan ditampilkan.
  const visible = data.filter((e) => e.name !== ".emptyFolderPlaceholder");

  const entries: StorageEntry[] = visible.map((entry) => {
    const isFolder = entry.id === null;
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    const mimetype = entry.metadata?.mimetype ?? null;
    const publicUrl = isFolder ? null : admin.storage.from(bucket).getPublicUrl(entryPath).data.publicUrl;
    return {
      name: entry.name,
      type: isFolder ? "folder" : "file",
      size: entry.metadata?.size ?? 0,
      mimetype,
      updatedAt: entry.updated_at ?? entry.created_at ?? null,
      publicUrl,
      isImage: !isFolder && isImageMime(mimetype, entry.name),
    };
  });

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "id");
  });

  const parent = path === "" ? null : path.split("/").slice(0, -1).join("/");
  const summary = await computeBucketSummary(admin, bucket);

  return { bucket, path: path || ".", parent, entries, summary };
}

// Batas jumlah file per permintaan hapus — cukup longgar untuk "pilih
// semua" di satu folder, tapi tetap mencegah payload tak wajar besar.
const MAX_DELETE_BATCH = 200;

/**
 * Hapus sejumlah FILE dari bucket (bukan folder — UI hanya pernah
 * mengirim path file karena checkbox cuma ada di baris file, lihat
 * file-manager-client.tsx). remove() Supabase Storage sendiri tidak
 * mengenal "folder" sebagai objek nyata, jadi path folder yang salah
 * kirim pun tidak akan berefek apa-apa di sini — bukan celah.
 *
 * Ini tidak menghapus/mengubah baris data mana pun di database; hanya
 * file di storage. Lihat catatan di komentar atas file ini.
 */
export async function deleteStorageFiles(
  rawPaths: string[]
): Promise<{ deleted: string[] } | { error: string; status: number }> {
  const admin = createAdminClient();
  const bucket = STORAGE_BUCKET;

  const paths = Array.from(
    new Set(
      rawPaths
        .map((p) => (typeof p === "string" ? p.replace(/^\/+/, "").replace(/\/+$/, "") : ""))
        .filter((p) => p.length > 0)
    )
  );

  if (paths.length === 0) {
    return { error: "Tidak ada file yang dipilih.", status: 400 };
  }
  if (paths.length > MAX_DELETE_BATCH) {
    return { error: `Maksimal ${MAX_DELETE_BATCH} file dalam sekali hapus.`, status: 400 };
  }

  const { data, error } = await admin.storage.from(bucket).remove(paths);
  if (error) {
    return { error: `Gagal menghapus file: ${error.message}`, status: 500 };
  }

  return { deleted: (data ?? []).map((d) => d.name) };
}

// Umur minimum (jam) sebelum sebuah file dianggap AMAN untuk dibersihkan
// otomatis kalau ternyata tidak terpakai. WAJIB ada jeda ini: ImageUpload
// (src/components/shared/image-upload.tsx) meng-upload gambar ke storage
// LANGSUNG begitu dipilih di form — SEBELUM form induknya (produk, input
// stok, metode pembayaran, dst) benar-benar disimpan. Tanpa jeda ini,
// gambar yang baru saja dipilih tapi formnya belum/batal disubmit (mis.
// admin masih mengisi, atau baru pindah tab) bisa ikut kehapus otomatis
// padahal bukan sampah.
const ORPHAN_MIN_AGE_HOURS = 24;

// Kolom *_url di database yang bisa menunjuk ke file di STORAGE_BUCKET —
// dipakai scanOrphanFiles() untuk tahu file mana yang MASIH terpakai.
// profiles.avatar_url sengaja TIDAK disertakan: avatar diisi dari foto
// akun Google (URL eksternal googleusercontent.com), tidak pernah lewat
// ImageUpload/bucket ini sama sekali.
const REFERENCING_TABLES = [
  { table: "products", column: "gambar_url" },
  { table: "payment_methods", column: "info_gambar_url" },
  { table: "orders", column: "bukti_bayar_url" },
  { table: "stock_entries", column: "gambar_url" },
  { table: "expenses", column: "gambar_url" },
  { table: "special_incomes", column: "gambar_url" },
] as const;

async function listAllFiles(admin: ReturnType<typeof createAdminClient>, bucket: string): Promise<OrphanFile[]> {
  const files: OrphanFile[] = [];

  async function walk(prefix: string): Promise<void> {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (error || !data) return;
    for (const entry of data) {
      if (entry.name === ".emptyFolderPlaceholder") continue;
      const isFolder = entry.id === null;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (isFolder) {
        await walk(entryPath);
      } else {
        const mimetype = entry.metadata?.mimetype ?? null;
        files.push({
          path: entryPath,
          size: entry.metadata?.size ?? 0,
          updatedAt: entry.updated_at ?? entry.created_at ?? null,
          publicUrl: admin.storage.from(bucket).getPublicUrl(entryPath).data.publicUrl,
          isImage: isImageMime(mimetype, entry.name),
        });
      }
    }
  }

  await walk("");
  return files;
}

/** Ambil path (relatif ke bucket) dari sebuah public URL Supabase Storage. */
function pathFromPublicUrl(bucket: string, url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const raw = url.slice(idx + marker.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Cari file di storage yang TIDAK dirujuk kolom *_url mana pun di
 * database — sisa dari record yang dihapus/diganti (mis. input stok
 * ditarik lalu diinput ulang dengan foto nota baru; foto nota yang lama
 * sebelumnya tidak pernah otomatis kehapus, menumpuk terus sebagai sampah).
 *
 * Sengaja HANYA MENCARI & MENGEMBALIKAN daftar — TIDAK menghapus apa pun
 * sendiri. Dipakai oleh dua pemanggil:
 * - Tombol "Cari File Tidak Terpakai" di Admin > File Manager (hasil
 *   ditinjau admin, baru dihapus via deleteStorageFiles setelah konfirmasi).
 * - /api/cron/cleanup-orphan-images (dipanggil cron server tanpa
 *   konfirmasi manusia — makanya ORPHAN_MIN_AGE_HOURS penting sebagai
 *   jaring pengaman di jalur ini).
 */
export async function scanOrphanFiles(): Promise<
  { orphans: OrphanFile[]; totalScanned: number } | { error: string; status: number }
> {
  const admin = createAdminClient();
  const bucket = STORAGE_BUCKET;

  try {
    const [allFiles, referencedRows] = await Promise.all([
      listAllFiles(admin, bucket),
      Promise.all(REFERENCING_TABLES.map(({ table, column }) => admin.from(table).select(column))),
    ]);

    const referenced = new Set<string>();
    referencedRows.forEach(({ data }, i) => {
      const { column } = REFERENCING_TABLES[i];
      for (const row of data ?? []) {
        const p = pathFromPublicUrl(bucket, (row as Record<string, string | null>)[column]);
        if (p) referenced.add(p);
      }
    });

    const cutoff = Date.now() - ORPHAN_MIN_AGE_HOURS * 60 * 60 * 1000;
    const orphans = allFiles.filter((f) => {
      if (referenced.has(f.path)) return false;
      const uploadedAt = f.updatedAt ? new Date(f.updatedAt).getTime() : 0;
      return uploadedAt > 0 && uploadedAt <= cutoff;
    });

    return { orphans, totalScanned: allFiles.length };
  } catch (e: any) {
    return { error: `Gagal memindai file tidak terpakai: ${e.message}`, status: 500 };
  }
}
