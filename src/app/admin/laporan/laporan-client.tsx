"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Receipt, ArrowLeftRight, TrendingUp, Trophy, Scale, Loader2 } from "lucide-react";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  addDays, addWeeks, addMonths, addYears, format, isAfter,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { DataTable } from "@/components/shared/data-table";
import { DataTableFacetedFilter } from "@/components/shared/data-table-faceted-filter";
import { StatCards } from "@/components/admin/stat-cards";
import { formatRupiah, formatDate, slugifyFilename } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { downloadXlsxMultiSheet } from "@/lib/excel";
import { downloadReportPdf } from "@/lib/pdf";
import { DailyTrendChart, TopProductsChart, FinanceSnapshotChart } from "./laporan-charts";
import { getColumns } from "../pesanan/columns";
import { arusKasColumns, buildArusKasRows } from "./arus-kas-columns";
import { distribusiStokColumns, buildDistribusiStokRows } from "./distribusi-stok-columns";
import { EMPTY_PERIOD_STATS, type Expense, type Order, type PeriodStats, type SpecialIncome, type StockEntry, type StockWriteoff } from "@/types/database";

type Preset = "semua" | "minggu" | "bulan" | "tahun" | "custom";

function rangeFor(preset: Preset, offset: number, custom?: DateRange): { start?: Date; end?: Date } {
  const now = new Date();
  if (preset === "minggu") {
    const base = addWeeks(now, offset);
    return { start: startOfWeek(base, { weekStartsOn: 1 }), end: endOfWeek(base, { weekStartsOn: 1 }) };
  }
  if (preset === "bulan") {
    const base = addMonths(now, offset);
    return { start: startOfMonth(base), end: endOfMonth(base) };
  }
  if (preset === "tahun") {
    const base = addYears(now, offset);
    return { start: startOfYear(base), end: endOfYear(base) };
  }
  if (preset === "custom" && custom?.from) return { start: custom.from, end: custom.to ?? custom.from };
  return {};
}

function rangeLabel(preset: Preset, offset: number, custom?: DateRange): string | null {
  const { start, end } = rangeFor(preset, offset, custom);
  if (!start || !end) return null;
  if (preset === "tahun") return format(start, "yyyy", { locale: localeId });
  const sameYear = start.getFullYear() === end.getFullYear();
  const fmt = sameYear ? "d MMM" : "d MMM yyyy";
  return `${format(start, fmt, { locale: localeId })} – ${format(end, "d MMM yyyy", { locale: localeId })}`;
}

