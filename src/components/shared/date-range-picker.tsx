"use client";
import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DateRangePicker({
  value, onChange, className,
}: { value?: DateRange; onChange: (range: DateRange | undefined) => void; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 w-full justify-start text-left font-normal sm:w-64", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {value?.from ? (
              value.to ? (
                <>{format(value.from, "d MMM yyyy", { locale: localeId })} – {format(value.to, "d MMM yyyy", { locale: localeId })}</>
              ) : (
                format(value.from, "d MMM yyyy", { locale: localeId })
              )
            ) : (
              <span>Pilih rentang tanggal</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar initialFocus mode="range" defaultMonth={value?.from} selected={value} onSelect={onChange} numberOfMonths={2} locale={localeId} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
