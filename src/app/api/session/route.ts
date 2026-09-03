import { authenticateRequest, getRawDb, jsonResponse } from "@/app/server/city-defense";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await authenticateRequest(getRawDb(), request);
    if (!identity) return jsonResponse({ ok: false, code: "UNAUTHENTICATED" }, 401);
    return jsonResponse({
      ok: true,
      account_id: identity.accountId,
      seat_id: identity.seatId,
      role: identity.role,
      branch_id: identity.branchId,
    });
  } catch {
    return jsonResponse({ ok: false, code: "SESSION_UNAVAILABLE" }, 503);
  }
}
