import { actor, getState } from "../../../lib/server";

type ExportOrder = {
  buyer_id: string;
  po: string;
  buyer_name: string;
  style: string;
  color: string;
  unit_id: string;
  stage: string;
  stage_done: number;
  qty: number;
  ex_factory: string;
  milestones: Array<{ name: string; due_date: string }>;
  projection: { status: string; neededPerDay: number | null; madePerDay: number } | null;
};
const cell = (v: unknown) => {
  const raw = String(v ?? "");
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
export async function GET(request: Request) {
  const user = await actor(request);
  if (!user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const state = await getState(user);
  const buyerId = new URL(request.url).searchParams.get("buyer");
  const orders = (state.orders as unknown as ExportOrder[]).filter(
    (o) => user.role === "buyer" || !buyerId || o.buyer_id === buyerId,
  );
  const rows = [
    [
      "PO",
      "Buyer",
      "Style",
      "Color",
      "Unit",
      "Stage",
      "Done",
      "Total",
      "Milestone due",
      "Ex-factory",
      "Status",
      "Needed/day",
      "Made/day",
    ]
      .map(cell)
      .join(","),
  ];
  for (const o of orders) {
    const p = o.projection;
    const due =
      o.milestones.find((m) => m.name === o.stage)
        ?.due_date ?? o.ex_factory;
    rows.push(
      [
        o.po,
        o.buyer_name,
        o.style,
        o.color,
        o.unit_id,
        o.stage,
        o.stage_done,
        o.qty,
        due,
        o.ex_factory,
        p?.status ?? "Not shared",
        p?.neededPerDay ?? "",
        p?.madePerDay ?? "",
      ]
        .map(cell)
        .join(","),
    );
  }
  return new Response(`\ufeff${rows.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=weekly-status.csv",
      "Cache-Control": "no-store",
    },
  });
}
