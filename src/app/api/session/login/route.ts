import {
  createSession,
  getRawDb,
  jsonResponse,
  sessionCookie,
} from "@/app/server/city-defense";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOriginOrAbsent(request)) {
    return jsonResponse({ ok: false, code: "INVALID_ORIGIN" }, 403);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: "INVALID_JSON" }, 400);
  }

  try {
    const session = await createSession(getRawDb(), body);
    if (!session) {
      return jsonResponse({ ok: false, code: "INVALID_CREDENTIALS" }, 401);
    }
    return jsonResponse({
      ok: true,
      account_id: session.identity.accountId,
      seat_id: session.identity.seatId,
      role: session.identity.role,
      branch_id: session.identity.branchId,
    }, 200, { "set-cookie": sessionCookie(session.token, request.url) });
  } catch {
    return jsonResponse({ ok: false, code: "LOGIN_UNAVAILABLE" }, 503);
  }
}

function sameOriginOrAbsent(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
