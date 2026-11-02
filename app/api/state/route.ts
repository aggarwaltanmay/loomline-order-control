import { actor, getState } from "../../../lib/server";

export async function GET(request: Request) {
  const user = await actor(request);
  if (!user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    return Response.json(await getState(user), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Could not load orders. Try again." },
      { status: 500 },
    );
  }
}
