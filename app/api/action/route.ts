import {
  actor,
  categories,
  classifyNote,
  db,
  getOrder,
  stages,
  todayIST,
} from "../../../lib/server";
import { classifyFallback } from "../../../lib/note-fallback.mjs";

const error = (message: string, status = 400) =>
  Response.json({ error: message }, { status });
const dateOk = (x: unknown) =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(`${x}T00:00:00Z`));
const textOk = (x: unknown, max = 120) =>
  typeof x === "string" && x.trim().length > 0 && x.trim().length <= max;
const str = (x: unknown) => String(x ?? "").trim();

export async function POST(request: Request) {
  const user = await actor(request);
  if (!user) return error("Sign in to continue.", 401);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    any
  > | null;
  if (!body || typeof body.action !== "string")
    return error("Invalid request.");
  const now = new Date().toISOString();
  try {
    if (body.action === "createOrder") {
      if (user.role !== "merchandiser")
        return error("Merchandiser access required.", 403);
      const { po, style, color, buyerId, buyerName, unitId, exFactory, sizes } =
        body;
      if (
        ![po, style, color, buyerId, buyerName, unitId].every((x) =>
          textOk(x, 120),
        ) ||
        !dateOk(exFactory)
      )
        return error("Complete the required order fields.");
      if (
        !/^[-A-Za-z0-9/ ]{4,40}$/.test(po) ||
        !/^[A-Z0-9]{1,12}$/.test(buyerId)
      )
        return error("Check PO and buyer code.");
      if (!sizes || typeof sizes !== "object" || Array.isArray(sizes))
        return error("Enter size quantities.");
      const entries = Object.entries(sizes).filter(
        ([size, q]) =>
          /^[A-Za-z0-9]{1,8}$/.test(size) &&
          Number.isInteger(q) &&
          Number(q) >= 0,
      );
      const qty = entries.reduce((n, [, q]) => n + Number(q), 0);
      if (
        !entries.length ||
        qty < 1 ||
        qty > 1000000 ||
        entries.length !== Object.keys(sizes).length
      )
        return error("Check size quantities.");
      const id = crypto.randomUUID();
      await db()
        .prepare(
          "INSERT INTO orders (id,po,buyer_id,buyer_name,style,color,sizes_json,qty,ex_factory,unit_id,stage,stage_done,baseline_daily,buyer_warning_confirmed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          str(po),
          str(buyerId),
          str(buyerName),
          str(style),
          str(color),
          JSON.stringify(sizes),
          qty,
          exFactory,
          str(unitId),
          "Cutting",
          0,
          0,
          0,
          now,
          now,
        )
        .run();
      const template = [
        ["Cutting", -18],
        ["Printing", -15],
        ["Stitching", -11],
        ["Washing", -8],
        ["Finishing", -5],
        ["Packing", -2],
        ["Ex-factory", 0],
      ] as const;
      for (const [i, [name, offset]] of template.entries()) {
        const due = new Date(
          Date.parse(`${exFactory}T00:00:00Z`) + offset * 86400000,
        )
          .toISOString()
          .slice(0, 10);
        await db()
          .prepare(
            "INSERT INTO milestones (id,order_id,name,due_date,sequence) VALUES (?,?,?,?,?)",
          )
          .bind(crypto.randomUUID(), id, name, due, i)
          .run();
      }
      return Response.json({ ok: true, id });
    }
    if (body.action === "dailyUpdate") {
      if (user.role === "buyer") return error("Read only access.", 403);
      const order = await getOrder(str(body.orderId), user);
      if (!order) return error("Order not found.", 404);
      const id = str(body.id);
      const qty = Number(body.dailyQty);
      const note = str(body.note);
      const date = str(body.updateDate);
      if (
        !/^[a-f0-9-]{36}$/i.test(id) ||
        !Number.isInteger(qty) ||
        qty < 0 ||
        qty > 50000 ||
        note.length > 1000 ||
        !dateOk(date)
      )
        return error("Check update fields.");
      if (
        date > todayIST() ||
        Date.parse(`${date}T00:00:00Z`) < Date.now() - 31 * 86400000
      )
        return error("Date must be within the last 30 days.");
      if (qty === 0 && !note && !body.photoData)
        return error("Enter pieces, an issue or a photo.");
      if (qty + Number(order.stage_done) > Number(order.qty))
        return error("Quantity exceeds the order total.");
      const inserted = await db()
        .prepare(
          "INSERT OR IGNORE INTO updates (id,order_id,stage,daily_qty,update_date,note,actor_email,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(id, order.id, order.stage, qty, date, note, user.email, now)
        .run();
      if (!inserted.meta.changes)
        return Response.json({ ok: true, duplicate: true });
      await db()
        .prepare(
          "UPDATE orders SET stage_done=stage_done+?,buyer_warning_confirmed=0,updated_at=? WHERE id=?",
        )
        .bind(qty, now, order.id)
        .run();
      if (typeof body.photoData === "string") {
        const match = body.photoData.match(
          /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
        );
        if (match && match[2].length <= 2800000) {
          await db()
            .prepare("UPDATE updates SET photo_key=?,photo_data=? WHERE id=?")
            .bind(id, body.photoData, id)
            .run();
        }
      }
      const used = await db()
        .prepare(
          "SELECT COUNT(*) AS n FROM updates WHERE actor_email=? AND update_date=? AND note<>''",
        )
        .bind(user.email, todayIST())
        .first<{ n: number }>();
      const suggestion =
        (used?.n ?? 0) > 20 ? classifyFallback(note) : await classifyNote(note);
      await db()
        .prepare(
          "UPDATE updates SET category=?,english_summary=?,confidence=? WHERE id=?",
        )
        .bind(
          suggestion.category,
          suggestion.englishSummary,
          suggestion.confidence,
          id,
        )
        .run();
      return Response.json({ ok: true, suggestion });
    }
    if (body.action === "changeDate") {
      if (user.role !== "merchandiser")
        return error("Merchandiser access required.", 403);
      const order = await getOrder(str(body.orderId), user);
      if (!order) return error("Order not found.", 404);
      if (!dateOk(body.newDate) || !textOk(body.reason, 300))
        return error("Enter a valid date and reason.");
      let oldDate = "";
      if (body.field === "Ex-factory") {
        oldDate = String(order.ex_factory);
        await db()
          .prepare(
            "UPDATE orders SET ex_factory=?,buyer_warning_confirmed=0,updated_at=? WHERE id=?",
          )
          .bind(body.newDate, now, order.id)
          .run();
        await db()
          .prepare(
            "UPDATE milestones SET due_date=? WHERE order_id=? AND name='Ex-factory'",
          )
          .bind(body.newDate, order.id)
          .run();
      } else {
        const milestone = await db()
          .prepare("SELECT * FROM milestones WHERE order_id=? AND name=?")
          .bind(order.id, str(body.field))
          .first<Record<string, unknown>>();
        if (!milestone) return error("Milestone not found.", 404);
        oldDate = String(milestone.due_date);
        await db()
          .prepare("UPDATE milestones SET due_date=? WHERE id=?")
          .bind(body.newDate, milestone.id)
          .run();
        await db()
          .prepare(
            "UPDATE orders SET buyer_warning_confirmed=0,updated_at=? WHERE id=?",
          )
          .bind(now, order.id)
          .run();
      }
      if (oldDate !== body.newDate)
        await db()
          .prepare(
            "INSERT INTO date_changes (id,order_id,field,old_date,new_date,reason,actor_email,changed_at) VALUES (?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            order.id,
            str(body.field),
            oldDate,
            body.newDate,
            str(body.reason),
            user.email,
            now,
          )
          .run();
      return Response.json({ ok: true });
    }
    if (body.action === "setCategory") {
      if (user.role !== "merchandiser")
        return error("Merchandiser access required.", 403);
      if (!categories.includes(body.category))
        return error("Invalid category.");
      const update = await db()
        .prepare("SELECT * FROM updates WHERE id=?")
        .bind(str(body.updateId))
        .first<Record<string, unknown>>();
      if (!update || !(await getOrder(String(update.order_id), user)))
        return error("Update not found.", 404);
      await db()
        .prepare(
          "UPDATE updates SET category=?,confidence='reviewed' WHERE id=?",
        )
        .bind(body.category, update.id)
        .run();
      return Response.json({ ok: true });
    }
    if (body.action === "confirmWarning") {
      if (user.role !== "merchandiser")
        return error("Merchandiser access required.", 403);
      const order = await getOrder(str(body.orderId), user);
      if (!order) return error("Order not found.", 404);
      await db()
        .prepare(
          "UPDATE orders SET buyer_warning_confirmed=1,updated_at=? WHERE id=?",
        )
        .bind(now, order.id)
        .run();
      return Response.json({ ok: true });
    }
    if (body.action === "advanceStage") {
      if (user.role !== "merchandiser")
        return error("Merchandiser access required.", 403);
      const order = await getOrder(str(body.orderId), user);
      if (!order || !stages.includes(body.stage))
        return error("Order or stage not found.", 404);
      await db()
        .prepare(
          "UPDATE orders SET stage=?,stage_done=0,baseline_daily=0,buyer_warning_confirmed=0,updated_at=? WHERE id=?",
        )
        .bind(body.stage, now, order.id)
        .run();
      return Response.json({ ok: true });
    }
    return error("Unknown action.", 404);
  } catch (e) {
    if (e instanceof Error && e.message.includes("UNIQUE constraint failed"))
      return error("That PO already exists.", 409);
    return error("Could not save. Please try again.", 500);
  }
}
