import { createClient } from "@/lib/supabase/server";
import { fetchTablePage, type SearchParams } from "@/lib/table-query";
import type { Order } from "@/types/database";
import { OrdersTable } from "./orders-table";

export default async function PesananPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const [{ rows: orders, server }, { data: kasirs }, { data: payments }] = await Promise.all([
    fetchTablePage<Order>(supabase, "orders", searchParams, {
      searchColumns: ["nama_pemesan", "nama_produk"],
      sortColumns: ["created_at", "nama_pemesan", "nama_produk", "nama_pembayaran", "harga_total", "modal_total", "status_pembayaran"],
      filterColumns: ["status_pembayaran", "nama_pembayaran"],
      defaultSort: { column: "created_at", ascending: false },
    }),
    supabase.from("profiles").select("id,nama").in("role", ["kasir", "admin"]),
    supabase.from("payment_methods").select("nama").order("nama"),
  ]);

  const kasirMap = Object.fromEntries((kasirs ?? []).map((k) => [k.id, k.nama]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pesanan</h1>
        <p className="text-sm text-muted-foreground">Semua pesanan yang masuk dari pelanggan, terbaru di atas.</p>
      </div>
      <OrdersTable
        data={orders}
        kasirMap={kasirMap}
        paymentNames={(payments ?? []).map((p) => p.nama)}
        server={server}
      />
    </div>
  );
}
