import { Clock4, Landmark, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/utils";
import type { PeriodStats } from "@/types/database";

/**
 * Lima kartu statistik yang dipakai BERSAMA oleh Dashboard (selalu bulan
 * berjalan) & Laporan (periode apa saja) — sengaja satu komponen supaya
 * definisi & tampilannya selalu identik di kedua halaman, cuma beda
 * periode & `saldoNote`.
 *
 *  - Saldo            : uang kantin yang tersedia SAAT INI/per akhir
 *                        periode (kumulatif sejak awal, lihat `saldo`
 *                        dari get_period_stats — bukan cuma periode ini).
 *  - Keuntungan Kotor  : Pendapatan − Modal (modal barang yang terjual).
 *  - Keuntungan Bersih : Pendapatan + Pemasukan Khusus − Pengeluaran
 *                        Khusus − Kerugian Stok PADA PERIODE INI — bisa
 *                        surplus (untung) atau defisit (rugi).
 *  - Pengeluaran       : gabungan pengeluaran khusus + belanja stok
 *                        (kerugian stok) periode ini — semua uang keluar.
 *  - Pesanan Belum Dibayar : jumlah + nilai rupiah pesanan pending.
 */
export function StatCards({
  stats, loading, saldoNote,
}: { stats: PeriodStats; loading?: boolean; saldoNote: string }) {
  const keuntunganKotor = stats.pendapatan - stats.modal;
  const keuntunganBersih = stats.untung;
  const totalPengeluaran = stats.pengeluaran + stats.kerugian_stok;
  const isSurplus = keuntunganBersih >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          <Landmark className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-7 w-28" /> : (
            <p className="tabular-figures text-xl font-semibold">{formatRupiah(stats.saldo)}</p>
          )}
          <p className="text-xs text-muted-foreground">{saldoNote}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Keuntungan Kotor</CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-7 w-28" /> : (
            <p className="tabular-figures text-xl font-semibold">{formatRupiah(keuntunganKotor)}</p>
          )}
          <p className="text-xs text-muted-foreground">Pendapatan − modal barang terjual</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Keuntungan Bersih <span className={isSurplus ? "text-success" : "text-destructive"}>({isSurplus ? "Surplus" : "Defisit"})</span>
          </CardTitle>
          {isSurplus ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-7 w-28" /> : (
            <p className={`tabular-figures text-xl font-semibold ${isSurplus ? "text-success" : "text-destructive"}`}>
              {formatRupiah(Math.abs(keuntunganBersih))}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Sesudah pengeluaran & kerugian stok</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pengeluaran</CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-7 w-28" /> : (
            <p className="tabular-figures text-xl font-semibold">{formatRupiah(totalPengeluaran)}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Stok {formatRupiah(stats.kerugian_stok)} + khusus {formatRupiah(stats.pengeluaran)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pesanan Belum Dibayar</CardTitle>
          <Clock4 className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-7 w-16" /> : (
            <p className="tabular-figures text-xl font-semibold">{stats.jumlah_pending} pesanan</p>
          )}
          <p className="text-xs text-muted-foreground">
            Senilai {formatRupiah(stats.pendapatan_pending)} · {stats.jumlah_dibatalkan} dibatalkan
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
