import {
  authenticateRequest,
  contextInputSchema,
  getRawDb,
  jsonResponse,
  readCityContext,
} from "@/app/server/city-defense";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ branchId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const db = getRawDb();
    const identity = await authenticateRequest(db, request);
    if (!identity) {
      return jsonResponse({
        ok: false,
        tool: "get_city_context",
        code: "UNAUTHENTICATED",
        message: "Authenticate the disposable Gate 1 Seat.",
        retryable: false,
      }, 401);
    }
    const { branchId } = await context.params;
    if (branchId !== identity.branchId) {
      return jsonResponse({
        ok: false,
        tool: "get_city_context",
        code: "BRANCH_FORBIDDEN",
        message: "The requested Branch is not active for this Seat.",
        retryable: false,
      }, 403);
    }

    const url = new URL(request.url);
    const parsed = contextInputSchema.safeParse({
      detail: url.searchParams.get("detail") ?? "OPERATIONAL",
      ...(url.searchParams.has("include_unresolved_stamps")
        ? { include_unresolved_stamps: url.searchParams.get("include_unresolved_stamps") === "true" }
        : {}),
      ...(url.searchParams.has("include_assigned_units")
        ? { include_assigned_units: url.searchParams.get("include_assigned_units") === "true" }
        : {}),
    });
    if (!parsed.success) {
      return jsonResponse({
        ok: false,
        tool: "get_city_context",
        code: "INVALID_INPUT",
        message: "Use a supported detail level and boolean flags.",
        retryable: false,
      }, 400);
    }
    return jsonResponse(await readCityContext(db, identity));
  } catch {
    return jsonResponse({
      ok: false,
      tool: "get_city_context",
      code: "READ_UNAVAILABLE",
      message: "City context is temporarily unavailable.",
      retryable: true,
    }, 503);
  }
}
