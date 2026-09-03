"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatRupiah } from "@/lib/utils";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type Row = {
  bulan: string; modal: number; pendapatan: number; pengeluaran: number;
  kerugian_stok: number; pemasukan_khusus: number; untung: number;
};

// Parameter chart di sini HARUS mengikuti seluruh kolom yang dikembalikan
// get_monthly_summary() (lihat supabase/migrations/schema.sql) — sebelumnya
// kerugian_stok sudah ada di data & di tipe Row tapi tidak pernah ikut
// digambar sebagai bar, jadi seolah nilainya selalu nol di chart.
// Diekspor supaya chart lain (mis. di halaman Laporan) bisa pakai palet
// warna yang sama persis — angka yang sama selalu warna yang sama di
// seluruh aplikasi.
export const financeChartConfig: ChartConfig = {
  modal: { label: "Modal", color: "hsl(var(--chart-5))" },
  pendapatan: { label: "Pendapatan", color: "hsl(var(--chart-1))" },
  pengeluaran: { label: "Pengeluaran Khusus", color: "hsl(var(--chart-3))" },
  kerugian_stok: { label: "Kerugian Stok", color: "hsl(var(--chart-4))" },
  pemasukan_khusus: { label: "Pemasukan Khusus", color: "hsl(var(--chart-6))" },
  untung: { label: "Untung/Rugi", color: "hsl(var(--chart-2))" },
};

export function MonthlyChart({ data }: { data: Row[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(new Date(d.bulan)),
  }));

  return (
    <ChartContainer config={financeChartConfig} className="h-[280px] w-full">
      <BarChart data={formatted} margin={{ left: 4, right: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={70}
          tickFormatter={(v) => new Intl.NumberFormat("id-ID", { notation: "compact" }).format(v)}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRupiah(v)} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="modal" fill="var(--color-modal)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="pendapatan" fill="var(--color-pendapatan)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="pengeluaran" fill="var(--color-pengeluaran)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="kerugian_stok" fill="var(--color-kerugian_stok)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="pemasukan_khusus" fill="var(--color-pemasukan_khusus)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="untung" fill="var(--color-untung)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  );
}