export function LaporanClient() {
  const [preset, setPreset] = React.useState<Preset>("bulan");
  const [offset, setOffset] = React.useState(0);
  const [customRange, setCustomRange] = React.useState<DateRange | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [incomes, setIncomes] = React.useState<SpecialIncome[]>([]);
  const [writeoffs, setWriteoffs] = React.useState<StockWriteoff[]>([]);
  const [stockEntries, setStockEntries] = React.useState<StockEntry[]>([]);
  const [kasirMap, setKasirMap] = React.useState<Record<string, string>>({});
  const [stats, setStats] = React.useState<PeriodStats>(EMPTY_PERIOD_STATS);
  const [exportingExcel, setExportingExcel] = React.useState(false);
  const [exportingPdf, setExportingPdf] = React.useState(false);

  function changePreset(p: Preset) {
    setPreset(p);
    setOffset(0);
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = rangeFor(preset, offset, customRange);
      const params = new URLSearchParams();
      if (start) params.set("start", start.toISOString());
      if (end) params.set("end", addDays(end, 1).toISOString());
      const res = await fetch(`/api/export?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setOrders(json.orders);
      setExpenses(json.expenses ?? []);
      setIncomes(json.incomes ?? []);
      setWriteoffs(json.writeoffs ?? []);
      setStockEntries(json.stockEntries ?? []);
      setStats(json.stats);
      setKasirMap(json.kasirMap ?? {});
    } catch (err: any) {
      toast.error("Gagal memuat laporan", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [preset, offset, customRange]);

  React.useEffect(() => { load(); }, [load]);

  const columns = React.useMemo(() => getColumns(kasirMap), [kasirMap]);
  const paymentOptions = React.useMemo(() => {
    const names = Array.from(new Set(orders.map((o) => o.nama_pembayaran).filter(Boolean))) as string[];
    return names.sort().map((n) => ({ label: n, value: n }));
  }, [orders]);
  // Arus Kas Khusus: gabungan Pemasukan Khusus + Pengeluaran Khusus dalam
  // satu datatable (satu ledger, urut waktu terbaru dulu).
  const arusKasRows = React.useMemo(() => buildArusKasRows(incomes, expenses), [incomes, expenses]);
  // Distribusi Stok: gabungan Input Stok (masuk) + Penghapusan Stok
  // (keluar) dalam satu datatable.
  const distribusiStokRows = React.useMemo(
    () => buildDistribusiStokRows(stockEntries, writeoffs),
    [stockEntries, writeoffs]
  );

  // Untuk periode panjang (tahunan/semua waktu), tren pendapatan
  // dikelompokkan per BULAN (bukan per hari) supaya chart tidak penuh
  // sesak dengan ratusan bar setipis rambut.
  const trendGranularity: "day" | "month" = preset === "tahun" || preset === "semua" ? "month" : "day";

  // Data agregat yang sama dipakai chart di layar (lihat laporan-charts.tsx)
  // DAN dua sheet/section baru di file ekspor (Tren Pendapatan & Produk
  // Terlaris) — dihitung sekali di sini supaya keduanya selalu konsisten.
  const trendRows = React.useMemo(() => {
    const buckets = new Map<string, { key: string; label: string; pendapatan: number; jumlahPesanan: number }>();
    for (const o of orders) {
      if (o.status_pembayaran !== "paid") continue;
      const date = new Date(o.created_at);
      const key = trendGranularity === "day" ? format(date, "yyyy-MM-dd") : format(date, "yyyy-MM");
      const label = trendGranularity === "day"
        ? format(date, "d MMM yyyy", { locale: localeId })
        : format(date, "MMMM yyyy", { locale: localeId });
      const existing = buckets.get(key);
      if (existing) {
        existing.pendapatan += o.harga_total;
        existing.jumlahPesanan += 1;
      } else {
        buckets.set(key, { key, label, pendapatan: o.harga_total, jumlahPesanan: 1 });
      }
    }
    return Array.from(buckets.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [orders, trendGranularity]);

  const topProductRows = React.useMemo(() => {
    const byProduct = new Map<string, { nama: string; qty: number; pendapatan: number }>();
    for (const o of orders) {
      if (o.status_pembayaran !== "paid") continue;
      const existing = byProduct.get(o.nama_produk);
      if (existing) {
        existing.qty += o.qty;
        existing.pendapatan += o.harga_total;
      } else {
        byProduct.set(o.nama_produk, { nama: o.nama_produk, qty: o.qty, pendapatan: o.harga_total });
      }
    }
    return Array.from(byProduct.values()).sort((a, b) => b.qty - a.qty);
  }, [orders]);

  const label = rangeLabel(preset, offset, customRange);
  const hasNav = preset === "minggu" || preset === "bulan" || preset === "tahun";
  const isFuture = hasNav && (() => {
    const { start } = rangeFor(preset, offset + 1, customRange);
    return start ? isAfter(start, new Date()) : true;
  })();
  // Saldo dari get_period_stats/API SELALU kumulatif sejak awal s/d akhir
  // periode terpilih (bukan cuma dalam periode itu) — lihat catatan di
  // migrasi v11. Untuk preset "Semua Waktu" itu otomatis = saldo saat ini.
  const saldoNote = preset === "semua" ? "Saldo kas kantin saat ini" : "Kumulatif sejak awal, per akhir periode ini";

  // exportExcel/exportPdf membangun file secara SINKRON (bisa terasa berat
  // sesaat utk data banyak) — dibungkus handler async di bawah supaya
  // tombolnya sempat menampilkan spinner SEBELUM kerja berat itu mulai
  // (browser perlu satu tick utk menggambar ulang tombolnya dulu).
  function exportExcel() {
    const orderRows = orders.map((o) => ({
      Waktu: formatDate(o.created_at, true),
      Pelanggan: o.nama_pemesan,
      Produk: o.nama_produk,
      Jumlah: o.qty,
      Pembayaran: o.nama_pembayaran ?? "-",
      Modal: o.modal_total,
      Harga: o.harga_total,
      Untung: o.harga_total - o.modal_total,
      Kasir: o.kasir_id ? kasirMap[o.kasir_id] ?? "-" : "-",
      Status: o.status_pembayaran,
    }));
    const arusKasXlsxRows = arusKasRows.map((r) => ({
      Waktu: formatDate(r.created_at, true),
      Jenis: r.jenis === "pemasukan" ? "Pemasukan Khusus" : "Pengeluaran Khusus",
      Nama: r.nama,
      "Nominal (+/-)": r.jenis === "pemasukan" ? r.nominal : -r.nominal,
      Keterangan: r.keterangan ?? "-",
    }));
    const distribusiStokXlsxRows = distribusiStokRows.map((r) => ({
      Waktu: formatDate(r.created_at, true),
      Produk: r.nama_produk,
      Jenis: r.jenis === "masuk" ? "Stok Masuk" : "Stok Keluar",
      "Jumlah (+/-)": r.jenis === "masuk" ? r.qty : -r.qty,
      Nilai: r.nilai ?? 0,
      Keterangan: r.keterangan ?? "-",
    }));
    const trendXlsxRows = trendRows.map((r) => ({
      Periode: r.label,
      Pendapatan: r.pendapatan,
      "Jumlah Pesanan": r.jumlahPesanan,
    }));
    const topProductXlsxRows = topProductRows.map((r, i) => ({
      Peringkat: i + 1,
      Produk: r.nama,
      "Jumlah Terjual": r.qty,
      Pendapatan: r.pendapatan,
    }));
    const keuntunganKotor = stats.pendapatan - stats.modal;
    const totalPengeluaran = stats.pengeluaran + stats.kerugian_stok;
    const summaryRows = [
      { Ringkasan: "Saldo", Nilai: stats.saldo },
      { Ringkasan: "Pendapatan", Nilai: stats.pendapatan },
      { Ringkasan: "Modal", Nilai: stats.modal },
      { Ringkasan: "Keuntungan Kotor", Nilai: keuntunganKotor },
      { Ringkasan: "Pengeluaran (Total)", Nilai: totalPengeluaran },
      { Ringkasan: "Pengeluaran Khusus", Nilai: stats.pengeluaran },
      { Ringkasan: "Kerugian Stok", Nilai: stats.kerugian_stok },
      { Ringkasan: "Pemasukan Khusus", Nilai: stats.pemasukan_khusus },
      { Ringkasan: stats.untung >= 0 ? "Keuntungan Bersih (Surplus)" : "Keuntungan Bersih (Defisit)", Nilai: Math.abs(stats.untung) },
      { Ringkasan: `Pesanan Belum Dibayar (${stats.jumlah_pending} pesanan)`, Nilai: stats.pendapatan_pending },
    ];
    downloadXlsxMultiSheet(`laporan-${slugifyFilename(APP_NAME)}-${preset}-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: "Ringkasan", rows: summaryRows, currencyColumns: ["Nilai"] },
      { name: "Tren Pendapatan", rows: trendXlsxRows, currencyColumns: ["Pendapatan"] },
      { name: "Produk Terlaris", rows: topProductXlsxRows, currencyColumns: ["Pendapatan"] },
      { name: "Pesanan", rows: orderRows, currencyColumns: ["Modal", "Harga", "Untung"] },
      { name: "Arus Kas Khusus", rows: arusKasXlsxRows, currencyColumns: ["Nominal (+/-)"] },
      { name: "Distribusi Stok", rows: distribusiStokXlsxRows, currencyColumns: ["Nilai"] },
    ]);
    toast.success("Laporan Excel diunduh.");
  }

  function exportPdf() {
    const keuntunganKotor = stats.pendapatan - stats.modal;
    const totalPengeluaran = stats.pengeluaran + stats.kerugian_stok;
    downloadReportPdf({
      filename: `laporan-${slugifyFilename(APP_NAME)}-${preset}-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: `Laporan ${APP_NAME}`,
      periodLabel: label ?? "Semua Waktu",
      summary: [
        { label: "Saldo", value: formatRupiah(stats.saldo) },
        { label: "Pendapatan", value: formatRupiah(stats.pendapatan) },
        { label: "Keuntungan Kotor", value: formatRupiah(keuntunganKotor) },
        { label: "Pengeluaran (Total)", value: formatRupiah(totalPengeluaran) },
        { label: stats.untung >= 0 ? "Keuntungan Bersih (Surplus)" : "Keuntungan Bersih (Defisit)", value: formatRupiah(Math.abs(stats.untung)) },
        { label: "Pesanan Belum Dibayar", value: `${stats.jumlah_pending} pesanan (${formatRupiah(stats.pendapatan_pending)})` },
      ],
      sections: [
        {
          title: "Tren Pendapatan",
          head: ["Periode", "Pendapatan", "Jumlah Pesanan"],
          rows: trendRows.map((r) => [r.label, formatRupiah(r.pendapatan), String(r.jumlahPesanan)]),
        },
        {
          title: "Produk Terlaris",
          head: ["Peringkat", "Produk", "Jumlah Terjual", "Pendapatan"],
          rows: topProductRows.map((r, i) => [String(i + 1), r.nama, String(r.qty), formatRupiah(r.pendapatan)]),
        },
        {
          title: "Pesanan",
          head: ["Waktu", "Pelanggan", "Produk", "Jml", "Harga", "Untung", "Status"],
          rows: orders.map((o) => [
            formatDate(o.created_at, true), o.nama_pemesan, o.nama_produk, String(o.qty),
            formatRupiah(o.harga_total), formatRupiah(o.harga_total - o.modal_total), o.status_pembayaran,
          ]),
        },
        {
          title: "Arus Kas Khusus",
          head: ["Waktu", "Jenis", "Nama", "Nominal", "Keterangan"],
          rows: arusKasRows.map((r) => [
            formatDate(r.created_at, true),
            r.jenis === "pemasukan" ? "Pemasukan" : "Pengeluaran",
            r.nama,
            `${r.jenis === "pemasukan" ? "+" : "-"}${formatRupiah(r.nominal)}`,
            r.keterangan ?? "-",
          ]),
        },
        {
          title: "Distribusi Stok",
          head: ["Waktu", "Produk", "Jenis", "Jumlah", "Nilai"],
          rows: distribusiStokRows.map((r) => [
            formatDate(r.created_at, true),
            r.nama_produk,
            r.jenis === "masuk" ? "Masuk" : "Keluar",
            `${r.jenis === "masuk" ? "+" : "-"}${r.qty}`,
            r.nilai != null ? formatRupiah(r.nilai) : "-",
          ]),
        },
      ],
    });
    toast.success("Laporan PDF diunduh.");
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      exportExcel();
      fetch("/api/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "xlsx", label: label ?? preset }),
      }).catch(() => {});
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      exportPdf();
      fetch("/api/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pdf", label: label ?? preset }),
      }).catch(() => {});
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={preset} onValueChange={(v) => changePreset(v as Preset)} className="w-full sm:w-auto">
          {/* h-auto + flex-wrap: 5 tab kepanjangan buat layar sempit kalau
              dipaksa satu baris (bikin halaman scroll kanan-kiri) — biarkan
              wrap ke baris berikutnya di layar sempit, bukan overflow. */}
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="semua">Semua Waktu</TabsTrigger>
            <TabsTrigger value="minggu">Mingguan</TabsTrigger>
            <TabsTrigger value="bulan">Bulanan</TabsTrigger>
            <TabsTrigger value="tahun">Tahunan</TabsTrigger>
            <TabsTrigger value="custom">Kustom</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {preset === "custom" && <DateRangePicker value={customRange} onChange={setCustomRange} />}
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={loading || exportingExcel || !orders.length}>
            {exportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={loading || exportingPdf || !orders.length}>
            {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} PDF
          </Button>
        </div>
      </div>

      {label && (
        <div className="flex items-center gap-2">
          {hasNav && (
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <p className="text-sm text-muted-foreground">Periode: <span className="font-medium text-foreground">{label}</span></p>
          {hasNav && (
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOffset((o) => o + 1)} disabled={isFuture}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      <StatCards stats={stats} loading={loading} saldoNote={saldoNote} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Tren Pendapatan</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[240px] w-full" /> : <DailyTrendChart orders={orders} granularity={trendGranularity} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Produk Terlaris</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[240px] w-full" /> : <TopProductsChart orders={orders} />}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scale className="h-4 w-4" /> Ringkasan Keuangan Periode Ini</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[240px] w-full" /> : <FinanceSnapshotChart stats={stats} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Detail Pesanan</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={orders}
              searchPlaceholder="Cari..."
              emptyMessage="Tidak ada pesanan pada periode ini."
              toolbar={(table) => paymentOptions.length > 0 && (
                <DataTableFacetedFilter column={table.getColumn("nama_pembayaran")} title="Pembayaran" options={paymentOptions} />
              )}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Arus Kas Khusus</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-24 w-full" /> : (
            <DataTable
              columns={arusKasColumns}
              data={arusKasRows}
              searchPlaceholder="Cari..."
              emptyMessage="Tidak ada pemasukan/pengeluaran khusus pada periode ini."
              toolbar={(table) => (
                <DataTableFacetedFilter
                  column={table.getColumn("jenis")}
                  title="Jenis"
                  options={[{ label: "Pemasukan Khusus", value: "pemasukan" }, { label: "Pengeluaran Khusus", value: "pengeluaran" }]}
                />
              )}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Distribusi Stok</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-24 w-full" /> : (
            <DataTable
              columns={distribusiStokColumns}
              data={distribusiStokRows}
              searchPlaceholder="Cari..."
              emptyMessage="Tidak ada input/penghapusan stok pada periode ini."
              toolbar={(table) => (
                <DataTableFacetedFilter
                  column={table.getColumn("jenis")}
                  title="Jenis"
                  options={[{ label: "Stok Masuk", value: "masuk" }, { label: "Stok Keluar", value: "keluar" }]}
                />
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
