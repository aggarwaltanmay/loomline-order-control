import { actor, db, getOrder } from "../../../../lib/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await actor(request);
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  const update = await db()
    .prepare("SELECT order_id,photo_data FROM updates WHERE id=?")
    .bind(id)
    .first<{ order_id: string; photo_data: string | null }>();
  if (!update?.photo_data || !(await getOrder(update.order_id, user)))
    return new Response(null, { status: 404 });
  const match = update.photo_data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return new Response(null, { status: 404 });
  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": `image/${match[1]}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
