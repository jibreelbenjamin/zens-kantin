import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bungkus field-field form dengan elemen <fieldset disabled> ASLI (bukan
 * prop `disabled` manual per komponen). Browser otomatis mendisable SEMUA
 * elemen turunan yang "form-associated" (input, textarea, select, button,
 * termasuk yang dirender oleh komponen custom seperti Combobox/NumberInput)
 * begitu `disabled` bernilai true — jadi cukup satu tempat, tidak perlu
 * meneruskan prop `disabled` ke setiap field satu-satu.
 *
 * Dipakai untuk mengunci seluruh input saat form sedang submit (loading),
 * supaya user tidak bisa mengubah/mengklik apa pun sampai request selesai.
 * `border-0 p-0 m-0 min-w-0` menghapus styling bawaan <fieldset> (border,
 * padding) supaya tidak mengubah tampilan/layout — perilakunya identik
 * dengan <div> biasa, cuma menambah kemampuan disable-cascade ini.
 */
export function FormFieldset({
  disabled, className, children,
}: { disabled?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <fieldset disabled={disabled} className={cn("m-0 min-w-0 border-0 p-0", className)}>
      {children}
    </fieldset>
  );
}
