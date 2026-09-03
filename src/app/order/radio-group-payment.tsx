"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

export function RadioGroupPayment({
  methods, value, onChange,
}: { methods: PaymentMethod[]; value: string; onChange: (id: string) => void }) {
  if (!methods.length) {
    return <p className="text-sm text-muted-foreground">Belum ada metode pembayaran aktif. Hubungi admin kantin.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {methods.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-primary bg-primary/5 text-primary" : "hover:bg-secondary"
            )}
          >
            {m.nama}
            {active && <Check className="h-4 w-4" />}
          </button>
        );
      })}
    </div>
  );
}
