/**
 * Verifikasi endpoint /api/cron/* — dipanggil oleh cron SISTEM (crontab di
 * server, BUKAN dari browser/UI aplikasi), jadi tidak ada sesi Supabase
 * untuk requireRole() memverifikasinya. Sebagai gantinya, endpoint ini
 * diproteksi token rahasia (CRON_SECRET) yang dikirim lewat header
 * `Authorization: Bearer <CRON_SECRET>` — lihat contoh crontab di
 * .env.example.
 *
 * FAIL CLOSED: kalau CRON_SECRET belum diisi di env, endpoint dianggap
 * TIDAK terautentikasi sama sekali (bukan "lewati saja pengecekan") — jadi
 * fitur cron baru aktif setelah admin sengaja mengisi secret-nya sendiri.
 */
export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && token === secret;
}
