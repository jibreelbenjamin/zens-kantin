"use client";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Dengar pesanan baru masuk lewat WebSocket Supabase Realtime — TANPA
 * mengambil/menyimpan data pesanan apa pun (beda dari useRealtimeOrders
 * yang juga memuat & menyimpan seluruh daftar pesanan). Dipakai khusus di
 * layar PIN (/kasir/lock): layar itu sengaja route terpisah yang tidak
 * pernah me-render konten kasir sama sekali selagi terkunci (demi
 * keamanan — lihat komentar di layout kasir), jadi hook penuh
 * useRealtimeOrders tidak pernah jalan di sana & notifikasi pesanan masuk
 * tidak pernah kedengaran sampai layarnya dibuka lagi. Callback di sini
 * HANYA dipanggil untuk INSERT yang benar-benar terjadi SETELAH listener
 * ini terpasang (bukan pesanan lama yang sudah ada), jadi aman dipakai di
 * layar yang sedang terkunci tanpa memicu bunyi utk pesanan basi.
 */
export function useNewOrderAlert(onNewOrder: () => void) {
  const callbackRef = React.useRef(onNewOrder);
  callbackRef.current = onNewOrder;

  React.useEffect(() => {
    const supabase = createClient();

    // Sama seperti di useRealtimeOrders: token akses browser berganti tiap
    // ±1 jam, koneksi realtime perlu diberi tahu manual token barunya.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    const channel = supabase
      .channel("orders-lock-screen-alert")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        callbackRef.current();
      })
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);
}
