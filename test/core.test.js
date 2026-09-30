import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demo,
  validate,
  meter,
  record,
  undo,
  countdown,
} from "../public/core.js";
const now = Date.parse("2026-09-29T12:00:00Z");
test("expired observations become unknown, never a fabricated full allowance", () => {
  const b = demo(now).buckets[0];
  assert.equal(meter(b, now).remaining, 42);
  assert.equal(meter(b, Date.parse(b.resetAt)).remaining, null);
});
test("record is immutable and undo restores previous usage", () => {
  const a = demo(now),
    b = record(a, "chat", 1, new Date(now).toISOString(), "unique");
  assert.equal(meter(b.buckets[0], now).remaining, 41);
  assert.deepEqual(undo(b, "chat"), a);
  assert.equal(a.buckets[0].events.length, 4);
});
test("rejects negative, duplicate, expired and invalid events", () => {
  const a = demo(now);
  assert.throws(() => record(a, "chat", -1));
  assert.throws(() => record(a, "chat", 1, a.buckets[0].resetAt));
  assert.throws(() =>
    record(a, "chat", 1, new Date(now).toISOString(), "chat-0"),
  );
  a.buckets[0].events[0].amount = Infinity;
  assert.throws(() => validate(a));
});
test("never shows negative remaining but exposes overage", () => {
  const a = demo(now),
    b = record(a, "chat", 80, new Date(now).toISOString(), "extra"),
    m = meter(b.buckets[0], now);
  assert.equal(m.remaining, 0);
  assert.equal(m.over, 38);
});
test("backup rejects wrong versions, duplicate meters and invalid percentage totals", () => {
  const a = demo(now);
  assert.throws(() => validate({ ...a, version: 2 }));
  assert.throws(() =>
    validate({ ...a, buckets: [a.buckets[0], a.buckets[0]] }),
  );
  a.buckets[2].limit = 150;
  assert.throws(() => validate(a));
});
test("countdown rounds up and handles reset boundaries", () => {
  assert.equal(countdown(1), "0h 1m");
  assert.equal(countdown(3600000), "1h 0m");
  assert.equal(countdown(0), "Check your allowance");
});
