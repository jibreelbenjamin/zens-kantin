import Link from "next/link";
import { ArrowUpRight, PackageX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MonthlyChart } from "@/components/admin/monthly-chart";
import { StatCards } from "@/components/admin/stat-cards";
import { DashboardRefreshButton } from "@/components/admin/dashboard-refresh-button";
import { formatRupiah, formatDate } from "@/lib/utils";
import { EMPTY_PERIOD_STATS, type PeriodStats } from "@/types/database";

export default async function AdminDashboardPage() {
  const supabase = createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const [{ data: periodStats }, { data: monthly }, { data: lowStock }, { data: recentOrders }, { count: pendingApprovals }] =
    await Promise.all([
      supabase.rpc("get_period_stats", { p_start: startOfMonth, p_end: startOfNextMonth }).single(),
      supabase.rpc("get_monthly_summary", { p_months: 6 }),
      supabase.from("products").select("id,nama,stok").lte("stok", 5).eq("is_active", true).order("stok", { ascending: true }).limit(5),
      supabase.from("orders").select("id,nama_pemesan,nama_produk,harga_total,status_pembayaran,created_at").order("created_at", { ascending: false }).limit(6),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const stats: PeriodStats = (periodStats as PeriodStats | null) ?? EMPTY_PERIOD_STATS;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan kantin bulan {new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(now)}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!!pendingApprovals && (
            <Link href="/admin/approval">
              <Badge variant="warning" className="cursor-pointer gap-1">
                {pendingApprovals} pendaftaran menunggu approval <ArrowUpRight className="h-3 w-3" />
              </Badge>
            </Link>
          )}
          <DashboardRefreshButton />
        </div>
      </div>

      {/*
        Kartu statistik di sini SENGAJA dibuat sama persis dengan kartu di
        halaman Laporan (Saldo, Keuntungan Kotor, Keuntungan Bersih,
        Pengeluaran, Pesanan Belum Dibayar — lihat components/admin/stat-
        cards.tsx) — bedanya cuma periodenya: dashboard selalu bulan
        berjalan, Laporan bisa pilih periode apa saja.
      */}
      <StatCards stats={stats} saldoNote="Uang kantin yang tersedia saat ini" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tren 6 Bulan Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={(monthly ?? []) as any} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><PackageX className="h-4 w-4 text-destructive" /> Stok Menipis</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/admin/produk">Lihat semua</Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock?.length ? lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{p.nama}</span>
                {p.stok === 0 ? (
                  <Badge variant="destructive">Stok Kosong</Badge>
                ) : (
                  <Badge variant="warning">{p.stok} sisa</Badge>
                )}
              </div>
            )) : <p className="text-sm text-muted-foreground">Semua stok aman.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pesanan Terbaru</CardTitle>
          <Button variant="ghost" size="sm" asChild><Link href="/admin/pesanan">Lihat semua</Link></Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {recentOrders?.length ? recentOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between border-b py-2.5 text-sm last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{o.nama_produk}</p>
                <p className="truncate text-xs text-muted-foreground">{o.nama_pemesan} · {formatDate(o.created_at, true)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-figures text-sm">{formatRupiah(o.harga_total)}</span>
                <Badge variant={o.status_pembayaran === "paid" ? "success" : o.status_pembayaran === "cancelled" ? "destructive" : "warning"}>
                  {o.status_pembayaran === "paid" ? "Lunas" : o.status_pembayaran === "cancelled" ? "Dibatalkan" : "Pending"}
                </Badge>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

