import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, autoComplete, ...props }, ref) => {
    return (
      <input
        type={type}
        // Default off di seluruh input aplikasi (form kasir/pelanggan pakai
        // tablet bersama — autocomplete/autofill browser tidak diinginkan).
        // Override tetap bisa lewat prop autoComplete kalau ada kebutuhan khusus.
        autoComplete={autoComplete ?? "off"}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
