import test from "node:test";
import assert from "node:assert/strict";
import { classifyFallback } from "../lib/note-fallback.mjs";

test("Tamil machine note gets a reviewable rule suggestion", () => {
  assert.deepEqual(classifyFallback("இயந்திரம் பழுதாகி வேலை நின்றது"), {category:"Machine breakdown",englishSummary:null,confidence:"rule"});
});
test("unknown note stays in review", () => {
  assert.equal(classifyFallback("தாமதம் உள்ளது").category,"Needs review");
});
