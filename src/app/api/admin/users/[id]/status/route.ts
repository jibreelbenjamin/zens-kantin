import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/require-role";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { accountApprovedEmail, accountBlockedEmail } from "@/lib/mail-templates";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, profile } = await requireRole(["admin"]);
    const { status } = await request.json();
    if (!["active", "pending", "block"].includes(status)) {
      return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update({ status }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: target } = await admin.from("profiles").select("nama,email").eq("id", params.id).single();
    // Admin bertindak lewat service-role client (bukan sesi user biasa), jadi
    // log dicatat manual di sini — trigger DB tidak bisa membaca siapa admin
    // yang login lewat koneksi service-role.
    await logActivity({
      admin,
      userId: profile.id,
      namaUser: profile.nama,
      aksi: ACTIVITY_ACTIONS.USER_STATUS,
      deskripsi: `Mengubah status ${target?.nama ?? params.id} menjadi ${status}`,
      request,
    });

    // Kabari client lewat email kalau statusnya disetujui/diblokir (bukan
    // "pending" — itu status awal netral, belum ada keputusan buat dikabari).
    // Gagal kirim email TIDAK menggagalkan perubahan status itu sendiri
    // (sendMail menelan errornya sendiri & cuma mencatat ke console) —
    // status akun sudah berubah di database apa pun hasil pengirimannya.
    if (target?.email && (status === "active" || status === "block")) {
      const { subject, html } = status === "active"
        ? accountApprovedEmail({ nama: target.nama })
        : accountBlockedEmail({ nama: target.nama });
      await sendMail({ to: target.email, subject, html });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
