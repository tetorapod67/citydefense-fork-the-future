import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the public wrangler template locally or bind the deployment database before using the database."
    );
  }

  return drizzle(binding, { schema });
}
