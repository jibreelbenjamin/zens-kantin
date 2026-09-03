import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { decryptPin, encryptPin, newPinVersion } from "@/lib/pin-crypto";

/** Ambil & ubah PIN kasir (dan pengaturan lain di app_settings). Admin-only. */
export async function GET() {
  try {
    const { admin } = await requireRole(["admin"]);
    const { data, error } = await admin.from("app_settings").select("*").order("key");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // PIN dikembalikan dalam bentuk terbaca — admin memang harus bisa
    // melihatnya — tapi hanya lewat route ini, yang sudah dipastikan
    // admin-only; yang tersimpan di database tetap ciphertext. Penanda
    // versinya (kasir_pin_version) dibuang dari respons karena murni urusan
    // internal token kunci kasir, bukan pengaturan yang bisa diubah admin.
    const settings = (data ?? [])
      .filter((row) => row.key !== "kasir_pin_version")
      .map((row) => (row.key === "kasir_pin" ? { ...row, value: decryptPin(row.value) ?? "" } : row));
    return NextResponse.json({ data: settings });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { key, value } = await request.json();
    if (key === "kasir_pin" && !/^\d{4}$/.test(value)) {
      return NextResponse.json({ error: "PIN harus tepat 4 digit angka." }, { status: 400 });
    }
    if (key === "kasir_lock_interval_minutes") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 60) {
        return NextResponse.json({ error: "Interval harus angka bulat 1-60 menit." }, { status: 400 });
      }
    }
    const now = new Date().toISOString();
    const rows = [{ key, value: key === "kasir_pin" ? encryptPin(value) : value, updated_by: profile.id, updated_at: now }];

    // Setiap penyimpanan PIN ikut mengganti penanda versinya. Middleware
    // mencocokkan penanda ini dengan yang tertanam di token kunci kasir,
    // jadi layar kasir yang sedang terbuka dengan PIN lama langsung terkunci
    // lagi — tanpa ini, mengganti PIN tidak berpengaruh apa pun sampai token
    // yang lama kedaluwarsa sendiri.
    if (key === "kasir_pin") {
      rows.push({ key: "kasir_pin_version", value: newPinVersion(), updated_by: profile.id, updated_at: now });
    }

    const { error } = await admin.from("app_settings").upsert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivity({
      admin, userId: profile.id, namaUser: profile.nama, aksi: ACTIVITY_ACTIONS.PENGATURAN_UBAH,
      deskripsi: `Mengubah pengaturan ${key}`, request,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
