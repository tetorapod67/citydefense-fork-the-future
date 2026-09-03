/// <reference types="webmcp-types" />
"use client";

/* eslint-disable @next/next/no-img-element -- Vinext rewrites fixed-width Next images through an optimizer that rejects these proof UI widths. Direct same-origin P0 assets are intentional. */
import { Database, LogOut, RadioTower, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type SiteToolStatus = "UNAVAILABLE" | "REGISTERING" | "READY" | "ERROR";

type Session = {
  ok: true;
  account_id: string;
  seat_id: string;
  role: "OWNER" | "SENTINEL" | "PLANNER";
  branch_id: string;
};

type Activity = {
  event_id: string;
  stamp_id: string;
  branch_version: number;
  actor_seat_id: string;
  origin: string;
  stamp_type: string;
  target_ref: string;
  scope: string;
  created_at: string;
};

type CityContext = {
  ok: true;
  tool: "get_city_context";
  branch_id: string;
  branch_version: number;
  simulation_tick: number;
  month: number;
  data: {
    seat_id: string;
    role: string;
    persistence: "SERVER_BACKED_D1";
    focus: {
      ref: "district:CENTRAL_WARD";
      source_district_id: "CENTRAL";
      stamp_count: number;
      latest_stamp_id: string | null;
      latest_event_id: string | null;
    };
    activity: Activity[];
  };
};

type ToolOutput = CityContext | {
  ok: boolean;
  tool: string;
  branch_version?: number;
  event_id?: string;
  idempotent_replay?: boolean;
  code?: string;
  message?: string;
  data?: { stamp_id?: string };
};

const GET_CITY_CONTEXT_SCHEMA = {
  type: "object",
  properties: {
    detail: { type: "string", enum: ["SUMMARY", "OPERATIONAL", "FULL_VISIBLE"] },
    include_unresolved_stamps: { type: "boolean" },
    include_assigned_units: { type: "boolean" },
  },
  required: ["detail"],
  additionalProperties: false,
} as const;

const PLACE_STAMP_SCHEMA = {
  type: "object",
  properties: {
    request_id: { type: "string", minLength: 12, maxLength: 120 },
    expected_branch_version: { type: "integer", minimum: 0 },
    core_stamp_type_id: { type: "string", minLength: 3, maxLength: 120 },
    modifier_stamp_type_ids: {
      type: "array",
      maxItems: 3,
      uniqueItems: true,
      items: { type: "string", minLength: 3, maxLength: 120 },
    },
    target_refs: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      uniqueItems: true,
      items: { type: "string", minLength: 3, maxLength: 160 },
    },
    scope: { type: "string", enum: ["BRANCH_PUBLIC", "SEAT_PRIVATE"] },
    urgency: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"] },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    reply_to_stamp_id: { type: "string", maxLength: 120 },
    expires_after_ticks: { type: "integer", minimum: 0, maximum: 200 },
  },
  required: [
    "request_id",
    "expected_branch_version",
    "core_stamp_type_id",
    "target_refs",
    "scope",
  ],
  additionalProperties: false,
} as const;

