import {
  deleteSession,
  expiredSessionCookie,
  getRawDb,
  jsonResponse,
} from "@/app/server/city-defense";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ ok: false, code: "INVALID_ORIGIN" }, 403);
  }
  try {
    await deleteSession(getRawDb(), request);
  } catch {
    // Expire the browser cookie even when D1 is temporarily unavailable.
  }
  return jsonResponse({ ok: true }, 200, {
    "set-cookie": expiredSessionCookie(request.url),
  });
}
