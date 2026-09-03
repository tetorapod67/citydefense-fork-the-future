import { env } from "cloudflare:workers";
import { z } from "zod";

export const PRODUCT_TITLE = "CityDefense: Fork the Future";
export const ACCOUNT_ID = "DEMO-CITY";
export const BRANCH_ID = "BRANCH-MAIN";
export const CENTRAL_WARD_REF = "district:CENTRAL_WARD";
export const CANONICAL_STAMP = "STAMP_CONFIRM";
export const SESSION_COOKIE = "cd_gate1_session";
export const SESSION_SECONDS = 2 * 60 * 60;
export const SEEDED_SEAT_IDS = ["OWNER", "SENTINEL-01", "PLANNER-01"] as const;

export type RuntimeRole = "OWNER" | "SENTINEL" | "PLANNER";

export type SessionIdentity = {
  accountId: string;
  seatId: string;
  role: RuntimeRole;
  branchId: string;
};

type D1Rows<T> = { results?: T[]; success?: boolean; meta?: { changes?: number } };
type D1Prepared = {
  bind: (...values: unknown[]) => D1Prepared;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<D1Rows<T>>;
  run: () => Promise<D1Rows<unknown>>;
};
export type D1DatabaseLike = {
  prepare: (sql: string) => D1Prepared;
  batch: (statements: D1Prepared[]) => Promise<D1Rows<unknown>[]>;
};

type PasswordVerifierSecretName =
  | "CITYDEFENSE_OWNER_PASSWORD_VERIFIER"
  | "CITYDEFENSE_SENTINEL_PASSWORD_VERIFIER"
  | "CITYDEFENSE_PLANNER_PASSWORD_VERIFIER";

type SeatSeedDefinition = {
  seatId: string;
  role: RuntimeRole;
  displayName: string;
  secretName: PasswordVerifierSecretName;
};

type SeatSeed = SeatSeedDefinition & {
  salt: string;
  hash: string;
};

const DEMO_SEAT_DEFINITIONS: readonly SeatSeedDefinition[] = [
  {
    seatId: "OWNER",
    role: "OWNER",
    displayName: "City Owner",
    secretName: "CITYDEFENSE_OWNER_PASSWORD_VERIFIER",
  },
  {
    seatId: "SENTINEL-01",
    role: "SENTINEL",
    displayName: "Sentinel",
    secretName: "CITYDEFENSE_SENTINEL_PASSWORD_VERIFIER",
  },
  {
    seatId: "PLANNER-01",
    role: "PLANNER",
    displayName: "Planner / Responder",
    secretName: "CITYDEFENSE_PLANNER_PASSWORD_VERIFIER",
  },
] as const;

export const loginInputSchema = z.object({
  account_id: z.literal(ACCOUNT_ID),
  seat_id: z.enum(SEEDED_SEAT_IDS),
  seat_password: z.string().min(12).max(160),
}).strict();

export const contextInputSchema = z.object({
  detail: z.enum(["SUMMARY", "OPERATIONAL", "FULL_VISIBLE"]),
  include_unresolved_stamps: z.boolean().optional(),
  include_assigned_units: z.boolean().optional(),
}).strict();

export const placeStampInputSchema = z.object({
  request_id: z.string().min(12).max(120).regex(/^[A-Za-z0-9._:-]+$/),
  expected_branch_version: z.number().int().nonnegative(),
  core_stamp_type_id: z.literal(CANONICAL_STAMP),
  modifier_stamp_type_ids: z.array(z.string().min(3).max(120)).max(3).optional(),
  target_refs: z.array(z.literal(CENTRAL_WARD_REF)).length(1),
  scope: z.literal("BRANCH_PUBLIC"),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  reply_to_stamp_id: z.string().max(120).optional(),
  expires_after_ticks: z.number().int().min(0).max(200).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.modifier_stamp_type_ids?.length ?? 0) !== 0) {
    ctx.addIssue({ code: "custom", message: "Gate 1 does not accept modifier stamps" });
  }
  if (value.reply_to_stamp_id) {
    ctx.addIssue({ code: "custom", message: "Gate 1 does not accept reply linkage" });
  }
  if ((value.expires_after_ticks ?? 0) !== 0) {
    ctx.addIssue({ code: "custom", message: "Gate 1 proof stamps do not expire" });
  }
});

export type PlaceStampInput = z.infer<typeof placeStampInputSchema>;

type BranchRow = {
  branch_id: string;
  version: number;
  simulation_tick: number;
  month: number;
};

type StampRow = {
  stamp_id: string;
  event_id: string;
  core_stamp_type_id: string;
  target_ref: string;
  scope: string;
  created_at: string;
};

type ActivityRow = StampRow & {
  branch_version: number;
  actor_seat_id: string;
  origin: string;
};

