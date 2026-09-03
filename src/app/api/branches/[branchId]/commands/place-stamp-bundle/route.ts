import {
  authenticateRequest,
  getRawDb,
  jsonResponse,
  placeCanonicalStamp,
} from "@/app/server/city-defense";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ branchId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({
      ok: false,
      tool: "place_stamp_bundle",
      code: "INVALID_ORIGIN",
      message: "Cross-origin writes are not accepted.",
      retryable: false,
    }, 403);
  }

  try {
    const db = getRawDb();
    const identity = await authenticateRequest(db, request);
    if (!identity) {
      return jsonResponse({
        ok: false,
        tool: "place_stamp_bundle",
        code: "UNAUTHENTICATED",
        message: "Authenticate the disposable Gate 1 Seat.",
        retryable: false,
      }, 401);
    }
    const { branchId } = await context.params;
    if (branchId !== identity.branchId) {
      return jsonResponse({
        ok: false,
        tool: "place_stamp_bundle",
        code: "BRANCH_FORBIDDEN",
        message: "The requested Branch is not active for this Seat.",
        retryable: false,
      }, 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({
        ok: false,
        tool: "place_stamp_bundle",
        code: "INVALID_JSON",
        message: "The command body must be valid JSON.",
        retryable: false,
      }, 400);
    }
    const result = await placeCanonicalStamp(db, identity, body);
    if (result.ok) return jsonResponse(result);
    const status = result.code === "FORBIDDEN_SEAT"
      ? 403
      : result.code.includes("VERSION") || result.code === "WRITE_CONFLICT"
        ? 409
        : 400;
    return jsonResponse(result, status);
  } catch {
    return jsonResponse({
      ok: false,
      tool: "place_stamp_bundle",
      code: "WRITE_UNAVAILABLE",
      message: "The canonical stamp was not accepted.",
      retryable: true,
    }, 503);
  }
}
