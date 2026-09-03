"use client";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/types/database";

const POLL_MS = 4000;

/**
 * Berlangganan realtime ke tabel `orders` supaya halaman kasir langsung
 * menerima pesanan baru / perubahan status dari perangkat lain tanpa
 * refresh. Mengembalikan [orders, setOrders, refresh] — komponen pemanggil
 * bisa juga meng-update state secara LANGSUNG setelah aksi lokal berhasil
 * (mis. kasir sendiri menekan "Sudah Bayar"), supaya UI tidak bergantung
 * sepenuhnya pada round-trip realtime untuk aksi milik sendiri.
 *
 * Dua jalur berjalan bersamaan supaya antrian TIDAK PERNAH terlihat "mati":
 *   1. WebSocket Supabase Realtime — jalur cepat, event nyaris instan.
 *      Termasuk perbaikan bug umum Supabase: token akses browser berganti
 *      tiap ±1 jam (auto-refresh), tapi koneksi realtime TIDAK otomatis
 *      diberi tahu token barunya kecuali dipanggil manual — tanpa ini,
 *      realtime diam-diam berhenti menerima event setelah kasir membuka
 *      halaman cukup lama (persis keluhan "kadang berhenti sendiri").
 *   2. Polling ringan tiap beberapa detik ke /api/kasir/orders-live —
 *      jaring pengaman kalau WebSocket sempat putus (jaringan goyang, tab
 *      lama tidak aktif, dsb) tanpa terlihat error di layar.
 */
export function useRealtimeOrders(initialOrders: Order[], onInsert?: (order: Order) => void) {
  const [orders, setOrders] = React.useState<Order[]>(initialOrders);
  const onInsertRef = React.useRef(onInsert);
  onInsertRef.current = onInsert;

  React.useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const applyIncoming = React.useCallback((rows: Order[]) => {
    if (rows.length === 0) return;
    setOrders((prev) => {
      const byId = new Map(prev.map((o) => [o.id, o] as const));
      let hasNew = false;
      for (const row of rows) {
        if (!byId.has(row.id)) hasNew = true;
        byId.set(row.id, row);
      }
      if (hasNew) onInsertRef.current?.(rows[0]);
      return Array.from(byId.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    });
  }, []);

  // Jalur cepat: WebSocket.
  React.useEffect(() => {
    const supabase = createClient();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        applyIncoming([payload.new as Order]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        applyIncoming([payload.new as Order]);
      })
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [applyIncoming]);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/kasir/orders-live");
      if (!res.ok) return false;
      const json = await res.json();
      if (Array.isArray(json.orders)) applyIncoming(json.orders as Order[]);
      return true;
    } catch {
      return false;
    }
  }, [applyIncoming]);

  // Jalur cadangan: polling berkala, jaga-jaga WebSocket sempat terputus diam-diam.
  React.useEffect(() => {
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return [orders, setOrders, refresh] as const;
}