type StoredStampResult = {
  ok: true;
  tool: "place_stamp_bundle";
  branch_id: string;
  branch_version: number;
  simulation_tick: number;
  month: number;
  event_id: string;
  idempotent_replay: boolean;
  data: {
    event_id: string;
    stamp_id: string;
    target_refs: [string];
    core_stamp_type_id: string;
    scope: "BRANCH_PUBLIC";
    persisted: true;
    origin: "WEBMCP";
  };
};

export function getRawDb(): D1DatabaseLike {
  const binding = (env as unknown as { DB?: D1DatabaseLike }).DB;
  if (!binding) throw new Error("Cloudflare D1 binding DB is unavailable");
  return binding;
}

export async function ensureDemoSeed(db: D1DatabaseLike): Promise<void> {
  const now = new Date().toISOString();
  const configuredSeats = readConfiguredSeatSeeds();
  const statements = [
    db.prepare(
      "INSERT OR IGNORE INTO accounts (account_id, display_name, created_at) VALUES (?, ?, ?)",
    ).bind(ACCOUNT_ID, "Disposable Gate 1 Demo Town", now),
    db.prepare(
      "INSERT OR IGNORE INTO branches (branch_id, account_id, town_id, name, status, version, simulation_tick, month, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?)",
    ).bind(BRANCH_ID, ACCOUNT_ID, "TOWN-DEMO-01", "Main Timeline", "RUNNING", now),
    ...configuredSeats.map((seat) => db.prepare(
      "INSERT OR IGNORE INTO seats (seat_id, account_id, role, display_name, active_branch_id, password_salt, password_hash, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    ).bind(
      seat.seatId,
      ACCOUNT_ID,
      seat.role,
      seat.displayName,
      BRANCH_ID,
      seat.salt,
      seat.hash,
      now,
    )),
    // Only deployment-secret values can create or rotate a login verifier.
    // Existing rows are left unchanged when no verifier secret is configured.
    ...configuredSeats.map((seat) => db.prepare(
      "UPDATE seats SET password_salt = ?, password_hash = ? WHERE seat_id = ? AND account_id = ?",
    ).bind(seat.salt, seat.hash, seat.seatId, ACCOUNT_ID)),
  ];
  await db.batch(statements);
}

function readConfiguredSeatSeeds(): SeatSeed[] {
  const bindings = env as unknown as Partial<Record<PasswordVerifierSecretName, string>>;

  return DEMO_SEAT_DEFINITIONS.flatMap((definition) => {
    const verifier = bindings[definition.secretName];
    if (!verifier) return [];

    const match = /^([0-9a-f]{32}):([0-9a-f]{64})$/i.exec(verifier);
    if (!match) {
      throw new Error(
        `${definition.secretName} must contain a 16-byte salt and PBKDF2-SHA256 hash.`,
      );
    }

    return [{
      ...definition,
      salt: match[1].toLowerCase(),
      hash: match[2].toLowerCase(),
    }];
  });
}

export async function createSession(
  db: D1DatabaseLike,
  rawInput: unknown,
): Promise<{ token: string; identity: SessionIdentity } | null> {
  const parsed = loginInputSchema.safeParse(rawInput);
  if (!parsed.success) return null;

  await ensureDemoSeed(db);
  const seat = await db.prepare(
    "SELECT seat_id, account_id, role, active_branch_id, password_salt, password_hash, enabled FROM seats WHERE seat_id = ? AND account_id = ? LIMIT 1",
  ).bind(parsed.data.seat_id, parsed.data.account_id).first<{
    seat_id: string;
    account_id: string;
    role: RuntimeRole;
    active_branch_id: string;
    password_salt: string;
    password_hash: string;
    enabled: number;
  }>();

  if (!seat || !seat.enabled) return null;
  const passwordMatches = await verifyPasswordForSeat(
    seat.seat_id,
    parsed.data.seat_password,
    seat.password_salt,
    seat.password_hash,
  );
  if (!passwordMatches) return null;

  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_SECONDS * 1000);
  await db.prepare(
    "INSERT INTO sessions (token_hash, account_id, seat_id, role, branch_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    tokenHash,
    seat.account_id,
    seat.seat_id,
    seat.role,
    seat.active_branch_id,
    createdAt.toISOString(),
    expiresAt.toISOString(),
  ).run();

  return {
    token,
    identity: {
      accountId: seat.account_id,
      seatId: seat.seat_id,
      role: seat.role,
      branchId: seat.active_branch_id,
    },
  };
}

