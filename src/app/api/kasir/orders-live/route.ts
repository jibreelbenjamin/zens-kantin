import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";

/**
 * Daftar pesanan terbaru untuk kasir — dipakai sebagai jalur cadangan
 * polling di useRealtimeOrders. WebSocket Supabase Realtime kadang diam-diam
 * berhenti menerima event (mis. koneksi sempat putus, tab lama dibuka, token
 * kedaluwarsa) tanpa terlihat error apa pun di layar — endpoint ini jadi
 * jaring pengaman supaya antrian pesanan tidak pernah benar-benar "macet".
 */
export async function GET() {
  try {
    const { supabase } = await requireRole(["admin", "kasir"]);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ orders: data ?? [] });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
