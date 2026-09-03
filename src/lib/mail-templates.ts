import { APP_NAME } from "@/lib/constants";
import { formatRupiah } from "@/lib/utils";

// Warna diambil langsung dari token brand aplikasi (src/app/globals.css,
// tema terang) — dikonversi ke hex karena email client tidak bisa diajak
// pakai CSS variables/hsl() secara andal, harus warna literal + inline style.
const COLOR = {
  primary: "#205B47", // --primary: 160 48% 24% (deep jade)
  primaryDark: "#163F32",
  accent: "#DC9A28", // --accent: 38 72% 51% (warm turmeric)
  success: "#2D7654", // --success: 152 45% 32%
  destructive: "#CE2D22", // --destructive: 4 72% 47%
  cream: "#FAF8F5", // --primary-foreground: 40 30% 97%
  text: "#2A2521",
  muted: "#8A8079",
  border: "#E7E1D8",
};

function baseLayout({ preheader, bodyHtml }: { preheader: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${APP_NAME}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLOR.cream}; font-family:Segoe UI, Helvetica, Arial, sans-serif; color:${COLOR.text};">
    <span style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.cream}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid ${COLOR.border};">
            <tr>
              <td style="background-color:${COLOR.primary}; padding:28px 32px;">
                <span style="font-size:19px; font-weight:700; color:#ffffff; letter-spacing:0.2px;">${APP_NAME}</span>
                <div style="font-size:12px; color:${COLOR.cream}; opacity:0.75; margin-top:2px;">Sistem Manajemen Kantin</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; border-top:1px solid ${COLOR.border}; background-color:${COLOR.cream};">
                <p style="margin:0; font-size:12px; line-height:1.6; color:${COLOR.muted};">
                  Email ini dikirim otomatis oleh sistem ${APP_NAME}. Mohon tidak membalas langsung ke email ini.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label: string, url: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:10px; background-color:${color};">
        <a href="${url}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function badge(label: string, color: string): string {
  return `<span style="display:inline-block; padding:4px 12px; border-radius:999px; background-color:${color}1A; color:${color}; font-size:12px; font-weight:600;">${label}</span>`;
}

const siteUrl = () => (process.env.APP_URL || "").replace(/\/$/, "");

/** Ke CLIENT: akun disetujui admin, sekarang bisa login & dipakai. */
export function accountApprovedEmail({ nama }: { nama: string }): { subject: string; html: string } {
  const url = siteUrl();
  const subject = `Akun ${APP_NAME} kamu sudah disetujui`;
  const bodyHtml = `
    ${badge("Akun Disetujui", COLOR.success)}
    <h1 style="font-size:20px; margin:16px 0 8px;">Halo, ${nama}!</h1>
    <p style="font-size:14px; line-height:1.7; color:${COLOR.text}; margin:0 0 4px;">
      Kabar baik — pendaftaran akun kamu di <strong>${APP_NAME}</strong> sudah <strong>disetujui admin</strong>.
      Kamu sekarang sudah bisa masuk dan mulai memesan.
    </p>
    ${url ? button("Buka " + APP_NAME, url, COLOR.success) : ""}
    <p style="font-size:12px; line-height:1.6; color:${COLOR.muted}; margin-top:24px;">
      Kalau kamu merasa tidak pernah mendaftar akun ini, abaikan saja email ini.
    </p>
  `;
  return { subject, html: baseLayout({ preheader: "Akun kamu sudah disetujui admin.", bodyHtml }) };
}

/** Ke CLIENT: akun diblokir admin. */
export function accountBlockedEmail({ nama }: { nama: string }): { subject: string; html: string } {
  const subject = `Akun ${APP_NAME} kamu diblokir`;
  const bodyHtml = `
    ${badge("Akun Diblokir", COLOR.destructive)}
    <h1 style="font-size:20px; margin:16px 0 8px;">Halo, ${nama}.</h1>
    <p style="font-size:14px; line-height:1.7; color:${COLOR.text}; margin:0 0 4px;">
      Akun kamu di <strong>${APP_NAME}</strong> telah <strong>diblokir oleh admin</strong> dan untuk sementara
      tidak bisa dipakai untuk masuk atau memesan.
    </p>
    <p style="font-size:14px; line-height:1.7; color:${COLOR.text}; margin:16px 0 0;">
      Kalau menurutmu ini keliru, silakan hubungi pihak kantin/admin sekolah secara langsung.
    </p>
  `;
  return { subject, html: baseLayout({ preheader: "Akun kamu diblokir oleh admin.", bodyHtml }) };
}