export async function authenticateRequest(
  db: D1DatabaseLike,
  request: Request,
): Promise<SessionIdentity | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db.prepare(
    "SELECT account_id, seat_id, role, branch_id, expires_at FROM sessions WHERE token_hash = ? LIMIT 1",
  ).bind(tokenHash).first<{
    account_id: string;
    seat_id: string;
    role: RuntimeRole;
    branch_id: string;
    expires_at: string;
  }>();
  if (!row || Date.parse(row.expires_at) <= Date.now()) return null;
  if (!isRuntimeRole(row.role)) return null;
  return {
    accountId: row.account_id,
    seatId: row.seat_id,
    role: row.role,
    branchId: row.branch_id,
  };
}

export async function deleteSession(db: D1DatabaseLike, request: Request): Promise<void> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return;
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(await sha256Hex(token))
    .run();
}

export function sessionCookie(token: string, requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function expiredSessionCookie(requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function readCityContext(
  db: D1DatabaseLike,
  identity: SessionIdentity,
) {
  const [branch, countRow, latest, activities] = await Promise.all([
    db.prepare(
      "SELECT branch_id, version, simulation_tick, month FROM branches WHERE branch_id = ? AND account_id = ? LIMIT 1",
    ).bind(identity.branchId, identity.accountId).first<BranchRow>(),
    db.prepare(
      "SELECT COUNT(*) AS count FROM stamps WHERE branch_id = ? AND target_ref = ?",
    ).bind(identity.branchId, CENTRAL_WARD_REF).first<{ count: number }>(),
    db.prepare(
      "SELECT stamp_id, event_id, core_stamp_type_id, target_ref, scope, created_at FROM stamps WHERE branch_id = ? AND target_ref = ? ORDER BY created_at DESC, stamp_id DESC LIMIT 1",
    ).bind(identity.branchId, CENTRAL_WARD_REF).first<StampRow>(),
    db.prepare(
      "SELECT e.event_id, e.branch_version, e.actor_seat_id, e.origin, e.created_at, s.stamp_id, s.core_stamp_type_id, s.target_ref, s.scope FROM events e JOIN stamps s ON s.event_id = e.event_id WHERE e.branch_id = ? ORDER BY e.branch_version DESC LIMIT 3",
    ).bind(identity.branchId).all<ActivityRow>(),
  ]);
  if (!branch) throw new Error("Active Branch is unavailable");

  return {
    ok: true as const,
    tool: "get_city_context" as const,
    branch_id: branch.branch_id,
    branch_version: Number(branch.version),
    simulation_tick: Number(branch.simulation_tick),
    month: Number(branch.month),
    data: {
      seat_id: identity.seatId,
      role: identity.role,
      persistence: "SERVER_BACKED_D1" as const,
      focus: {
        ref: CENTRAL_WARD_REF,
        source_district_id: "CENTRAL",
        stamp_count: Number(countRow?.count ?? 0),
        latest_stamp_id: latest?.stamp_id ?? null,
        latest_event_id: latest?.event_id ?? null,
      },
      activity: (activities.results ?? []).map((row) => ({
        event_id: row.event_id,
        stamp_id: row.stamp_id,
        branch_version: Number(row.branch_version),
        actor_seat_id: row.actor_seat_id,
        origin: row.origin,
        stamp_type: row.core_stamp_type_id,
        target_ref: row.target_ref,
        scope: row.scope,
        created_at: row.created_at,
      })),
    },
  };
}

export async function placeCanonicalStamp(
  db: D1DatabaseLike,
  identity: SessionIdentity,
  rawInput: unknown,
): Promise<StoredStampResult | ReturnType<typeof toolFailure>> {
  if (
    identity.accountId !== ACCOUNT_ID ||
    identity.seatId !== "PLANNER-01" ||
    identity.role !== "PLANNER" ||
    identity.branchId !== BRANCH_ID
  ) {
    return toolFailure("FORBIDDEN_SEAT", "Gate 1 canonical proof requires PLANNER-01.");
  }

  const parsed = placeStampInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return toolFailure("INVALID_INPUT", "Only the bounded Gate 1 canonical stamp is accepted.");
  }
  const input = parsed.data;

  const replay = await readIdempotentResult(db, input.request_id, identity);
  if (replay) return { ...replay, idempotent_replay: true };

  const branch = await db.prepare(
    "SELECT branch_id, version, simulation_tick, month FROM branches WHERE branch_id = ? AND account_id = ? LIMIT 1",
  ).bind(identity.branchId, identity.accountId).first<BranchRow>();
  if (!branch) return toolFailure("BRANCH_NOT_FOUND", "Active Branch is unavailable.");
  if (Number(branch.version) !== input.expected_branch_version) {
    return toolFailure(
      "STALE_BRANCH_VERSION",
      "Branch Version changed. Read context and retry with the current version.",
      Number(branch.version),
      true,
    );
  }

  const createdAt = new Date().toISOString();
  const nextVersion = Number(branch.version) + 1;
  const eventId = `EVT-G1-${randomId()}`;
  const stampId = `STAMP-G1-${randomId()}`;
  const result: StoredStampResult = {
    ok: true,
    tool: "place_stamp_bundle",
    branch_id: branch.branch_id,
    branch_version: nextVersion,
    simulation_tick: Number(branch.simulation_tick),
    month: Number(branch.month),
    event_id: eventId,
    idempotent_replay: false,
    data: {
      event_id: eventId,
      stamp_id: stampId,
      target_refs: [CENTRAL_WARD_REF],
      core_stamp_type_id: CANONICAL_STAMP,
      scope: "BRANCH_PUBLIC",
      persisted: true,
      origin: "WEBMCP",
    },
  };

  const payload = JSON.stringify({
    request_id: input.request_id,
    event_id: eventId,
    stamp_id: stampId,
    core_stamp_type_id: CANONICAL_STAMP,
    target_refs: [CENTRAL_WARD_REF],
    scope: "BRANCH_PUBLIC",
    origin: "WEBMCP",
  });

  try {
    await db.batch([
      db.prepare(
        "INSERT INTO events (event_id, branch_id, branch_version, event_type, actor_seat_id, origin, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        eventId,
        identity.branchId,
        nextVersion,
        "STAMP_PLACED",
        identity.seatId,
        "WEBMCP",
        payload,
        createdAt,
      ),
      db.prepare(
        "INSERT INTO stamps (stamp_id, event_id, branch_id, actor_seat_id, core_stamp_type_id, target_ref, scope, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        stampId,
        eventId,
        identity.branchId,
        identity.seatId,
        CANONICAL_STAMP,
        CENTRAL_WARD_REF,
        "BRANCH_PUBLIC",
        createdAt,
      ),
      db.prepare(
        "UPDATE branches SET version = ?, updated_at = ? WHERE branch_id = ? AND account_id = ? AND version = ?",
      ).bind(nextVersion, createdAt, identity.branchId, identity.accountId, branch.version),
      db.prepare(
        "INSERT INTO idempotency_results (request_id, branch_id, actor_seat_id, operation, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(
        input.request_id,
        identity.branchId,
        identity.seatId,
        "place_stamp_bundle",
        JSON.stringify(result),
        createdAt,
      ),
    ]);
    return result;
  } catch {
    const racedReplay = await readIdempotentResult(db, input.request_id, identity);
    if (racedReplay) return { ...racedReplay, idempotent_replay: true };
    const current = await db.prepare(
      "SELECT version FROM branches WHERE branch_id = ? LIMIT 1",
    ).bind(identity.branchId).first<{ version: number }>();
    return toolFailure(
      "WRITE_CONFLICT",
      "The canonical stamp was not accepted because Branch state changed.",
      current ? Number(current.version) : undefined,
      true,
    );
  }
}

async function readIdempotentResult(
  db: D1DatabaseLike,
  requestId: string,
  identity: SessionIdentity,
): Promise<StoredStampResult | null> {
  const row = await db.prepare(
    "SELECT result_json FROM idempotency_results WHERE request_id = ? AND branch_id = ? AND actor_seat_id = ? AND operation = ? LIMIT 1",
  ).bind(requestId, identity.branchId, identity.seatId, "place_stamp_bundle")
    .first<{ result_json: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.result_json) as StoredStampResult;
  } catch {
    return null;
  }
}

