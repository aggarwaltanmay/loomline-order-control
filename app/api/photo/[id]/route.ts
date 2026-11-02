import { env } from "cloudflare:workers";
import { actor, db, getOrder } from "../../../../lib/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await actor(request);
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  const update = await db()
    .prepare("SELECT order_id,photo_key FROM updates WHERE id=?")
    .bind(id)
    .first<{ order_id: string; photo_key: string | null }>();
  if (!update?.photo_key || !(await getOrder(update.order_id, user)))
    return new Response(null, { status: 404 });
  const object = await env.BUCKET?.get(update.photo_key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
