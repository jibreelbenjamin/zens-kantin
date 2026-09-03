"use client";
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

/** Konfigurasi tiap seri data pada chart: label yang ditampilkan + warnanya. */
export type ChartConfig = Record<
  string,
  {
    label: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<"light" | "dark", string> })
>;

type ChartContextValue = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("Komponen chart (ChartTooltipContent/ChartLegendContent) harus dipakai di dalam <ChartContainer>.");
  return ctx;
}

/**
 * Bungkus ResponsiveContainer recharts + suntikkan variabel CSS
 * `--color-<key>` per entri di `config` (dibaca oleh <Bar fill="var(--color-x)" />
 * dkk), plus sedikit override style supaya garis grid/axis/tooltip ikut
 * token desain aplikasi (border, radius, font) alih-alih default recharts.
 */
export function ChartContainer({
  id, config, className, children, ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uid = React.useId();
  const chartId = `chart-${id ?? uid.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line]:stroke-border",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, cfg]) => cfg.color || cfg.theme);
  if (!entries.length) return null;

  const css = [
    `[data-chart=${id}] {`,
    ...entries.map(([key, cfg]) => `  --color-${key}: ${cfg.color ?? cfg.theme?.light};`),
    `}`,
    `.dark [data-chart=${id}] {`,
    ...entries.map(([key, cfg]) => `  --color-${key}: ${cfg.theme?.dark ?? cfg.color};`),
    `}`,
  ].join("\n");

  // eslint-disable-next-line react/no-danger -- cuma merakit deklarasi CSS var dari config sendiri, bukan input pengguna
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

/** Isi tooltip custom — pakai label & warna dari ChartConfig, format nilai lewat `formatter`. */
export function ChartTooltipContent({
  active, payload, label, formatter, labelFormatter, className, indicator = "dot",
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>;
  label?: React.ReactNode;
  formatter?: (value: number, name: string) => React.ReactNode;
  labelFormatter?: (label: React.ReactNode) => React.ReactNode;
  className?: string;
  indicator?: "dot" | "line";
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div className={cn("min-w-[9rem] rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md", className)}>
      {label != null && <p className="mb-1 font-medium">{labelFormatter ? labelFormatter(label) : label}</p>}
      <div className="space-y-1">
        {payload.map((item, i) => {
          const key = item.dataKey ?? item.name ?? `item-${i}`;
          const cfg = config[key as string];
          const color = item.color ?? `var(--color-${key})`;
          const value = typeof item.value === "number" ? item.value : Number(item.value ?? 0);
          return (
            <div key={key} className="flex items-center gap-1.5">
              {indicator === "dot" ? (
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              ) : (
                <span className="h-2.5 w-1 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
              )}
              <span className="flex-1 text-muted-foreground">{cfg?.label ?? item.name ?? key}</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatter ? formatter(value, key as string) : value.toLocaleString("id-ID")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ChartLegend = RechartsPrimitive.Legend;

/** Legenda custom — titik warna + label dari ChartConfig, konsisten dgn tooltip. */
export function ChartLegendContent({
  payload, className,
}: {
  payload?: Array<{ dataKey?: string; value?: string; color?: string }>;
  className?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2", className)}>
      {payload.map((item, i) => {
        const key = item.dataKey ?? item.value ?? `item-${i}`;
        const cfg = config[key as string];
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color ?? `var(--color-${key})` }} />
            <span className="text-xs text-muted-foreground">{cfg?.label ?? item.value ?? key}</span>
          </div>
        );
      })}
    </div>
  );
}
