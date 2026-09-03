import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";

/** Data laporan untuk rentang tanggal tertentu — dipakai halaman Laporan (ringkasan + export Excel). */
export async function GET(request: Request) {
  try {
    const { admin } = await requireRole(["admin"]);
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    let orderQuery = admin.from("orders").select("*").order("created_at", { ascending: false });
    if (start) orderQuery = orderQuery.gte("created_at", start);
    if (end) orderQuery = orderQuery.lt("created_at", end);

    let expenseQuery = admin.from("expenses").select("*").order("created_at", { ascending: false });
    if (start) expenseQuery = expenseQuery.gte("created_at", start);
    if (end) expenseQuery = expenseQuery.lt("created_at", end);

    let writeoffQuery = admin.from("stock_writeoffs").select("*").order("created_at", { ascending: false });
    if (start) writeoffQuery = writeoffQuery.gte("created_at", start);
    if (end) writeoffQuery = writeoffQuery.lt("created_at", end);

    let stockEntryQuery = admin.from("stock_entries").select("*").order("created_at", { ascending: false });
    if (start) stockEntryQuery = stockEntryQuery.gte("created_at", start);
    if (end) stockEntryQuery = stockEntryQuery.lt("created_at", end);

    let incomeQuery = admin.from("special_incomes").select("*").order("created_at", { ascending: false });
    if (start) incomeQuery = incomeQuery.gte("created_at", start);
    if (end) incomeQuery = incomeQuery.lt("created_at", end);

    const [
      { data: orders, error },
      { data: expenses, error: expError },
      { data: writeoffs, error: woError },
      { data: stockEntries, error: seError },
      { data: incomes, error: incError },
    ] = await Promise.all([orderQuery, expenseQuery, writeoffQuery, stockEntryQuery, incomeQuery]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (expError) return NextResponse.json({ error: expError.message }, { status: 400 });
    if (woError) return NextResponse.json({ error: woError.message }, { status: 400 });
    if (seError) return NextResponse.json({ error: seError.message }, { status: 400 });
    if (incError) return NextResponse.json({ error: incError.message }, { status: 400 });

    const { data: kasirs } = await admin.from("profiles").select("id,nama").in("role", ["kasir", "admin"]);
    const kasirMap = Object.fromEntries((kasirs ?? []).map((k) => [k.id, k.nama]));

    // Modal (biaya pokok pesanan lunas + baris lama "tidak dibayar", status
    // yang sudah dipensiunkan di v10 — lihat constants.ts) ditampilkan
    // sebagai info margin saja — TIDAK dikurangkan dari surplus, karena
    // belanja stoknya sudah dihitung penuh sebagai kerugian saat stok
    // diinput (lihat "Kerugian Stok" di bawah). Pendapatan hanya dari
    // pesanan yang lunas.
    const costCounted = (orders ?? []).filter((o) => o.status_pembayaran === "paid" || o.status_pembayaran === "tidak_dibayar");
    const paid = (orders ?? []).filter((o) => o.status_pembayaran === "paid");
    const pengeluaran = (expenses ?? []).reduce((s, e) => s + Number(e.nominal), 0);
    const belanjaStok = (stockEntries ?? []).reduce((s, e) => s + Number(e.total_beli), 0);
    const kerugianDikembalikan = (writeoffs ?? []).filter((w) => w.kembalikan_kerugian).reduce((s, w) => s + Number(w.kerugian), 0);
    const kerugianStok = belanjaStok - kerugianDikembalikan;
    const modal = costCounted.reduce((s, o) => s + Number(o.modal_total), 0);
    const pendapatan = paid.reduce((s, o) => s + Number(o.harga_total), 0);
    const pemasukanKhusus = (incomes ?? []).reduce((s, i) => s + Number(i.nominal), 0);
    const pending = (orders ?? []).filter((o) => o.status_pembayaran === "pending");
    const pendapatanPending = pending.reduce((s, o) => s + Number(o.harga_total), 0);

    // Saldo kas KUMULATIF kantin per akhir periode (p_end) — beda dari
    // kolom lain yang di atas cuma dihitung DALAM rentang start..end.
    // Kalau `end` tidak ada (preset "Semua Waktu"), data yang sudah
    // diambil di atas SUDAH mencakup seluruh riwayat, jadi saldo = untung
    // periode ini sendiri (tidak perlu query tambahan).
    let saldo: number;
    if (end) {
      const [
        { data: paidAll }, { data: incomesAll }, { data: expensesAll },
        { data: stockAll }, { data: writeoffsAll },
      ] = await Promise.all([
        admin.from("orders").select("harga_total").eq("status_pembayaran", "paid").lt("created_at", end),
        admin.from("special_incomes").select("nominal").lt("created_at", end),
        admin.from("expenses").select("nominal").lt("created_at", end),
        admin.from("stock_entries").select("total_beli").lt("created_at", end),
        admin.from("stock_writeoffs").select("kerugian").eq("kembalikan_kerugian", true).lt("created_at", end),
      ]);
      const pendapatanAll = (paidAll ?? []).reduce((s, o) => s + Number(o.harga_total), 0);
      const pemasukanAll = (incomesAll ?? []).reduce((s, i) => s + Number(i.nominal), 0);
      const pengeluaranAll = (expensesAll ?? []).reduce((s, e) => s + Number(e.nominal), 0);
      const belanjaAll = (stockAll ?? []).reduce((s, e) => s + Number(e.total_beli), 0);
      const kerugianDikembalikanAll = (writeoffsAll ?? []).reduce((s, w) => s + Number(w.kerugian), 0);
      saldo = pendapatanAll + pemasukanAll - pengeluaranAll - (belanjaAll - kerugianDikembalikanAll);
    } else {
      saldo = pendapatan + pemasukanKhusus - pengeluaran - kerugianStok;
    }

    const stats = {
      modal,
      pendapatan,
      pengeluaran,
      kerugian_stok: kerugianStok,
      pemasukan_khusus: pemasukanKhusus,
      untung: pendapatan - pengeluaran - kerugianStok + pemasukanKhusus,
      saldo,
      pendapatan_pending: pendapatanPending,
      jumlah_pesanan: paid.length,
      jumlah_pending: pending.length,
      jumlah_dibatalkan: (orders ?? []).filter((o) => o.status_pembayaran === "cancelled").length,
    };

    return NextResponse.json({
      orders: orders ?? [], expenses: expenses ?? [], writeoffs: writeoffs ?? [],
      incomes: incomes ?? [], stockEntries: stockEntries ?? [], stats, kasirMap,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

/**
 * Catat aksi export laporan (Excel/PDF) — dipanggil dari tombol "Export
 * Excel"/"Export PDF" di halaman Laporan SETELAH file berhasil dibuat &
 * diunduh (file-nya sendiri dibuat penuh di client dari data yang sudah
 * dimuat lewat GET di atas, jadi tidak ada round-trip server tambahan
 * untuk isi filenya — endpoint ini murni untuk jejak audit "kapan &
 * siapa yang meng-export, rentang tanggal berapa").
 *
 * Sengaja dipisah dari GET: GET dipanggil berkali-kali tiap filter
 * tanggal laporan berubah (rutin, bukan "aksi" yang perlu dicatat —
 * sama seperti endpoint listing lain di aplikasi ini), sedangkan export
 * sungguhan hanya terjadi saat admin memang menekan tombol unduh.
 */
export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { format, label } = await request.json().catch(() => ({}));
    const formatLabel = format === "pdf" ? "PDF" : "Excel";

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama,
      aksi: ACTIVITY_ACTIONS.EXPORT_DATA,
      deskripsi: `Meng-export laporan ${formatLabel}${label ? ` (${label})` : ""}`,
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
