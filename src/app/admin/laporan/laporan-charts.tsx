"use client";
import * as React from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { formatRupiah } from "@/lib/utils";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { financeChartConfig } from "@/components/admin/monthly-chart";
import type { Order, PeriodStats } from "@/types/database";

/** Tren pendapatan dari pesanan lunas dalam periode terpilih — dikelompokkan
 * per hari untuk periode pendek (mingguan/bulanan/kustom singkat), atau per
 * bulan untuk periode panjang (tahunan/semua waktu) supaya grafiknya tidak
 * penuh sesak dengan ratusan bar setipis rambut. */
export function DailyTrendChart({ orders, granularity }: { orders: Order[]; granularity: "day" | "month" }) {
  const data = React.useMemo(() => {
    const buckets = new Map<string, { key: string; label: string; pendapatan: number }>();
    for (const o of orders) {
      if (o.status_pembayaran !== "paid") continue;
      const date = new Date(o.created_at);
      const key = granularity === "day" ? format(date, "yyyy-MM-dd") : format(date, "yyyy-MM");
      const label = granularity === "day" ? format(date, "d MMM", { locale: localeId }) : format(date, "MMM yy", { locale: localeId });
      const existing = buckets.get(key);
      if (existing) existing.pendapatan += o.harga_total;
      else buckets.set(key, { key, label, pendapatan: o.harga_total });
    }
    return Array.from(buckets.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [orders, granularity]);

  const config: ChartConfig = { pendapatan: { label: "Pendapatan", color: "hsl(var(--chart-1))" } };

  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pesanan lunas pada periode ini.</p>;

  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={64}
          tickFormatter={(v) => new Intl.NumberFormat("id-ID", { notation: "compact" }).format(v)}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRupiah(v)} />} />
        <Bar dataKey="pendapatan" fill="var(--color-pendapatan)" radius={[4, 4, 0, 0]} maxBarSize={granularity === "day" ? 28 : 42} />
      </BarChart>
    </ChartContainer>
  );
}

/** Produk terlaris (berdasar jumlah terjual) dari pesanan lunas pada periode terpilih. */
export function TopProductsChart({ orders }: { orders: Order[] }) {
  const data = React.useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const o of orders) {
      if (o.status_pembayaran !== "paid") continue;
      byProduct.set(o.nama_produk, (byProduct.get(o.nama_produk) ?? 0) + o.qty);
    }
    return Array.from(byProduct.entries())
      .map(([nama, qty]) => ({ nama, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [orders]);

  const config: ChartConfig = { qty: { label: "Terjual", color: "hsl(var(--chart-2))" } };

  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pesanan lunas pada periode ini.</p>;

  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="nama"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={110}
          tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v} terjual`} />} />
        <Bar dataKey="qty" fill="var(--color-qty)" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>
  );
}

/** Ringkasan keuangan periode terpilih dalam satu chart perbandingan — satu
 * bar per metrik (bukan dikelompokkan per kategori), pakai palet warna yang
 * sama persis dengan chart tren 6 bulan di Dashboard supaya angka yang sama
 * selalu warna yang sama di seluruh aplikasi. */
export function FinanceSnapshotChart({ stats }: { stats: PeriodStats }) {
  const rows: Array<{ key: keyof typeof financeChartConfig; value: number }> = [
    { key: "pendapatan", value: stats.pendapatan },
    { key: "modal", value: stats.modal },
    { key: "pengeluaran", value: stats.pengeluaran },
    { key: "kerugian_stok", value: stats.kerugian_stok },
    { key: "pemasukan_khusus", value: stats.pemasukan_khusus },
    { key: "untung", value: stats.untung },
  ];
  const data = rows.map((r) => ({ ...r, label: financeChartConfig[r.key].label }));

  return (
    <ChartContainer config={financeChartConfig} className="h-[240px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(v) => new Intl.NumberFormat("id-ID", { notation: "compact" }).format(v)}
        />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} fontSize={11} width={100} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRupiah(v)} />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((row) => <Cell key={row.key} fill={`var(--color-${row.key})`} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
