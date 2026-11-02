import test from "node:test";
import assert from "node:assert/strict";
import { projectDelay } from "../lib/projection.mjs";

test("red when current rate cannot make stage date", () => {
  const p = projectDelay({ qty: 8000, done: 5200, due: "2026-11-07", today: "2026-11-02", recentDaily: 390 });
  assert.equal(p.neededPerDay, 560);
  assert.equal(p.status, "red");
  assert.equal(p.earlyWarning, true);
});

test("completed stage is green even on due date", () => {
  assert.equal(projectDelay({ qty: 100, done: 100, due: "2026-11-02", today: "2026-11-02", recentDaily: 0 }).status, "green");
});

test("no output is red and never divides by zero", () => {
  const p = projectDelay({ qty: 100, done: 0, due: "2026-11-02", today: "2026-11-02", recentDaily: 0 });
  assert.equal(p.neededPerDay, null);
  assert.equal(p.projectedDate, null);
  assert.equal(p.status, "red");
});
