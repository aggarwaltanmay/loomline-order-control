import { actor, db, login, sha256 } from "../../../lib/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (body.action === "logout") {
    const token = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)loom_session=([^;]+)/)?.[1];
    if (token)
      await db()
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(await sha256(token))
        .run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie":
          "loom_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
      },
    });
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password)
    return Response.json(
      { error: "Enter email and password." },
      { status: 400 },
    );
  const token = await login(email, password);
  if (!token)
    return Response.json(
      { error: "Those demo credentials did not match." },
      { status: 401 },
    );
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `loom_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
    },
  });
}

export async function GET(request: Request) {
  return Response.json({ actor: await actor(request) });
}