export function toolFailure(
  code: string,
  message: string,
  branchVersion?: number,
  retryable = false,
) {
  return {
    ok: false as const,
    tool: "place_stamp_bundle",
    code,
    message,
    ...(branchVersion === undefined ? {} : { branch_version: branchVersion, refresh_required: true }),
    retryable,
  };
}

export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function isRuntimeRole(value: string): value is RuntimeRole {
  return value === "OWNER" || value === "SENTINEL" || value === "PLANNER";
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function verifyPasswordForSeat(
  seatId: string,
  password: string,
  salt: string,
  storedHash: string,
): Promise<boolean> {
  const legacyPlannerMatch =
    seatId === "PLANNER-01" && /^[0-9a-f]{32}$/i.test(salt)
      ? /^sha256:([0-9a-f]{64})$/.exec(storedHash)
      : null;

  if (legacyPlannerMatch) {
    return constantTimeEqual(await sha256Hex(password), legacyPlannerMatch[1]);
  }

  if (!/^[0-9a-f]{32}$/i.test(salt)) return false;
  if (!/^[0-9a-f]{64}$/i.test(storedHash)) return false;
  const normalizedHash = storedHash.toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(salt) as BufferSource,
      iterations: 120_000,
    },
    key,
    256,
  );
  return constantTimeEqual(bytesToHex(new Uint8Array(bits)), normalizedHash);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function randomId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase();
}
