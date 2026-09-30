export const VERSION = 1;
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const iso = (s) => typeof s === "string" && Number.isFinite(Date.parse(s));
export function validate(state) {
  if (
    state?.version !== VERSION ||
    !Array.isArray(state.buckets) ||
    state.buckets.length > 50
  )
    throw Error("Invalid backup: expected version 1 and up to 50 meters.");
  const ids = new Set();
  for (const b of state.buckets) {
    if (typeof b.id !== "string" || !b.id || ids.has(b.id))
      throw Error("Meter IDs must be unique.");
    ids.add(b.id);
    if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 60)
      throw Error("Meter names need 1–60 characters.");
    if (!["messages", "images", "percent", "credits"].includes(b.unit))
      throw Error("Unknown meter unit.");
    if (
      !finite(b.limit) ||
      b.limit <= 0 ||
      b.limit > 1e9 ||
      !finite(b.used) ||
      b.used < 0 ||
      b.used > b.limit ||
      (b.unit === "percent" && b.limit !== 100)
    )
      throw Error("Invalid meter amounts.");
    if (
      !iso(b.observedAt) ||
      !iso(b.resetAt) ||
      Date.parse(b.resetAt) <= Date.parse(b.observedAt)
    )
      throw Error("Reset must be after the observation.");
    if (!Array.isArray(b.events) || b.events.length > 10000)
      throw Error("Too many events.");
    const eventIds = new Set();
    for (const e of b.events) {
      if (
        typeof e.id !== "string" ||
        eventIds.has(e.id) ||
        !finite(e.amount) ||
        e.amount <= 0 ||
        e.amount > b.limit ||
        !iso(e.at) ||
        Date.parse(e.at) < Date.parse(b.observedAt) ||
        Date.parse(e.at) >= Date.parse(b.resetAt)
      )
        throw Error("Invalid usage event.");
      eventIds.add(e.id);
    }
  }
  return structuredClone(state);
}
export function meter(b, now = Date.now()) {
  const expired = now >= Date.parse(b.resetAt),
    used =
      b.used +
      b.events
        .filter((e) => Date.parse(e.at) <= now)
        .reduce((s, e) => s + e.amount, 0);
  return {
    expired,
    used,
    remaining: expired ? null : Math.max(0, b.limit - used),
    ratio: Math.min(1, used / b.limit),
    over: Math.max(0, used - b.limit),
    ms: Math.max(0, Date.parse(b.resetAt) - now),
  };
}
export function record(
  state,
  id,
  amount,
  at = new Date().toISOString(),
  eventId = globalThis.crypto.randomUUID(),
) {
  const next = validate(state),
    b = next.buckets.find((x) => x.id === id);
  if (!b) throw Error("Meter not found.");
  if (!finite(amount) || amount <= 0 || amount > b.limit)
    throw Error("Enter a positive amount no greater than the meter limit.");
  if (
    Date.parse(at) >= Date.parse(b.resetAt) ||
    Date.parse(at) < Date.parse(b.observedAt)
  )
    throw Error(
      "This window has ended. Start a new window or update your observation.",
    );
  b.events.push({ id: eventId, amount, at });
  return validate(next);
}
export function undo(state, id) {
  const next = validate(state),
    b = next.buckets.find((x) => x.id === id);
  if (!b) throw Error("Meter not found.");
  b.events.pop();
  return next;
}
export function countdown(ms) {
  if (ms <= 0) return "Check your allowance";
  const minutes = Math.ceil(ms / 60000),
    h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
}
export function demo(now = Date.now()) {
  const make = (id, name, unit, limit, used, hours, amounts) => ({
    id,
    name,
    unit,
    limit,
    used,
    observedAt: new Date(now - 6 * 3600000).toISOString(),
    resetAt: new Date(now + hours * 3600000).toISOString(),
    events: amounts.map((amount, i) => ({
      id: `${id}-${i}`,
      amount,
      at: new Date(now - (amounts.length - i) * 3600000).toISOString(),
    })),
  });
  return {
    version: 1,
    buckets: [
      make("chat", "Brainstorm fuel", "messages", 80, 18, 3, [4, 6, 3, 7]),
      make("image", "Picture potions", "images", 30, 6, 12, [2, 3, 1]),
      make("work", "Work battery", "percent", 100, 48, 26, [4, 6, 9]),
    ],
  };
}
