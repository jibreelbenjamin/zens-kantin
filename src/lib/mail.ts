import nodemailer from "nodemailer";
import { APP_NAME } from "@/lib/constants";

/**
 * Pengirim email lewat Gmail SMTP + App Password — BUKAN Gmail API/OAuth.
 * Dipilih karena jauh lebih ringan untuk aplikasi kecil seperti ini: tidak
 * perlu bikin project Google Cloud terpisah, consent screen, atau alur
 * refresh token, cukup satu akun Gmail.
 *
 * Cara setup (isi di .env, lihat .env.example):
 * 1. Aktifkan verifikasi 2 langkah di akun Gmail yang mau dipakai mengirim.
 * 2. Buat "App Password" khusus di myaccount.google.com/apppasswords
 *    (pilih app "Mail"). Ini BUKAN password akun Gmail asli — jangan pernah
 *    isi password akun Gmail biasa ke GMAIL_APP_PASSWORD.
 * 3. Isi GMAIL_USER (alamat Gmail pengirim) & GMAIL_APP_PASSWORD (16 karakter
 *    yang muncul dari App Password itu, boleh dengan atau tanpa spasi).
 *
 * Kalau env belum diisi, sendMail() gagal DIAM-DIAM (dicatat ke console,
 * mengembalikan false) — supaya fitur lain (approve akun, hapus stok, dst)
 * tidak ikut gagal cuma karena email belum disetel administrator.
 */
let cachedTransporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) {
    cachedTransporter = null;
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cachedTransporter;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions): Promise<boolean> {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return false;

  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[mail] GMAIL_USER/GMAIL_APP_PASSWORD belum diisi — email "${subject}" tidak dikirim.`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
      to: recipients,
      subject,
      html,
    });
    return true;
  } catch (e: any) {
    console.error(`[mail] Gagal mengirim email "${subject}":`, e.message);
    return false;
  }
}
