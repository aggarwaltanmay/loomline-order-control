export function daysBetween(today, due) {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${due}T00:00:00Z`);
  return Math.max(0, Math.ceil((b - a) / 86400000));
}

export function projectDelay({
  qty,
  done,
  due,
  today,
  recentDaily,
  baselineDaily = 0,
}) {
  const remaining = Math.max(0, qty - done);
  const days = daysBetween(today, due);
  const madePerDay = recentDaily == null ? baselineDaily : recentDaily;
  const neededPerDay =
    remaining === 0 ? 0 : days === 0 ? null : Math.ceil(remaining / days);
  const finishDays = madePerDay > 0 ? Math.ceil(remaining / madePerDay) : null;
  const projectedDate =
    finishDays == null
      ? null
      : new Date(Date.parse(`${today}T00:00:00Z`) + finishDays * 86400000)
          .toISOString()
          .slice(0, 10);
  let status = "green";
  if (
    remaining > 0 &&
    (days === 0 || madePerDay < (neededPerDay ?? Infinity) * 0.85)
  )
    status = "red";
  else if (remaining > 0 && madePerDay < (neededPerDay ?? Infinity))
    status = "amber";
  return {
    remaining,
    days,
    neededPerDay,
    madePerDay,
    projectedDate,
    status,
    usingBaseline: recentDaily == null,
    earlyWarning: status !== "green" && days <= 14,
  };
}
