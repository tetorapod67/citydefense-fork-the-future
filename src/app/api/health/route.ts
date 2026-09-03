import { getRawDb, jsonResponse, PRODUCT_TITLE } from "@/app/server/city-defense";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getRawDb();
    const row = await db.prepare(
      "SELECT COUNT(*) AS table_count FROM sqlite_schema WHERE type = 'table' AND name IN ('accounts', 'seats', 'sessions', 'branches', 'events', 'stamps', 'idempotency_results')",
    ).first<{ table_count: number }>();
    const ready = Number(row?.table_count ?? 0) === 7;
    return jsonResponse({
      ok: ready,
      product: PRODUCT_TITLE,
      gate: 1,
      persistence: "SERVER_BACKED_D1",
      schema_tables: Number(row?.table_count ?? 0),
      status: ready ? "READY" : "MIGRATION_REQUIRED",
    }, ready ? 200 : 503);
  } catch {
    return jsonResponse({
      ok: false,
      product: PRODUCT_TITLE,
      gate: 1,
      persistence: "SERVER_BACKED_D1",
      status: "DATABASE_UNAVAILABLE",
    }, 503);
  }
}
