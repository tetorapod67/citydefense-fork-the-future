import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import {
  ACCOUNT_ID,
  authenticateRequest,
  BRANCH_ID,
  CANONICAL_STAMP,
  CENTRAL_WARD_REF,
  createSession,
  type D1DatabaseLike,
  placeCanonicalStamp,
  readCityContext,
  SEEDED_SEAT_IDS,
  SESSION_COOKIE,
} from "@/app/server/city-defense";

type Row = Record<string, unknown>;

class FakeStatement {
  constructor(
    readonly db: FakeD1,
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new FakeStatement(this.db, this.sql, values);
  }

  first<T>() {
    return this.db.first(this.sql, this.values) as Promise<T | null>;
  }

  all<T>() {
    return this.db.all(this.sql) as Promise<{ results: T[]; success: true }>;
  }

  run() {
    return this.db.run(this.sql, this.values);
  }
}

class FakeD1 {
  branch = {
    branch_id: BRANCH_ID,
    account_id: ACCOUNT_ID,
    version: 0,
    simulation_tick: 0,
    month: 1,
  };
  events: Row[] = [];
  stamps: Row[] = [];
  idempotency = new Map<string, string>();
  sessions = new Map<string, Row>();
  seat: Row | null = null;

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  async batch(statements: FakeStatement[]) {
    const snapshot = structuredClone({
      branch: this.branch,
      events: this.events,
      stamps: this.stamps,
      idempotency: [...this.idempotency],
      sessions: [...this.sessions],
    });
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    } catch (error) {
      this.branch = snapshot.branch;
      this.events = snapshot.events;
      this.stamps = snapshot.stamps;
      this.idempotency = new Map(snapshot.idempotency);
      this.sessions = new Map(snapshot.sessions);
      throw error;
    }
  }

  async first(sql: string, values: unknown[]): Promise<Row | null> {
    if (sql.includes("FROM seats WHERE")) return this.seat;
    if (sql.includes("FROM sessions WHERE")) {
      return this.sessions.get(String(values[0])) ?? null;
    }
    if (sql.includes("FROM idempotency_results")) {
      const result = this.idempotency.get(String(values[0]));
      return result ? { result_json: result } : null;
    }
    if (sql.includes("COUNT(*) AS count FROM stamps")) {
      return {
        count: this.stamps.filter((stamp) => (
          stamp.branch_id === values[0] && stamp.target_ref === values[1]
        )).length,
      };
    }
    if (sql.includes("FROM stamps WHERE") && sql.includes("LIMIT 1")) {
      return this.stamps.length ? this.stamps.at(-1) ?? null : null;
    }
    if (sql.includes("SELECT version FROM branches")) {
      return { version: this.branch.version };
    }
    if (sql.includes("FROM branches WHERE")) {
      return this.branch.branch_id === values[0] && this.branch.account_id === values[1]
        ? this.branch
        : null;
    }
    return null;
  }

  async all(sql: string): Promise<{ results: Row[]; success: true }> {
    if (!sql.includes("FROM events e JOIN stamps s")) return { results: [], success: true };
    const rows = this.events.toReversed().map((event) => {
      const stamp = this.stamps.find((item) => item.event_id === event.event_id) ?? {};
      return { ...event, ...stamp };
    });
    return { results: rows, success: true };
  }

  async run(sql: string, values: unknown[]) {
    if (sql.startsWith("INSERT OR IGNORE INTO")) return { success: true, meta: { changes: 0 } };
    if (sql.startsWith("INSERT INTO sessions")) {
      this.sessions.set(String(values[0]), {
        account_id: values[1],
        seat_id: values[2],
        role: values[3],
        branch_id: values[4],
        created_at: values[5],
        expires_at: values[6],
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("DELETE FROM sessions")) {
      this.sessions.delete(String(values[0]));
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO events")) {
      const duplicate = this.events.some((event) => (
        event.branch_id === values[1] && event.branch_version === values[2]
      ));
      if (duplicate) throw new Error("unique event version");
      this.events.push({
        event_id: values[0],
        branch_id: values[1],
        branch_version: values[2],
        event_type: values[3],
        actor_seat_id: values[4],
        origin: values[5],
        payload_json: values[6],
        created_at: values[7],
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO stamps")) {
      this.stamps.push({
        stamp_id: values[0],
        event_id: values[1],
        branch_id: values[2],
        actor_seat_id: values[3],
        core_stamp_type_id: values[4],
        target_ref: values[5],
        scope: values[6],
        created_at: values[7],
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE branches")) {
      if (this.branch.version !== values[4]) return { success: true, meta: { changes: 0 } };
      this.branch.version = Number(values[0]);
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO idempotency_results")) {
      const requestId = String(values[0]);
      if (this.idempotency.has(requestId)) throw new Error("duplicate request id");
      this.idempotency.set(requestId, String(values[4]));
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
}

const identity = {
  accountId: ACCOUNT_ID,
  seatId: "PLANNER-01",
  role: "PLANNER" as const,
  branchId: BRANCH_ID,
};

const canonicalInput = {
  request_id: "gate1-unit-request-001",
  expected_branch_version: 0,
  core_stamp_type_id: CANONICAL_STAMP,
  target_refs: [CENTRAL_WARD_REF],
  scope: "BRANCH_PUBLIC",
} as const;

describe("Gate 1 bounded command service", () => {
  let fake: FakeD1;
  let db: D1DatabaseLike;

  beforeEach(() => {
    fake = new FakeD1();
    db = fake as unknown as D1DatabaseLike;
  });

  it("reads context without changing Branch state", async () => {
    const before = structuredClone(fake.branch);
    const result = await readCityContext(db, identity);
    expect(result.ok).toBe(true);
    expect(result.branch_version).toBe(0);
    expect(result.data.focus.stamp_count).toBe(0);
    expect(fake.branch).toEqual(before);
  });

  it("atomically creates one event, one stamp, and Version +1", async () => {
    const result = await placeCanonicalStamp(db, identity, canonicalInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.branch_version).toBe(1);
    expect(result.data.target_refs).toEqual([CENTRAL_WARD_REF]);
    expect(result.data.persisted).toBe(true);
    expect(fake.branch.version).toBe(1);
    expect(fake.events).toHaveLength(1);
    expect(fake.stamps).toHaveLength(1);
  });

  it("replays a duplicate request id without a second mutation", async () => {
    const first = await placeCanonicalStamp(db, identity, canonicalInput);
    const replay = await placeCanonicalStamp(db, identity, canonicalInput);
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (!first.ok || !replay.ok) return;
    expect(replay.idempotent_replay).toBe(true);
    expect(replay.event_id).toBe(first.event_id);
    expect(replay.data.stamp_id).toBe(first.data.stamp_id);
    expect(fake.events).toHaveLength(1);
    expect(fake.stamps).toHaveLength(1);
  });

  it("rejects stale Version, invalid target, and invalid stamp", async () => {
    fake.branch.version = 2;
    const stale = await placeCanonicalStamp(db, identity, canonicalInput);
    expect(stale).toMatchObject({ ok: false, code: "STALE_BRANCH_VERSION", branch_version: 2 });

    const invalidTarget = await placeCanonicalStamp(db, identity, {
      ...canonicalInput,
      request_id: "gate1-unit-request-002",
      expected_branch_version: 2,
      target_refs: ["district:NORTH_RIDGE"],
    });
    const invalidStamp = await placeCanonicalStamp(db, identity, {
      ...canonicalInput,
      request_id: "gate1-unit-request-003",
      expected_branch_version: 2,
      core_stamp_type_id: "STAMP_ALERT",
    });
    expect(invalidTarget).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(invalidStamp).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(fake.events).toHaveLength(0);
    expect(fake.stamps).toHaveLength(0);
  });

  it("requires the exact Planner account, Seat, role, and active Branch", async () => {
    const mismatches = [
      { ...identity, accountId: "OTHER-CITY" },
      { ...identity, seatId: "SENTINEL-01" },
      { ...identity, role: "SENTINEL" as const },
      { ...identity, branchId: "BRANCH-OTHER" },
    ];

    for (const mismatchedIdentity of mismatches) {
      const result = await placeCanonicalStamp(db, mismatchedIdentity, canonicalInput);
      expect(result).toMatchObject({ ok: false, code: "FORBIDDEN_SEAT" });
    }
    expect(fake.events).toHaveLength(0);
    expect(fake.stamps).toHaveLength(0);
  });

  it("rejects unauthenticated requests and has no Dispatcher seed", async () => {
    const anonymous = await authenticateRequest(db, new Request("https://example.test/api/session"));
    expect(anonymous).toBeNull();
    expect(SEEDED_SEAT_IDS).toEqual(["OWNER", "SENTINEL-01", "PLANNER-01"]);
    expect(SEEDED_SEAT_IDS).not.toContain("DISPATCHER-01");
  });

  it("accepts a valid disposable login and rejects the wrong password", async () => {
    const salt = "00112233445566778899aabbccddeeff";
    const password = "unit-correct-password";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const hash = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: Buffer.from(salt, "hex"), iterations: 120_000 },
      key,
      256,
    );
    fake.seat = {
      seat_id: "PLANNER-01",
      account_id: ACCOUNT_ID,
      role: "PLANNER",
      active_branch_id: BRANCH_ID,
      password_salt: salt,
      password_hash: Buffer.from(hash).toString("hex"),
      enabled: 1,
    };

    const accepted = await createSession(db, {
      account_id: ACCOUNT_ID,
      seat_id: "PLANNER-01",
      seat_password: password,
    });
    const rejected = await createSession(db, {
      account_id: ACCOUNT_ID,
      seat_id: "PLANNER-01",
      seat_password: "unit-wrong-password",
    });
    expect(accepted?.identity).toEqual(identity);
    expect(accepted?.token).toMatch(/^[0-9a-f]{64}$/);
    expect(rejected).toBeNull();

    const authenticated = await authenticateRequest(db, new Request("https://example.test/api/session", {
      headers: { cookie: `${SESSION_COOKIE}=${accepted?.token}` },
    }));
    expect(authenticated).toEqual(identity);
  });

  it("does not expose secrets in read or write results", async () => {
    const read = await readCityContext(db, identity);
    const write = await placeCanonicalStamp(db, identity, canonicalInput);
    const serialized = JSON.stringify({ read, write });
    expect(serialized).not.toMatch(/password|token_hash|session|salt/i);
  });
});
