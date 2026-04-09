function parseCronPart(part: string, value: number, min: number) {
  if (part === "*") return true;

  const segments = part.split(",");
  return segments.some((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return false;

    if (trimmed.includes("/")) {
      const [base, stepValue] = trimmed.split("/");
      if (!base || !stepValue) return false;
      const step = Number(stepValue);
      if (!Number.isFinite(step) || step <= 0) return false;

      if (base === "*") {
        return (value - min) % step === 0;
      }

      if (base.includes("-")) {
        const [startValue, endValue] = base.split("-");
        if (!startValue || !endValue) return false;
        const start = Number(startValue);
        const end = Number(endValue);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
        return value >= start && value <= end && (value - start) % step === 0;
      }

      const baseValue = Number(base);
      return Number.isFinite(baseValue) && value >= baseValue && (value - baseValue) % step === 0;
    }

    if (trimmed.includes("-")) {
      const [startValue, endValue] = trimmed.split("-");
      if (!startValue || !endValue) return false;
      const start = Number(startValue);
      const end = Number(endValue);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      return value >= start && value <= end;
    }

    const exact = Number(trimmed);
    if (!Number.isFinite(exact)) return false;
    return exact === value;
  });
}

export function matchesCronExpression(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return (
    parseCronPart(minute ?? "*", date.getMinutes(), 0) &&
    parseCronPart(hour ?? "*", date.getHours(), 0) &&
    parseCronPart(dayOfMonth ?? "*", date.getDate(), 1) &&
    parseCronPart(month ?? "*", date.getMonth() + 1, 1) &&
    parseCronPart(dayOfWeek ?? "*", date.getDay(), 0)
  );
}

export function getMinuteWindow(date: Date) {
  const start = new Date(date);
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 1);
  return { start, end };
}

export function getScheduleKey(date: Date): string {
  const minute = new Date(date);
  minute.setSeconds(0, 0);
  return minute.toISOString();
}
