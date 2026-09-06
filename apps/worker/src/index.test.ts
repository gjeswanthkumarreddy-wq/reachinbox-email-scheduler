import test from "node:test";
import assert from "node:assert";

function msUntilNextHour(nowMs: number, bufferMs: number = 2000): number {
  const now = new Date(nowMs);
  const nextHour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1)
  );
  return nextHour.getTime() - now.getTime() + bufferMs;
}

test("msUntilNextHour calculates time to next UTC hour correctly", () => {
  // 10:45:00 UTC
  const now = new Date(Date.UTC(2026, 8, 6, 10, 45, 0)).getTime();
  const nextHour = msUntilNextHour(now, 2000);

  // Next hour is 11:00:00 UTC -> 15 minutes away = 15 * 60 * 1000 = 900,000 + 2000 buffer = 902000
  assert.strictEqual(nextHour, 902000);
});
