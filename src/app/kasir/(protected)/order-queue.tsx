"use client";
import * as React from "react";
import { Clock, ImageOff, PauseCircle, RefreshCw, Undo2, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { OrderProofDialog } from "@/components/shared/order-proof-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { cn, formatRupiah, formatDate } from "@/lib/utils";
import type { Order, PaymentMethod, Product } from "@/types/database";
import { ConfirmPaymentDialog } from "./confirm-payment-dialog";
import { NewOrderDialog } from "./new-order-dialog";

type Group = { groupId: string; orders: Order[] };

function groupOrders(orders: Order[]): Group[] {
  const map = new Map<string, Order[]>();
  for (const o of orders) {
    const list = map.get(o.group_id) ?? [];
    list.push(o);
    map.set(o.group_id, list);
  }
  return Array.from(map.entries())
    .map(([groupId, list]) => ({ groupId, orders: list }))
    .sort((a, b) => a.orders[0].created_at.localeCompare(b.orders[0].created_at));
}

function GroupCard({
  group, onChanged, onToggleSetAside,
}: { group: Group; onChanged: (updated: Order[]) => void; onToggleSetAside: (group: Group, next: boolean) => void }) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [togglingSetAside, setTogglingSetAside] = React.useState(false);
  const orders = group.orders;
  const first = orders[0];
  const total = orders.reduce((s, o) => s + o.harga_total, 0);
  const isPending = first.status_pembayaran === "pending";

  async function setStatus(status: "cancelled") {
    setLoading(true);
    try {
      const results = await Promise.all(
        orders.map((o) =>
          fetch(`/api/orders/${o.id}/status`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
          })
        )
      );
      if (results.some((r) => !r.ok)) throw new Error("Sebagian pesanan gagal diperbarui.");
      toast.success("Pesanan dibatalkan.");
      setCancelOpen(false);
      onChanged(orders.map((o) => ({ ...o, status_pembayaran: status })));
    } catch (err: any) {
      toast.error("Gagal memperbarui", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleSetAside() {
    setTogglingSetAside(true);
    try {
      await onToggleSetAside(group, !first.disampingkan);
    } finally {
      setTogglingSetAside(false);
    }
  }

  return (
    <Card className={cn(isPending && first.disampingkan && "border-dashed bg-secondary/30")}>
      <CardContent className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{first.nama_pemesan}</p>
            {orders.length > 1 && <Badge variant="secondary">{orders.length} produk</Badge>}
            <Badge variant="outline" className="gap-1 font-normal">
              <Wallet className="h-3 w-3" /> {first.nama_pembayaran ?? "Tidak diketahui"}
            </Badge>
            {isPending && first.disampingkan && (
              <Badge variant="secondary" className="gap-1">
                <PauseCircle className="h-3 w-3" /> Disampingkan
              </Badge>
            )}
            {isPending && first.dikonfirmasi_pelanggan && (
              <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Pelanggan klaim sudah bayar
              </Badge>
            )}
            {first.bukti_bayar_url && (
              <OrderProofDialog url={first.bukti_bayar_url} title={first.nama_pemesan} filename={`bukti-${first.nama_pemesan}.jpg`} />
            )}
          </div>
          <div className="space-y-0.5 text-sm text-muted-foreground">
            {orders.map((o) => (
              <p key={o.id} className="truncate">{o.nama_produk} <span className="text-foreground/70">×{o.qty}</span></p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(first.created_at, true)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="tabular-figures text-lg font-semibold">{formatRupiah(total)}</p>
          {isPending ? (
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline" disabled={togglingSetAside}
                title={first.disampingkan ? "Kembalikan ke antrian" : "Sampingkan pesanan (pelanggan bayar nanti)"}
                onClick={handleToggleSetAside}
              >
                {first.disampingkan ? <Undo2 className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
              </Button>
              <ConfirmDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                trigger={
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" title="Batalkan">
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                }
                title="Batalkan pesanan ini?"
                description={`${first.nama_pemesan} — ${orders.length} produk akan dibatalkan.`}
                confirmLabel="Ya, Batalkan"
                destructive
                loading={loading}
                onConfirm={() => setStatus("cancelled")}
              />
              <ConfirmPaymentDialog orders={orders} onConfirmed={onChanged} />
            </div>
          ) : (
            <StatusBadge value={first.status_pembayaran} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OrderQueue({
  initialOrders, products, paymentMethods,
}: { initialOrders: Order[]; products: Product[]; paymentMethods: PaymentMethod[] }) {
  const playSound = useNotificationSound();
  const [orders, setOrders, refreshOrders] = useRealtimeOrders(initialOrders, () => playSound());
  const [tab, setTab] = React.useState<"pending" | "selesai">("pending");
  const [refreshing, setRefreshing] = React.useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    const ok = await refreshOrders();
    setRefreshing(false);
    if (ok) toast.success("Daftar pesanan diperbarui.");
    else toast.error("Gagal memperbarui. Periksa koneksi.");
  }

  function applyLocalUpdate(updated: Order[]) {
    setOrders((prev) => {
      const byId = new Map(updated.map((o) => [o.id, o]));
      return prev.map((o) => byId.get(o.id) ?? o);
    });
  }

  async function handleToggleSetAside(group: Group, next: boolean) {
    try {
      const results = await Promise.all(
        group.orders.map((o) =>
          fetch(`/api/orders/${o.id}/set-aside`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disampingkan: next }),
          })
        )
      );
      if (results.some((r) => !r.ok)) throw new Error("Sebagian pesanan gagal diperbarui.");
      applyLocalUpdate(group.orders.map((o) => ({ ...o, disampingkan: next })));
      toast.success(next ? "Pesanan disampingkan." : "Pesanan dikembalikan ke antrian.");
    } catch (err: any) {
      toast.error("Gagal memperbarui", { description: err.message });
    }
  }

  const groups = groupOrders(orders);
  const pendingAll = groups.filter((g) => g.orders[0].status_pembayaran === "pending");
  // Pesanan yang "disampingkan" (pelanggan bayar nanti) TETAP di tab
  // Menunggu yang sama — cuma diposisikan di bawah, dipisah garis, biar
  // tidak tercampur dengan pesanan baru yang masuk & bikin kasir bingung.
  const pendingActive = pendingAll.filter((g) => !g.orders[0].disampingkan);
  const pendingSetAside = pendingAll.filter((g) => g.orders[0].disampingkan);
  const selesai = groups
    .filter((g) => g.orders[0].status_pembayaran !== "pending")
    .sort((a, b) => b.orders[0].created_at.localeCompare(a.orders[0].created_at))
    .slice(0, 30);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Menunggu ({pendingAll.length})
            </TabsTrigger>
            <TabsTrigger value="selesai">Riwayat</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}
            title="Muat ulang daftar pesanan"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <NewOrderDialog products={products} paymentMethods={paymentMethods} />
        </div>
      </div>

      <div className="space-y-3">
        {tab === "pending" ? (
          pendingAll.length ? (
            <>
              {pendingActive.map((g) => (
                <GroupCard key={g.groupId} group={g} onChanged={applyLocalUpdate} onToggleSetAside={handleToggleSetAside} />
              ))}
              {pendingSetAside.length > 0 && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <hr className="flex-1 border-dashed" />
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      Disampingkan ({pendingSetAside.length})
                    </span>
                    <hr className="flex-1 border-dashed" />
                  </div>
                  {pendingSetAside.map((g) => (
                    <GroupCard key={g.groupId} group={g} onChanged={applyLocalUpdate} onToggleSetAside={handleToggleSetAside} />
                  ))}
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
              <ImageOff className="h-8 w-8 opacity-40" />
              <p className="text-sm">Belum ada pesanan yang menunggu.</p>
            </div>
          )
        ) : (
          selesai.length ? selesai.map((g) => <GroupCard key={g.groupId} group={g} onChanged={applyLocalUpdate} onToggleSetAside={handleToggleSetAside} />) : (
            <p className="py-16 text-center text-sm text-muted-foreground">Belum ada riwayat.</p>
          )
        )}
      </div>
    </div>
  );
}
