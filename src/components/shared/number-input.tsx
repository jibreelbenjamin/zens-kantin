"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
}

/**
 * Input angka yang menyimpan teks mentah secara internal supaya field bisa
 * dikosongkan dengan wajar (tekan hapus sampai kosong, lalu ketik ulang) —
 * input number biasa yang di-bind ke number langsung memaksa nilai balik
 * jadi "0" setiap kali dikosongkan, sehingga harus ketik "01000" dulu baru
 * hapus nol-nya. Nilai numerik final tetap dikirim lewat onChange.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min = 0, onFocus, onBlur, ...props }, ref) => {
    const [text, setText] = React.useState(value === 0 ? "" : String(value));
    const focused = React.useRef(false);

    React.useEffect(() => {
      if (!focused.current) setText(value === 0 ? "" : String(value));
    }, [value]);

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={text}
        onFocus={(e) => {
          focused.current = true;
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          if (text === "") setText(value === 0 ? "" : String(Math.max(value, min)));
          onBlur?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          const stripped = raw.replace(/^0+(?=\d)/, "");
          setText(stripped);
          onChange(stripped === "" ? 0 : Math.max(Number(stripped), min));
        }}
        {...props}
      />
    );
  }
);
NumberInput.displayName = "NumberInput";