/** Ke ADMIN: ada pendaftaran akun baru yang menunggu persetujuan. */
export function newRegistrationAdminEmail({ nama, username }: { nama: string; username: string }): { subject: string; html: string } {
  const url = siteUrl();
  const subject = `Pendaftaran baru menunggu persetujuan: ${nama}`;
  const bodyHtml = `
    ${badge("Pengguna Baru", COLOR.accent)}
    <h1 style="font-size:20px; margin:16px 0 8px;">Ada pendaftaran akun baru</h1>
    <p style="font-size:14px; line-height:1.7; color:${COLOR.text}; margin:0 0 16px;">
      <strong>${nama}</strong> (@${username}) baru saja mendaftar di ${APP_NAME} dan statusnya masih
      <strong>menunggu persetujuan</strong>. Akun ini belum bisa dipakai sampai disetujui.
    </p>
    ${url ? button("Tinjau di Admin > Pengguna", `${url}/admin/users`, COLOR.primary) : ""}
  `;
  return { subject, html: baseLayout({ preheader: `${nama} menunggu persetujuan akun.`, bodyHtml }) };
}

export interface MonthlyReportRow {
  modal: number;
  pendapatan: number;
  pengeluaran: number;
  kerugian_stok: number;
  pemasukan_khusus: number;
  untung: number;
  jumlah_pesanan: number;
}

/** Ke ADMIN: ringkasan laporan kantin bulanan. */
export function monthlyReportAdminEmail({ periodLabel, row }: { periodLabel: string; row: MonthlyReportRow }): { subject: string; html: string } {
  const url = siteUrl();
  const subject = `Laporan Bulanan ${APP_NAME} — ${periodLabel}`;
  const totalPengeluaran = row.pengeluaran + row.kerugian_stok;
  const untungColor = row.untung >= 0 ? COLOR.success : COLOR.destructive;
  const rowStyle = `padding:10px 0; border-bottom:1px solid ${COLOR.border}; font-size:14px;`;
  const line = (label: string, value: string, strong = false) => `
    <tr>
      <td style="${rowStyle} color:${COLOR.muted};">${label}</td>
      <td style="${rowStyle} text-align:right; font-weight:${strong ? 700 : 500}; color:${strong ? COLOR.text : COLOR.text};">${value}</td>
    </tr>`;

  const bodyHtml = `
    ${badge("Laporan Bulanan", COLOR.primary)}
    <h1 style="font-size:20px; margin:16px 0 8px;">Ringkasan ${periodLabel}</h1>
    <p style="font-size:14px; line-height:1.7; color:${COLOR.text}; margin:0 0 16px;">
      Berikut ringkasan performa kantin untuk periode <strong>${periodLabel}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      ${line("Pendapatan", formatRupiah(row.pendapatan))}
      ${line("Modal", formatRupiah(row.modal))}
      ${line("Pengeluaran (total)", formatRupiah(totalPengeluaran))}
      ${line("— Pengeluaran khusus", formatRupiah(row.pengeluaran))}
      ${line("— Kerugian stok", formatRupiah(row.kerugian_stok))}
      ${line("Pemasukan khusus", formatRupiah(row.pemasukan_khusus))}
      ${line("Jumlah pesanan lunas", String(row.jumlah_pesanan))}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px; background-color:${COLOR.cream}; border-radius:10px;">
      <tr>
        <td style="padding:14px 16px; font-size:13px; color:${COLOR.muted};">${row.untung >= 0 ? "Keuntungan Bersih" : "Defisit"}</td>
        <td style="padding:14px 16px; text-align:right; font-size:16px; font-weight:700; color:${untungColor};">${formatRupiah(Math.abs(row.untung))}</td>
      </tr>
    </table>
    ${url ? button("Lihat Laporan Lengkap", `${url}/admin/laporan`, COLOR.primary) : ""}
  `;
  return { subject, html: baseLayout({ preheader: `Ringkasan kantin periode ${periodLabel}.`, bodyHtml }) };
}
