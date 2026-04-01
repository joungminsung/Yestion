"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";

type Props = {
  date: string; // ISO date string
  className?: string;
};

export function DateMention({ date, className = "" }: Props) {
  const dateObj = useMemo(() => new Date(date), [date]);

  const label = useMemo(() => {
    if (isToday(dateObj)) return "Today";
    if (isTomorrow(dateObj)) return "Tomorrow";
    return format(dateObj, "MMM d, yyyy");
  }, [dateObj]);

  const isOverdue = isPast(dateObj) && !isToday(dateObj);

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${className}`}
      style={{
        backgroundColor: isOverdue ? "var(--color-red-bg)" : "var(--color-yellow-bg)",
        color: isOverdue ? "var(--color-red)" : "var(--color-default)",
      }}
      title={format(dateObj, "EEEE, MMMM d, yyyy")}
    >
      <Calendar size={10} />
      {label}
    </span>
  );
}