export function CityDefenseClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<CityContext | null>(null);
  const [siteToolsStatus, setSiteToolsStatus] = useState<SiteToolStatus>("UNAVAILABLE");
  const [lastSynchronized, setLastSynchronized] = useState<string | null>(null);
  const [lastToolCall, setLastToolCall] = useState<{ name: string; ok: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshing = useRef(false);

  const refreshContext = useCallback(async (identity: Session) => {
    if (refreshing.current) return null;
    refreshing.current = true;
    try {
      const result = await fetchJson<CityContext>(
        `/api/branches/${encodeURIComponent(identity.branch_id)}/context?detail=OPERATIONAL&include_unresolved_stamps=true&include_assigned_units=false`,
      );
      if (!result.ok) throw new Error("Context read failed");
      setContext(result);
      setLastSynchronized(new Date().toISOString());
      setLoadError(null);
      return result;
    } catch {
      setLoadError("Live city state could not be synchronized.");
      return null;
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/session", {
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }
        const identity = await response.json() as Session;
        if (!response.ok || !identity.ok) throw new Error("Session unavailable");
        if (!cancelled) {
          setSession(identity);
          await refreshContext(identity);
        }
      } catch {
        if (!cancelled) setLoadError("The authenticated Seat could not be loaded.");
      }
    })();
    return () => { cancelled = true; };
  }, [refreshContext]);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => { void refreshContext(session); }, 2_000);
    return () => window.clearInterval(interval);
  }, [refreshContext, session]);

  useEffect(() => {
    if (!session) return;
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") {
      return;
    }

    const registration = new AbortController();
    queueMicrotask(() => setSiteToolsStatus("REGISTERING"));
    const [readTool, writeTool] = createGate1Tools(session.branch_id, async (name, result) => {
      setLastToolCall({ name, ok: result.ok });
      await refreshContext(session);
    });

    void (async () => {
      try {
        await modelContext.registerTool(readTool, { signal: registration.signal });
        await modelContext.registerTool(writeTool, { signal: registration.signal });
        if (!registration.signal.aborted) setSiteToolsStatus("READY");
      } catch {
        registration.abort();
        setSiteToolsStatus("ERROR");
      }
    })();

    return () => registration.abort();
  }, [refreshContext, session]);

  async function logout() {
    await fetch("/api/session/logout", { method: "POST", credentials: "same-origin" });
    window.location.assign("/login");
  }

  if (!session || !context) {
    return (
      <main className="loading-shell">
        <span className="brand-mark" aria-hidden="true">CD</span>
        <p>{loadError ?? "Synchronizing the active Branch…"}</p>
      </main>
    );
  }

  const focus = context.data.focus;
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup compact">
          <span className="brand-mark" aria-hidden="true">CD</span>
          <div>
            <h1>CityDefense: Fork the Future</h1>
            <p>Live coordination surface</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => void refreshContext(session)} type="button">
            <RefreshCw aria-hidden="true" size={17} />
            Refresh
          </button>
          <button className="icon-button" onClick={() => void logout()} type="button">
            <LogOut aria-hidden="true" size={17} />
            Logout
          </button>
        </div>
      </header>

      <section className="command-strip" aria-label="Authenticated runtime">
        <div>
          <span>Account / Seat / Role</span>
          <strong>{session.account_id} · {session.seat_id} · {session.role}</strong>
        </div>
        <div>
          <span>Active Branch</span>
          <strong>{context.branch_id}</strong>
        </div>
        <div>
          <span>Branch Version</span>
          <strong data-testid="branch-version">v{context.branch_version}</strong>
        </div>
        <div>
          <span>Site Tools</span>
          <strong className={`status-value status-${siteToolsStatus.toLowerCase()}`} data-testid="site-tools-status">
            <RadioTower aria-hidden="true" size={15} /> {siteToolsStatus}
          </strong>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="city-stage" aria-labelledby="central-ward-title">
          <div className="section-heading">
            <div>
              <p>Operational focus</p>
              <h2 id="central-ward-title">Central Ward</h2>
            </div>
            <code>{focus.ref}</code>
          </div>

          <div className="city-map" role="img" aria-label={`Central Ward with ${focus.stamp_count} confirmation stamps`}>
            <div className="map-grid" aria-hidden="true" />
            <img className="map-asset asset-office" src="/assets/p0/buildings/com_market_hall.png" alt="Commercial market hall" width={128} height={128} />
            <img className="map-asset asset-civic" src="/assets/p0/buildings/civ_town_hall.png" alt="Civic town hall" width={128} height={128} />
            <img className="map-asset asset-road" src="/assets/p0/map/road_one_lane_local__m1111_nesw.png" alt="Central road junction" width={128} height={96} />
            <img className="map-asset asset-tower" src="/assets/p0/buildings/def_sensor_mast.png" alt="Defense sensor tower" width={128} height={128} />
            <div className="district-label">
              <span>Central Ward</span>
              <small>Source district: CENTRAL</small>
            </div>
            {focus.stamp_count > 0 ? (
              <div className="stamp-marker" data-testid="stamp-marker">
                <img src="/assets/p0/signals/stamp_confirm.png" alt="Confirmation stamp" width={44} height={44} />
                <span>STAMP_CONFIRM</span>
              </div>
            ) : (
              <div className="empty-marker" data-testid="empty-marker">
                Awaiting a public confirmation stamp
              </div>
            )}
          </div>

          <div className="metric-row">
            <Metric label="Stamp count" value={String(focus.stamp_count)} testId="stamp-count" />
            <Metric label="Latest Stamp ID" value={focus.latest_stamp_id ?? "—"} testId="latest-stamp-id" />
            <Metric label="Latest Event ID" value={focus.latest_event_id ?? "—"} testId="latest-event-id" />
          </div>
        </section>

        <aside className="activity-panel" aria-labelledby="activity-title">
          <div className="section-heading">
            <div>
              <p>Branch history</p>
              <h2 id="activity-title">Activity Feed</h2>
            </div>
            <span className="feed-count">{context.data.activity.length}</span>
          </div>
          <div className="activity-list" data-testid="activity-feed">
            {context.data.activity.length === 0 ? (
              <div className="empty-feed">
                <ShieldCheck aria-hidden="true" size={24} />
                <p>No public stamp events yet.</p>
                <span>The first WebMCP write will appear here.</span>
              </div>
            ) : context.data.activity.map((activity) => (
              <article className="activity-item" key={activity.event_id}>
                <div className="activity-icon">
                  <img src="/assets/p0/signals/stamp_confirm.png" alt="" width={28} height={28} />
                </div>
                <div>
                  <div className="activity-title-row">
                    <strong>{activity.stamp_type}</strong>
                    <span>v{activity.branch_version}</span>
                  </div>
                  <p>{activity.actor_seat_id} confirmed Central Ward.</p>
                  <dl>
                    <div><dt>Event</dt><dd>{activity.event_id}</dd></div>
                    <div><dt>Stamp</dt><dd>{activity.stamp_id}</dd></div>
                  </dl>
                  <small>{formatJst(activity.created_at)} · {activity.origin}</small>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <footer className="statusbar">
        <span><Database aria-hidden="true" size={15} /> Persistence: <strong>SERVER_BACKED_D1</strong></span>
        <span>Last synchronized: <strong>{lastSynchronized ? formatJst(lastSynchronized) : "—"}</strong></span>
        <span>Last Site Tool: <strong>{lastToolCall ? `${lastToolCall.name} · ${lastToolCall.ok ? "OK" : "ERROR"}` : "none"}</strong></span>
        {loadError ? <span className="sync-error" role="alert">{loadError}</span> : null}
      </footer>
    </main>
  );
}

function Metric({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong data-testid={testId} title={value}>{value}</strong>
    </div>
  );
}

function createGate1Tools(
  branchId: string,
  onResult: (name: string, result: ToolOutput) => Promise<void>,
): [WebMCP.ModelContextToolFromSchema<typeof GET_CITY_CONTEXT_SCHEMA>, WebMCP.ModelContextToolFromSchema<typeof PLACE_STAMP_SCHEMA>] {
  return [
    {
      name: "get_city_context",
      title: "Read City Context",
      description: "Read the authenticated Seat, active Branch Version, Central Ward stamp state, and recent public activity. Does not change state.",
      inputSchema: GET_CITY_CONTEXT_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input, options) => {
        const query = new URLSearchParams({ detail: input.detail });
        if (input.include_unresolved_stamps !== undefined) {
          query.set("include_unresolved_stamps", String(input.include_unresolved_stamps));
        }
        if (input.include_assigned_units !== undefined) {
          query.set("include_assigned_units", String(input.include_assigned_units));
        }
        const result = await fetchJson<ToolOutput>(
          `/api/branches/${encodeURIComponent(branchId)}/context?${query.toString()}`,
          { signal: options.signal },
        );
        await onResult("get_city_context", result);
        return result;
      },
    },
    {
      name: "place_stamp_bundle",
      title: "Place Canonical Stamp",
      description: "Write exactly one canonical public STAMP_CONFIRM to district:CENTRAL_WARD using request idempotency and the expected Branch Version. Other targets and stamp types are rejected.",
      inputSchema: PLACE_STAMP_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input, options) => {
        const result = await fetchJson<ToolOutput>(
          `/api/branches/${encodeURIComponent(branchId)}/commands/place-stamp-bundle`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal: options.signal,
          },
        );
        await onResult("place_stamp_bundle", result);
        return result;
      },
    },
  ];
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: { accept: "application/json", ...init?.headers },
  });
  const result = await response.json() as T;
  return result;
}

function formatJst(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
