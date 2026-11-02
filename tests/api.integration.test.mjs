import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL;
async function signIn(email) {
  const response = await fetch(`${base}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Demo@2026!" }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")?.split(";")[0];
}

test(
  "buyer reads only their buyer and cannot write",
  { skip: !base },
  async () => {
    const cookie = await signIn("buyer-b@loomline.demo");
    const state = await (
      await fetch(`${base}/api/state`, { headers: { cookie } })
    ).json();
    assert.ok(state.orders.length >= 2);
    assert.ok(state.orders.every((o) => o.buyer_id === "B"));
    const write = await fetch(`${base}/api/action`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirmWarning",
        orderId: state.orders[0].id,
      }),
    });
    assert.equal(write.status, 403);
  },
);

test("supervisor cannot update another unit", { skip: !base }, async () => {
  const cookie = await signIn("floor@loomline.demo");
  const state = await (
    await fetch(`${base}/api/state`, { headers: { cookie } })
  ).json();
  assert.ok(state.orders.every((o) => o.unit_id === "Unit 2"));
  const write = await fetch(`${base}/api/action`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "dailyUpdate",
      id: crypto.randomUUID(),
      orderId: "o-b-88213",
      dailyQty: 1,
      updateDate: "2026-11-02",
      note: "",
    }),
  });
  assert.equal(write.status, 404);
});

test("order setup creates milestones and date edits remain auditable", { skip: !base }, async () => {
  const cookie = await signIn("merch@loomline.demo");
  const po = `T-${crypto.randomUUID().slice(0, 8)}`;
  const created = await fetch(`${base}/api/action`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createOrder", po, buyerId: "B", buyerName: "Company B · UK",
      style: "Test crew tee", color: "Blue", unitId: "Unit 1",
      exFactory: "2026-12-10", sizes: { S: 100, M: 200 },
    }),
  });
  assert.equal(created.status, 200);
  const { id } = await created.json();
  let state = await (await fetch(`${base}/api/state`, { headers: { cookie } })).json();
  const order = state.orders.find(o => o.id === id);
  assert.equal(order.qty, 300);
  assert.equal(order.milestones.length, 7);
  const changed = await fetch(`${base}/api/action`, {
    method: "POST", headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "changeDate", orderId: id, field: "Cutting", newDate: "2026-11-25", reason: "Buyer approved revised cutting plan" }),
  });
  assert.equal(changed.status, 200);
  state = await (await fetch(`${base}/api/state`, { headers: { cookie } })).json();
  assert.equal(state.orders.find(o => o.id === id).history[0].reason, "Buyer approved revised cutting plan");
  const buyerC = await signIn("buyer-c@loomline.demo");
  const cState = await (await fetch(`${base}/api/state`, { headers: { cookie: buyerC } })).json();
  assert.ok(!cState.orders.some(o => o.id === id));
});
